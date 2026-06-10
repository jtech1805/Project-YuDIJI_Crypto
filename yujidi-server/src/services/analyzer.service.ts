import pino from "pino";

import { AlertModel, type Alert } from "../models/Alert.js";
import { TripwireConfigModel } from "../models/TripwireConfig.js";
import {
  createMonitorCacheSnapshot,
  evaluateMonitorThreshold,
  MONITOR_CACHE_TTL_MS,
} from "./analyzer.rules.js";
import { sharedLlmService } from "./llm.service.js";
import { fetchRecentHeadlines } from "./news.service.js";

const logger = pino({ name: "analyzer-engine" });

export interface PriceTick {
  price: number;
  timestamp: number;
}
export interface CvdTrade {
  volumeDelta: number;
  timestamp: number;
}
interface AlertEmitterPayload {
  type: "NEW_ALERT";
  payload: Alert;
}

type AlertEmitter = (userId: string, payload: AlertEmitterPayload) => void;

const MAX_BUFFER_WINDOW_MS = 60 * 60 * 1000;
const COOLDOWN_MS = 15 * 60 * 1000;
const CVD_BUFFER_WINDOW_MS = 60 * 1000;
const WHALE_THRESHOLD_BTC = 0.1; // Filter out retail noise
type ActiveMonitorDocument = Awaited<ReturnType<typeof TripwireConfigModel.find>>[number];
type ActiveMonitorCacheEntry = {
  monitors: ActiveMonitorDocument[];
  expiresAt: number;
  loadedAt: number;
};
type AnalyzerAlertDocument = {
  _id: { toString(): string };
  toObject(): Alert;
};
type AnalyzerLlmService = Pick<typeof sharedLlmService, "generateAlertReport">;
type AnalyzerDependencies = {
  llmService: AnalyzerLlmService;
  fetchRecentHeadlines: (symbol: string) => Promise<string>;
  findActiveMonitors: (symbol: string) => Promise<ActiveMonitorDocument[]>;
  createAlert: (payload: Record<string, unknown>) => Promise<AnalyzerAlertDocument>;
};

const defaultAnalyzerDependencies: AnalyzerDependencies = {
  llmService: sharedLlmService,
  fetchRecentHeadlines,
  findActiveMonitors: async (symbol: string): Promise<ActiveMonitorDocument[]> => {
    return TripwireConfigModel.find({
      symbol,
      isActive: true,
    }).exec();
  },
  createAlert: async (payload: Record<string, unknown>): Promise<AnalyzerAlertDocument> => {
    return AlertModel.create(payload) as Promise<AnalyzerAlertDocument>;
  },
};

export class AnalyzerEngine {
  private readonly llmService: AnalyzerLlmService;
  private readonly emitAlert: AlertEmitter;
  private readonly dependencies: AnalyzerDependencies;

  public readonly priceBuffer: Map<string, PriceTick[]>;
  public readonly cooldowns: Map<string, number>;
  // NEW: CVD State Maps
  public readonly cvdBuffer: Map<string, CvdTrade[]>;
  public readonly currentCVD: Map<string, number>; // O(1) lookup for running total
  // 1. ADD THE ORDER BOOK PROPERTY HERE
  public readonly orderBookSnapshot: Map<string, { bids: string[][], asks: string[][] }>;
  private readonly activeMonitorCache: Map<string, ActiveMonitorCacheEntry>;

  public constructor(emitAlert: AlertEmitter, dependencies: Partial<AnalyzerDependencies> = {}) {
    this.emitAlert = emitAlert;
    this.dependencies = { ...defaultAnalyzerDependencies, ...dependencies };
    this.llmService = this.dependencies.llmService;
    this.priceBuffer = new Map<string, PriceTick[]>();
    this.cooldowns = new Map<string, number>();
    // NEW: Initialize CVD maps
    this.cvdBuffer = new Map<string, CvdTrade[]>();
    this.currentCVD = new Map<string, number>();
    // 2. INITIALIZE IT IN THE CONSTRUCTOR HERE
    this.orderBookSnapshot = new Map<string, { bids: string[][], asks: string[][] }>();
    this.activeMonitorCache = new Map<string, ActiveMonitorCacheEntry>();
  }
  public updateOrderBook(symbol: string, bids: string[][], asks: string[][]): void {
    // This overwrites the old snapshot with the newest one every 100ms
    this.orderBookSnapshot.set(symbol, { bids, asks });
  }

