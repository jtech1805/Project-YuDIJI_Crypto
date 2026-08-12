import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import { RiskGovernorService } from "../../../src/services/trading/risk-governor.service.js";
import { TradeSetupService } from "../../../src/services/trading/trade-setup.service.js";

const userId = "69e64c5f9042aac89c8c83f8";
const otherUserId = "69e64c5f9042aac89c8c83f9";
const tradePlanId = "65abc0000000000000000002";
const scoreCheckId = "65abc0000000000000000003";
const symbolId = "65abc0000000000000000001";
const snapshotId = "65abc0000000000000000004";
const fixedNow = new Date("2026-06-23T10:00:00.000Z");

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
      const exists = recordValue !== undefined;
      if (exists !== value.$exists) return false;
      continue;
    }
    if (value && typeof value === "object" && "$ne" in value) {
      if (idString(recordValue) === idString(value.$ne)) return false;
      continue;
    }
    if (value && typeof value === "object" && "$gt" in value) {
      if (!(recordValue instanceof Date) || !(value.$gt instanceof Date) || recordValue.getTime() <= value.$gt.getTime()) {
        return false;
      }
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

const applyUpdate = (record: Record<string, any>, update: Record<string, any>): Record<string, any> => {
  if (update.$set && typeof update.$set === "object") {
    Object.assign(record, update.$set);
  }
  if (update.$unset && typeof update.$unset === "object") {
    for (const key of Object.keys(update.$unset)) {
      delete record[key];
    }
  }
  return record;
};

const makeScoreCheck = (overrides: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(scoreCheckId),
  userId: new Types.ObjectId(userId),
  symbolId: new Types.ObjectId(symbolId),
  symbolSnapshot: {
    symbolId: new Types.ObjectId(symbolId),
    symbol: "MCX:GOLD:04DEC2026:FUTURE",
    displayName: "MCX GOLD 04DEC2026 FUTURE",
    provider: "ANGEL_ONE",
    marketType: "COMMODITY",
    exchange: "MCX",
    instrumentType: "FUTURE",
    providerSymbol: "GOLD04DEC26FUT",
    requiresBrokerLogin: true,
  },
  marketType: "COMMODITY",
  tradeStyle: "INTRADAY",
  instrumentType: "FUTURE",
  direction: "LONG",
  entry: 100,
  stopLoss: 95,
  target1: 110,
  riskPerUnit: 5,
  rewardPerUnit: 10,
  rewardRiskRatio: 2,
  scoringTemplateKey: "INDIA_EQUITY_INTRADAY_V1",
  scoringTemplateVersion: "1",
  scoreStatus: "READY",
  score: 80,
  permission: "TAKE_TRADE",
  reasonCodes: ["VALID_GEOMETRY", "RR_ACCEPTABLE"],
  warnings: [],
  scoreCalculatedAt: fixedNow,
  scoreValidUntil: new Date("2026-06-23T10:15:00.000Z"),
  ...overrides,
});

const makeScoreCheckSnapshot = (overrides: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(snapshotId),
  userId: new Types.ObjectId(userId),
  scoreCheckId: new Types.ObjectId(scoreCheckId),
  scoringTemplateKey: "INDIA_EQUITY_INTRADAY_V1",
  scoringTemplateName: "India Equity Intraday",
  scoringTemplateVersion: "1",
  scoringTemplateScope: "SYSTEM",
  selectedSymbol: {
    symbolId: new Types.ObjectId(symbolId),
    symbol: "MCX:GOLD:04DEC2026:FUTURE",
    exchange: "MCX",
    provider: "ANGEL_ONE",
    marketType: "COMMODITY",
    instrumentType: "FUTURE",
  },
  resolvedResources: [{ role: "PRIMARY_SYMBOL", symbolId }],
  resourceSnapshots: [{ role: "PRIMARY_SYMBOL", resourceKey: `ANGEL_ONE:${userId}:MCX:495213`, ltp: 100 }],
  resourceReadinessSummary: { total: 1, ready: 1, stale: 0, missing: 0, partial: 0, blockingMissing: 0 },
  sectionBreakdown: [{ sectionKey: "PRICE_ACTION", score: 20, maxScore: 20, status: "EXECUTED" }],
  finalScore: 80,
  permission: "TAKE_TRADE",
  scoreStatus: "READY",
  dataConfidence: "HIGH",
  warnings: ["resource warning"],
  blockers: [],
  expiresAt: new Date("2026-06-24T10:00:00.000Z"),
  createdAt: fixedNow,
  updatedAt: fixedNow,
  ...overrides,
});

