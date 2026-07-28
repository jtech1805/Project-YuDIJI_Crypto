import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import {
  ActiveTradeSubscriptionService,
  buildActiveTradeSubscriptionKey,
} from "../../../src/services/active-trade-subscription.service.js";
import { TradeMonitoringHealthService } from "../../../src/services/trade-monitoring-health.service.js";

const userId = "69e64c5f9042aac89c8c83f8";
const otherUserId = "69e64c5f9042aac89c8c83f9";
const symbolId = "65abc0000000000000000001";
let now = new Date("2026-06-24T12:00:00.000Z");

const getPath = (record: Record<string, any>, path: string): unknown =>
  path.split(".").reduce<unknown>((value, key) => (
    value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined
  ), record);

const matches = (record: Record<string, any>, filter: Record<string, any>): boolean =>
  Object.entries(filter).every(([key, value]) => {
    if (key === "$or") {
      return (value as Record<string, unknown>[]).some((clause) => matches(record, clause));
    }
    const recordValue = getPath(record, key);
    if (value && typeof value === "object" && "$in" in value) {
      return (value.$in as unknown[]).some((candidate) => String(candidate) === String(recordValue));
    }
    return String(value) === String(recordValue);
  });

const makeTrade = (overrides: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(),
  userId: new Types.ObjectId(userId),
  tradePlanId: new Types.ObjectId(),
  tradeSetupId: new Types.ObjectId(),
  symbolId: new Types.ObjectId(symbolId),
  symbolSnapshot: {
    symbolId: new Types.ObjectId(symbolId),
    symbol: "BTCUSDT",
    displayName: "BTC / USDT",
    provider: "BINANCE",
    marketType: "CRYPTO",
    exchange: "BINANCE",
    instrumentType: "SPOT",
    providerSymbol: "BTCUSDT",
    requiresBrokerLogin: false,
    secret: "must-not-cache",
  },
  marketType: "CRYPTO",
  tradeStyle: "INTRADAY",
  instrumentType: "SPOT",
  direction: "LONG",
  actualEntry: 100,
  currentStopLoss: 95,
  actualTarget1: 110,
  actualRiskPerUnit: 5,
  status: "ACTIVE",
  ...overrides,
});

const createHarness = (options: {
  trades?: Record<string, any>[];
  ttlMs?: number;
  maxKeys?: number;
  maxTradesPerKey?: number;
  symbol?: Record<string, any>;
} = {}) => {
  now = new Date("2026-06-24T12:00:00.000Z");
  const trades = options.trades ?? [makeTrade()];
  let queryCount = 0;
  const subscriptions: Record<string, any>[] = [];
  const unsubscriptions: Record<string, any>[] = [];
  const service = new ActiveTradeSubscriptionService({
    activeTradeRepository: {
      find: (filter: Record<string, unknown>) => ({
        select: () => ({
          sort: () => ({
            limit: (limit: number) => ({
              lean: () => ({
                exec: async () => {
                  queryCount += 1;
                  return trades.filter((trade) => matches(trade, filter)).slice(0, limit);
                },
              }),
            }),
          }),
        }),
      }),
    } as never,
    symbolRepository: {
      findOne: () => ({
        lean: () => ({
          exec: async () => options.symbol ?? {
            _id: new Types.ObjectId(symbolId),
            symbol: "BTCUSDT",
            displayName: "BTC / USDT",
            providerSymbol: "BTCUSDT",
            instrumentToken: "BTCUSDT",
            requiresBrokerLogin: false,
            supportedBroker: "NONE",
          },
        }),
      }),
    },
    symbolResolver: {
      resolveCanonicalSymbol: async () => ({
        resolved: true,
        symbolId,
        confidence: "HIGH",
        reasonCode: "MATCHED_BY_INSTRUMENT_TOKEN",
      }),
    },
    now: () => now,
    ttlMs: options.ttlMs ?? 5_000,
    maxKeys: options.maxKeys ?? 5_000,
    maxTradesPerKey: options.maxTradesPerKey ?? 101,
  });
  service.configureStreamOrchestrator({
    subscribe: async (registeredUserId, subscription) => {
      subscriptions.push({ userId: registeredUserId, subscription });
    },
    unsubscribe: async (registeredUserId, subscription) => {
      unsubscriptions.push({ userId: registeredUserId, subscription });
    },
  });
  return {
    get queryCount() { return queryCount; },
    service,
    subscriptions,
    trades,
    unsubscriptions,
  };
};

