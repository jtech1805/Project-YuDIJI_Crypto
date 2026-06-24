import pino from "pino";
import { Types, isValidObjectId } from "mongoose";

import { ActiveTradeModel } from "../models/active-trade.model.js";
import { SymbolModel } from "../models/Symbol.js";
import type {
  Exchange,
  InstrumentType,
  MarketProvider,
  MarketType,
} from "../types/market-data.types.js";
import { buildMarketSubscriptionKey } from "../utils/market-subscription-key.js";
import type { ActiveTradeRecord } from "./active-trade.service.js";
import type { LiveTradeTickInput } from "./active-trade-live-monitor.service.js";
import { SymbolResolverService } from "./symbol-resolver.service.js";

const logger = pino({ name: "active-trade-subscription-service" });

export type ActiveTradeProjection = {
  _id: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  tradePlanId: Types.ObjectId | string;
  tradeSetupId: Types.ObjectId | string;
  symbolId: Types.ObjectId | string;
  symbolSnapshot: Record<string, unknown>;
  direction: string;
  actualEntry: number;
  currentStopLoss: number;
  actualTarget1: number;
  actualTarget2?: number;
  actualRiskPerUnit: number;
  status: string;
};

export type ActiveTradeStreamSubscription = {
  subscriptionKey: string;
  symbolId: string;
  symbol: string;
  displayName: string;
  provider: MarketProvider;
  marketType: MarketType;
  exchange: Exchange;
  instrumentToken: string;
  providerSymbol: string;
  requiresBrokerLogin: boolean;
  supportedBroker: "ANGEL_ONE" | "KITE" | "NONE";
};

export type ActiveTradeTickResolution = {
  subscriptionKey: string;
  trades: ActiveTradeProjection[];
  cacheHit: boolean;
};

type CacheEntry = {
  trades: ActiveTradeProjection[];
  expiresAt: number;
  touchedAt: number;
};

type QueryExec<T> = { exec: () => Promise<T> };
type LeanQueryExec<T> = { lean: () => QueryExec<T> };
type LimitQueryExec<T> = { limit: (limit: number) => LeanQueryExec<T> };
type SortQueryExec<T> = { sort: (sort: Record<string, 1 | -1>) => LimitQueryExec<T> };
type SelectQueryExec<T> = { select: (projection: Record<string, 0 | 1>) => SortQueryExec<T> };

type ActiveTradeRepository = {
  find: (filter: Record<string, unknown>) => SelectQueryExec<ActiveTradeProjection[]>;
};
type SymbolRepository = {
  findOne: (filter: Record<string, unknown>) => LeanQueryExec<Record<string, any> | null>;
};
type StreamOrchestrator = {
  subscribe: (userId: string, subscription: ActiveTradeStreamSubscription) => Promise<void>;
  unsubscribe: (userId: string, subscription: ActiveTradeStreamSubscription) => Promise<void>;
};
type Dependencies = {
  activeTradeRepository: ActiveTradeRepository;
  symbolRepository: SymbolRepository;
  symbolResolver: Pick<SymbolResolverService, "resolveCanonicalSymbol">;
  now: () => Date;
  ttlMs: number;
  maxKeys: number;
  maxTradesPerKey: number;
};

const projection = {
  _id: 1,
  userId: 1,
  tradePlanId: 1,
  tradeSetupId: 1,
  symbolId: 1,
  symbolSnapshot: 1,
  direction: 1,
  actualEntry: 1,
  currentStopLoss: 1,
  actualTarget1: 1,
  actualTarget2: 1,
  actualRiskPerUnit: 1,
  status: 1,
} as const;

const normalize = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toUpperCase();
  return normalized || undefined;
};

export const buildActiveTradeSubscriptionKey = (input: {
  provider: MarketProvider;
  exchange: Exchange;
  symbolId?: string;
  instrumentToken?: string;
  providerSymbol?: string;
  symbol?: string;
  userId?: string;
}): string | null => {
  const identity = input.instrumentToken?.trim()
    || normalize(input.providerSymbol)
    || normalize(input.symbol)
    || (input.symbolId && isValidObjectId(input.symbolId) ? `SYMBOL_ID:${input.symbolId}` : undefined);
  if (!identity) return null;
  if (input.provider === "ANGEL_ONE" && !input.userId) return null;
  return buildMarketSubscriptionKey({
    provider: input.provider,
    exchange: input.exchange,
    instrumentToken: identity,
    ...(input.provider === "ANGEL_ONE" ? { userId: input.userId } : {}),
  });
};