const makeTradePlan = (overrides: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(tradePlanId),
  userId: new Types.ObjectId(userId),
  status: "ACTIVE",
  marketType: "COMMODITY",
  tradeStyle: "INTRADAY",
  instrumentType: "FUTURE",
  maxTrades: 10,
  maxConsecutiveLosses: 3,
  ...overrides,
});

const makeRiskState = (overrides: Record<string, unknown> = {}) => ({
  userId: new Types.ObjectId(userId),
  tradePlanId: new Types.ObjectId(tradePlanId),
  riskBucketKey: `${userId}:COMMODITY:INTRADAY:FUTURE`,
  riskMode: "NORMAL_RISK",
  totalTrades: 0,
  consecutiveLosses: 0,
  ...overrides,
});

const makeRejectedTradeSetup = (overrides: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(),
  userId: new Types.ObjectId(userId),
  tradePlanId: new Types.ObjectId(tradePlanId),
  sourceScoreCheckId: new Types.ObjectId(scoreCheckId),
  symbolId: new Types.ObjectId(symbolId),
  symbolSnapshot: makeScoreCheck().symbolSnapshot,
  marketType: "COMMODITY",
  tradeStyle: "INTRADAY",
  instrumentType: "FUTURE",
  direction: "LONG",
  plannedEntry: 100,
  plannedStopLoss: 95,
  plannedTarget1: 110,
  plannedRiskPerUnit: 5,
  plannedRewardPerUnit: 10,
  plannedRewardRiskRatio: 2,
  scoringTemplateKey: "INDIA_EQUITY_INTRADAY_V1",
  scoringTemplateVersion: "1",
  tradeScoreSnapshotId: new Types.ObjectId(snapshotId),
  score: 80,
  scorePermission: "TAKE_TRADE",
  riskGovernorPermission: "STOP_TRADING",
  finalPermission: "STOP_TRADING",
  riskModeAtDecision: "STOP_TRADING",
  reasonCodes: ["STOP_TRADING_ACTIVE"],
  warnings: [],
  status: "REJECTED",
  riskEvaluatedAt: fixedNow,
  createdAt: fixedNow,
  updatedAt: fixedNow,
  ...overrides,
});