test("Binance active-trade subscription key is provider aware and public", () => {
  assert.equal(buildActiveTradeSubscriptionKey({
    provider: "BINANCE",
    exchange: "BINANCE",
    instrumentToken: "BTCUSDT",
  }), "BINANCE:BINANCE:BTCUSDT");
});

test("Angel active-trade subscription key includes userId", () => {
  assert.equal(buildActiveTradeSubscriptionKey({
    provider: "ANGEL_ONE",
    userId,
    exchange: "MCX",
    instrumentToken: "495213",
  }), `ANGEL_ONE:${userId}:MCX:495213`);
});

test("Angel active-trade subscription key rejects missing userId", () => {
  assert.equal(buildActiveTradeSubscriptionKey({
    provider: "ANGEL_ONE",
    exchange: "MCX",
    instrumentToken: "495213",
  }), null);
});

test("registration caches bounded projected trade data and subscribes once", async () => {
  const harness = createHarness();
  const trade = harness.trades[0]!;
  const key = await harness.service.registerActiveTrade(trade as never);
  assert.equal(key, "BINANCE:BINANCE:BTCUSDT");
  assert.equal(harness.subscriptions.length, 1);

  const resolution = await harness.service.resolveTradesForTick({
    provider: "BINANCE",
    exchange: "BINANCE",
    symbol: "BTCUSDT",
    instrumentToken: "BTCUSDT",
    price: 100,
    source: "BINANCE_WS",
  });
  assert.equal(resolution?.cacheHit, true);
  assert.equal(resolution?.trades.length, 1);
  const serialized = JSON.stringify(resolution?.trades[0]);
  assert.equal(serialized.includes("must-not-cache"), false);
  assert.equal(serialized.includes("executionQuality"), false);
});

test("cache lookup avoids MongoDB until TTL expires", async () => {
  const harness = createHarness({ ttlMs: 5_000 });
  const tick = {
    provider: "BINANCE" as const,
    exchange: "BINANCE" as const,
    symbol: "BTCUSDT",
    instrumentToken: "BTCUSDT",
    price: 100,
    source: "BINANCE_WS" as const,
  };
  await harness.service.resolveTradesForTick(tick);
  await harness.service.resolveTradesForTick(tick);
  assert.equal(harness.queryCount, 1);
  now = new Date(now.getTime() + 5_001);
  await harness.service.resolveTradesForTick(tick);
  assert.equal(harness.queryCount, 2);
});

test("MongoDB fallback refreshes cache", async () => {
  const harness = createHarness();
  const tick = {
    provider: "BINANCE" as const,
    exchange: "BINANCE" as const,
    symbol: "BTCUSDT",
    instrumentToken: "BTCUSDT",
    price: 100,
    source: "BINANCE_WS" as const,
  };
  const first = await harness.service.resolveTradesForTick(tick);
  const second = await harness.service.resolveTradesForTick(tick);
  assert.equal(first?.cacheHit, false);
  assert.equal(second?.cacheHit, true);
});

test("cache and Mongo fallback exclude inactive trades", async () => {
  const harness = createHarness({
    trades: [
      makeTrade({ status: "CLOSED" }),
      makeTrade({ status: "STOPPED_OUT" }),
      makeTrade({ status: "CANCELLED" }),
    ],
  });
  const resolution = await harness.service.resolveTradesForTick({
    provider: "BINANCE",
    exchange: "BINANCE",
    symbol: "BTCUSDT",
    instrumentToken: "BTCUSDT",
    price: 100,
    source: "BINANCE_WS",
  });
  assert.equal(resolution?.trades.length, 0);
});

test("bounded cache evicts oldest subscription keys", async () => {
  const firstTrade = makeTrade();
  const harness = createHarness({ trades: [firstTrade], maxKeys: 1 });
  await harness.service.resolveTradesForTick({
    provider: "BINANCE",
    exchange: "BINANCE",
    symbol: "BTCUSDT",
    instrumentToken: "BTCUSDT",
    price: 100,
    source: "BINANCE_WS",
  });
  await harness.service.resolveTradesForTick({
    provider: "BINANCE",
    exchange: "BINANCE",
    symbol: "ETHUSDT",
    instrumentToken: "ETHUSDT",
    price: 100,
    source: "BINANCE_WS",
  });
  assert.equal(harness.service.getSnapshot().length, 1);
  assert.equal(harness.service.getSnapshot()[0]?.subscriptionKey, "BINANCE:BINANCE:ETHUSDT");
});

