import pino from "pino";
import { isValidObjectId } from "mongoose";

import type {
  Exchange,
  MarketProvider,
} from "../types/market-data.types.js";
import {
  buildActiveTradeSubscriptionKey,
  sharedActiveTradeSubscriptionService,
  type ActiveTradeSubscriptionService,
} from "./active-trade-subscription.service.js";
import {
  sharedTradeMonitoringHealthService,
  type TradeMonitoringHealthService,
} from "./trade-monitoring-health.service.js";
import { TradeMonitoringService } from "./trade-monitoring.service.js";

const logger = pino({ name: "active-trade-live-monitor-service" });

export type LiveTradeTickSource = "BINANCE_WS" | "ANGEL_WS" | "MANUAL" | "SYSTEM";

export type LiveTradeTickInput = {
  provider: MarketProvider;
  exchange: Exchange;
  symbolId?: string;
  symbol?: string;
  providerSymbol?: string;
  instrumentToken?: string;
  userId?: string;
  price: number;
  occurredAt?: Date;
  receivedAt?: Date;
  source: LiveTradeTickSource;
};

export type LiveTradeTickSkipReason =
  | "INVALID_TICK"
  | "TICK_STALE"
  | "USER_SCOPE_REQUIRED"
  | "NO_SAFE_SYMBOL_MATCH"
  | "COOLDOWN_ACTIVE"
  | "WORKLOAD_CAP_REACHED";

export type LiveTradeTickResult = {
  matchedCount: number;
  evaluatedCount: number;
  skippedCount: number;
  reasons: LiveTradeTickSkipReason[];
  evaluatedTradeIds: string[];
};

type Dependencies = {
  subscriptionService: Pick<ActiveTradeSubscriptionService, "resolveTradesForTick">;
  healthService: Pick<
    TradeMonitoringHealthService,
    | "recordTick"
    | "recordEvaluated"
    | "recordSkipped"
    | "recordStale"
    | "recordCooldownSkip"
    | "recordWorkloadCap"
  >;
  tradeMonitoringService: Pick<TradeMonitoringService, "evaluateActiveTrade">;
  now: () => Date;
  maxTickAgeMs: number;
  minEvaluationIntervalMs: number;
  maxTradesPerTick: number;
  maxCooldownEntries: number;
};

export class ActiveTradeLiveMonitorService {
  private readonly lastEvaluatedAt = new Map<string, number>();
  private handledTickCount = 0;

  public constructor(private readonly dependencies: Partial<Dependencies> = {}) {}

  public async handleTick(input: LiveTradeTickInput): Promise<LiveTradeTickResult> {
    const result = this.emptyResult();
    const receivedAt = input.receivedAt ?? this.getNow();
    const occurredAt = input.occurredAt ?? receivedAt;
    const healthKey = buildActiveTradeSubscriptionKey(input);

    if (!Number.isFinite(input.price) || input.price <= 0) {
      if (healthKey) this.getHealthService().recordSkipped(healthKey);
      return this.skip(result, "INVALID_TICK");
    }
    if (healthKey) this.getHealthService().recordTick(healthKey, receivedAt);
    if (receivedAt.getTime() - occurredAt.getTime() > this.getMaxTickAgeMs()) {
      logger.debug(
        {
          event: "ACTIVE_TRADE_LIVE_TICK_SKIPPED",
          reason: "TICK_STALE",
          provider: input.provider,
          exchange: input.exchange,
          ageMs: receivedAt.getTime() - occurredAt.getTime(),
        },
        "Skipped stale live trade tick",
      );
      if (healthKey) this.getHealthService().recordStale(healthKey);
      return this.skip(result, "TICK_STALE");
    }
    if (
      input.provider === "ANGEL_ONE"
      && (!input.userId || !isValidObjectId(input.userId))
    ) {
      logger.warn(
        {
          event: "ACTIVE_TRADE_LIVE_TICK_SKIPPED",
          reason: "USER_SCOPE_REQUIRED",
          provider: input.provider,
          exchange: input.exchange,
        },
        "Skipped user-scoped Angel tick without user id",
      );
      return this.skip(result, "USER_SCOPE_REQUIRED");
    }

    const resolution = await this.getSubscriptionService().resolveTradesForTick(input);
    if (!resolution) return this.skip(result, "NO_SAFE_SYMBOL_MATCH");
    const subscriptionKey = resolution.subscriptionKey;

    const cap = this.getMaxTradesPerTick();
    const matches = resolution.trades;

    result.matchedCount = matches.length;
    const cappedMatches = matches.slice(0, cap);
    if (matches.length > cap) {
      result.skippedCount += matches.length - cap;
      result.reasons.push("WORKLOAD_CAP_REACHED");
      this.getHealthService().recordWorkloadCap(subscriptionKey, matches.length - cap);
      logger.warn(
        {
          event: "ACTIVE_TRADE_LIVE_WORKLOAD_CAPPED",
          provider: input.provider,
          exchange: input.exchange,
          matchedCount: matches.length,
          maxTradesPerTick: cap,
        },
        "ActiveTrade live monitoring workload cap reached",
      );
    }

    const evaluationTime = receivedAt.getTime();
    for (const trade of cappedMatches) {
      const activeTradeId = String(trade._id);
      if (this.isCoolingDown(activeTradeId, evaluationTime)) {
        result.skippedCount += 1;
        if (!result.reasons.includes("COOLDOWN_ACTIVE")) result.reasons.push("COOLDOWN_ACTIVE");
        this.getHealthService().recordCooldownSkip(subscriptionKey);
        continue;
      }

      this.lastEvaluatedAt.set(activeTradeId, evaluationTime);
      try {
        await this.getTradeMonitoringService().evaluateActiveTrade(
          String(trade.userId),
          activeTradeId,
          {
            price: input.price,
            source: "MARKET_TICK",
            occurredAt,
          },
        );
        result.evaluatedCount += 1;
        result.evaluatedTradeIds.push(activeTradeId);
        this.getHealthService().recordEvaluated(subscriptionKey, receivedAt);
      } catch (error: unknown) {
        this.lastEvaluatedAt.delete(activeTradeId);
        logger.warn(
          {
            event: "ACTIVE_TRADE_LIVE_EVALUATION_FAILED",
            activeTradeId,
            userId: String(trade.userId),
            provider: input.provider,
            exchange: input.exchange,
            error: error instanceof Error ? error.message : "Unknown evaluation error",
          },
          "Live ActiveTrade evaluation failed",
        );
      }
    }

    this.cleanupCooldowns(evaluationTime);
    return result;
  }