const createHarness = (overrides: {
  scoreChecks?: Record<string, any>[];
  tradePlans?: Record<string, any>[];
  riskStates?: Record<string, any>[];
  dailyRiskStates?: Record<string, any>[];
  tradeSetups?: Record<string, any>[];
  activeTrades?: Record<string, any>[];
  scoreCheckSnapshots?: Record<string, any>[];
  tradeScoreSnapshots?: Record<string, any>[];
} = {}) => {
  const scoreChecks = overrides.scoreChecks ?? [makeScoreCheck()];
  const tradePlans = overrides.tradePlans ?? [makeTradePlan()];
  const riskStates = overrides.riskStates ?? [makeRiskState()];
  const dailyRiskStates = overrides.dailyRiskStates ?? [];
  const tradeSetups = overrides.tradeSetups ?? [];
  const activeTrades = overrides.activeTrades ?? [];
  const scoreCheckSnapshots = overrides.scoreCheckSnapshots ?? [makeScoreCheckSnapshot()];
  const tradeScoreSnapshots = overrides.tradeScoreSnapshots ?? [];
  const auditEvents: Record<string, any>[] = [];

  const service = new TradeSetupService({
    scoreCheckRepository: {
      findOne: (filter: Record<string, unknown>) => leanResult(scoreChecks.find((record) => matchesFilter(record, filter)) ?? null),
      findOneAndUpdate: (filter: Record<string, unknown>, update: Record<string, unknown>) => {
        const record = scoreChecks.find((candidate) => matchesFilter(candidate, filter));
        if (!record) return leanResult(null);
        applyUpdate(record, update);
        return leanResult(record);
      },
    } as never,
    tradePlanRepository: {
      findOne: (filter: Record<string, unknown>) => leanResult(tradePlans.find((record) => matchesFilter(record, filter)) ?? null),
    } as never,
    tradeSetupRepository: {
      create: async (input: Record<string, unknown>) => {
        const tradeSetup = {
          _id: new Types.ObjectId(),
          ...input,
          createdAt: fixedNow,
          updatedAt: fixedNow,
        };
        tradeSetups.push(tradeSetup);
        return tradeSetup;
      },
      find: (filter: Record<string, unknown>) => sortableLeanResult(tradeSetups.filter((record) => matchesFilter(record, filter))),
      findOne: (filter: Record<string, unknown>) => leanResult(tradeSetups.find((record) => matchesFilter(record, filter)) ?? null),
      findOneAndUpdate: (filter: Record<string, unknown>, update: Record<string, unknown>) => {
        const record = tradeSetups.find((candidate) => matchesFilter(candidate, filter));
        if (!record) return leanResult(null);
        applyUpdate(record, update);
        return leanResult(record);
      },
    } as never,
    riskStateRepository: {
      findOne: (filter: Record<string, unknown>) => leanResult(riskStates.find((record) => matchesFilter(record, filter)) ?? null),
    } as never,
    userDailyRiskStateRepository: {
      findOne: (filter: Record<string, unknown>) => leanResult(dailyRiskStates.find((record) => matchesFilter(record, filter)) ?? null),
    } as never,
    activeTradeRepository: {
      findOne: (filter: Record<string, unknown>) => leanResult(activeTrades.find((record) => matchesFilter(record, filter)) ?? null),
    } as never,
    scoreCheckSnapshotRepository: {
      findOne: (filter: Record<string, unknown>) => leanResult(scoreCheckSnapshots.find((record) => matchesFilter(record, filter)) ?? null),
    } as never,
    tradeScoreSnapshotRepository: {
      create: async (input: Record<string, unknown>) => {
        const snapshot = {
          _id: new Types.ObjectId(),
          ...input,
          createdAt: fixedNow,
          updatedAt: fixedNow,
        };
        tradeScoreSnapshots.push(snapshot);
        return snapshot;
      },
      findOne: (filter: Record<string, unknown>) => leanResult(tradeScoreSnapshots.find((record) => matchesFilter(record, filter)) ?? null),
      findOneAndUpdate: (filter: Record<string, unknown>, update: Record<string, unknown>) => {
        const record = tradeScoreSnapshots.find((candidate) => matchesFilter(candidate, filter));
        if (!record) return leanResult(null);
        applyUpdate(record, update);
        return leanResult(record);
      },
    } as never,
    auditLogService: {
      record: async (event) => {
        auditEvents.push(event);
      },
    },
    now: () => fixedNow,
  });

  return {
    auditEvents,
    scoreChecks,
    scoreCheckSnapshots,
    service,
    tradePlans,
    tradeScoreSnapshots,
    tradeSetups,
  };
};

test("TradeSetupService rejects conversion without ACTIVE TradePlan", async () => {
  const { service } = createHarness({ tradePlans: [makeTradePlan({ status: "DRAFT" })] });

  await assert.rejects(
    service.convertScoreCheckToTradeSetup(userId, scoreCheckId, { tradePlanId }),
    /ACTIVE TradePlan/,
  );
});

test("TradeSetupService rejects another user's ScoreCheck", async () => {
  const { service } = createHarness({ scoreChecks: [makeScoreCheck({ userId: new Types.ObjectId(otherUserId) })] });

  await assert.rejects(
    service.convertScoreCheckToTradeSetup(userId, scoreCheckId, { tradePlanId }),
    /SCORE_CHECK_NOT_FOUND/,
  );
});

test("TradeSetupService rejects another user's TradePlan", async () => {
  const { service } = createHarness({ tradePlans: [makeTradePlan({ userId: new Types.ObjectId(otherUserId) })] });

  await assert.rejects(
    service.convertScoreCheckToTradeSetup(userId, scoreCheckId, { tradePlanId }),
    /TRADE_PLAN_NOT_FOUND/,
  );
});

test("TradeSetupService rejects TradePlan and ScoreCheck scope mismatch", async () => {
  const { service } = createHarness({ tradePlans: [makeTradePlan({ tradeStyle: "SWING" })] });

  await assert.rejects(
    service.convertScoreCheckToTradeSetup(userId, scoreCheckId, { tradePlanId }),
    /scope does not match/,
  );
});