  public invalidateMonitorCache(rawSymbol?: string): void {
    if (!rawSymbol) {
      const invalidatedSymbols = Array.from(this.activeMonitorCache.keys());
      this.activeMonitorCache.clear();
      logger.info(
        {
          event: "ANALYZER_MONITOR_CACHE_INVALIDATED",
          scope: "all",
          invalidatedSymbols,
        },
        "Invalidated analyzer monitor cache",
      );
      return;
    }

    const symbol = rawSymbol.toUpperCase().trim();
    const existed = this.activeMonitorCache.delete(symbol);
    logger.info(
      {
        event: "ANALYZER_MONITOR_CACHE_INVALIDATED",
        scope: "symbol",
        symbol,
        existed,
      },
      "Invalidated analyzer monitor cache for symbol",
    );
  }

  public async refreshMonitorCache(rawSymbol: string, reason = "mutation"): Promise<ActiveMonitorDocument[]> {
    const symbol = rawSymbol.toUpperCase().trim();
    logger.info(
      {
        event: "ANALYZER_MONITOR_CACHE_REFRESH_REQUESTED",
        symbol,
        reason,
      },
      "Refreshing analyzer monitor cache on demand",
    );

    return this.loadActiveMonitorCache(symbol, reason);
  }

  private async loadActiveMonitorCache(symbol: string, reason: string): Promise<ActiveMonitorDocument[]> {
    const now = Date.now();

    // logger.info(
    //   {
    //     event: "ANALYZER_MONITOR_CACHE_REFRESH",
    //     symbol,
    //     reason,
    //     previousActiveMonitorCount: this.activeMonitorCache.get(symbol)?.monitors.length ?? 0,
    //   },
    //   "Refreshing active monitor cache from MongoDB",
    // );

    const monitors = await this.dependencies.findActiveMonitors(symbol);

    this.activeMonitorCache.set(symbol, {
      monitors,
      loadedAt: now,
      expiresAt: now + MONITOR_CACHE_TTL_MS,
    });

    // logger.info(
    //   {
    //     event: "ANALYZER_MONITOR_CACHE_REFRESHED",
    //     symbol,
    //     activeMonitorCount: monitors.length,
    //     isNegativeCache: monitors.length === 0,
    //     ttlMs: MONITOR_CACHE_TTL_MS,
    //   },
    //   "Refreshed active monitor cache from MongoDB",
    // );

    return monitors;
  }

  private async getActiveMonitorsForSymbol(symbol: string): Promise<ActiveMonitorDocument[]> {
    const now = Date.now();
    const cached = this.activeMonitorCache.get(symbol);

    if (cached && cached.expiresAt > now) {
      logger.debug(
        {
          event: "ANALYZER_MONITOR_CACHE_HIT",
          symbol,
          activeMonitorCount: cached.monitors.length,
          isNegativeCache: cached.monitors.length === 0,
          ttlRemainingMs: cached.expiresAt - now,
        },
        "Using cached active monitors",
      );
      return cached.monitors;
    }

    return this.loadActiveMonitorCache(symbol, cached ? "expired" : "miss");
  }

  // public findHeavySupportResistance(symbol: string) {
  //   const book = this.orderBookSnapshot.get(symbol);

  //   if (!book) {
  //     return { support: "Unknown", resistance: "Unknown" };
  //   }

  //   // Find heaviest Support (Bids)
  //   let maxBidVol = 0;
  //   let supportPrice = "0";
  //   for (const entry of book.bids) {
  //     const price = entry[0];
  //     const qty = entry[1];

  //     // 🛑 The Bouncer: Skip if Binance sent a malformed array row
  //     if (!price || !qty) continue;

  //     if (parseFloat(qty) > maxBidVol) {
  //       maxBidVol = parseFloat(qty);
  //       supportPrice = price; // ✅ TypeScript now knows this is strictly a string
  //     }
  //   }

  //   // Find heaviest Resistance (Asks)
  //   let maxAskVol = 0;
  //   let resistancePrice = "0";
  //   for (const entry of book.asks) {
  //     const price = entry[0];
  //     const qty = entry[1];

  //     // 🛑 The Bouncer: Skip if Binance sent a malformed array row
  //     if (!price || !qty) continue;

  //     if (parseFloat(qty) > maxAskVol) {
  //       maxAskVol = parseFloat(qty);
  //       resistancePrice = price; // ✅ TypeScript now knows this is strictly a string
  //     }
  //   }

