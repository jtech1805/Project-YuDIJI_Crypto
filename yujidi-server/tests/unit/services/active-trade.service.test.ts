import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import {
  ActiveTradeService,
  calculateActualTradeGeometry,
  type ConfirmActualTradeInput,
} from "../../../src/services/trading/active-trade.service.js";

const userId = "69e64c5f9042aac89c8c83f8";
const otherUserId = "69e64c5f9042aac89c8c83f9";
const tradePlanId = "65abc0000000000000000002";
const tradeSetupId = "65abc0000000000000000003";
const scoreCheckId = "65abc0000000000000000004";
const symbolId = "65abc0000000000000000001";
const fixedNow = new Date("2026-06-24T10:00:00.000Z");

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
    if (value && typeof value === "object" && "$exists" in value) {
      if ((recordValue !== undefined) !== value.$exists) return false;
      continue;
    }
    if (recordValue instanceof Types.ObjectId || value instanceof Types.ObjectId) {
      if (idString(recordValue) !== idString(value)) return false;
      continue;
    }
    if (recordValue !== value) return false;
  }
  return true;
};

const applyUpdate = (record: Record<string, any>, update: Record<string, any>): void => {
  if (update.$set && typeof update.$set === "object") {
    Object.assign(record, update.$set);
  }
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

const makeTradeSetup = (overrides: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(tradeSetupId),
  userId: new Types.ObjectId(userId),
  tradePlanId: new Types.ObjectId(tradePlanId),
  sourceScoreCheckId: new Types.ObjectId(scoreCheckId),
  symbolId: new Types.ObjectId(symbolId),
  symbolSnapshot,
  marketType: "COMMODITY",
  tradeStyle: "INTRADAY",
  instrumentType: "FUTURE",
  direction: "LONG",
  plannedEntry: 100,
  plannedStopLoss: 95,
  plannedTarget1: 110,
  plannedRiskPerUnit: 5,
  plannedRewardRiskRatio: 2,
  finalPermission: "TAKE_TRADE",
  riskModeAtDecision: "NORMAL_RISK",
  status: "APPROVED",
  scoreValidUntil: new Date("2026-06-24T10:15:00.000Z"),
  ...overrides,
});

const validLongInput = (overrides: Partial<ConfirmActualTradeInput> = {}): ConfirmActualTradeInput => ({
  actualEntry: 100,
  actualQuantity: 2,
  initialStopLoss: 95,
  actualTarget1: 110,
  ...overrides,
});

const validShortSetup = (overrides: Record<string, unknown> = {}) => makeTradeSetup({
  direction: "SHORT",
  plannedEntry: 100,
  plannedStopLoss: 105,
  plannedTarget1: 90,
  plannedRiskPerUnit: 5,
  plannedRewardRiskRatio: 2,
  ...overrides,
});

const validShortInput = (overrides: Partial<ConfirmActualTradeInput> = {}): ConfirmActualTradeInput => ({
  actualEntry: 100,
  actualQuantity: 2,
  initialStopLoss: 105,
  actualTarget1: 90,
  ...overrides,
});

