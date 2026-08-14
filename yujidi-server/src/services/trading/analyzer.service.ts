import { randomUUID } from "node:crypto";
import pino from "pino";

import { AlertModel, type Alert } from "../../models/Alert.js";
import { TripwireConfigModel } from "../../models/TripwireConfig.js";
import type { NormalizedMarketTick } from "../../types/market-data.types.js";
import {
  createMonitorCacheSnapshot,
  evaluateMonitorThreshold,
  MONITOR_CACHE_TTL_MS,
  normalizeMonitorTrigger,
} from "./analyzer.rules.js";
import { llmTraceService, type LlmTraceService } from "../ai-runtime/llm-trace.service.js";
import { sharedLlmService } from "../ai-runtime/llm.service.js";
import { fetchRecentHeadlines } from "../market-data/news.service.js";
import {
  advanceAnalyzerCvdState,
  advanceAnalyzerPriceBuffer,
  findAnalyzerBaseTick,
  type CvdTrade,
  type PriceTick,
} from "./analyzer-state-transition.js";
import {
  buildAnalyzerStreamKey,
  validateNormalizedAnalyzerTick,
} from "./analyzer-tick-validation.js";
import { calculateStructuralSupportResistance } from "./analyzer-order-book-calculation.js";
import {
  buildAnalyzerAlertPayload,
  buildAnalyzerLlmTraceBase,
} from "./analyzer-trigger-projection.js";
import {
  buildAnalyzerRuntimeSnapshot,
  type AnalyzerRuntimeSnapshot,
} from "./analyzer-runtime-snapshot.js";

const logger = pino({ name: "analyzer-engine" });
export const ALERT_REPORT_PROMPT_VERSION = "ALERT_REPORT_V1";

export type { CvdTrade, PriceTick } from "./analyzer-state-transition.js";
export type { AnalyzerRuntimeSnapshot } from "./analyzer-runtime-snapshot.js";
interface AlertEmitterPayload {
  type: "NEW_ALERT";
  payload: Alert;
}

type AlertEmitter = (userId: string, payload: AlertEmitterPayload) => number | void;

const COOLDOWN_MS = 15 * 60 * 1000;
const TRIGGER_FAILURE_RETRY_DELAY_MS = 30 * 1000;
const MONITOR_STATUS_EMIT_INTERVAL_MS = 1000;
export type AnalyzerMonitorStatus = Readonly<{
  monitorId: string;
  symbol: string;
  triggerType: "drop" | "spike";
  thresholdPercentage: number;
  timeWindowMinutes: number;
  historyReady: boolean;
  historyCoveredMs: number;
  requiredHistoryMs: number;
  changePercentage?: number;
  movementMagnitude?: number;
  triggerMovementPercentage?: number;
  direction?: "up" | "down";
  thresholdBreached: boolean;
  evaluatedAt: number;
}>;
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
type AnalyzerLlmService = Pick<
  typeof sharedLlmService,
  "generateAlertReport" | "getProviderMetadata"
>;
type AnalyzerDependencies = {
  llmService: AnalyzerLlmService;
  llmTraceService: Pick<LlmTraceService, "record">;
  getNow: () => Date;
  generateId: () => string;
  fetchRecentHeadlines: (symbol: string) => Promise<string>;
  findActiveMonitors: (symbol: string) => Promise<ActiveMonitorDocument[]>;
  findActiveMonitorsForNormalizedTick: (tick: NormalizedMarketTick) => Promise<ActiveMonitorDocument[]>;
  createAlert: (payload: Record<string, unknown>) => Promise<AnalyzerAlertDocument>;
  emitMonitorStatus: (userId: string, status: AnalyzerMonitorStatus) => void;
};

type ProcessTickContext = {
  streamKey?: string;
  monitorCacheKey?: string;
  findActiveMonitors?: () => Promise<ActiveMonitorDocument[]>;
  metadata?: Record<string, unknown>;
};

