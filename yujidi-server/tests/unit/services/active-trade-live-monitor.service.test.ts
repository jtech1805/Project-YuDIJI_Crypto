import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import { ActiveTradeLiveMonitorService } from "../../../src/services/active-trade-live-monitor.service.js";
import { ActiveTradeSubscriptionService } from "../../../src/services/active-trade-subscription.service.js";
import { TradeMonitoringHealthService } from "../../../src/services/trade-monitoring-health.service.js";
import { TradeEventService } from "../../../src/services/trade-event.service.js";
import { TradeMonitoringService } from "../../../src/services/trade-monitoring.service.js";

const userId = "69e64c5f9042aac89c8c83f8";
const otherUserId = "69e64c5f9042aac89c8c83f9";
const symbolId = "65abc0000000000000000001";
const fixedNow = new Date("2026-06-24T12:00:00.000Z");

const getPath = (record: Record<string, any>, path: string): unknown =>
  path.split(".").reduce<unknown>((value, key) => (
    value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined
  ), record);

const equalValue = (left: unknown, right: unknown): boolean => String(left) === String(right);

const matchesFilter = (record: Record<string, any>, filter: Record<string, any>): boolean =>
  Object.entries(filter).every(([key, value]) => {
    if (key === "$or") {
      return (value as Record<string, unknown>[]).some((clause) => matchesFilter(record, clause));
    }
    const recordValue = getPath(record, key);
    if (value && typeof value === "object" && "$in" in value) {
      return (value.$in as unknown[]).some((candidate) => equalValue(recordValue, candidate));
    }
    return equalValue(recordValue, value);
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
  },
  direction: "LONG",
  actualEntry: 100,
  currentStopLoss: 95,
  actualTarget1: 110,
  actualTarget2: 115,
  actualRiskPerUnit: 5,
  status: "ACTIVE",
  ...overrides,
});

const createRepository = (records: Record<string, any>[]) => ({
  find: (filter: Record<string, unknown>) => ({
    select: () => ({
      sort: () => ({
        limit: (limit: number) => ({
          lean: () => ({
            exec: async () => records
              .filter((record) => matchesFilter(record, filter))
              .sort((left, right) => String(left._id).localeCompare(String(right._id)))
              .slice(0, limit),
          }),
        }),
      }),
    }),
  }),
});

const createHarness = (options: {
  trades?: Record<string, any>[];
  resolvedSymbolId?: string;
  maxTickAgeMs?: number;
  minEvaluationIntervalMs?: number;
  maxTradesPerTick?: number;
} = {}) => {
  const trades = options.trades ?? [makeTrade()];
  const evaluations: Array<{ userId: string; activeTradeId: string; input: Record<string, any> }> = [];
  const tradeResult = { created: false };
  const riskState = { totalTrades: 0, netPnl: 0 };
  const subscriptionService = new ActiveTradeSubscriptionService({
    activeTradeRepository: createRepository(trades) as never,
    symbolRepository: {
      findOne: () => ({
        lean: () => ({
          exec: async () => ({
            _id: new Types.ObjectId(symbolId),
            symbol: "BTCUSDT",
            displayName: "BTC / USDT",
            providerSymbol: "BTCUSDT",
            instrumentToken: "BTCUSDT",
          }),
        }),
      }),
    },
    symbolResolver: {
      resolveCanonicalSymbol: async () => options.resolvedSymbolId
        ? {
            resolved: true,
            symbolId: options.resolvedSymbolId,
            confidence: "HIGH",
            reasonCode: "MATCHED_BY_INSTRUMENT_TOKEN",
          }
        : {
            resolved: false,
            confidence: "LOW",
            reasonCode: "NO_MAPPING_FOUND",
        },
    },
    now: () => fixedNow,
    ttlMs: 5_000,
    maxKeys: 100,
    maxTradesPerKey: 101,
  });
  const service = new ActiveTradeLiveMonitorService({
    subscriptionService,
    healthService: {
      recordTick: () => undefined,
      recordEvaluated: () => undefined,
      recordSkipped: () => undefined,
      recordStale: () => undefined,
      recordCooldownSkip: () => undefined,
      recordWorkloadCap: () => undefined,
    },
    tradeMonitoringService: {
      evaluateActiveTrade: async (evaluationUserId, activeTradeId, input) => {
        evaluations.push({ userId: evaluationUserId, activeTradeId, input });
        return {} as never;
      },
    },
    now: () => fixedNow,
    maxTickAgeMs: options.maxTickAgeMs ?? 10_000,
    minEvaluationIntervalMs: options.minEvaluationIntervalMs ?? 1_000,
    maxTradesPerTick: options.maxTradesPerTick ?? 100,
    maxCooldownEntries: 100,
  });
  return { evaluations, riskState, service, subscriptionService, tradeResult, trades };
};

