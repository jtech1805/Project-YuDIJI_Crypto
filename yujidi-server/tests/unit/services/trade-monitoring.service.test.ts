import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import { TradeEventService } from "../../../src/services/trading/trade-event.service.js";
import {
  calculateCurrentR,
  TradeMonitoringService,
} from "../../../src/services/trading/trade-monitoring.service.js";

const userId = "69e64c5f9042aac89c8c83f8";
const otherUserId = "69e64c5f9042aac89c8c83f9";
const tradePlanId = "65abc0000000000000000002";
const activeTradeId = "65abc0000000000000000003";
const tradeSetupId = "65abc0000000000000000004";
const symbolId = "65abc0000000000000000001";
const fixedNow = new Date("2026-06-24T12:00:00.000Z");

const execResult = <T>(value: T) => ({
  exec: async () => value,
});

const leanResult = <T>(value: T) => ({
  lean: () => execResult(value),
});

const sortableLeanResult = <T>(value: T) => ({
  sort: () => leanResult(value),
});

const idString = (value: unknown): string => String(value);

const matchesFilter = (record: Record<string, any>, filter: Record<string, any>): boolean => {
  for (const [key, value] of Object.entries(filter)) {
    const recordValue = record[key];
    if (recordValue instanceof Types.ObjectId || value instanceof Types.ObjectId) {
      if (idString(recordValue) !== idString(value)) return false;
      continue;
    }
    if (recordValue !== value) return false;
  }
  return true;
};

const symbolSnapshot = {
  symbolId: new Types.ObjectId(symbolId),
  symbol: "MCX:GOLD:04DEC2026:FUTURE",
  displayName: "MCX GOLD 04DEC2026 FUTURE",
  provider: "ANGEL_ONE",
  marketType: "COMMODITY",
  exchange: "MCX",
  instrumentType: "FUTURE",
  providerSymbol: "GOLD04DEC26FUT",
  requiresBrokerLogin: true,
};

const makeLongTrade = (overrides: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(activeTradeId),
  userId: new Types.ObjectId(userId),
  tradePlanId: new Types.ObjectId(tradePlanId),
  tradeSetupId: new Types.ObjectId(tradeSetupId),
  symbolId: new Types.ObjectId(symbolId),
  symbolSnapshot,
  direction: "LONG",
  actualEntry: 100,
  currentStopLoss: 95,
  actualTarget1: 110,
  actualTarget2: 115,
  actualRiskPerUnit: 5,
  status: "ACTIVE",
  ...overrides,
});

const makeShortTrade = (overrides: Record<string, unknown> = {}) => makeLongTrade({
  direction: "SHORT",
  currentStopLoss: 105,
  actualTarget1: 90,
  actualTarget2: 85,
  ...overrides,
});