test("TradeSetupService rejects expired ScoreCheck", async () => {
  const { service } = createHarness({
    scoreChecks: [makeScoreCheck({ scoreValidUntil: new Date("2026-06-23T09:59:00.000Z") })],
  });

  await assert.rejects(
    service.convertScoreCheckToTradeSetup(userId, scoreCheckId, { tradePlanId }),
    /expired/,
  );
});

test("TradeSetupService rejects already converted ScoreCheck", async () => {
  const { service } = createHarness({
    scoreChecks: [makeScoreCheck({ convertedToTradeSetupId: new Types.ObjectId() })],
  });

  await assert.rejects(
    service.convertScoreCheckToTradeSetup(userId, scoreCheckId, { tradePlanId }),
    /already converted/,
  );
});

test("TradeSetupService gives retry guidance for already converted rejected ScoreCheck", async () => {
  const rejectedSetup = makeRejectedTradeSetup();
  const { service } = createHarness({
    scoreChecks: [makeScoreCheck({ convertedToTradeSetupId: rejectedSetup._id })],
    tradeSetups: [rejectedSetup],
  });

  await assert.rejects(
    service.convertScoreCheckToTradeSetup(userId, scoreCheckId, { tradePlanId }),
    /Retry the setup instead/,
  );
});

test("TradeSetupService valid conversion creates TradeSetup", async () => {
  const { service, tradeSetups } = createHarness();

  const tradeSetup = await service.convertScoreCheckToTradeSetup(userId, scoreCheckId, { tradePlanId });

  assert.equal(tradeSetups.length, 1);
  assert.equal(tradeSetup.status, "APPROVED");
  assert.equal(tradeSetup.finalPermission, "TAKE_TRADE");
});

test("TradeSetupService valid conversion creates permanent TradeScoreSnapshot", async () => {
  const { scoreChecks, service, tradeScoreSnapshots } = createHarness();

  const tradeSetup = await service.convertScoreCheckToTradeSetup(userId, scoreCheckId, { tradePlanId });

  assert.equal(tradeScoreSnapshots.length, 1);
  const snapshot = tradeScoreSnapshots[0]!;
  assert.equal(String(snapshot.scoreCheckId), scoreCheckId);
  assert.equal(String(snapshot.tradeSetupId), String(tradeSetup._id));
  assert.equal(String(snapshot.sourceSnapshotId), snapshotId);
  assert.equal(String(tradeSetup.tradeScoreSnapshotId), String(snapshot._id));
  assert.equal(String((scoreChecks[0] as Record<string, any>).tradeScoreSnapshotId), String(snapshot._id));
  assert.equal(snapshot.scoringTemplateKey, "INDIA_EQUITY_INTRADAY_V1");
  assert.equal(snapshot.scoringTemplateName, "India Equity Intraday");
  assert.equal(snapshot.scoringTemplateVersion, "1");
  assert.equal(snapshot.scoringTemplateScope, "SYSTEM");
  assert.equal(snapshot.selectedSymbol.symbol, "MCX:GOLD:04DEC2026:FUTURE");
  assert.equal(snapshot.finalScore, 80);
  assert.equal(snapshot.permission, "TAKE_TRADE");
  assert.equal(snapshot.scoreStatus, "READY");
  assert.equal(snapshot.dataConfidence, "HIGH");
  assert.equal(snapshot.resourceReadinessSummary.ready, 1);
  assert.equal(snapshot.resolvedResources.length, 1);
  assert.equal(snapshot.resourceSnapshots.length, 1);
  assert.equal(snapshot.sectionBreakdown.length, 1);
  assert.deepEqual(snapshot.warnings, ["resource warning"]);
  assert.deepEqual(snapshot.blockers, []);
  assert.equal(Object.hasOwn(snapshot, "expiresAt"), false);
});

test("TradeSetupService blocks conversion when ScoreCheckSnapshot is missing", async () => {
  const { service, tradeScoreSnapshots, tradeSetups } = createHarness({ scoreCheckSnapshots: [] });

  await assert.rejects(
    service.convertScoreCheckToTradeSetup(userId, scoreCheckId, { tradePlanId }),
    /SCORE_CHECK_SNAPSHOT_EXPIRED_RERUN_REQUIRED/,
  );

  assert.equal(tradeSetups.length, 0);
  assert.equal(tradeScoreSnapshots.length, 0);
});