const createHarness = (overrides: {
  tradeSetups?: Record<string, any>[];
  activeTrades?: Record<string, any>[];
  registrationError?: Error;
} = {}) => {
  const tradeSetups: Record<string, any>[] = overrides.tradeSetups ?? [makeTradeSetup()];
  const activeTrades: Record<string, any>[] = overrides.activeTrades ?? [];
  const auditEvents: Record<string, any>[] = [];
  const registeredTrades: Record<string, any>[] = [];
  const unregisteredTrades: Array<Record<string, any> | string> = [];

  const service = new ActiveTradeService({
    tradeSetupRepository: {
      findOne: (filter: Record<string, unknown>) => {
        return leanResult(tradeSetups.find((record) => matchesFilter(record, filter)) ?? null);
      },
      findOneAndUpdate: (filter: Record<string, unknown>, update: Record<string, unknown>) => {
        const record = tradeSetups.find((candidate) => matchesFilter(candidate, filter));
        if (!record) return leanResult(null);
        applyUpdate(record, update);
        record.updatedAt = fixedNow;
        return leanResult(record);
      },
    } as never,
    activeTradeRepository: {
      create: async (input: Record<string, unknown>) => {
        const activeTrade = {
          _id: new Types.ObjectId(),
          ...input,
          createdAt: fixedNow,
          updatedAt: fixedNow,
        };
        activeTrades.push(activeTrade);
        return activeTrade;
      },
      find: (filter: Record<string, unknown>) => {
        return sortableLeanResult(activeTrades.filter((record) => matchesFilter(record, filter)));
      },
      findOne: (filter: Record<string, unknown>) => {
        return leanResult(activeTrades.find((record) => matchesFilter(record, filter)) ?? null);
      },
      findOneAndUpdate: (filter: Record<string, unknown>, update: Record<string, unknown>) => {
        const record = activeTrades.find((candidate) => matchesFilter(candidate, filter));
        if (!record) return leanResult(null);
        applyUpdate(record, update);
        record.updatedAt = fixedNow;
        return leanResult(record);
      },
      deleteOne: (filter: Record<string, unknown>) => ({
        exec: async () => {
          const index = activeTrades.findIndex((record) => matchesFilter(record, filter));
          if (index >= 0) activeTrades.splice(index, 1);
          return { deletedCount: index >= 0 ? 1 : 0 };
        },
      }),
    } as never,
    auditLogService: {
      record: async (event) => {
        auditEvents.push(event);
      },
    },
    subscriptionService: {
      registerActiveTrade: async (activeTrade) => {
        if (overrides.registrationError) throw overrides.registrationError;
        registeredTrades.push(activeTrade);
        return "ANGEL_ONE:user:MCX:token";
      },
      unregisterActiveTrade: async (activeTrade) => {
        unregisteredTrades.push(activeTrade);
      },
    },
    now: () => fixedNow,
  });

  return {
    activeTrades,
    auditEvents,
    registeredTrades,
    service,
    tradeSetups,
    unregisteredTrades,
  };
};

test("ActiveTradeService rejects TradeSetup that is not APPROVED", async () => {
  const { service } = createHarness({ tradeSetups: [makeTradeSetup({ status: "REJECTED" })] });

  await assert.rejects(
    service.confirmActualTrade(userId, tradeSetupId, validLongInput()),
    /Only APPROVED/,
  );
});

for (const permission of ["WAIT", "REJECT", "STOP_TRADING"] as const) {
  test(`ActiveTradeService rejects final permission ${permission}`, async () => {
    const { service } = createHarness({
      tradeSetups: [makeTradeSetup({ finalPermission: permission })],
    });

    await assert.rejects(
      service.confirmActualTrade(userId, tradeSetupId, validLongInput()),
      new RegExp(permission),
    );
  });
}

test("ActiveTradeService rejects already executed TradeSetup", async () => {
  const { service } = createHarness({
    tradeSetups: [makeTradeSetup({ status: "EXECUTED", executedAt: fixedNow })],
  });

  await assert.rejects(
    service.confirmActualTrade(userId, tradeSetupId, validLongInput()),
    /already executed/,
  );
});

test("ActiveTradeService rejects expired score", async () => {
  const { service } = createHarness({
    tradeSetups: [makeTradeSetup({ scoreValidUntil: new Date("2026-06-24T09:59:00.000Z") })],
  });

  await assert.rejects(
    service.confirmActualTrade(userId, tradeSetupId, validLongInput()),
    /SCORE_EXPIRED_BEFORE_EXECUTION/,
  );
});

test("ActiveTradeService cannot confirm another user's TradeSetup", async () => {
  const { service } = createHarness({
    tradeSetups: [makeTradeSetup({ userId: new Types.ObjectId(otherUserId) })],
  });

  await assert.rejects(
    service.confirmActualTrade(userId, tradeSetupId, validLongInput()),
    /TRADE_SETUP_NOT_FOUND/,
  );
});