export class ActiveTradeSubscriptionService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly registeredTrades = new Map<string, {
    subscriptionKey: string;
    userId: string;
    subscription: ActiveTradeStreamSubscription;
  }>();
  private readonly interestCounts = new Map<string, number>();
  private streamOrchestrator?: StreamOrchestrator;

  public constructor(private readonly dependencies: Partial<Dependencies> = {}) {}

  public configureStreamOrchestrator(orchestrator: StreamOrchestrator): void {
    this.streamOrchestrator = orchestrator;
  }

  public async registerActiveTrade(
    activeTrade: ActiveTradeRecord | ActiveTradeProjection,
  ): Promise<string | null> {
    if (!["ACTIVE", "PARTIALLY_EXITED"].includes(activeTrade.status)) return null;
    const subscription = await this.buildSubscription(activeTrade);
    if (!subscription) return null;
    const activeTradeId = String(activeTrade._id);
    const userId = String(activeTrade.userId);
    this.upsertCachedTrade(subscription.subscriptionKey, this.project(activeTrade));

    const previous = this.registeredTrades.get(activeTradeId);
    if (previous?.subscriptionKey === subscription.subscriptionKey) return subscription.subscriptionKey;
    if (previous) await this.unregisterActiveTrade(activeTradeId);

    this.registeredTrades.set(activeTradeId, {
      subscriptionKey: subscription.subscriptionKey,
      userId,
      subscription,
    });
    const currentCount = this.interestCounts.get(subscription.subscriptionKey) ?? 0;
    this.interestCounts.set(subscription.subscriptionKey, currentCount + 1);
    if (currentCount === 0 && this.streamOrchestrator) {
      try {
        await this.streamOrchestrator.subscribe(userId, subscription);
      } catch (error: unknown) {
        this.registeredTrades.delete(activeTradeId);
        this.interestCounts.delete(subscription.subscriptionKey);
        throw error;
      }
    }
    return subscription.subscriptionKey;
  }

  public async warmActiveTradeSubscriptions(limit = 1_000): Promise<{
    loadedCount: number;
    registeredCount: number;
    failedCount: number;
  }> {
    const trades = await this.getActiveTradeRepository()
      .find({ status: { $in: ["ACTIVE", "PARTIALLY_EXITED"] } })
      .select(projection)
      .sort({ _id: 1 })
      .limit(Math.max(1, limit))
      .lean()
      .exec();
    let registeredCount = 0;
    let failedCount = 0;
    for (const trade of trades) {
      try {
        if (await this.registerActiveTrade(trade)) registeredCount += 1;
      } catch (error: unknown) {
        failedCount += 1;
        logger.warn(
          {
            event: "ACTIVE_TRADE_SUBSCRIPTION_WARMUP_ITEM_FAILED",
            activeTradeId: String(trade._id),
            error: error instanceof Error ? error.message : "Unknown warmup error",
          },
          "Failed to warm one ActiveTrade subscription",
        );
      }
    }
    return { loadedCount: trades.length, registeredCount, failedCount };
  }

  public async unregisterActiveTrade(activeTrade: ActiveTradeRecord | string): Promise<void> {
    const activeTradeId = typeof activeTrade === "string" ? activeTrade : String(activeTrade._id);
    for (const [subscriptionKey] of this.cache) {
      this.removeCachedTrade(subscriptionKey, activeTradeId);
    }
    let registration = this.registeredTrades.get(activeTradeId);
    if (!registration && typeof activeTrade !== "string") {
      const subscription = await this.buildSubscription(activeTrade);
      if (subscription) {
        registration = {
          subscriptionKey: subscription.subscriptionKey,
          userId: String(activeTrade.userId),
          subscription,
        };
      }
    }
    if (!registration) return;

    this.registeredTrades.delete(activeTradeId);
    this.removeCachedTrade(registration.subscriptionKey, activeTradeId);
    const currentCount = this.interestCounts.get(registration.subscriptionKey) ?? 0;
    if (currentCount <= 1) {
      this.interestCounts.delete(registration.subscriptionKey);
      if (this.streamOrchestrator) {
        await this.streamOrchestrator.unsubscribe(registration.userId, registration.subscription);
      }
      return;
    }
    this.interestCounts.set(registration.subscriptionKey, currentCount - 1);
  }

  public async resolveTradesForTick(input: LiveTradeTickInput): Promise<ActiveTradeTickResolution | null> {
    const subscriptionKey = buildActiveTradeSubscriptionKey(input);
    if (!subscriptionKey) return null;
    const now = this.getNow().getTime();
    const cached = this.cache.get(subscriptionKey);
    if (cached && cached.expiresAt > now) {
      cached.touchedAt = now;
      return { subscriptionKey, trades: [...cached.trades], cacheHit: true };
    }

    const filter = await this.buildMatchFilter(input);
    if (!filter) return { subscriptionKey, trades: [], cacheHit: false };
    const trades = await this.getActiveTradeRepository()
      .find({
        status: { $in: ["ACTIVE", "PARTIALLY_EXITED"] },
        ...(input.provider === "ANGEL_ONE" && input.userId
          ? { userId: new Types.ObjectId(input.userId) }
          : {}),
        ...filter,
      })
      .select(projection)
      .sort({ _id: 1 })
      .limit(this.getMaxTradesPerKey())
      .lean()
      .exec();
    const safeTrades = trades.map((trade) => this.sanitizeProjection(trade));
    this.setCache(subscriptionKey, safeTrades, now);
    return { subscriptionKey, trades: safeTrades, cacheHit: false };
  }

  public getSnapshot(): Array<{
    subscriptionKey: string;
    tradeCount: number;
    expiresAt: Date;
    interestCount: number;
  }> {
    return [...this.cache.entries()].map(([subscriptionKey, entry]) => ({
      subscriptionKey,
      tradeCount: entry.trades.length,
      expiresAt: new Date(entry.expiresAt),
      interestCount: this.interestCounts.get(subscriptionKey) ?? 0,
    }));
  }

  private async buildSubscription(
    activeTrade: ActiveTradeRecord | ActiveTradeProjection,
  ): Promise<ActiveTradeStreamSubscription | null> {
    const snapshot = activeTrade.symbolSnapshot;
    const provider = snapshot.provider as MarketProvider | undefined;
    const marketType = snapshot.marketType as MarketType | undefined;
    const exchange = snapshot.exchange as Exchange | undefined;
    if (!provider || !marketType || !exchange) return null;

    const symbolRecord = await this.getSymbolRepository().findOne({
      _id: activeTrade.symbolId,
    }).lean().exec();
    const symbol = normalize(snapshot.symbol) ?? normalize(symbolRecord?.symbol);
    const providerSymbol = normalize(snapshot.providerSymbol) ?? normalize(symbolRecord?.providerSymbol) ?? symbol;
    const instrumentToken = normalize(symbolRecord?.instrumentToken)
      ?? (provider === "BINANCE" ? symbol : providerSymbol);
    if (!symbol || !providerSymbol || !instrumentToken) return null;
    const subscriptionKey = buildActiveTradeSubscriptionKey({
      provider,
      exchange,
      instrumentToken,
      providerSymbol,
      symbol,
      userId: String(activeTrade.userId),
    });
    if (!subscriptionKey) return null;
    return {
      subscriptionKey,
      symbolId: String(activeTrade.symbolId),
      symbol,
      displayName: String(snapshot.displayName ?? symbolRecord?.displayName ?? symbol),
      provider,
      marketType,
      exchange,
      instrumentToken,
      providerSymbol,
      requiresBrokerLogin: snapshot.requiresBrokerLogin === true || symbolRecord?.requiresBrokerLogin === true,
      supportedBroker: (symbolRecord?.supportedBroker as "ANGEL_ONE" | "KITE" | "NONE" | undefined)
        ?? (provider === "ANGEL_ONE" ? "ANGEL_ONE" : "NONE"),
    };
  }

  private async buildMatchFilter(input: LiveTradeTickInput): Promise<Record<string, unknown> | null> {
    if (input.symbolId && isValidObjectId(input.symbolId)) {
      return { symbolId: new Types.ObjectId(input.symbolId) };
    }
    const providerSymbol = normalize(input.providerSymbol) ?? normalize(input.symbol);
    const resolveInput: Parameters<SymbolResolverService["resolveCanonicalSymbol"]>[0] = {
      provider: input.provider,
      exchange: input.exchange,
    };
    if (providerSymbol) resolveInput.providerSymbol = providerSymbol;
    if (input.instrumentToken?.trim()) resolveInput.instrumentToken = input.instrumentToken.trim();
    const resolved = await this.getSymbolResolver().resolveCanonicalSymbol(resolveInput);
    if (resolved.resolved && resolved.symbolId && isValidObjectId(resolved.symbolId)) {
      return { symbolId: new Types.ObjectId(resolved.symbolId) };
    }
    const candidates = [normalize(input.symbol), normalize(input.providerSymbol)]
      .filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index);
    if (candidates.length === 0) return null;
    return {
      "symbolSnapshot.provider": input.provider,
      "symbolSnapshot.exchange": input.exchange,
      $or: candidates.flatMap((candidate) => [
        { "symbolSnapshot.symbol": candidate },
        { "symbolSnapshot.providerSymbol": candidate },
      ]),
    };
  }

  private project(activeTrade: ActiveTradeRecord | ActiveTradeProjection): ActiveTradeProjection {
    return this.sanitizeProjection({
      _id: activeTrade._id,
      userId: activeTrade.userId,
      tradePlanId: activeTrade.tradePlanId,
      tradeSetupId: activeTrade.tradeSetupId,
      symbolId: activeTrade.symbolId,
      symbolSnapshot: activeTrade.symbolSnapshot,
      direction: activeTrade.direction,
      actualEntry: activeTrade.actualEntry,
      currentStopLoss: activeTrade.currentStopLoss,
      actualTarget1: activeTrade.actualTarget1,
      ...(activeTrade.actualTarget2 !== undefined ? { actualTarget2: activeTrade.actualTarget2 } : {}),
      actualRiskPerUnit: activeTrade.actualRiskPerUnit,
      status: activeTrade.status,
    });
  }

  private sanitizeProjection(activeTrade: ActiveTradeProjection): ActiveTradeProjection {
    const snapshot = activeTrade.symbolSnapshot;
    const safeSnapshot: Record<string, unknown> = {};
    for (const key of [
      "symbolId",
      "symbol",
      "displayName",
      "provider",
      "marketType",
      "exchange",
      "instrumentType",
      "providerSymbol",
      "requiresBrokerLogin",
    ]) {
      if (snapshot[key] !== undefined) safeSnapshot[key] = snapshot[key];
    }
    return {
      _id: activeTrade._id,
      userId: activeTrade.userId,
      tradePlanId: activeTrade.tradePlanId,
      tradeSetupId: activeTrade.tradeSetupId,
      symbolId: activeTrade.symbolId,
      symbolSnapshot: safeSnapshot,
      direction: activeTrade.direction,
      actualEntry: activeTrade.actualEntry,
      currentStopLoss: activeTrade.currentStopLoss,
      actualTarget1: activeTrade.actualTarget1,
      ...(activeTrade.actualTarget2 !== undefined ? { actualTarget2: activeTrade.actualTarget2 } : {}),
      actualRiskPerUnit: activeTrade.actualRiskPerUnit,
      status: activeTrade.status,
    };
  }

  private upsertCachedTrade(subscriptionKey: string, trade: ActiveTradeProjection): void {
    const now = this.getNow().getTime();
    const current = this.cache.get(subscriptionKey)?.trades ?? [];
    const trades = current.filter((item) => String(item._id) !== String(trade._id));
    trades.push(trade);
    trades.sort((left, right) => String(left._id).localeCompare(String(right._id)));
    this.setCache(subscriptionKey, trades.slice(0, this.getMaxTradesPerKey()), now);
  }

  private removeCachedTrade(subscriptionKey: string, activeTradeId: string): void {
    const entry = this.cache.get(subscriptionKey);
    if (!entry) return;
    entry.trades = entry.trades.filter((trade) => String(trade._id) !== activeTradeId);
    entry.touchedAt = this.getNow().getTime();
  }

  private setCache(subscriptionKey: string, trades: ActiveTradeProjection[], now: number): void {
    this.cache.set(subscriptionKey, {
      trades: trades.filter((trade) => ["ACTIVE", "PARTIALLY_EXITED"].includes(trade.status)),
      expiresAt: now + this.getTtlMs(),
      touchedAt: now,
    });
    this.enforceBounds();
  }

  private enforceBounds(): void {
    const overflow = this.cache.size - this.getMaxKeys();
    if (overflow <= 0) return;
    const oldest = [...this.cache.entries()]
      .sort((left, right) => left[1].touchedAt - right[1].touchedAt)
      .slice(0, overflow);
    for (const [key] of oldest) this.cache.delete(key);
  }

  private getActiveTradeRepository(): ActiveTradeRepository {
    return this.dependencies.activeTradeRepository ?? ActiveTradeModel;
  }
  private getSymbolRepository(): SymbolRepository {
    return this.dependencies.symbolRepository ?? SymbolModel;
  }
  private getSymbolResolver(): Pick<SymbolResolverService, "resolveCanonicalSymbol"> {
    return this.dependencies.symbolResolver ?? new SymbolResolverService();
  }
  private getNow(): Date {
    return this.dependencies.now?.() ?? new Date();
  }
  private getTtlMs(): number {
    return this.dependencies.ttlMs ?? 5_000;
  }
  private getMaxKeys(): number {
    return this.dependencies.maxKeys ?? 5_000;
  }
  private getMaxTradesPerKey(): number {
    return this.dependencies.maxTradesPerKey ?? 101;
  }
}

export const sharedActiveTradeSubscriptionService = new ActiveTradeSubscriptionService();