const defaultAnalyzerDependencies: AnalyzerDependencies = {
  llmService: sharedLlmService,
  llmTraceService,
  getNow: () => new Date(),
  generateId: randomUUID,
  fetchRecentHeadlines,
  findActiveMonitors: async (symbol: string): Promise<ActiveMonitorDocument[]> => {
    return TripwireConfigModel.find({
      symbol,
      isActive: true,
    }).exec();
  },
  findActiveMonitorsForNormalizedTick: async (tick: NormalizedMarketTick): Promise<ActiveMonitorDocument[]> => {
    if (tick.provider === "ANGEL_ONE") {
      if (!tick.userId) {
        return [];
      }

      return TripwireConfigModel.find({
        user: tick.userId,
        provider: "ANGEL_ONE",
        exchange: tick.exchange,
        instrumentToken: tick.instrumentToken,
        isActive: true,
      }).exec();
    }

    return TripwireConfigModel.find({
      provider: tick.provider,
      exchange: tick.exchange,
      instrumentToken: tick.instrumentToken,
      isActive: true,
    }).exec();
  },
  createAlert: async (payload: Record<string, unknown>): Promise<AnalyzerAlertDocument> => {
    return AlertModel.create(payload) as Promise<AnalyzerAlertDocument>;
  },
  emitMonitorStatus: () => undefined,
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
  private readonly triggerFailureRetryAfter: Map<string, number>;
  private readonly triggerPipelinesInFlight: Set<string>;
  private readonly lastMonitorStatusEmittedAt: Map<string, number>;

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
    this.triggerFailureRetryAfter = new Map<string, number>();
    this.triggerPipelinesInFlight = new Set<string>();
    this.lastMonitorStatusEmittedAt = new Map<string, number>();
  }
  public updateOrderBook(symbol: string, bids: string[][], asks: string[][]): void {
    // This overwrites the old snapshot with the newest one every 100ms
    this.orderBookSnapshot.set(symbol, { bids, asks });
  }

  public async processNormalizedTick(tick: NormalizedMarketTick): Promise<void> {
    const validationFailure = validateNormalizedAnalyzerTick(tick);
    if (validationFailure === "INVALID_PRICE") {
      logger.warn(
        {
          event: "ANALYZER_NORMALIZED_TICK_REJECTED",
          provider: tick.provider,
          symbol: tick.symbol,
          instrumentToken: tick.instrumentToken,
          price: tick.price,
          timestamp: tick.timestamp,
        },
        "Rejected invalid normalized market tick",
      );
      return;
    }
    if (validationFailure === "MISSING_USER_ID") {
      logger.warn(
        {
          event: "ANALYZER_NORMALIZED_TICK_REJECTED",
          provider: tick.provider,
          symbol: tick.symbol,
          instrumentToken: tick.instrumentToken,
          reason: "MISSING_USER_ID",
        },
        "Rejected Angel normalized tick without user id",
      );
      return;
    }

    const subscriptionKey = buildAnalyzerStreamKey(tick);

    await this.processTick(
      tick.symbol,
      tick.price,
      tick.timestamp,
      false,
      tick.volume ?? 0,
      {
        streamKey: subscriptionKey,
        monitorCacheKey: subscriptionKey,
        findActiveMonitors: () => this.dependencies.findActiveMonitorsForNormalizedTick(tick),
        metadata: {
          displayName: tick.displayName ?? tick.displaySymbol,
          provider: tick.provider,
          marketType: tick.marketType,
          exchange: tick.exchange,
          instrumentToken: tick.instrumentToken,
          providerSymbol: tick.providerSymbol,
          currentPrice: tick.price,
        },
      },
    );
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

  private async loadActiveMonitorCache(
    symbol: string,
    reason: string,
    loader?: () => Promise<ActiveMonitorDocument[]>,
  ): Promise<ActiveMonitorDocument[]> {
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

    const monitors = loader ? await loader() : await this.dependencies.findActiveMonitors(symbol);

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

  private async getActiveMonitorsForSymbol(
    symbol: string,
    loader?: () => Promise<ActiveMonitorDocument[]>,
  ): Promise<ActiveMonitorDocument[]> {
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

    return this.loadActiveMonitorCache(symbol, cached ? "expired" : "miss", loader);
  }

  public findStructuralSupportResistance(symbol: string) {
    return calculateStructuralSupportResistance(this.orderBookSnapshot.get(symbol));
  }

  public async processTick(
    symbol: string,
    currentPrice: number,
    currentTimestamp: number,
    isbuyermaker: boolean,
    quantity: number,
    context: ProcessTickContext = {},
  ): Promise<void> {
    if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
      logger.warn(
        { event: "ANALYZER_TICK_REJECTED", symbol, currentPrice, currentTimestamp },
        "Rejected invalid tick payload",
      );
      return;
    }

    const normalizedSymbol = symbol.toUpperCase();
    const streamKey = context.streamKey ?? normalizedSymbol;
    const monitorCacheKey = context.monitorCacheKey ?? normalizedSymbol;
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

    const priceTransition = advanceAnalyzerPriceBuffer(
      this.priceBuffer.get(streamKey) ?? [],
      currentPrice,
      currentTimestamp,
    );
    const { ticks, bufferSizeBeforePush, culledCount } = priceTransition;
    this.priceBuffer.set(streamKey, ticks);
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
    const cvdTransition = advanceAnalyzerCvdState(
      this.cvdBuffer.get(streamKey) ?? [],
      this.currentCVD.get(streamKey) ?? 0,
      currentTimestamp,
      isbuyermaker,
      quantity,
    );
    const cvdTrades = cvdTransition.cvdTrades;
    const runningCVD = cvdTransition.currentCvd;

    // // 1. The Whale Filter
    // if (quantity >= WHALE_THRESHOLD_BTC) {
    //   // 2. The Directional Math (m: true means seller, m: false means buyer)
    //   const volumeDelta = isbuyermaker ? -quantity : quantity;

    //   runningCVD += volumeDelta;
    //   cvdTrades.push({ volumeDelta, timestamp: currentTimestamp });
    // }
    // 4. Save state
    this.cvdBuffer.set(streamKey, cvdTrades);
    this.currentCVD.set(streamKey, runningCVD);

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
    const activeMonitors = await this.getActiveMonitorsForSymbol(monitorCacheKey, context.findActiveMonitors);
    // logger.info(
    //   {
    //     event: "ANALYZER_MONITORS_FOUND",
    //     symbol: normalizedSymbol,
    //     streamKey,
    //     monitorCacheKey,
    //     activeMonitorCount: activeMonitors.length,
    //   },
    //   "Fetched active monitors for analyzer stream",
    // );

    for (const monitor of activeMonitors) {
      const monitorId = monitor._id.toString();
      const monitorTrigger = normalizeMonitorTrigger(monitor.trigger);
      if (!monitorTrigger) {
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
      const requiredHistoryMs = monitor.timeWindowMinutes * 60 * 1000;
      const oldestTick = ticks[0];
      const historyCoveredMs = oldestTick
        ? Math.max(0, currentTimestamp - oldestTick.timestamp)
        : 0;
      const lastTriggeredAt = this.cooldowns.get(monitorId) ?? 0;
      const cooldownRemainingMs = COOLDOWN_MS - (currentTimestamp - lastTriggeredAt);
      const isInCooldown = cooldownRemainingMs > 0;
      if (isInCooldown) {
        continue;
      }

      const windowStart = currentTimestamp - monitor.timeWindowMinutes * 60 * 1000;
      const baseTick = findAnalyzerBaseTick(ticks, windowStart);
      if (!baseTick) {
        this.emitMonitorStatus(monitor.user.toString(), {
          monitorId,
          symbol: normalizedSymbol,
          triggerType: monitorTrigger,
          thresholdPercentage: monitor.thresholdPercentage,
          timeWindowMinutes: monitor.timeWindowMinutes,
          historyReady: false,
          historyCoveredMs,
          requiredHistoryMs,
          thresholdBreached: false,
          evaluatedAt: currentTimestamp,
        });
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

      if (!triggerType) continue;
      this.emitMonitorStatus(monitor.user.toString(), {
        monitorId,
        symbol: normalizedSymbol,
        triggerType,
        thresholdPercentage: monitor.thresholdPercentage,
        timeWindowMinutes: monitor.timeWindowMinutes,
        historyReady: true,
        historyCoveredMs,
        requiredHistoryMs,
        changePercentage,
        movementMagnitude,
        triggerMovementPercentage: Math.max(
          0,
          triggerType === "drop" ? -changePercentage : changePercentage,
        ),
        direction,
        thresholdBreached,
        evaluatedAt: currentTimestamp,
      }, thresholdBreached);
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

      if (this.triggerPipelinesInFlight.has(monitorId)) {
        continue;
      }
      const retryAfter = this.triggerFailureRetryAfter.get(monitorId) ?? 0;
      if (currentTimestamp < retryAfter) {
        continue;
      }

      const pipelineId = `${monitorId}:${currentTimestamp}`;
      const pipelineStartedAt = Date.now();
      this.triggerPipelinesInFlight.add(monitorId);
      logger.warn(
        {
          event: "ANALYZER_TRIGGER_BREACH",
          pipelineId,
          pipelineStep: "THRESHOLD_BREACHED",
          symbol: normalizedSymbol,
          monitorId,
          userId: monitor.user.toString(),
          triggerPrice: currentPrice,
          changePercentage,
          movementMagnitude,
          triggerType,
          direction,
          streamKey,
          monitorCacheKey,
          successCooldownMs: COOLDOWN_MS,
        },
        "Threshold breached; starting trigger pipeline",
      );

      let pipelineStage = "NEWS_FETCH";
      try {
        const newsStartedAt = Date.now();
        logger.info(
          {
            event: "ANALYZER_NEWS_FETCH_START",
            pipelineId,
            pipelineStep: "NEWS_FETCH_STARTED",
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
            pipelineId,
            pipelineStep: "NEWS_FETCHED",
            symbol: normalizedSymbol,
            monitorId,
            userId: monitor.user.toString(),
            newsLength: newsContext.length,
            hasFallback: newsContext === "No recent news available.",
            stageDurationMs: Date.now() - newsStartedAt,
          },
          "News context fetched",
        );

        pipelineStage = "LLM_GENERATION";
        const llmStartedAt = Date.now();
        logger.info(
          {
            event: "ANALYZER_LLM_REPORT_START",
            pipelineId,
            pipelineStep: "LLM_GENERATION_STARTED",
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
        const traceId = this.dependencies.generateId();
        const correlationId = this.dependencies.generateId();
        const startedAt = this.dependencies.getNow();
        const providerMetadata = this.llmService.getProviderMetadata();
        const traceBase = buildAnalyzerLlmTraceBase({
          traceId,
          correlationId,
          providerName: providerMetadata.name,
          ...(providerMetadata.modelName ? { modelName: providerMetadata.modelName } : {}),
          promptVersion: ALERT_REPORT_PROMPT_VERSION,
          startedAt,
          symbol: normalizedSymbol,
          monitorId,
          monitor,
          triggerType,
          direction,
          changePercentage,
          currentPrice,
          currentCvd: runningCVD,
          newsContext,
          walls,
        });
        let report;
        try {
          report = await this.llmService.generateAlertReport(
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
        } catch (error: unknown) {
          const completedAt = this.dependencies.getNow();
          void this.dependencies.llmTraceService.record({
            ...traceBase,
            status: "PROVIDER_FAILED",
            completedAt,
            latencyMs: Math.max(0, completedAt.getTime() - startedAt.getTime()),
            failureCode: "ALERT_REPORT_GENERATION_FAILED",
            validation: {
              parseSucceeded: false,
              schemaSucceeded: false,
              semanticSucceeded: false,
            },
          }).catch(() => undefined);
          throw error;
        }
        const completedAt = this.dependencies.getNow();
        void this.dependencies.llmTraceService.record({
          ...traceBase,
          status: "COMPLETED",
          completedAt,
          latencyMs: Math.max(0, completedAt.getTime() - startedAt.getTime()),
          outputReference: {
            fieldSummary: {
              catalystLength: report.catalyst.length,
              threatLevelLength: report.threatLevel.length,
              supportLength: report.support.length,
              resistanceLength: report.resistance.length,
              summaryLength: report.summary.length,
            },
          },
          validation: {
            parseSucceeded: true,
            schemaSucceeded: true,
            semanticSucceeded: true,
          },
        }).catch(() => undefined);
        logger.info(
          {
            event: "ANALYZER_LLM_REPORT_SUCCESS",
            pipelineId,
            pipelineStep: "LLM_RESPONSE_VALIDATED",
            symbol: normalizedSymbol,
            monitorId,
            userId: monitor.user.toString(),
            stageDurationMs: Date.now() - llmStartedAt,
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
        pipelineStage = "ALERT_PERSISTENCE";
        const persistenceStartedAt = Date.now();
        logger.info(
          {
            event: "ANALYZER_ALERT_PERSIST_START",
            pipelineId,
            pipelineStep: "ALERT_PERSISTENCE_STARTED",
            symbol: normalizedSymbol,
            monitorId,
            userId: monitor.user.toString(),
          },
          "Persisting generated alert",
        );
        const alertDocument = await this.dependencies.createAlert(buildAnalyzerAlertPayload({
          monitor,
          ...(context.metadata ? { metadata: context.metadata } : {}),
          symbol: normalizedSymbol,
          currentPrice,
          previousPrice: baseTick.price,
          movementMagnitude,
          changePercentage,
          triggerType,
          direction,
          report,
          currentCvd: runningCVD,
          currentTimestamp,
        }));
        this.cooldowns.set(monitorId, currentTimestamp);
        this.triggerFailureRetryAfter.delete(monitorId);
        logger.warn(
          {
            event: "ANALYZER_ALERT_SAVED",
            pipelineId,
            pipelineStep: "ALERT_GENERATED",
            symbol: normalizedSymbol,
            monitorId,
            userId: monitor.user.toString(),
            alertId: alertDocument._id.toString(),
            stageDurationMs: Date.now() - persistenceStartedAt,
            totalDurationMs: Date.now() - pipelineStartedAt,
            // sentiment: report.sentiment,
          },
          "Persisted alert document to MongoDB",
        );

        pipelineStage = "WEBSOCKET_DELIVERY";
        const deliveredSocketCount = this.emitAlert(monitor.user.toString(), {
          type: "NEW_ALERT",
          payload: alertDocument.toObject() as Alert,
        }) ?? 0;
        logger.warn(
          {
            event: "ANALYZER_ALERT_EMITTED",
            pipelineId,
            pipelineStep: "ALERT_DELIVERY_ATTEMPTED",
            symbol: normalizedSymbol,
            monitorId,
            userId: monitor.user.toString(),
            alertId: alertDocument._id.toString(),
            deliveredSocketCount,
          },
          "Completed NEW_ALERT delivery attempt",
        );
      } catch (error: unknown) {
        this.triggerFailureRetryAfter.set(
          monitorId,
          currentTimestamp + TRIGGER_FAILURE_RETRY_DELAY_MS,
        );
        logger.error(
          {
            event: "ANALYZER_TRIGGER_PIPELINE_FAILED",
            pipelineId,
            pipelineStep: "PIPELINE_FAILED",
            failedStage: pipelineStage,
            retryAfter: currentTimestamp + TRIGGER_FAILURE_RETRY_DELAY_MS,
            totalDurationMs: Date.now() - pipelineStartedAt,
            error,
            symbol: normalizedSymbol,
            monitorId,
            userId: monitor.user.toString(),
          },
          "Analyzer failed to process trigger event",
        );
      } finally {
        this.triggerPipelinesInFlight.delete(monitorId);
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
  public getRuntimeSnapshot(input: {
    streamKeys: string[];
    includeBuffers?: boolean;
    bufferLimit?: number;
    now?: number;
  }): AnalyzerRuntimeSnapshot {
    return buildAnalyzerRuntimeSnapshot({
      ...input,
      cooldownMs: COOLDOWN_MS,
      priceBuffer: this.priceBuffer,
      cvdBuffer: this.cvdBuffer,
      currentCVD: this.currentCVD,
      cooldowns: this.cooldowns,
      orderBookSnapshot: this.orderBookSnapshot,
    });
  }

  private emitMonitorStatus(
    userId: string,
    status: AnalyzerMonitorStatus,
    force = false,
  ): void {
    const lastEmittedAt = this.lastMonitorStatusEmittedAt.get(status.monitorId) ?? 0;
    if (!force && status.evaluatedAt - lastEmittedAt < MONITOR_STATUS_EMIT_INTERVAL_MS) {
      return;
    }
    this.lastMonitorStatusEmittedAt.set(status.monitorId, status.evaluatedAt);
    this.dependencies.emitMonitorStatus(userId, Object.freeze({ ...status }));
  }
}