test("ActiveTradeService creates ActiveTrade for valid LONG geometry", async () => {
  const { activeTrades, service } = createHarness();

  const activeTrade = await service.confirmActualTrade(userId, tradeSetupId, validLongInput());

  assert.equal(activeTrades.length, 1);
  assert.equal(activeTrade.direction, "LONG");
  assert.equal(activeTrade.status, "ACTIVE");
});

test("ActiveTradeService rejects invalid LONG geometry", async () => {
  const { service } = createHarness();

  await assert.rejects(
    service.confirmActualTrade(userId, tradeSetupId, validLongInput({ initialStopLoss: 101 })),
    /INVALID_LONG_GEOMETRY/,
  );
});

test("ActiveTradeService creates ActiveTrade for valid SHORT geometry", async () => {
  const { service } = createHarness({ tradeSetups: [validShortSetup()] });

  const activeTrade = await service.confirmActualTrade(userId, tradeSetupId, validShortInput());

  assert.equal(activeTrade.direction, "SHORT");
  assert.equal(activeTrade.status, "ACTIVE");
});

test("ActiveTradeService rejects invalid SHORT geometry", async () => {
  const { service } = createHarness({ tradeSetups: [validShortSetup()] });

  await assert.rejects(
    service.confirmActualTrade(userId, tradeSetupId, validShortInput({ initialStopLoss: 95 })),
    /INVALID_SHORT_GEOMETRY/,
  );
});

test("calculateActualTradeGeometry calculates LONG risk reward and RR", () => {
  assert.deepEqual(
    calculateActualTradeGeometry({
      direction: "LONG",
      actualEntry: 100,
      actualQuantity: 2,
      initialStopLoss: 95,
      actualTarget1: 110,
    }),
    {
      actualRiskPerUnit: 5,
      actualRiskAmount: 10,
      actualRewardPerUnit: 10,
      actualRewardRiskRatio: 2,
    },
  );
});

test("calculateActualTradeGeometry calculates SHORT risk reward and RR", () => {
  assert.deepEqual(
    calculateActualTradeGeometry({
      direction: "SHORT",
      actualEntry: 100,
      actualQuantity: 3,
      initialStopLoss: 105,
      actualTarget1: 90,
    }),
    {
      actualRiskPerUnit: 5,
      actualRiskAmount: 15,
      actualRewardPerUnit: 10,
      actualRewardRiskRatio: 2,
    },
  );
});

test("ActiveTradeService rejects actual RR below 1", async () => {
  const { service } = createHarness();

  await assert.rejects(
    service.confirmActualTrade(
      userId,
      tradeSetupId,
      validLongInput({ initialStopLoss: 90, actualTarget1: 105 }),
    ),
    /ACTUAL_RR_BELOW_MINIMUM/,
  );
});

test("ActiveTradeService detects stoploss widening for LONG", async () => {
  const { service } = createHarness();

  const activeTrade = await service.confirmActualTrade(
    userId,
    tradeSetupId,
    validLongInput({ initialStopLoss: 94 }),
  );

  assert.equal(activeTrade.executionQuality.includes("STOPLOSS_CHANGED"), true);
  assert.equal(activeTrade.ruleViolations.includes("STOPLOSS_WIDENED_AFTER_APPROVAL"), true);
});

test("ActiveTradeService detects stoploss widening for SHORT", async () => {
  const { service } = createHarness({ tradeSetups: [validShortSetup()] });

  const activeTrade = await service.confirmActualTrade(
    userId,
    tradeSetupId,
    validShortInput({ initialStopLoss: 106 }),
  );

  assert.equal(activeTrade.executionQuality.includes("STOPLOSS_CHANGED"), true);
  assert.equal(activeTrade.ruleViolations.includes("STOPLOSS_WIDENED_AFTER_APPROVAL"), true);
});