  //   return {
  //     support: `$${parseFloat(supportPrice).toLocaleString()} (${maxBidVol} coins)`,
  //     resistance: `$${parseFloat(resistancePrice).toLocaleString()} (${maxAskVol} coins)`
  //   };
  // }
  // public findStructuralSupportResistance(symbol: string) {
  //   const book = this.orderBookSnapshot.get(symbol);

  //   // Added extra safety checks for the bids/asks arrays
  //   if (!book || !book.bids || !book.asks || !book.bids.length || !book.asks.length) {
  //     return { currentPrice: "Unknown", support: "Unknown", resistance: "Unknown" };
  //   }

  //   // 1. Safe access for the spread baseline using optional chaining (?.)
  //   const topBidStr = book.bids[0]?.[0];
  //   const topAskStr = book.asks[0]?.[0];
  //   console.log(topBidStr, topAskStr)
  //   if (!topBidStr || !topAskStr) {
  //     return { currentPrice: "Unknown", support: "Unknown", resistance: "Unknown" };
  //   }

  //   const topBid = parseFloat(topBidStr);
  //   const topAsk = parseFloat(topAskStr);
  //   const currentPrice = (topBid + topAsk) / 2;

  //   // 2. Define Engine Parameters
  //   const MIN_DISTANCE_PERCENT = 0.008;
  //   const WHALE_THRESHOLD_VOL = 0;

  //   const minValidAskPrice = currentPrice * (1 + MIN_DISTANCE_PERCENT);
  //   const maxValidBidPrice = currentPrice * (1 - MIN_DISTANCE_PERCENT);

  //   // 3. Find Structural Support
  //   let structuralSupportPrice: string = "0";
  //   let supportVol: number = 0;

  //   for (const entry of book.bids) {
  //     // A. Extract raw values first
  //     const priceStr = entry[0];
  //     const qtyStr = entry[1];

  //     // B. STRICT TS BOUNCER: If Binance sends a malformed row, skip it
  //     if (priceStr === undefined || qtyStr === undefined) continue;

  //     // C. Now that TS knows they are strings, it is safe to parse
  //     const price = parseFloat(priceStr);
  //     const qty = parseFloat(qtyStr);

  //     if (isNaN(price) || isNaN(qty)) continue;
  //     console.log(qty, supportVol, price, maxValidBidPrice, 'quantity and supportvol')
  //     // Distance Filter
  //     // if (price > maxValidBidPrice) continue;
  //     // Whale Threshold Filter
  //     if (qty > supportVol && qty >= WHALE_THRESHOLD_VOL) {
  //       supportVol = qty;
  //       structuralSupportPrice = priceStr; // ✅ TS knows this is safely a string now
  //     }
  //   }

  //   // 4. Find Structural Resistance
  //   let structuralResistancePrice: string = "0";
  //   let resistanceVol: number = 0;

  //   for (const entry of book.asks) {
  //     const priceStr = entry[0];
  //     const qtyStr = entry[1];

  //     if (priceStr === undefined || qtyStr === undefined) continue;

  //     const price = parseFloat(priceStr);
  //     const qty = parseFloat(qtyStr);

  //     if (isNaN(price) || isNaN(qty)) continue;

  //     // Distance Filter
  //     console.log(qty, resistanceVol, price, minValidAskPrice, 'quantity and resistanceVol')
  //     // if (price < minValidAskPrice) continue;
  //     // Whale Threshold Filter
  //     if (qty > resistanceVol && qty >= WHALE_THRESHOLD_VOL) {
  //       resistanceVol = qty;
  //       structuralResistancePrice = priceStr; // ✅ TS knows this is safely a string now
  //     }
  //   }

  //   // 5. Final Formatting
  //   const finalSupport = supportVol > 0
  //     ? `$${parseFloat(structuralSupportPrice).toLocaleString()} (${supportVol} coins)`
  //     : "No strong support found";

  //   const finalResistance = resistanceVol > 0
  //     ? `$${parseFloat(structuralResistancePrice).toLocaleString()} (${resistanceVol} coins)`
  //     : "No strong resistance found";

