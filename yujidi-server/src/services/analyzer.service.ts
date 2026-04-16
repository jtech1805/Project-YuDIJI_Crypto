import pino from "pino";

import { AlertModel, type Alert } from "../models/Alert.js";
import { TripwireConfigModel } from "../models/TripwireConfig.js";
import { LlmService } from "./llm.service.js";
import { fetchRecentHeadlines } from "./news.service.js";

const logger = pino({ name: "analyzer-engine" });

interface PriceTick {
  price: number;
  timestamp: number;
}

interface AlertEmitterPayload {
  type: "NEW_ALERT";
  payload: Alert;
}

type AlertEmitter = (userId: string, payload: AlertEmitterPayload) => void;

const MAX_BUFFER_WINDOW_MS = 60 * 60 * 1000;
const COOLDOWN_MS = 15 * 60 * 1000;

export class AnalyzerEngine {
  private readonly llmService: LlmService;
  private readonly emitAlert: AlertEmitter;

  public readonly priceBuffer: Map<string, PriceTick[]>;
  public readonly cooldowns: Map<string, number>;

  public constructor(emitAlert: AlertEmitter) {
    this.llmService = new LlmService();
    this.emitAlert = emitAlert;
    this.priceBuffer = new Map<string, PriceTick[]>();
    this.cooldowns = new Map<string, number>();
  }

  public async processTick(
    symbol: string,
    currentPrice: number,
    currentTimestamp: number,
  ): Promise<void> {
    if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
      logger.warn(
        { event: "ANALYZER_TICK_REJECTED", symbol, currentPrice, currentTimestamp },
        "Rejected invalid tick payload",
      );
      return;
    }

    const normalizedSymbol = symbol.toUpperCase();
    logger.info(
      {
        event: "ANALYZER_TICK_RECEIVED",
        symbol: normalizedSymbol,
        currentPrice,
        currentTimestamp,
      },
      "Analyzer received price tick",
    );

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
    logger.info(
      {
        event: "ANALYZER_BUFFER_UPDATED",
        symbol: normalizedSymbol,
        bufferSizeBeforePush,
        bufferSizeAfterCull: ticks.length,
        culledCount,
        oldestTickTimestamp: ticks[0]?.timestamp ?? null,
        latestTickTimestamp: ticks[ticks.length - 1]?.timestamp ?? null,
      },
      "Updated in-memory rolling price buffer",
    );

    const activeMonitors = await TripwireConfigModel.find({
      symbol: normalizedSymbol,
      isActive: true,
    }).exec();
    logger.info(
      {
        event: "ANALYZER_MONITORS_FETCHED",
        symbol: normalizedSymbol,
        activeMonitorCount: activeMonitors.length,
      },
      "Fetched active monitors for symbol",
    );

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
        logger.info(
          {
            event: "ANALYZER_MONITOR_NO_BASE_TICK",
            symbol: normalizedSymbol,
            monitorId,
            userId: monitor.user.toString(),
            timeWindowMinutes: monitor.timeWindowMinutes,
            windowStart,
            availableTickCount: ticks.length,
          },
          "Insufficient historical data for monitor evaluation",
        );
        continue;
      }

      const percentChange = ((currentPrice - baseTick.price) / baseTick.price) * 100;
      const absDropPercent = Number(Math.abs(percentChange).toFixed(2));
      const thresholdBreached = percentChange <= -monitor.thresholdPercentage;
      logger.info(
        {
          event: "ANALYZER_THRESHOLD_EVALUATED",
          symbol: normalizedSymbol,
          monitorId,
          userId: monitor.user.toString(),
          currentPrice,
          basePrice: baseTick.price,
          percentChange: Number(percentChange.toFixed(4)),
          absDropPercent,
          thresholdPercentage: monitor.thresholdPercentage,
          thresholdBreached,
          timeWindowMinutes: monitor.timeWindowMinutes,
          baseTickTimestamp: baseTick.timestamp,
          currentTimestamp,
        },
        "Computed threshold status for monitor",
      );

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
          },
          "Calling Groq report generation",
        );
        const report = await this.llmService.generateAlertReport(
          normalizedSymbol,
          absDropPercent,
          monitor.timeWindowMinutes,
          newsContext,
        );
        logger.info(
          {
            event: "ANALYZER_GROQ_SUCCESS",
            symbol: normalizedSymbol,
            monitorId,
            userId: monitor.user.toString(),
            sentiment: report.sentiment,
            aiRootCauseLength: report.aiRootCause.length,
          },
          "Groq report generated successfully",
        );

        const alertDocument = await AlertModel.create({
          user: monitor.user,
          symbol: normalizedSymbol,
          triggerPrice: currentPrice,
          dropPercentage: absDropPercent,
          aiRootCause: report.aiRootCause,
          sentiment: report.sentiment,
          createdAt: new Date(currentTimestamp),
        });
        logger.warn(
          {
            event: "ANALYZER_ALERT_SAVED",
            symbol: normalizedSymbol,
            monitorId,
            userId: monitor.user.toString(),
            alertId: alertDocument._id.toString(),
            sentiment: report.sentiment,
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