test("Binance tick matches active trade by canonical symbolId", async () => {
  const harness = createHarness();
  const result = await harness.service.handleTick({
    provider: "BINANCE",
    exchange: "BINANCE",
    symbolId,
    symbol: "BTCUSDT",
    price: 110,
    occurredAt: fixedNow,
    receivedAt: fixedNow,
    source: "BINANCE_WS",
  });
  assert.equal(result.evaluatedCount, 1);
  assert.equal(harness.evaluations[0]?.userId, userId);
});

test("Binance tick resolves canonical symbol before evaluating", async () => {
  const harness = createHarness({ resolvedSymbolId: symbolId });
  const result = await harness.service.handleTick({
    provider: "BINANCE",
    exchange: "BINANCE",
    symbol: "BTCUSDT",
    instrumentToken: "BTCUSDT",
    price: 110,
    occurredAt: fixedNow,
    receivedAt: fixedNow,
    source: "BINANCE_WS",
  });
  assert.equal(result.evaluatedCount, 1);
});

test("Binance tick can use strict provider exchange and symbol fallback", async () => {
  const harness = createHarness();
  const result = await harness.service.handleTick({
    provider: "BINANCE",
    exchange: "BINANCE",
    symbol: "BTCUSDT",
    price: 110,
    occurredAt: fixedNow,
    receivedAt: fixedNow,
    source: "BINANCE_WS",
  });
  assert.equal(result.evaluatedCount, 1);
});

test("Angel tick requires a valid userId", async () => {
  const harness = createHarness();
  const result = await harness.service.handleTick({
    provider: "ANGEL_ONE",
    exchange: "MCX",
    symbol: "MCX:GOLD:04DEC2026:FUTURE",
    price: 110,
    occurredAt: fixedNow,
    receivedAt: fixedNow,
    source: "ANGEL_WS",
  });
  assert.deepEqual(result.reasons, ["USER_SCOPE_REQUIRED"]);
  assert.equal(harness.evaluations.length, 0);
});

test("Angel tick evaluates only ActiveTrades owned by its user session", async () => {
  const ownTrade = makeTrade({
    userId: new Types.ObjectId(userId),
    symbolSnapshot: {
      symbol: "MCX:GOLD:04DEC2026:FUTURE",
      providerSymbol: "GOLD04DEC26FUT",
      provider: "ANGEL_ONE",
      exchange: "MCX",
    },
  });
  const otherTrade = makeTrade({
    userId: new Types.ObjectId(otherUserId),
    symbolSnapshot: {
      symbol: "MCX:GOLD:04DEC2026:FUTURE",
      providerSymbol: "GOLD04DEC26FUT",
      provider: "ANGEL_ONE",
      exchange: "MCX",
    },
  });
  const harness = createHarness({ trades: [ownTrade, otherTrade] });
  await harness.service.handleTick({
    provider: "ANGEL_ONE",
    exchange: "MCX",
    symbol: "MCX:GOLD:04DEC2026:FUTURE",
    providerSymbol: "GOLD04DEC26FUT",
    instrumentToken: "495213",
    userId,
    price: 110,
    occurredAt: fixedNow,
    receivedAt: fixedNow,
    source: "ANGEL_WS",
  });
  assert.equal(harness.evaluations.length, 1);
  assert.equal(harness.evaluations[0]?.userId, userId);
});