  //   return {
  //     currentPrice: `$${currentPrice.toLocaleString()}`,
  //     support: finalSupport,
  //     resistance: finalResistance
  //   };
  // }
  public findStructuralSupportResistance(symbol: string) {
    const book = this.orderBookSnapshot.get(symbol);

    if (!book || !book.bids || !book.asks || !book.bids.length || !book.asks.length) {
      return { currentPrice: "Unknown", support: "Unknown", resistance: "Unknown" };
    }

    // 1. Safe access for the spread baseline
    const topBidStr = book.bids[0]?.[0];
    const topAskStr = book.asks[0]?.[0];

    if (!topBidStr || !topAskStr) {
      return { currentPrice: "Unknown", support: "Unknown", resistance: "Unknown" };
    }

    const topBid = parseFloat(topBidStr);
    const topAsk = parseFloat(topAskStr);
    const currentPrice = (topBid + topAsk) / 2;

    // // ==========================================
    // // 2. THE RELATIVE MATH (DYNAMIC AVERAGES)
    // // ==========================================

    // // Calculate Average Bid Size
    // let totalBidVolume = 0;
    // let validBidLevels = 0;
    // for (const entry of book.bids) {
    //   const qty = parseFloat(entry[1] ?? "0");
    //   if (!isNaN(qty)) {
    //     totalBidVolume += qty;
    //     validBidLevels++;
    //   }
    // }
    // const avgBidVolume = validBidLevels > 0 ? (totalBidVolume / validBidLevels) : 0;

    // // Calculate Average Ask Size
    // let totalAskVolume = 0;
    // let validAskLevels = 0;
    // for (const entry of book.asks) {
    //   const qty = parseFloat(entry[1] ?? "0");
    //   if (!isNaN(qty)) {
    //     totalAskVolume += qty;
    //     validAskLevels++;
    //   }
    // }
    // const avgAskVolume = validAskLevels > 0 ? (totalAskVolume / validAskLevels) : 0;
    // ==========================================
    // 2. THE RELATIVE MATH (DYNAMIC AVERAGES)
    // ==========================================
    const IGNORE_TOP_N_LEVELSDavg = 3;

    // Calculate Average Bid Size (IGNORING THE NOISE)
    let totalBidVolume = 0;
    let validBidLevels = 0;
    let bidCalcLevel = 0;

    for (const entry of book.bids) {
      bidCalcLevel++;
      // 🔥 Skip the massive spoof orders so they don't skew the average!
      if (bidCalcLevel <= IGNORE_TOP_N_LEVELSDavg) continue;

      const qty = parseFloat(entry[1] ?? "0");
      if (!isNaN(qty)) {
        totalBidVolume += qty;
        validBidLevels++;
      }
    }
    const avgBidVolume = validBidLevels > 0 ? (totalBidVolume / validBidLevels) : 0;

    // Calculate Average Ask Size (IGNORING THE NOISE)
    let totalAskVolume = 0;
    let validAskLevels = 0;
    let askCalcLevel = 0;

    for (const entry of book.asks) {
      askCalcLevel++;
      // 🔥 Skip the massive spoof orders so they don't skew the average!
      if (askCalcLevel <= IGNORE_TOP_N_LEVELSDavg) continue;

      const qty = parseFloat(entry[1] ?? "0");
      if (!isNaN(qty)) {
        totalAskVolume += qty;
        validAskLevels++;
      }
    }
    const avgAskVolume = validAskLevels > 0 ? (totalAskVolume / validAskLevels) : 0;

    // // ==========================================
    // // 3. DEFINE ENGINE PARAMETERS
    // // ==========================================

    // const MIN_DISTANCE_PERCENT = 0.0002; // 0.5% away from price (Mandatory Noise Filter)
    // const WALL_MULTIPLIER = 2.5;        // A true wall must be 3.5x larger than the average

    // const minValidAskPrice = currentPrice * (1 + MIN_DISTANCE_PERCENT);
    // const maxValidBidPrice = currentPrice * (1 - MIN_DISTANCE_PERCENT);

    // // THESE ARE YOUR NEW RELATIVE THRESHOLDS
    // const dynamicBidThreshold = avgBidVolume * WALL_MULTIPLIER;
    // const dynamicAskThreshold = avgAskVolume * WALL_MULTIPLIER;

    // // ==========================================
    // // 4. FIND STRUCTURAL SUPPORT
    // // ==========================================
    // let structuralSupportPrice: string = "0";
    // let supportVol: number = 0;

    // for (const entry of book.bids) {
    //   const priceStr = entry[0];
    //   const qtyStr = entry[1];

    //   if (priceStr === undefined || qtyStr === undefined) continue;

    //   const price = parseFloat(priceStr);
    //   const qty = parseFloat(qtyStr);

    //   if (isNaN(price) || isNaN(qty)) continue;

    //   // The Bouncer: Skip HFT bots sitting right on the spread
    //   if (price > maxValidBidPrice) continue;

    //   // Whale Filter: Only accept if it beats our DYNAMIC threshold
    //   if (qty > supportVol && qty >= dynamicBidThreshold) {
    //     supportVol = qty;
    //     structuralSupportPrice = priceStr;
    //   }
    // }

    // // ==========================================
    // // 5. FIND STRUCTURAL RESISTANCE
    // // ==========================================
    // let structuralResistancePrice: string = "0";
    // let resistanceVol: number = 0;

    // for (const entry of book.asks) {
    //   const priceStr = entry[0];
    //   const qtyStr = entry[1];

    //   if (priceStr === undefined || qtyStr === undefined) continue;

    //   const price = parseFloat(priceStr);
    //   const qty = parseFloat(qtyStr);

    //   if (isNaN(price) || isNaN(qty)) continue;

    //   // The Bouncer: Skip HFT bots sitting right on the spread
    //   if (price < minValidAskPrice) continue;

    //   // Whale Filter: Only accept if it beats our DYNAMIC threshold
    //   if (qty > resistanceVol && qty >= dynamicAskThreshold) {
    //     resistanceVol = qty;
    //     structuralResistancePrice = priceStr;
    //   }
    // }
    // ==========================================
    // 3. DEFINE SCALPING ENGINE PARAMETERS
    // ==========================================

    // 🔥 NEW: Instead of percentages, we just skip the first 3 levels (the spread/spoof zone)
    const IGNORE_TOP_N_LEVELS = 3;
    const WALL_MULTIPLIER = 2.5;

    const dynamicBidThreshold = avgBidVolume * WALL_MULTIPLIER;
    const dynamicAskThreshold = avgAskVolume * WALL_MULTIPLIER;

    // ==========================================
    // 4. FIND STRUCTURAL SUPPORT
    // ==========================================
    let structuralSupportPrice: string = "0";
    let supportVol: number = 0;
    let currentBidLevel = 0;

    for (const entry of book.bids) {
      currentBidLevel++;

      const priceStr = entry[0];
      const qtyStr = entry[1];
      if (priceStr === undefined || qtyStr === undefined) continue;

      const price = parseFloat(priceStr);
      const qty = parseFloat(qtyStr);
      if (isNaN(price) || isNaN(qty)) continue;

      // 🔥 THE BOUNCER: Skip the first 3 levels, no matter the price!
      if (currentBidLevel <= IGNORE_TOP_N_LEVELS) continue;

      if (qty > supportVol && qty >= dynamicBidThreshold) {
        supportVol = qty;
        structuralSupportPrice = priceStr;
      }
    }

    // ==========================================
    // 5. FIND STRUCTURAL RESISTANCE
    // ==========================================
    let structuralResistancePrice: string = "0";
    let resistanceVol: number = 0;
    let currentAskLevel = 0;

    for (const entry of book.asks) {
      currentAskLevel++;

      const priceStr = entry[0];
      const qtyStr = entry[1];
      if (priceStr === undefined || qtyStr === undefined) continue;

      const price = parseFloat(priceStr);
      const qty = parseFloat(qtyStr);
      if (isNaN(price) || isNaN(qty)) continue;

      // 🔥 THE BOUNCER: Skip the first 3 levels!
      if (currentAskLevel <= IGNORE_TOP_N_LEVELS) continue;

      if (qty > resistanceVol && qty >= dynamicAskThreshold) {
        resistanceVol = qty;
        structuralResistancePrice = priceStr;
      }
    }

    // ==========================================
    // 6. FINAL FORMATTING
    // ==========================================
    const finalSupport = supportVol > 0
      ? `$${parseFloat(structuralSupportPrice).toLocaleString()} (${supportVol.toFixed(2)} coins)`
      : "No strong support found";

    const finalResistance = resistanceVol > 0
      ? `$${parseFloat(structuralResistancePrice).toLocaleString()} (${resistanceVol.toFixed(2)} coins)`
      : "No strong resistance found";

    return {
      currentPrice: `$${currentPrice.toLocaleString()}`,
      support: finalSupport,
      resistance: finalResistance,
      rawCurrentPrice: currentPrice,
      rawSupport: parseFloat(structuralSupportPrice),
      rawResistance: parseFloat(structuralResistancePrice),
      // I included this so you can log and see exactly what the algorithm is calculating!
      debugData: {
        averageBid: avgBidVolume.toFixed(2),
        requiredBidWall: dynamicBidThreshold.toFixed(2),
        averageAsk: avgAskVolume.toFixed(2),
        requiredAskWall: dynamicAskThreshold.toFixed(2)
      }
    };
  }
  public async processTick(
    symbol: string,
    currentPrice: number,
    currentTimestamp: number,
    isbuyermaker: boolean,
    quantity: number
  ): Promise<void> {
    if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
      logger.warn(
        { event: "ANALYZER_TICK_REJECTED", symbol, currentPrice, currentTimestamp },
        "Rejected invalid tick payload",
      );
      return;
    }