test("TradeSetupService blocks conversion when ScoreCheckSnapshot is expired", async () => {
  const { service, tradeScoreSnapshots, tradeSetups } = createHarness({
    scoreCheckSnapshots: [makeScoreCheckSnapshot({ expiresAt: new Date("2026-06-23T09:59:00.000Z") })],
  });

  await assert.rejects(
    service.convertScoreCheckToTradeSetup(userId, scoreCheckId, { tradePlanId }),
    /SCORE_CHECK_SNAPSHOT_EXPIRED_RERUN_REQUIRED/,
  );

  assert.equal(tradeSetups.length, 0);
  assert.equal(tradeScoreSnapshots.length, 0);
});

test("TradeSetupService reuses existing permanent TradeScoreSnapshot during conversion", async () => {
  const existingPermanentSnapshotId = new Types.ObjectId();
  const { service, tradeScoreSnapshots } = createHarness({
    tradeScoreSnapshots: [{
      _id: existingPermanentSnapshotId,
      userId: new Types.ObjectId(userId),
      scoreCheckId: new Types.ObjectId(scoreCheckId),
      symbolId: new Types.ObjectId(symbolId),
      selectedSymbol: makeScoreCheckSnapshot().selectedSymbol,
      scoringTemplateKey: "INDIA_EQUITY_INTRADAY_V1",
      scoringTemplateName: "India Equity Intraday",
      scoringTemplateVersion: "1",
      scoringTemplateScope: "SYSTEM",
      score: 80,
      finalScore: 80,
      permission: "TAKE_TRADE",
      scoreStatus: "READY",
      dataConfidence: "HIGH",
      breakdown: {},
      reasonCodes: [],
      warnings: [],
      blockers: [],
      calculatedAt: fixedNow,
      createdAt: fixedNow,
      updatedAt: fixedNow,
    }],
  });

  const tradeSetup = await service.convertScoreCheckToTradeSetup(userId, scoreCheckId, { tradePlanId });

  assert.equal(tradeScoreSnapshots.length, 1);
  assert.equal(String(tradeScoreSnapshots[0]!._id), String(existingPermanentSnapshotId));
  assert.equal(String(tradeScoreSnapshots[0]!.tradeSetupId), String(tradeSetup._id));
  assert.equal(String(tradeSetup.tradeScoreSnapshotId), String(existingPermanentSnapshotId));
});

test("TradeSetupService keeps permanent TradeScoreSnapshot when RiskGovernor rejects", async () => {
  const { service, tradeScoreSnapshots } = createHarness({
    riskStates: [makeRiskState({ riskMode: "STOP_TRADING" })],
  });

  const tradeSetup = await service.convertScoreCheckToTradeSetup(userId, scoreCheckId, { tradePlanId });

  assert.equal(tradeSetup.status, "REJECTED");
  assert.equal(tradeSetup.finalPermission, "STOP_TRADING");
  assert.equal(tradeScoreSnapshots.length, 1);
  assert.equal(String(tradeScoreSnapshots[0]!.tradeSetupId), String(tradeSetup._id));
});

test("TradeSetupService permanent TradeScoreSnapshot omits raw provider payloads", async () => {
  const { service, tradeScoreSnapshots } = createHarness();

  await service.convertScoreCheckToTradeSetup(userId, scoreCheckId, { tradePlanId });

  const serialized = JSON.stringify(tradeScoreSnapshots[0]);
  assert.equal(serialized.includes("providerPayload"), false);
  assert.equal(serialized.includes("rawOrderBook"), false);
  assert.equal(serialized.includes("rawCandles"), false);
  assert.equal(serialized.includes("brokerToken"), false);
});

test("TradeSetupService valid conversion updates ScoreCheck convertedToTradeSetupId", async () => {
  const { scoreChecks, service } = createHarness();

  const tradeSetup = await service.convertScoreCheckToTradeSetup(userId, scoreCheckId, { tradePlanId });

  assert.equal(String((scoreChecks[0] as Record<string, any>).convertedToTradeSetupId), String(tradeSetup._id));
});

test("TradeSetupService valid conversion copies planned values", async () => {
  const { service, tradeSetups } = createHarness();

  await service.convertScoreCheckToTradeSetup(userId, scoreCheckId, { tradePlanId });

  assert.equal(tradeSetups[0]!.plannedEntry, 100);
  assert.equal(tradeSetups[0]!.plannedStopLoss, 95);
  assert.equal(tradeSetups[0]!.plannedTarget1, 110);
  assert.equal(tradeSetups[0]!.plannedRewardRiskRatio, 2);
});