test("Angel tick does not evaluate another user's matching ActiveTrade", async () => {
  const harness = createHarness({
    trades: [makeTrade({
      userId: new Types.ObjectId(otherUserId),
      symbolSnapshot: {
        symbol: "MCX:GOLD:04DEC2026:FUTURE",
        providerSymbol: "GOLD04DEC26FUT",
        provider: "ANGEL_ONE",
        exchange: "MCX",
      },
    })],
  });
  const result = await harness.service.handleTick({
    provider: "ANGEL_ONE",
    exchange: "MCX",
    symbol: "MCX:GOLD:04DEC2026:FUTURE",
    providerSymbol: "GOLD04DEC26FUT",
    userId,
    price: 110,
    occurredAt: fixedNow,
    receivedAt: fixedNow,
    source: "ANGEL_WS",
  });
  assert.equal(result.evaluatedCount, 0);
  assert.equal(harness.evaluations.length, 0);
});

test("closed stopped-out and cancelled trades are not evaluated", async () => {
  const harness = createHarness({
    trades: [
      makeTrade({ status: "CLOSED" }),
      makeTrade({ status: "STOPPED_OUT" }),
      makeTrade({ status: "CANCELLED" }),
    ],
  });
  const result = await harness.service.handleTick({
    provider: "BINANCE",
    exchange: "BINANCE",
    symbolId,
    price: 110,
    occurredAt: fixedNow,
    receivedAt: fixedNow,
    source: "BINANCE_WS",
  });
  assert.equal(result.evaluatedCount, 0);
});

test("partially exited trade remains eligible for live evaluation", async () => {
  const harness = createHarness({ trades: [makeTrade({ status: "PARTIALLY_EXITED" })] });
  const result = await harness.service.handleTick({
    provider: "BINANCE",
    exchange: "BINANCE",
    symbolId,
    price: 110,
    occurredAt: fixedNow,
    receivedAt: fixedNow,
    source: "BINANCE_WS",
  });
  assert.equal(result.evaluatedCount, 1);
});

test("stale tick is skipped before database matching", async () => {
  const harness = createHarness();
  const result = await harness.service.handleTick({
    provider: "BINANCE",
    exchange: "BINANCE",
    symbolId,
    price: 110,
    occurredAt: new Date(fixedNow.getTime() - 10_001),
    receivedAt: fixedNow,
    source: "BINANCE_WS",
  });
  assert.deepEqual(result.reasons, ["TICK_STALE"]);
  assert.equal(harness.evaluations.length, 0);
});

test("per-trade cooldown skips repeated high-frequency evaluation", async () => {
  const harness = createHarness({ minEvaluationIntervalMs: 1_000 });
  const tick = {
    provider: "BINANCE" as const,
    exchange: "BINANCE" as const,
    symbolId,
    price: 110,
    occurredAt: fixedNow,
    receivedAt: fixedNow,
    source: "BINANCE_WS" as const,
  };
  await harness.service.handleTick(tick);
  const second = await harness.service.handleTick({
    ...tick,
    occurredAt: new Date(fixedNow.getTime() + 500),
    receivedAt: new Date(fixedNow.getTime() + 500),
  });
  assert.equal(harness.evaluations.length, 1);
  assert.equal(second.reasons.includes("COOLDOWN_ACTIVE"), true);
});

test("workload cap bounds number of evaluated trades deterministically", async () => {
  const trades = [makeTrade(), makeTrade(), makeTrade(), makeTrade()];
  const harness = createHarness({ trades, maxTradesPerTick: 2 });
  const result = await harness.service.handleTick({
    provider: "BINANCE",
    exchange: "BINANCE",
    symbolId,
    price: 110,
    occurredAt: fixedNow,
    receivedAt: fixedNow,
    source: "BINANCE_WS",
  });
  assert.equal(result.evaluatedCount, 2);
  assert.equal(result.reasons.includes("WORKLOAD_CAP_REACHED"), true);
  assert.equal(harness.evaluations.length, 2);
});

test("matching ActiveTrades call TradeMonitoringService with MARKET_TICK", async () => {
  const harness = createHarness();
  await harness.service.handleTick({
    provider: "BINANCE",
    exchange: "BINANCE",
    symbolId,
    price: 107,
    occurredAt: fixedNow,
    receivedAt: fixedNow,
    source: "BINANCE_WS",
  });
  assert.deepEqual(harness.evaluations[0]?.input, {
    price: 107,
    source: "MARKET_TICK",
    occurredAt: fixedNow,
  });
});

