import pino from "pino";

import { AlertModel, type Alert } from "../models/Alert.js";
import { TripwireConfigModel } from "../models/TripwireConfig.js";
import { LlmService } from "./llm.service.js";
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
export class AnalyzerEngine {
  private readonly llmService: LlmService;
  private readonly emitAlert: AlertEmitter;

  public readonly priceBuffer: Map<string, PriceTick[]>;
  public readonly cooldowns: Map<string, number>;
  // NEW: CVD State Maps
  public readonly cvdBuffer: Map<string, CvdTrade[]>;
  public readonly currentCVD: Map<string, number>; // O(1) lookup for running total
  // 1. ADD THE ORDER BOOK PROPERTY HERE
  public readonly orderBookSnapshot: Map<string, { bids: string[][], asks: string[][] }>;

  public constructor(emitAlert: AlertEmitter) {
    this.llmService = new LlmService();
    this.emitAlert = emitAlert;
    this.priceBuffer = new Map<string, PriceTick[]>();
    this.cooldowns = new Map<string, number>();
    // NEW: Initialize CVD maps
    this.cvdBuffer = new Map<string, CvdTrade[]>();
    this.currentCVD = new Map<string, number>();
    // 2. INITIALIZE IT IN THE CONSTRUCTOR HERE
    this.orderBookSnapshot = new Map<string, { bids: string[][], asks: string[][] }>();
  }
  public updateOrderBook(symbol: string, bids: string[][], asks: string[][]): void {
    // This overwrites the old snapshot with the newest one every 100ms
    this.orderBookSnapshot.set(symbol, { bids, asks });
  }

  public findHeavySupportResistance(symbol: string) {
    const book = this.orderBookSnapshot.get(symbol);

    if (!book) {
      return { support: "Unknown", resistance: "Unknown" };
    }

    // Find heaviest Support (Bids)
    let maxBidVol = 0;
    let supportPrice = "0";
    for (const entry of book.bids) {
      const price = entry[0];
      const qty = entry[1];

      // 🛑 The Bouncer: Skip if Binance sent a malformed array row
      if (!price || !qty) continue;

      if (parseFloat(qty) > maxBidVol) {
        maxBidVol = parseFloat(qty);
        supportPrice = price; // ✅ TypeScript now knows this is strictly a string
      }
    }

    // Find heaviest Resistance (Asks)
    let maxAskVol = 0;
    let resistancePrice = "0";
    for (const entry of book.asks) {
      const price = entry[0];
      const qty = entry[1];

      // 🛑 The Bouncer: Skip if Binance sent a malformed array row
      if (!price || !qty) continue;

      if (parseFloat(qty) > maxAskVol) {
        maxAskVol = parseFloat(qty);
        resistancePrice = price; // ✅ TypeScript now knows this is strictly a string
      }
    }

    return {
      support: `$${parseFloat(supportPrice).toLocaleString()} (${maxBidVol} coins)`,
      resistance: `$${parseFloat(resistancePrice).toLocaleString()} (${maxAskVol} coins)`
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
    const activeMonitors = await TripwireConfigModel.find({
      symbol: normalizedSymbol,
      isActive: true,
    }).exec();
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
      const absDropPercent = Number(Math.abs(percentChange).toFixed(2));
      const thresholdBreached = percentChange <= -monitor.thresholdPercentage;
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
          dropPercentage: absDropPercent,
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
        const newsContext = await fetchRecentHeadlines(normalizedSymbol);
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
            event: "ANALYZER_GROQ_START",
            symbol: normalizedSymbol,
            monitorId,
            userId: monitor.user.toString(),
            dropPercentage: absDropPercent,
            timeWindowMinutes: monitor.timeWindowMinutes,
            currentCVD: runningCVD // Log the CVD
          },
          "Calling Groq report generation",
        );
        // 1. Grab the thickest walls from the Order Book snapshot
        const walls = this.findHeavySupportResistance(normalizedSymbol);
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
          absDropPercent,
          monitor.timeWindowMinutes,
          newsContext,
          runningCVD,
          walls.support,    // <-- Pass Support
          walls.resistance  // <-- Pass Resistance
        );
        logger.info(
          {
            event: "ANALYZER_GROQ_SUCCESS",
            symbol: normalizedSymbol,
            monitorId,
            userId: monitor.user.toString(),
            // sentiment: report.sentiment,
            // aiRootCauseLength: report.aiRootCause.length,
          },
          "Groq report generated successfully",
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
        const alertDocument = await AlertModel.create({
          user: monitor.user,
          symbol: normalizedSymbol,
          triggerPrice: currentPrice,
          dropPercentage: absDropPercent,

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
      // 🧠 NEW: Dynamically calculate walls for every single coin we are tracking!
      supportResistance: Object.fromEntries(
        Array.from(this.orderBookSnapshot.keys()).map((symbol) => [
          symbol,
          this.findHeavySupportResistance(symbol),
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