test("TradeSetupService valid conversion copies symbol snapshot", async () => {
  const { service, tradeSetups } = createHarness();

  await service.convertScoreCheckToTradeSetup(userId, scoreCheckId, { tradePlanId });

  assert.equal(tradeSetups[0]!.symbolSnapshot.symbol, "MCX:GOLD:04DEC2026:FUTURE");
  assert.equal(tradeSetups[0]!.symbolSnapshot.provider, "ANGEL_ONE");
});

test("TradeSetupService valid conversion accepts custom user scoring template keys", async () => {
  const customTemplateKey = "USER_INDIA_EQUITY_INTRADAY_V1_1782770000000";
  const { service, tradeSetups } = createHarness({
    scoreChecks: [makeScoreCheck({ scoringTemplateKey: customTemplateKey })],
  });

  const tradeSetup = await service.convertScoreCheckToTradeSetup(userId, scoreCheckId, { tradePlanId });

  assert.equal(tradeSetup.scoringTemplateKey, customTemplateKey);
  assert.equal(tradeSetups[0]!.scoringTemplateKey, customTemplateKey);
});

test("RiskGovernor returns STOP_TRADING when TradePlanRiskState riskMode is STOP_TRADING", () => {
  const decision = new RiskGovernorService().evaluate({
    tradePlan: { status: "ACTIVE" },
    tradePlanRiskState: { riskMode: "STOP_TRADING" },
    scorePermission: "TAKE_TRADE",
    plannedRewardRiskRatio: 2,
    evaluatedAt: fixedNow,
  });

  assert.equal(decision.permission, "STOP_TRADING");
});

test("RiskGovernor returns REJECT when score permission is REJECT", () => {
  const decision = new RiskGovernorService().evaluate({
    tradePlan: { status: "ACTIVE" },
    tradePlanRiskState: { riskMode: "NORMAL_RISK" },
    scorePermission: "REJECT",
    plannedRewardRiskRatio: 2,
    evaluatedAt: fixedNow,
  });

  assert.equal(decision.permission, "REJECT");
});

test("RiskGovernor caps permission to TAKE_SMALL_RISK in REDUCED_RISK", () => {
  const decision = new RiskGovernorService().evaluate({
    tradePlan: { status: "ACTIVE" },
    tradePlanRiskState: { riskMode: "REDUCED_RISK" },
    scorePermission: "TAKE_TRADE",
    plannedRewardRiskRatio: 2,
    evaluatedAt: fixedNow,
  });

  assert.equal(decision.permission, "TAKE_SMALL_RISK");
});

test("RiskGovernor caps permission to TAKE_SMALL_RISK in MICRO_RISK", () => {
  const decision = new RiskGovernorService().evaluate({
    tradePlan: { status: "ACTIVE" },
    tradePlanRiskState: { riskMode: "MICRO_RISK" },
    scorePermission: "TAKE_TRADE",
    plannedRewardRiskRatio: 2,
    evaluatedAt: fixedNow,
  });

  assert.equal(decision.permission, "TAKE_SMALL_RISK");
});

test("RiskGovernor rejects when maxTrades reached", () => {
  const decision = new RiskGovernorService().evaluate({
    tradePlan: { status: "ACTIVE", maxTrades: 2 },
    tradePlanRiskState: { riskMode: "NORMAL_RISK", totalTrades: 2 },
    scorePermission: "TAKE_TRADE",
    plannedRewardRiskRatio: 2,
    evaluatedAt: fixedNow,
  });

  assert.equal(decision.permission, "REJECT");
});

test("RiskGovernor returns STOP_TRADING when consecutive loss limit reached", () => {
  const decision = new RiskGovernorService().evaluate({
    tradePlan: { status: "ACTIVE", maxConsecutiveLosses: 3 },
    tradePlanRiskState: { riskMode: "NORMAL_RISK", consecutiveLosses: 3 },
    scorePermission: "TAKE_TRADE",
    plannedRewardRiskRatio: 2,
    evaluatedAt: fixedNow,
  });

  assert.equal(decision.permission, "STOP_TRADING");
});

test("TradeSetupService audits conversion, setup creation, and risk evaluation", async () => {
  const { auditEvents, service } = createHarness();

  await service.convertScoreCheckToTradeSetup(userId, scoreCheckId, { tradePlanId });

  assert.deepEqual(auditEvents.map((event) => event.action), [
    "SCORE_CHECK_CONVERTED_TO_TRADE_SETUP",
    "TRADE_SETUP_CREATED",
    "RISK_GOVERNOR_EVALUATED",
  ]);
});