test("ActiveTradeService detects actual risk above planned risk", async () => {
  const { service } = createHarness();

  const activeTrade = await service.confirmActualTrade(
    userId,
    tradeSetupId,
    validLongInput({ initialStopLoss: 94 }),
  );

  assert.equal(activeTrade.executionQuality.includes("EXCEEDED_APPROVED_RISK"), true);
  assert.equal(activeTrade.ruleViolations.includes("ACTUAL_RISK_EXCEEDED_APPROVED_RISK"), true);
});

test("ActiveTradeService marks TradeSetup EXECUTED", async () => {
  const { service, tradeSetups } = createHarness();

  await service.confirmActualTrade(userId, tradeSetupId, validLongInput());

  assert.equal(tradeSetups[0]!.status, "EXECUTED");
  assert.equal(tradeSetups[0]!.executedAt, fixedNow);
});

test("ActiveTradeService copies symbol snapshot without mutating TradeSetup planned values", async () => {
  const { service, tradeSetups } = createHarness();

  const activeTrade = await service.confirmActualTrade(
    userId,
    tradeSetupId,
    validLongInput({ actualEntry: 101, initialStopLoss: 96, actualTarget1: 111 }),
  );

  assert.equal(activeTrade.symbolSnapshot.symbol, symbolSnapshot.symbol);
  assert.equal(activeTrade.symbolSnapshot.provider, "ANGEL_ONE");
  assert.equal(tradeSetups[0]!.plannedEntry, 100);
  assert.equal(tradeSetups[0]!.plannedStopLoss, 95);
});

test("ActiveTradeService audits confirmation, creation, and TradeSetup execution", async () => {
  const { auditEvents, service } = createHarness();

  await service.confirmActualTrade(userId, tradeSetupId, validLongInput());

  assert.deepEqual(auditEvents.map((event) => event.action), [
    "ACTUAL_TRADE_CONFIRMED",
    "ACTIVE_TRADE_CREATED",
    "TRADE_SETUP_EXECUTED",
  ]);
});

test("ActiveTradeService registers new trade for live monitoring", async () => {
  const { registeredTrades, service } = createHarness();
  const activeTrade = await service.confirmActualTrade(userId, tradeSetupId, validLongInput());
  assert.equal(registeredTrades.length, 1);
  assert.equal(String(registeredTrades[0]?._id), String(activeTrade._id));
});

test("ActiveTradeService creation survives monitoring registration failure", async () => {
  const { activeTrades, service } = createHarness({
    registrationError: new Error("stream unavailable"),
  });
  const activeTrade = await service.confirmActualTrade(userId, tradeSetupId, validLongInput());
  assert.equal(activeTrades.length, 1);
  assert.equal(activeTrade.status, "ACTIVE");
});

test("ActiveTradeService cancellation works for ACTIVE trade", async () => {
  const { service, unregisteredTrades } = createHarness();
  const activeTrade = await service.confirmActualTrade(userId, tradeSetupId, validLongInput());

  const cancelled = await service.cancelActiveTrade(userId, String(activeTrade._id));

  assert.equal(cancelled.status, "CANCELLED");
  assert.equal(cancelled.cancelledAt, fixedNow);
  assert.equal(unregisteredTrades.length, 1);
});

test("ActiveTradeService cancellation rejects CLOSED trade", async () => {
  const activeTradeId = new Types.ObjectId();
  const { service } = createHarness({
    activeTrades: [{
      _id: activeTradeId,
      userId: new Types.ObjectId(userId),
      tradePlanId: new Types.ObjectId(tradePlanId),
      tradeSetupId: new Types.ObjectId(tradeSetupId),
      symbolId: new Types.ObjectId(symbolId),
      symbolSnapshot,
      marketType: "COMMODITY",
      tradeStyle: "INTRADAY",
      instrumentType: "FUTURE",
      direction: "LONG",
      status: "CLOSED",
    }],
  });

  await assert.rejects(
    service.cancelActiveTrade(userId, String(activeTradeId)),
    /Only ACTIVE trades/,
  );
});