    const normalizedSymbol = symbol.toUpperCase();
    // logger.info(
    //   {
    //     event: "ANALYZER_TICK_RECEIVED",
    //     symbol: normalizedSymbol,
    //     currentPrice,
    //     currentTimestamp,
    //     isbuyermaker,
    //     quantity
    //   },
    //   "Analyzer received price tick",
    // );

    const ticks = this.priceBuffer.get(normalizedSymbol) ?? [];
    const bufferSizeBeforePush = ticks.length;
    ticks.push({ price: currentPrice, timestamp: currentTimestamp });

    const cullBefore = currentTimestamp - MAX_BUFFER_WINDOW_MS;
    let culledCount = 0;
    while (ticks.length > 0) {
      const oldestTick = ticks[0];
      if (!oldestTick || oldestTick.timestamp >= cullBefore) {
        break;
      }
      ticks.shift();
      culledCount += 1;
    }
    this.priceBuffer.set(normalizedSymbol, ticks);
    // logger.info(
    //   {
    //     event: "ANALYZER_BUFFER_UPDATED",
    //     symbol: normalizedSymbol,
    //     bufferSizeBeforePush,
    //     bufferSizeAfterCull: ticks.length,
    //     culledCount,
    //     oldestTickTimestamp: ticks[0]?.timestamp ?? null,
    //     latestTickTimestamp: ticks[ticks.length - 1]?.timestamp ?? null,
    //   },
    //   "Updated in-memory rolling price buffer",
    // );
    // ==========================================
    // 🧠 CVD & WHALE FILTER ENGINE
    // ==========================================
    let runningCVD = this.currentCVD.get(normalizedSymbol) ?? 0;
    const cvdTrades = this.cvdBuffer.get(normalizedSymbol) ?? [];