test("TradeSetupService retries rejected setup and approves when risk state is ready", async () => {
  const rejectedSetup = makeRejectedTradeSetup();
  const { auditEvents, service, tradeSetups } = createHarness({
    tradeSetups: [rejectedSetup],
    riskStates: [makeRiskState({ riskMode: "NORMAL_RISK" })],
  });

  const result = await service.retryRiskCheck(userId, String(rejectedSetup._id), {
    reason: "Retry after risk lock reset",
  });

  assert.equal(result.tradeSetup.status, "APPROVED");
  assert.equal(result.tradeSetup.finalPermission, "TAKE_TRADE");
  assert.equal(tradeSetups[0]!.status, "APPROVED");
  assert.ok(auditEvents.some((event) => event.action === "TRADE_SETUP_RISK_RETRY"));
  assert.ok(auditEvents.some((event) => event.action === "RISK_GOVERNOR_EVALUATED"));
});

test("TradeSetupService keeps rejected setup rejected when risk governor still blocks", async () => {
  const rejectedSetup = makeRejectedTradeSetup();
  const { service } = createHarness({
    tradeSetups: [rejectedSetup],
    riskStates: [makeRiskState({ riskMode: "STOP_TRADING" })],
  });

  const result = await service.retryRiskCheck(userId, String(rejectedSetup._id), {
    reason: "Retry after risk lock reset",
  });

  assert.equal(result.tradeSetup.status, "REJECTED");
  assert.equal(result.tradeSetup.finalPermission, "STOP_TRADING");
  assert.deepEqual(result.riskDecision.reasonCodes, ["STOP_TRADING_ACTIVE"]);
});

test("TradeSetupService retry requires reason", async () => {
  const rejectedSetup = makeRejectedTradeSetup();
  const { service } = createHarness({ tradeSetups: [rejectedSetup] });

  await assert.rejects(
    service.retryRiskCheck(userId, String(rejectedSetup._id), { reason: "" }),
    /Invalid TradeSetup risk retry payload/,
  );
});

test("TradeSetupService retry rejects executed setup", async () => {
  const rejectedSetup = makeRejectedTradeSetup({ status: "EXECUTED", executedAt: fixedNow });
  const { service } = createHarness({ tradeSetups: [rejectedSetup] });

  await assert.rejects(
    service.retryRiskCheck(userId, String(rejectedSetup._id), { reason: "Retry after risk lock reset" }),
    /Executed TradeSetup cannot retry/,
  );
});

test("TradeSetupService retry rejects setup linked to ActiveTrade", async () => {
  const rejectedSetup = makeRejectedTradeSetup();
  const { service } = createHarness({
    tradeSetups: [rejectedSetup],
    activeTrades: [{
      _id: new Types.ObjectId(),
      userId: new Types.ObjectId(userId),
      tradeSetupId: rejectedSetup._id,
    }],
  });

  await assert.rejects(
    service.retryRiskCheck(userId, String(rejectedSetup._id), { reason: "Retry after risk lock reset" }),
    /ActiveTrade/,
  );
});

test("TradeSetupService cancellation works if not executed", async () => {
  const { service } = createHarness();
  const tradeSetup = await service.convertScoreCheckToTradeSetup(userId, scoreCheckId, { tradePlanId });

  const cancelled = await service.cancelTradeSetup(userId, String(tradeSetup._id));

  assert.equal(cancelled.status, "CANCELLED");
});

test("TradeSetupService cancellation rejects already executed setup", async () => {
  const executedSetupId = new Types.ObjectId();
  const { service } = createHarness({
    tradeSetups: [{
      _id: executedSetupId,
      userId: new Types.ObjectId(userId),
      tradePlanId: new Types.ObjectId(tradePlanId),
      status: "EXECUTED",
      finalPermission: "TAKE_TRADE",
      riskGovernorPermission: "TAKE_TRADE",
      riskModeAtDecision: "NORMAL_RISK",
      reasonCodes: [],
      warnings: [],
      executedAt: fixedNow,
    }],
  });

  await assert.rejects(
    service.cancelTradeSetup(userId, String(executedSetupId)),
    /cannot be cancelled/,
  );
});
