import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import { RiskStateProjectionService } from "./risk-state-projection.service.js";
import {
  calculateTradeResult,
  TradeResultService,
} from "./trade-result.service.js";

const userId = "69e64c5f9042aac89c8c83f8";
const otherUserId = "69e64c5f9042aac89c8c83f9";
const tradePlanId = "65abc0000000000000000002";
const activeTradeId = "65abc0000000000000000003";
const tradeSetupId = "65abc0000000000000000004";
const symbolId = "65abc0000000000000000001";
const fixedNow = new Date("2026-06-24T14:00:00.000Z");

const execResult = <T>(value: T) => ({ exec: async () => value });
const leanResult = <T>(value: T) => ({ lean: () => execResult(value) });
const sortableLeanResult = <T>(value: T) => ({ sort: () => leanResult(value) });
const idString = (value: unknown): string => String(value);

const matchesFilter = (record: Record<string, any>, filter: Record<string, any>): boolean => {
  for (const [key, value] of Object.entries(filter)) {
    const recordValue = record[key];
    if (value && typeof value === "object" && "$in" in value) {
      if (!value.$in.includes(recordValue)) return false;
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
  if (update.$setOnInsert) {
    for (const [key, value] of Object.entries(update.$setOnInsert)) {
      if (record[key] === undefined) record[key] = value;
    }
  }
  if (update.$inc) {
    for (const [key, value] of Object.entries(update.$inc)) {
      record[key] = (record[key] ?? 0) + Number(value);
    }
  }
  if (update.$set) Object.assign(record, update.$set);
  if (update.$unset) {
    for (const key of Object.keys(update.$unset)) delete record[key];
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

const makeActiveTrade = (overrides: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(activeTradeId),
  userId: new Types.ObjectId(userId),
  tradePlanId: new Types.ObjectId(tradePlanId),
  tradeSetupId: new Types.ObjectId(tradeSetupId),
  symbolId: new Types.ObjectId(symbolId),
  symbolSnapshot,
  marketType: "COMMODITY",
  tradeStyle: "INTRADAY",
  instrumentType: "FUTURE",
  direction: "LONG",
  actualEntry: 100,
  actualQuantity: 10,
  remainingQuantity: 10,
  actualRiskAmount: 50,
  status: "ACTIVE",
  ...overrides,
});

const makeTradePlan = (overrides: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(tradePlanId),
  userId: new Types.ObjectId(userId),
  startingCapital: 100000,
  maxDailyLossPercent: 3,
  maxConsecutiveLosses: 3,
  ...overrides,
});

const makeRiskState = (overrides: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(),
  userId: new Types.ObjectId(userId),
  tradePlanId: new Types.ObjectId(tradePlanId),
  riskBucketKey: `${userId}:COMMODITY:INTRADAY:FUTURE`,
  riskMode: "NORMAL_RISK",
  totalTrades: 0,
  winCount: 0,
  lossCount: 0,
  breakevenCount: 0,
  consecutiveLosses: 0,
  grossPnl: 0,
  netPnl: 0,
  realizedR: 0,
  ...overrides,
});

const createHarness = (overrides: {
  activeTrades?: Record<string, any>[];
  tradeResults?: Record<string, any>[];
  tradePlans?: Record<string, any>[];
  riskStates?: Record<string, any>[];
  dailyRiskStates?: Record<string, any>[];
} = {}) => {
  const activeTrades = overrides.activeTrades ?? [makeActiveTrade()];
  const tradeResults = overrides.tradeResults ?? [];
  const tradePlans = overrides.tradePlans ?? [makeTradePlan()];
  const riskStates = overrides.riskStates ?? [makeRiskState()];
  const dailyRiskStates = overrides.dailyRiskStates ?? [];
  const auditEvents: Record<string, any>[] = [];
  const unregisteredTradeIds: string[] = [];

  const activeTradeRepository = {
    findOne: (filter: Record<string, unknown>) =>
      leanResult(activeTrades.find((record) => matchesFilter(record, filter)) ?? null),
    findOneAndUpdate: (filter: Record<string, unknown>, update: Record<string, unknown>) => {
      const record = activeTrades.find((candidate) => matchesFilter(candidate, filter));
      if (!record) return leanResult(null);
      applyUpdate(record, update);
      return leanResult(record);
    },
  };

  const tradeResultRepository = {
    create: async (input: Record<string, unknown>) => {
      if (tradeResults.some((result) => idString(result.activeTradeId) === idString(input.activeTradeId))) {
        throw Object.assign(new Error("duplicate"), { code: 11000 });
      }
      const result = { _id: new Types.ObjectId(), ...input, createdAt: fixedNow, updatedAt: fixedNow };
      tradeResults.push(result);
      return result;
    },
    find: (filter: Record<string, unknown>) =>
      sortableLeanResult(tradeResults.filter((result) => matchesFilter(result, filter))),
    findOne: (filter: Record<string, unknown>) =>
      leanResult(tradeResults.find((result) => matchesFilter(result, filter)) ?? null),
    findOneAndUpdate: (filter: Record<string, unknown>, update: Record<string, unknown>) => {
      const result = tradeResults.find((candidate) => matchesFilter(candidate, filter));
      if (!result) return leanResult(null);
      applyUpdate(result, update);
      return leanResult(result);
    },
    deleteOne: (filter: Record<string, unknown>) => ({
      exec: async () => {
        const index = tradeResults.findIndex((result) => matchesFilter(result, filter));
        if (index >= 0) tradeResults.splice(index, 1);
        return { deletedCount: index >= 0 ? 1 : 0 };
      },
    }),
  };

  const tradePlanRepository = {
    findOne: (filter: Record<string, unknown>) =>
      leanResult(tradePlans.find((plan) => matchesFilter(plan, filter)) ?? null),
  };

  const makeUpsertRepository = (records: Record<string, any>[], defaults: Record<string, unknown>) => ({
    findOne: (filter: Record<string, unknown>) =>
      leanResult(records.find((record) => matchesFilter(record, filter)) ?? null),
    findOneAndUpdate: (
      filter: Record<string, unknown>,
      update: Record<string, unknown>,
      options: Record<string, unknown>,
    ) => {
      let record = records.find((candidate) => matchesFilter(candidate, filter));
      if (!record && options.upsert) {
        record = { _id: new Types.ObjectId(), ...defaults, ...filter };
        records.push(record);
      }
      if (!record) return leanResult(null);
      applyUpdate(record, update);
      return leanResult(record);
    },
  });

  const auditLogService = {
    record: async (event: Record<string, unknown>) => {
      auditEvents.push(event);
    },
  };
  const projectionService = new RiskStateProjectionService({
    tradeResultRepository: tradeResultRepository as never,
    tradePlanRepository: tradePlanRepository as never,
    riskStateRepository: makeUpsertRepository(riskStates, {
      riskMode: "NORMAL_RISK",
      consecutiveLosses: 0,
    }) as never,
    dailyRiskStateRepository: makeUpsertRepository(dailyRiskStates, {
      riskMode: "NORMAL_RISK",
      tradesTaken: 0,
      winCount: 0,
      lossCount: 0,
      breakevenCount: 0,
      grossPnl: 0,
      netPnl: 0,
      realizedR: 0,
      dailyLossLimitHit: false,
      stopTradingTriggered: false,
    }) as never,
    auditLogService,
    now: () => fixedNow,
  });
  const service = new TradeResultService({
    activeTradeRepository: activeTradeRepository as never,
    tradeResultRepository: tradeResultRepository as never,
    riskStateProjectionService: projectionService,
    auditLogService,
    subscriptionService: {
      unregisterActiveTrade: async (activeTrade: string | Record<string, unknown>) => {
        unregisteredTradeIds.push(String(activeTrade));
      },
    },
    now: () => fixedNow,
  });

  return {
    activeTrades,
    auditEvents,
    dailyRiskStates,
    projectionService,
    riskStates,
    service,
    tradeResults,
    unregisteredTradeIds,
  };
};

test("TradeResultService cannot close non-owned ActiveTrade", async () => {
  const { service } = createHarness({
    activeTrades: [makeActiveTrade({ userId: new Types.ObjectId(otherUserId) })],
  });
  await assert.rejects(
    service.closeActiveTrade(userId, activeTradeId, { exitPrice: 110, exitReason: "TARGET_1" }),
    /ACTIVE_TRADE_NOT_FOUND/,
  );
});

test("TradeResultService cannot close inactive ActiveTrade", async () => {
  const { service } = createHarness({ activeTrades: [makeActiveTrade({ status: "CANCELLED" })] });
  await assert.rejects(
    service.closeActiveTrade(userId, activeTradeId, { exitPrice: 110, exitReason: "MANUAL_EXIT" }),
    /not eligible/,
  );
});

test("TradeResultService rejects invalid exitPrice", async () => {
  const { service } = createHarness();
  await assert.rejects(
    service.closeActiveTrade(userId, activeTradeId, { exitPrice: 0, exitReason: "MANUAL_EXIT" }),
    /Invalid ActiveTrade close payload/,
  );
});

test("TradeResultService rejects exitQuantity above remainingQuantity", async () => {
  const { service } = createHarness();
  await assert.rejects(
    service.closeActiveTrade(userId, activeTradeId, {
      exitPrice: 110,
      exitQuantity: 11,
      exitReason: "MANUAL_EXIT",
    }),
    /exceeds remainingQuantity/,
  );
});

test("calculateTradeResult calculates LONG gross PnL", () => {
  const result = calculateTradeResult({
    direction: "LONG",
    entryPrice: 100,
    exitPrice: 110,
    quantity: 10,
    actualRiskAmount: 50,
  });
  assert.equal(result.grossPnl, 100);
});

test("calculateTradeResult calculates SHORT gross PnL", () => {
  const result = calculateTradeResult({
    direction: "SHORT",
    entryPrice: 100,
    exitPrice: 90,
    quantity: 10,
    actualRiskAmount: 50,
  });
  assert.equal(result.grossPnl, 100);
});

test("calculateTradeResult prefers provided net PnL", () => {
  const result = calculateTradeResult({
    direction: "LONG", entryPrice: 100, exitPrice: 110, quantity: 10, actualRiskAmount: 50, netPnl: 92,
  });
  assert.equal(result.pnlBasis, "CONFIRMED_NET");
  assert.equal(result.realizedPnlUsedForRisk, 92);
});

test("calculateTradeResult estimates net PnL from charges", () => {
  const result = calculateTradeResult({
    direction: "LONG", entryPrice: 100, exitPrice: 110, quantity: 10, actualRiskAmount: 50, chargesTotal: 8,
  });
  assert.equal(result.pnlBasis, "ESTIMATED_NET");
  assert.equal(result.netPnl, 92);
});

test("calculateTradeResult falls back to gross PnL with warning", () => {
  const result = calculateTradeResult({
    direction: "LONG", entryPrice: 100, exitPrice: 110, quantity: 10, actualRiskAmount: 50,
  });
  assert.equal(result.pnlBasis, "GROSS_FALLBACK");
  assert.equal(result.warnings.length, 1);
});

test("calculateTradeResult calculates realized R", () => {
  const result = calculateTradeResult({
    direction: "LONG", entryPrice: 100, exitPrice: 110, quantity: 10, actualRiskAmount: 50, netPnl: 100,
  });
  assert.equal(result.realizedR, 2);
});

test("calculateTradeResult classifies WIN LOSS and BREAKEVEN", () => {
  const base = { direction: "LONG" as const, entryPrice: 100, exitPrice: 110, quantity: 10, actualRiskAmount: 50 };
  assert.equal(calculateTradeResult({ ...base, netPnl: 1 }).resultType, "WIN");
  assert.equal(calculateTradeResult({ ...base, netPnl: -1 }).resultType, "LOSS");
  assert.equal(calculateTradeResult({ ...base, netPnl: 0 }).resultType, "BREAKEVEN");
});

test("STOPLOSS exit marks ActiveTrade STOPPED_OUT", async () => {
  const { activeTrades, service } = createHarness();
  await service.closeActiveTrade(userId, activeTradeId, { exitPrice: 95, exitReason: "STOPLOSS" });
  assert.equal(activeTrades[0]!.status, "STOPPED_OUT");
});

test("non-stoploss exit marks ActiveTrade CLOSED", async () => {
  const { activeTrades, service } = createHarness();
  await service.closeActiveTrade(userId, activeTradeId, { exitPrice: 110, exitReason: "TARGET_1" });
  assert.equal(activeTrades[0]!.status, "CLOSED");
});

test("closing ActiveTrade invalidates live monitoring registration", async () => {
  const { service, unregisteredTradeIds } = createHarness();
  await service.closeActiveTrade(userId, activeTradeId, {
    exitPrice: 110,
    exitReason: "TARGET_1",
  });
  assert.deepEqual(unregisteredTradeIds, [activeTradeId]);
});

test("TradeResult is created FINALIZED and projected APPLIED", async () => {
  const { service } = createHarness();
  const { tradeResult } = await service.closeActiveTrade(
    userId,
    activeTradeId,
    { exitPrice: 110, exitReason: "TARGET_1" },
  );
  assert.equal(tradeResult.status, "FINALIZED");
  assert.equal(tradeResult.projectionStatus, "APPLIED");
});

test("risk projection increments totalTrades and win count", async () => {
  const { riskStates, service } = createHarness();
  await service.closeActiveTrade(userId, activeTradeId, { exitPrice: 110, exitReason: "TARGET_1" });
  assert.equal(riskStates[0]!.totalTrades, 1);
  assert.equal(riskStates[0]!.winCount, 1);
});

test("risk projection increments loss and breakeven counts", async () => {
  const lossHarness = createHarness();
  await lossHarness.service.closeActiveTrade(userId, activeTradeId, { exitPrice: 95, exitReason: "STOPLOSS" });
  assert.equal(lossHarness.riskStates[0]!.lossCount, 1);

  const breakevenHarness = createHarness();
  await breakevenHarness.service.closeActiveTrade(userId, activeTradeId, { exitPrice: 100, exitReason: "MANUAL_EXIT" });
  assert.equal(breakevenHarness.riskStates[0]!.breakevenCount, 1);
});

test("loss increments consecutive losses", async () => {
  const { riskStates, service } = createHarness({ riskStates: [makeRiskState({ consecutiveLosses: 1 })] });
  await service.closeActiveTrade(userId, activeTradeId, { exitPrice: 95, exitReason: "STOPLOSS" });
  assert.equal(riskStates[0]!.consecutiveLosses, 2);
});

test("win resets consecutive losses", async () => {
  const { riskStates, service } = createHarness({ riskStates: [makeRiskState({ consecutiveLosses: 2 })] });
  await service.closeActiveTrade(userId, activeTradeId, { exitPrice: 110, exitReason: "TARGET_1" });
  assert.equal(riskStates[0]!.consecutiveLosses, 0);
});

test("duplicate projection does not double-count", async () => {
  const { projectionService, riskStates, service } = createHarness();
  const { tradeResult } = await service.closeActiveTrade(
    userId,
    activeTradeId,
    { exitPrice: 110, exitReason: "TARGET_1" },
  );
  const duplicate = await projectionService.applyFinalizedTradeResult(userId, String(tradeResult._id));
  assert.equal(duplicate.alreadyApplied, true);
  assert.equal(riskStates[0]!.totalTrades, 1);
});

test("max consecutive losses sets STOP_TRADING", async () => {
  const { riskStates, service } = createHarness({
    tradePlans: [makeTradePlan({ maxConsecutiveLosses: 2 })],
    riskStates: [makeRiskState({ consecutiveLosses: 1 })],
  });
  await service.closeActiveTrade(userId, activeTradeId, { exitPrice: 95, exitReason: "STOPLOSS" });
  assert.equal(riskStates[0]!.riskMode, "STOP_TRADING");
});

test("daily loss limit triggers STOP_TRADING", async () => {
  const { dailyRiskStates, service } = createHarness();
  await service.closeActiveTrade(userId, activeTradeId, {
    exitPrice: 95,
    exitReason: "STOPLOSS",
    netPnl: -3000,
  });
  assert.equal(dailyRiskStates[0]!.dailyLossLimitHit, true);
  assert.equal(dailyRiskStates[0]!.stopTradingTriggered, true);
  assert.equal(dailyRiskStates[0]!.riskMode, "STOP_TRADING");
});

test("audit service records result finalization and risk projection", async () => {
  const { auditEvents, service } = createHarness();
  await service.closeActiveTrade(userId, activeTradeId, { exitPrice: 110, exitReason: "TARGET_1" });
  assert.deepEqual(auditEvents.map((event) => event.action), [
    "TRADE_RESULT_FINALIZED",
    "RISK_PROJECTION_APPLIED",
  ]);
});

test("TradeResult list filters by user ownership", async () => {
  const ownId = new Types.ObjectId();
  const { service } = createHarness({
    tradeResults: [
      { _id: ownId, userId: new Types.ObjectId(userId) },
      { _id: new Types.ObjectId(), userId: new Types.ObjectId(otherUserId) },
    ],
  });
  const results = await service.listTradeResults(userId);
  assert.equal(results.length, 1);
  assert.equal(String(results[0]!._id), String(ownId));
});

test("ActiveTrade result lookup works", async () => {
  const resultId = new Types.ObjectId();
  const { service } = createHarness({
    tradeResults: [{
      _id: resultId,
      userId: new Types.ObjectId(userId),
      activeTradeId: new Types.ObjectId(activeTradeId),
    }],
  });
  const result = await service.getActiveTradeResult(userId, activeTradeId);
  assert.equal(String(result._id), String(resultId));
});