const createHarness = (overrides: {
  activeTrades?: Record<string, any>[];
  tradeEvents?: Record<string, any>[];
} = {}) => {
  const activeTrades: Record<string, any>[] = overrides.activeTrades ?? [makeLongTrade()];
  const tradeEvents: Record<string, any>[] = overrides.tradeEvents ?? [];
  const auditEvents: Record<string, any>[] = [];
  const deliveredEvents: Record<string, any>[] = [];
  let tradeResultCreateCount = 0;
  let riskMutationCount = 0;

  const tradeEventRepository = {
    create: async (input: Record<string, unknown>) => {
      if (
        input.idempotencyKey
        && tradeEvents.some((event) => event.idempotencyKey === input.idempotencyKey)
      ) {
        throw Object.assign(new Error("duplicate key"), { code: 11000 });
      }
      const event = {
        _id: new Types.ObjectId(),
        ...input,
        createdAt: fixedNow,
        updatedAt: fixedNow,
      };
      tradeEvents.push(event);
      return event;
    },
    find: (filter: Record<string, unknown>) => {
      return sortableLeanResult(tradeEvents.filter((event) => matchesFilter(event, filter)));
    },
    findOne: (filter: Record<string, unknown>) => {
      return leanResult(tradeEvents.find((event) => matchesFilter(event, filter)) ?? null);
    },
  };

  const auditLogService = {
    record: async (event: Record<string, unknown>) => {
      auditEvents.push(event);
    },
  };

  const tradeEventService = new TradeEventService({
    tradeEventRepository: tradeEventRepository as never,
    auditLogService,
    deliveryService: {
      deliver: async (event) => {
        deliveredEvents.push(event);
      },
    },
  });
  const service = new TradeMonitoringService({
    activeTradeRepository: {
      findOne: (filter: Record<string, unknown>) => {
        return leanResult(activeTrades.find((trade) => matchesFilter(trade, filter)) ?? null);
      },
    } as never,
    tradeEventService,
    auditLogService,
    now: () => fixedNow,
    nearStopThresholdPercent: 0.5,
  });

  return {
    activeTrades,
    auditEvents,
    deliveredEvents,
    get riskMutationCount() {
      return riskMutationCount;
    },
    get tradeResultCreateCount() {
      return tradeResultCreateCount;
    },
    simulateRiskMutation: () => {
      riskMutationCount += 1;
    },
    simulateTradeResultCreation: () => {
      tradeResultCreateCount += 1;
    },
    service,
    tradeEventService,
    tradeEvents,
  };
};

const eventTypes = (events: Array<{ eventType: string }>): string[] => {
  return events.map((event) => event.eventType);
};

test("TradeMonitoringService detects LONG SL_HIT", async () => {
  const { service } = createHarness();

  const result = await service.evaluateActiveTrade(userId, activeTradeId, { price: 95 });

  assert.equal(eventTypes(result.events).includes("SL_HIT"), true);
});

test("TradeMonitoringService detects SHORT SL_HIT", async () => {
  const { service } = createHarness({ activeTrades: [makeShortTrade()] });

  const result = await service.evaluateActiveTrade(userId, activeTradeId, { price: 105 });

  assert.equal(eventTypes(result.events).includes("SL_HIT"), true);
});

test("TradeMonitoringService detects LONG TARGET_1_HIT", async () => {
  const { service } = createHarness();

  const result = await service.evaluateActiveTrade(userId, activeTradeId, { price: 110 });

  assert.equal(eventTypes(result.events).includes("TARGET_1_HIT"), true);
});

test("TradeMonitoringService detects SHORT TARGET_1_HIT", async () => {
  const { service } = createHarness({ activeTrades: [makeShortTrade()] });

  const result = await service.evaluateActiveTrade(userId, activeTradeId, { price: 90 });

  assert.equal(eventTypes(result.events).includes("TARGET_1_HIT"), true);
});

test("TradeMonitoringService detects LONG TARGET_2_HIT", async () => {
  const { service } = createHarness();

  const result = await service.evaluateActiveTrade(userId, activeTradeId, { price: 115 });

  assert.equal(eventTypes(result.events).includes("TARGET_2_HIT"), true);
});

test("TradeMonitoringService detects SHORT TARGET_2_HIT", async () => {
  const { service } = createHarness({ activeTrades: [makeShortTrade()] });

  const result = await service.evaluateActiveTrade(userId, activeTradeId, { price: 85 });

  assert.equal(eventTypes(result.events).includes("TARGET_2_HIT"), true);
});

test("calculateCurrentR calculates LONG currentR", () => {
  assert.equal(calculateCurrentR({
    direction: "LONG",
    price: 107.5,
    actualEntry: 100,
    actualRiskPerUnit: 5,
  }), 1.5);
});

test("calculateCurrentR calculates SHORT currentR", () => {
  assert.equal(calculateCurrentR({
    direction: "SHORT",
    price: 92.5,
    actualEntry: 100,
    actualRiskPerUnit: 5,
  }), 1.5);
});

test("TradeMonitoringService detects PLUS_ONE_R_HIT", async () => {
  const { service } = createHarness();

  const result = await service.evaluateActiveTrade(userId, activeTradeId, { price: 105 });

  assert.equal(eventTypes(result.events).includes("PLUS_ONE_R_HIT"), true);
  assert.equal(result.currentR, 1);
});