    // // 1. The Whale Filter
    // if (quantity >= WHALE_THRESHOLD_BTC) {
    //   // 2. The Directional Math (m: true means seller, m: false means buyer)
    //   const volumeDelta = isbuyermaker ? -quantity : quantity;

    //   runningCVD += volumeDelta;
    //   cvdTrades.push({ volumeDelta, timestamp: currentTimestamp });
    // }
    // 1. FORCE THE QUANTITY TO BE A NUMBER
    const numericQuantity = parseFloat(quantity.toString());

    if (numericQuantity >= WHALE_THRESHOLD_BTC) {
      // 2. The Directional Math (using the forced number!)
      const volumeDelta = isbuyermaker ? -numericQuantity : numericQuantity;

      runningCVD += volumeDelta;
      cvdTrades.push({ volumeDelta, timestamp: currentTimestamp });
    }
    // 3. The 60-Second Sliding Window Cleanup
    const cvdCullBefore = currentTimestamp - CVD_BUFFER_WINDOW_MS;
    while (cvdTrades.length > 0) {
      const oldestCvdTrade = cvdTrades[0];
      if (!oldestCvdTrade || oldestCvdTrade.timestamp >= cvdCullBefore) {
        break;
      }
      // Deduct the expired trade from the running total
      runningCVD -= oldestCvdTrade.volumeDelta;
      cvdTrades.shift();
    }

    // 4. Save state
    this.cvdBuffer.set(normalizedSymbol, cvdTrades);
    this.currentCVD.set(normalizedSymbol, runningCVD);

    // logger.info(
    //   {
    //     event: "ANALYZER_CVD_UPDATED",
    //     symbol: normalizedSymbol,
    //     currentCVD: Number(runningCVD.toFixed(4)),
    //     activeWhaleTrades: cvdTrades.length
    //   },
    //   "Updated high-frequency CVD momentum"
    // );
    // ==========================================
    const activeMonitors = await this.getActiveMonitorsForSymbol(normalizedSymbol);
    // logger.info(
    //   {
    //     event: "ANALYZER_MONITORS_FETCHED",
    //     symbol: normalizedSymbol,
    //     activeMonitorCount: activeMonitors.length,
    //   },
    //   "Fetched active monitors for symbol",
    // );