test("unregister removes cache interest and provider subscription", async () => {
  const harness = createHarness();
  const trade = harness.trades[0]!;
  await harness.service.registerActiveTrade(trade as never);
  await harness.service.unregisterActiveTrade(trade as never);
  assert.equal(harness.unsubscriptions.length, 1);
  assert.equal(harness.service.getSnapshot()[0]?.tradeCount, 0);
});

test("failed provider subscription rolls back interest so registration can retry", async () => {
  const harness = createHarness();
  const trade = harness.trades[0]!;
  let attempts = 0;
  harness.service.configureStreamOrchestrator({
    subscribe: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("provider unavailable");
    },
    unsubscribe: async () => undefined,
  });
  await assert.rejects(harness.service.registerActiveTrade(trade as never), /provider unavailable/);
  await assert.doesNotReject(harness.service.registerActiveTrade(trade as never));
  assert.equal(attempts, 2);
});

test("bounded startup warm-up registers existing active trades", async () => {
  const harness = createHarness({ trades: [makeTrade(), makeTrade(), makeTrade()] });
  const result = await harness.service.warmActiveTradeSubscriptions(2);
  assert.deepEqual(result, { loadedCount: 2, registeredCount: 2, failedCount: 0 });
  assert.equal(harness.subscriptions.length, 1);
});

test("Angel cache resolution remains scoped to same user", async () => {
  const angelSnapshot = {
    symbol: "MCX:GOLD:04DEC2026:FUTURE",
    displayName: "MCX GOLD 04DEC2026 FUTURE",
    provider: "ANGEL_ONE",
    marketType: "COMMODITY",
    exchange: "MCX",
    instrumentType: "FUTURE",
    providerSymbol: "GOLD04DEC26FUT",
  };
  const harness = createHarness({
    trades: [
      makeTrade({ userId: new Types.ObjectId(userId), symbolSnapshot: angelSnapshot }),
      makeTrade({ userId: new Types.ObjectId(otherUserId), symbolSnapshot: angelSnapshot }),
    ],
    symbol: {
      _id: new Types.ObjectId(symbolId),
      symbol: "MCX:GOLD:04DEC2026:FUTURE",
      displayName: "MCX GOLD 04DEC2026 FUTURE",
      providerSymbol: "GOLD04DEC26FUT",
      instrumentToken: "495213",
      requiresBrokerLogin: true,
      supportedBroker: "ANGEL_ONE",
    },
  });
  const resolution = await harness.service.resolveTradesForTick({
    provider: "ANGEL_ONE",
    exchange: "MCX",
    userId,
    symbol: "MCX:GOLD:04DEC2026:FUTURE",
    providerSymbol: "GOLD04DEC26FUT",
    instrumentToken: "495213",
    price: 100,
    source: "ANGEL_WS",
  });
  assert.equal(resolution?.trades.length, 1);
  assert.equal(String(resolution?.trades[0]?.userId), userId);
});

test("Binance public cache can return matching trades across users", async () => {
  const harness = createHarness({
    trades: [
      makeTrade({ userId: new Types.ObjectId(userId) }),
      makeTrade({ userId: new Types.ObjectId(otherUserId) }),
    ],
  });
  const resolution = await harness.service.resolveTradesForTick({
    provider: "BINANCE",
    exchange: "BINANCE",
    symbol: "BTCUSDT",
    instrumentToken: "BTCUSDT",
    price: 100,
    source: "BINANCE_WS",
  });
  assert.deepEqual(
    resolution?.trades.map((trade) => String(trade.userId)).sort(),
    [otherUserId, userId].sort(),
  );
});

test("monitoring health tracks evaluated stale cooldown and workload counters", () => {
  const health = new TradeMonitoringHealthService(10);
  const key = "BINANCE:BINANCE:BTCUSDT";
  health.recordTick(key, now);
  health.recordEvaluated(key, now, 2);
  health.recordStale(key);
  health.recordCooldownSkip(key, 3);
  health.recordWorkloadCap(key, 4);
  assert.deepEqual(health.getSnapshot()[0], {
    subscriptionKey: key,
    lastTickAt: now,
    lastEvaluatedAt: now,
    skippedCount: 8,
    evaluatedCount: 2,
    staleTickCount: 1,
    cooldownSkipCount: 3,
    workloadCapHitCount: 1,
  });
});