test("live tick evaluation does not create TradeResult or mutate risk state", async () => {
  const harness = createHarness();
  const riskBefore = structuredClone(harness.riskState);
  await harness.service.handleTick({
    provider: "BINANCE",
    exchange: "BINANCE",
    symbolId,
    price: 110,
    occurredAt: fixedNow,
    receivedAt: fixedNow,
    source: "BINANCE_WS",
  });
  assert.equal(harness.tradeResult.created, false);
  assert.deepEqual(harness.riskState, riskBefore);
});

test("live monitor updates health counters for evaluated stale and cooldown ticks", async () => {
  const harness = createHarness();
  const health = new TradeMonitoringHealthService();
  const service = new ActiveTradeLiveMonitorService({
    subscriptionService: harness.subscriptionService,
    healthService: health,
    tradeMonitoringService: {
      evaluateActiveTrade: async () => ({} as never),
    },
    now: () => fixedNow,
    minEvaluationIntervalMs: 1_000,
  });
  const tick = {
    provider: "BINANCE" as const,
    exchange: "BINANCE" as const,
    symbol: "BTCUSDT",
    instrumentToken: "BTCUSDT",
    price: 110,
    occurredAt: fixedNow,
    receivedAt: fixedNow,
    source: "BINANCE_WS" as const,
  };
  await service.handleTick(tick);
  await service.handleTick({
    ...tick,
    occurredAt: new Date(fixedNow.getTime() + 500),
    receivedAt: new Date(fixedNow.getTime() + 500),
  });
  await service.handleTick({
    ...tick,
    occurredAt: new Date(fixedNow.getTime() - 10_001),
  });
  const snapshot = health.getSnapshot()[0]!;
  assert.equal(snapshot.evaluatedCount, 1);
  assert.equal(snapshot.cooldownSkipCount, 1);
  assert.equal(snapshot.staleTickCount, 1);
});

test("live monitoring reuses TradeEvent persistence and delivery path", async () => {
  const activeTrade = makeTrade();
  const tradeEvents: Record<string, any>[] = [];
  const deliveries: Record<string, any>[] = [];
  const eventRepository = {
    create: async (input: Record<string, unknown>) => {
      const event = { _id: new Types.ObjectId(), ...input };
      tradeEvents.push(event);
      return event;
    },
    find: () => ({ sort: () => ({ lean: () => ({ exec: async () => tradeEvents }) }) }),
    findOne: () => ({ lean: () => ({ exec: async () => null }) }),
  };
  const eventService = new TradeEventService({
    tradeEventRepository: eventRepository as never,
    auditLogService: { record: async () => undefined },
    deliveryService: { deliver: async (event) => { deliveries.push(event); } },
  });
  const monitoringService = new TradeMonitoringService({
    activeTradeRepository: {
      findOne: () => ({ lean: () => ({ exec: async () => activeTrade }) }),
    } as never,
    tradeEventService: eventService,
    auditLogService: { record: async () => undefined },
    now: () => fixedNow,
  });
  const liveService = new ActiveTradeLiveMonitorService({
    subscriptionService: new ActiveTradeSubscriptionService({
      activeTradeRepository: createRepository([activeTrade]) as never,
      symbolRepository: {
        findOne: () => ({
          lean: () => ({
            exec: async () => ({
              _id: new Types.ObjectId(symbolId),
              symbol: "BTCUSDT",
              displayName: "BTC / USDT",
              providerSymbol: "BTCUSDT",
              instrumentToken: "BTCUSDT",
            }),
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
      now: () => fixedNow,
    }),
    healthService: {
      recordTick: () => undefined,
      recordEvaluated: () => undefined,
      recordSkipped: () => undefined,
      recordStale: () => undefined,
      recordCooldownSkip: () => undefined,
      recordWorkloadCap: () => undefined,
    },
    tradeMonitoringService: monitoringService,
    now: () => fixedNow,
  });

  await liveService.handleTick({
    provider: "BINANCE",
    exchange: "BINANCE",
    symbolId,
    price: 110,
    occurredAt: fixedNow,
    receivedAt: fixedNow,
    source: "BINANCE_WS",
  });

  assert.equal(tradeEvents.length > 0, true);
  assert.equal(deliveries.length, tradeEvents.length);
});