    for (const monitor of activeMonitors) {
      const monitorId = monitor._id.toString();
      const lastTriggeredAt = this.cooldowns.get(monitorId) ?? 0;
      const cooldownRemainingMs = COOLDOWN_MS - (currentTimestamp - lastTriggeredAt);
      const isInCooldown = cooldownRemainingMs > 0;
      if (isInCooldown) {
        logger.info(
          {
            event: "ANALYZER_MONITOR_COOLDOWN",
            symbol: normalizedSymbol,
            monitorId,
            userId: monitor.user.toString(),
            lastTriggeredAt,
            cooldownRemainingMs,
          },
          "Skipped monitor due to cooldown window",
        );
        continue;
      }

      const windowStart = currentTimestamp - monitor.timeWindowMinutes * 60 * 1000;
      const baseTick = this.findBaseTick(ticks, windowStart);
      if (!baseTick) {
        // logger.info(
        //   {
        //     event: "ANALYZER_MONITOR_NO_BASE_TICK",
        //     symbol: normalizedSymbol,
        //     monitorId,
        //     userId: monitor.user.toString(),
        //     timeWindowMinutes: monitor.timeWindowMinutes,
        //     windowStart,
        //     availableTickCount: ticks.length,
        //   },
        //   "Insufficient historical data for monitor evaluation",
        // );
        continue;
      }

      const percentChange = ((currentPrice - baseTick.price) / baseTick.price) * 100;
      const {
        changePercentage,
        movementMagnitude,
        triggerType,
        direction,
        thresholdBreached,
      } = evaluateMonitorThreshold(percentChange, monitor.thresholdPercentage, monitor.trigger);

      if (!triggerType) {
        logger.warn(
          {
            event: "ANALYZER_MONITOR_INVALID_TRIGGER",
            symbol: normalizedSymbol,
            monitorId,
            userId: monitor.user.toString(),
            trigger: monitor.trigger,
          },
          "Skipped monitor with invalid trigger type",
        );
        continue;
      }
      // logger.info(
      //   {
      //     event: "ANALYZER_THRESHOLD_EVALUATED",
      //     symbol: normalizedSymbol,
      //     monitorId,
      //     userId: monitor.user.toString(),
      //     currentPrice,
      //     basePrice: baseTick.price,
      //     percentChange: Number(percentChange.toFixed(4)),
      //     absDropPercent,
      //     thresholdPercentage: monitor.thresholdPercentage,
      //     thresholdBreached,
      //     timeWindowMinutes: monitor.timeWindowMinutes,
      //     baseTickTimestamp: baseTick.timestamp,
      //     currentTimestamp,
      //   },
      //   "Computed threshold status for monitor",
      // );

      if (!thresholdBreached) {
        continue;
      }

      this.cooldowns.set(monitorId, currentTimestamp);
      logger.warn(
        {
          event: "ANALYZER_TRIGGER_BREACH",
          symbol: normalizedSymbol,
          monitorId,
          userId: monitor.user.toString(),
          triggerPrice: currentPrice,
          changePercentage,
          movementMagnitude,
          triggerType,
          direction,
          cooldownUntil: currentTimestamp + COOLDOWN_MS,
        },
        "Threshold breached; starting trigger pipeline",
      );

      try {
        logger.info(
          {
            event: "ANALYZER_NEWS_FETCH_START",
            symbol: normalizedSymbol,
            monitorId,
            userId: monitor.user.toString(),
          },
          "Calling news context service",
        );
        const newsContext = await this.dependencies.fetchRecentHeadlines(normalizedSymbol);
        logger.info(
          {
            event: "ANALYZER_NEWS_FETCH_SUCCESS",
            symbol: normalizedSymbol,
            monitorId,
            userId: monitor.user.toString(),
            newsLength: newsContext.length,
            hasFallback: newsContext === "No recent news available.",
          },
          "News context fetched",
        );

        logger.info(
          {
            event: "ANALYZER_LLM_REPORT_START",
            symbol: normalizedSymbol,
            monitorId,
            userId: monitor.user.toString(),
            changePercentage,
            movementMagnitude,
            triggerType,
            direction,
            timeWindowMinutes: monitor.timeWindowMinutes,
            currentCVD: runningCVD // Log the CVD
          },
          "Calling LLM report generation",
        );
        // 1. Grab the thickest walls from the Order Book snapshot
        const walls = this.findStructuralSupportResistance(normalizedSymbol);
        // const report = await this.llmService.generateAlertReport(
        //   normalizedSymbol,
        //   absDropPercent,
        //   monitor.timeWindowMinutes,
        //   newsContext,
        //   runningCVD // <-- New parameter for the RAG prompt
        // );
        // 2. Call the updated LLM Service
        const report = await this.llmService.generateAlertReport(
          normalizedSymbol,
          changePercentage,
          monitor.timeWindowMinutes,
          newsContext,
          runningCVD,
          walls.support,    // <-- Pass Support
          walls.resistance,  // <-- Pass Resistance
          triggerType,
          direction,
          currentPrice,
        );
        logger.info(
          {
            event: "ANALYZER_LLM_REPORT_SUCCESS",
            symbol: normalizedSymbol,
            monitorId,
            userId: monitor.user.toString(),
            // aiRootCauseLength: report.aiRootCause.length,
          },
          "LLM report generated successfully",
        );

        // const alertDocument = await AlertModel.create({
        //   user: monitor.user,
        //   symbol: normalizedSymbol,
        //   triggerPrice: currentPrice,
        //   dropPercentage: absDropPercent,
        //   aiRootCause: report.aiRootCause,
        //   sentiment: report.sentiment,
        //   createdAt: new Date(currentTimestamp),
        // });
        const alertDocument = await this.dependencies.createAlert({
          user: monitor.user,
          symbol: normalizedSymbol,
          triggerPrice: currentPrice,
          dropPercentage: movementMagnitude,
          changePercentage,
          triggerType,
          direction,

          // The AI Playbook
          catalyst: report.catalyst,
          threatLevel: report.threatLevel,
          support: report.support,
          resistance: report.resistance,
          summary: report.summary,

          // The Metrics
          cvdAtTrigger: runningCVD,

          createdAt: new Date(currentTimestamp),
        });
        logger.warn(
          {
            event: "ANALYZER_ALERT_SAVED",
            symbol: normalizedSymbol,
            monitorId,
            userId: monitor.user.toString(),
            alertId: alertDocument._id.toString(),
            // sentiment: report.sentiment,
          },
          "Persisted alert document to MongoDB",
        );

        this.emitAlert(monitor.user.toString(), {
          type: "NEW_ALERT",
          payload: alertDocument.toObject() as Alert,
        });
        logger.warn(
          {
            event: "ANALYZER_ALERT_EMITTED",
            symbol: normalizedSymbol,
            monitorId,
            userId: monitor.user.toString(),
            alertId: alertDocument._id.toString(),
          },
          "Emitted NEW_ALERT to subscribed user sockets",
        );
      } catch (error: unknown) {
        logger.error(
          {
            event: "ANALYZER_TRIGGER_PIPELINE_FAILED",
            error,
            symbol: normalizedSymbol,
            monitorId,
            userId: monitor.user.toString(),
          },
          "Analyzer failed to process trigger event",
        );
      }
    }
  }
  // ==========================================
  // 🐛 DIAGNOSTIC DEBUG METHOD
  // ==========================================
  public getEngineStateSnapshot() {
    return {
      // 1. The Running Totals (Easy to read)
      currentCVD: Object.fromEntries(this.currentCVD),
      cooldowns: Object.fromEntries(this.cooldowns),

      // 2. The Sliding Windows
      cvdBuffer: Object.fromEntries(this.cvdBuffer),
      priceBuffer: Object.fromEntries(this.priceBuffer),
      orderbook: Object.fromEntries(this.orderBookSnapshot),
      activeMonitorCache: Object.fromEntries(
        Array.from(this.activeMonitorCache.entries()).map(([symbol, cacheEntry]) => [
          symbol,
          createMonitorCacheSnapshot(cacheEntry),
        ])
      ),
      // 🧠 NEW: Dynamically calculate walls for every single coin we are tracking!
      supportResistance: Object.fromEntries(
        Array.from(this.orderBookSnapshot.keys()).map((symbol) => [
          symbol,
          this.findStructuralSupportResistance(symbol),
        ])
      ),
      // 3. Server Health
      system: {
        serverTime: new Date().toISOString(),
        memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
      }
    };
  }
  private findBaseTick(ticks: PriceTick[], windowStart: number): PriceTick | null {
    for (let index = ticks.length - 1; index >= 0; index -= 1) {
      const tick = ticks[index];
      if (!tick) {
        continue;
      }
      if (tick.timestamp <= windowStart) {
        return tick;
      }
    }

    return null;
  }
}