  private isCoolingDown(activeTradeId: string, timestamp: number): boolean {
    const lastEvaluation = this.lastEvaluatedAt.get(activeTradeId);
    return lastEvaluation !== undefined
      && timestamp - lastEvaluation < this.getMinEvaluationIntervalMs();
  }

  private cleanupCooldowns(now: number): void {
    this.handledTickCount += 1;
    if (
      this.handledTickCount % 100 !== 0
      && this.lastEvaluatedAt.size <= this.getMaxCooldownEntries()
    ) return;

    const expiryAge = Math.max(this.getMinEvaluationIntervalMs() * 10, 60_000);
    for (const [activeTradeId, timestamp] of this.lastEvaluatedAt) {
      if (now - timestamp > expiryAge) this.lastEvaluatedAt.delete(activeTradeId);
    }

    const overflow = this.lastEvaluatedAt.size - this.getMaxCooldownEntries();
    if (overflow <= 0) return;
    const oldest = [...this.lastEvaluatedAt.entries()]
      .sort((left, right) => left[1] - right[1])
      .slice(0, overflow);
    for (const [activeTradeId] of oldest) this.lastEvaluatedAt.delete(activeTradeId);
  }

  private emptyResult(): LiveTradeTickResult {
    return {
      matchedCount: 0,
      evaluatedCount: 0,
      skippedCount: 0,
      reasons: [],
      evaluatedTradeIds: [],
    };
  }

  private skip(
    result: LiveTradeTickResult,
    reason: LiveTradeTickSkipReason,
  ): LiveTradeTickResult {
    result.skippedCount += 1;
    result.reasons.push(reason);
    return result;
  }

  private getSubscriptionService(): Pick<ActiveTradeSubscriptionService, "resolveTradesForTick"> {
    return this.dependencies.subscriptionService ?? sharedActiveTradeSubscriptionService;
  }
  private getHealthService(): Pick<
    TradeMonitoringHealthService,
    | "recordTick"
    | "recordEvaluated"
    | "recordSkipped"
    | "recordStale"
    | "recordCooldownSkip"
    | "recordWorkloadCap"
  > {
    return this.dependencies.healthService ?? sharedTradeMonitoringHealthService;
  }
  private getTradeMonitoringService(): Pick<TradeMonitoringService, "evaluateActiveTrade"> {
    return this.dependencies.tradeMonitoringService ?? new TradeMonitoringService();
  }
  private getNow(): Date {
    return this.dependencies.now?.() ?? new Date();
  }
  private getMaxTickAgeMs(): number {
    return this.dependencies.maxTickAgeMs ?? 10_000;
  }
  private getMinEvaluationIntervalMs(): number {
    return this.dependencies.minEvaluationIntervalMs ?? 1_000;
  }
  private getMaxTradesPerTick(): number {
    return this.dependencies.maxTradesPerTick ?? 100;
  }
  private getMaxCooldownEntries(): number {
    return this.dependencies.maxCooldownEntries ?? 10_000;
  }
}