test("TradeMonitoringService detects LONG PRICE_NEAR_SL", async () => {
  const { service } = createHarness();

  const result = await service.evaluateActiveTrade(userId, activeTradeId, { price: 95.4 });

  assert.equal(eventTypes(result.events).includes("PRICE_NEAR_SL"), true);
});

test("TradeMonitoringService detects SHORT PRICE_NEAR_SL", async () => {
  const { service } = createHarness({ activeTrades: [makeShortTrade()] });

  const result = await service.evaluateActiveTrade(userId, activeTradeId, { price: 104.6 });

  assert.equal(eventTypes(result.events).includes("PRICE_NEAR_SL"), true);
});

test("TradeMonitoringService dedupes repeated SL_HIT for same ActiveTrade", async () => {
  const { deliveredEvents, service, tradeEvents } = createHarness();

  await service.evaluateActiveTrade(userId, activeTradeId, { price: 95 });
  const second = await service.evaluateActiveTrade(userId, activeTradeId, { price: 94 });

  assert.equal(tradeEvents.filter((event) => event.eventType === "SL_HIT").length, 1);
  assert.equal(second.dedupedEventTypes.includes("SL_HIT"), true);
  assert.equal(deliveredEvents.filter((event) => event.eventType === "SL_HIT").length, 1);
});

test("TradeMonitoringService does not mutate ActiveTrade status on SL_HIT", async () => {
  const { activeTrades, service } = createHarness();

  await service.evaluateActiveTrade(userId, activeTradeId, { price: 95 });

  assert.equal(activeTrades[0]!.status, "ACTIVE");
});

test("TradeMonitoringService does not create TradeResult or mutate risk state", async () => {
  const harness = createHarness();

  await harness.service.evaluateActiveTrade(userId, activeTradeId, { price: 95 });

  assert.equal(harness.tradeResultCreateCount, 0);
  assert.equal(harness.riskMutationCount, 0);
});

test("TradeMonitoringService rejects evaluation for non-active status", async () => {
  const { service } = createHarness({
    activeTrades: [makeLongTrade({ status: "CLOSED" })],
  });

  await assert.rejects(
    service.evaluateActiveTrade(userId, activeTradeId, { price: 105 }),
    /not eligible/,
  );
});

test("TradeMonitoringService audits monitoring evaluation and event creation", async () => {
  const { auditEvents, service } = createHarness();

  await service.evaluateActiveTrade(userId, activeTradeId, { price: 95 });

  assert.deepEqual(auditEvents.map((event) => event.action), [
    "TRADE_EVENT_CREATED",
    "TRADE_MONITORING_EVALUATED",
  ]);
});

test("TradeEventService list filters events by user ownership", async () => {
  const ownEvent = {
    _id: new Types.ObjectId(),
    userId: new Types.ObjectId(userId),
    activeTradeId: new Types.ObjectId(activeTradeId),
    eventType: "SL_HIT",
  };
  const otherEvent = {
    _id: new Types.ObjectId(),
    userId: new Types.ObjectId(otherUserId),
    activeTradeId: new Types.ObjectId(),
    eventType: "TARGET_1_HIT",
  };
  const { tradeEventService } = createHarness({
    tradeEvents: [ownEvent, otherEvent],
  });

  const events = await tradeEventService.listTradeEvents(userId);

  assert.equal(events.length, 1);
  assert.equal(String(events[0]!._id), String(ownEvent._id));
});

test("TradeMonitoringService manual evaluation returns events and currentR", async () => {
  const { service } = createHarness();

  const result = await service.evaluateActiveTrade(userId, activeTradeId, {
    price: 110,
    source: "MANUAL_EVALUATION",
    occurredAt: fixedNow,
  });

  assert.equal(result.currentR, 2);
  assert.equal(result.events.length > 0, true);
  assert.equal(result.evaluatedAt.getTime(), fixedNow.getTime());
});
