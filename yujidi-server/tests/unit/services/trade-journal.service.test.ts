import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import { TradeJournalService } from "../../../src/services/trade-journal.service.js";

const userId = "69e64c5f9042aac89c8c83f8";
const otherUserId = "69e64c5f9042aac89c8c83f9";
const resultId = "65abc0000000000000000005";
const activeTradeId = "65abc0000000000000000003";
const setupId = "65abc0000000000000000004";
const planId = "65abc0000000000000000002";
const symbolId = "65abc0000000000000000001";
const scoreId = "65abc0000000000000000006";
const snapshotId = "65abc0000000000000000007";
const fixedNow = new Date("2026-06-24T16:00:00.000Z");

const execResult = <T>(value: T) => ({ exec: async () => value });
const leanResult = <T>(value: T) => ({ lean: () => execResult(value) });
const sortableLeanResult = <T>(value: T) => ({ sort: () => leanResult(value) });
const idString = (value: unknown): string => String(value);
const matches = (record: Record<string, any>, filter: Record<string, any>): boolean =>
  Object.entries(filter).every(([key, value]) => idString(record[key]) === idString(value));
const applyUpdate = (record: Record<string, any>, update: Record<string, any>): void => {
  if (update.$set) Object.assign(record, update.$set);
};

const symbolSnapshot = {
  symbolId: new Types.ObjectId(symbolId),
  symbol: "MCX:GOLD:04DEC2026:FUTURE",
  displayName: "MCX GOLD 04DEC2026 FUTURE",
  provider: "ANGEL_ONE",
  marketType: "COMMODITY",
  exchange: "MCX",
  instrumentType: "FUTURE",
};
const makeResult = (overrides: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(resultId), userId: new Types.ObjectId(userId),
  tradePlanId: new Types.ObjectId(planId), tradeSetupId: new Types.ObjectId(setupId),
  activeTradeId: new Types.ObjectId(activeTradeId), symbolId: new Types.ObjectId(symbolId),
  symbolSnapshot, marketType: "COMMODITY", tradeStyle: "INTRADAY", instrumentType: "FUTURE",
  direction: "LONG", quantity: 10, exitPrice: 110, exitReason: "TARGET_1",
  grossPnl: 100, netPnl: 92, realizedPnlUsedForRisk: 92, pnlBasis: "CONFIRMED_NET",
  realizedR: 1.84, resultType: "WIN", status: "FINALIZED", closedAt: fixedNow,
  ...overrides,
});
const makeActive = (overrides: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(activeTradeId), userId: new Types.ObjectId(userId),
  sourceScoreCheckId: new Types.ObjectId(scoreId), actualEntry: 100, initialStopLoss: 95,
  currentStopLoss: 100, ruleViolations: ["LATE_ENTRY_DEGRADED_RR"],
  openedAt: new Date("2026-06-24T14:00:00Z"), ...overrides,
});
const makeSetup = (overrides: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(setupId), userId: new Types.ObjectId(userId),
  tradeScoreSnapshotId: new Types.ObjectId(snapshotId), plannedEntry: 99,
  plannedStopLoss: 94, plannedTarget1: 109, plannedTarget2: 114,
  plannedRewardRiskRatio: 2, ...overrides,
});
const completeReflection = {
  entryQuality: "VALID_ENTRY" as const,
  exitQuality: "EXITED_AT_TARGET" as const,
  outcomeQuality: "PROFIT_WITH_GOOD_PROCESS" as const,
  followedPlan: true,
  mistakeTags: ["NONE" as const],
};

const createHarness = (overrides: {
  results?: Record<string, any>[]; active?: Record<string, any>[];
  setups?: Record<string, any>[]; events?: Record<string, any>[]; journals?: Record<string, any>[];
} = {}) => {
  const results = overrides.results ?? [makeResult()];
  const active = overrides.active ?? [makeActive()];
  const setups = overrides.setups ?? [makeSetup()];
  const events = overrides.events ?? [
    { _id: new Types.ObjectId(), userId: new Types.ObjectId(userId), activeTradeId: new Types.ObjectId(activeTradeId) },
  ];
  const journals = overrides.journals ?? [];
  const auditEvents: Record<string, any>[] = [];
  const riskState = { totalTrades: 1, netPnl: 92 };
  const readRepo = (records: Record<string, any>[]) => ({
    findOne: (filter: Record<string, unknown>) => leanResult(records.find((r) => matches(r, filter)) ?? null),
  });
  const journalRepo = {
    create: async (input: Record<string, unknown>) => {
      if (journals.some((j) => idString(j.tradeResultId) === idString(input.tradeResultId))) {
        throw Object.assign(new Error("duplicate"), { code: 11000 });
      }
      const journal = { _id: new Types.ObjectId(), ...input, createdAt: fixedNow, updatedAt: fixedNow };
      journals.push(journal); return journal;
    },
    find: (filter: Record<string, unknown>) => sortableLeanResult(journals.filter((j) => matches(j, filter))),
    findOne: (filter: Record<string, unknown>) => leanResult(journals.find((j) => matches(j, filter)) ?? null),
    findOneAndUpdate: (filter: Record<string, unknown>, update: Record<string, unknown>) => {
      const journal = journals.find((j) => matches(j, filter));
      if (!journal) return leanResult(null);
      applyUpdate(journal, update); return leanResult(journal);
    },
  };
  const service = new TradeJournalService({
    tradeResultRepository: readRepo(results) as never,
    activeTradeRepository: readRepo(active) as never,
    tradeSetupRepository: readRepo(setups) as never,
    tradeEventRepository: {
      find: (filter: Record<string, unknown>) => leanResult(events.filter((e) => matches(e, filter))),
    } as never,
    journalRepository: journalRepo as never,
    auditLogService: { record: async (event) => { auditEvents.push(event); } },
    now: () => fixedNow,
  });
  return { active, auditEvents, events, journals, results, riskState, service, setups };
};

test("cannot create journal for non-owned TradeResult", async () => {
  const { service } = createHarness({ results: [makeResult({ userId: new Types.ObjectId(otherUserId) })] });
  await assert.rejects(service.createFromTradeResult(userId, resultId), /TRADE_RESULT_NOT_FOUND/);
});
test("cannot create journal for non-finalized TradeResult", async () => {
  const { service } = createHarness({ results: [makeResult({ status: "DRAFT" })] });
  await assert.rejects(service.createFromTradeResult(userId, resultId), /FINALIZED/);
});
test("creation copies deterministic lifecycle facts", async () => {
  const { service } = createHarness();
  const journal = await service.createFromTradeResult(userId, resultId);
  assert.equal(journal.plannedEntry, 99); assert.equal(journal.actualEntry, 100);
  assert.equal(journal.exitPrice, 110); assert.equal(journal.realizedR, 1.84);
  assert.equal(String(journal.scoreCheckId), scoreId);
  assert.equal(String(journal.tradeScoreSnapshotId), snapshotId);
});
test("creation links TradeEvents", async () => {
  const { events, service } = createHarness();
  const journal = await service.createFromTradeResult(userId, resultId);
  assert.equal(String(journal.tradeEventIds[0]), String(events[0]!._id));
});
test("duplicate creation returns existing journal", async () => {
  const { service } = createHarness();
  const first = await service.createFromTradeResult(userId, resultId);
  const second = await service.createFromTradeResult(userId, resultId);
  assert.equal(String(first._id), String(second._id));
});
test("user can update allowed reflection fields", async () => {
  const { service } = createHarness();
  const journal = await service.createFromTradeResult(userId, resultId);
  const updated = await service.updateJournal(userId, String(journal._id), {
    setupType: "BREAKOUT", userNotes: "Patient entry.", selfRating: 8,
  });
  assert.equal(updated.setupType, "BREAKOUT"); assert.equal(updated.selfRating, 8);
});
test("user cannot update system-owned fields", async () => {
  const { service } = createHarness();
  const journal = await service.createFromTradeResult(userId, resultId);
  await assert.rejects(
    service.updateJournal(userId, String(journal._id), { plannedEntry: 1 } as never),
    /Invalid TradeJournal update payload/,
  );
});

for (const [name, field] of [
  ["entryQuality", "entryQuality"], ["exitQuality", "exitQuality"],
  ["outcomeQuality", "outcomeQuality"], ["followedPlan", "followedPlan"],
  ["mistakeTags", "mistakeTags"],
] as const) {
  test(`finalize requires ${name}`, async () => {
    const { service } = createHarness();
    const journal = await service.createFromTradeResult(userId, resultId);
    const reflection: Record<string, unknown> = { ...completeReflection };
    delete reflection[field];
    await service.updateJournal(userId, String(journal._id), reflection);
    await assert.rejects(service.finalizeJournal(userId, String(journal._id)), new RegExp(name));
  });
}

test("finalize sets FINALIZED and finalizedAt", async () => {
  const { service } = createHarness();
  const journal = await service.createFromTradeResult(userId, resultId);
  await service.updateJournal(userId, String(journal._id), completeReflection);
  const finalized = await service.finalizeJournal(userId, String(journal._id));
  assert.equal(finalized.status, "FINALIZED");
  assert.equal(finalized.finalizedAt, fixedNow);
});
test("finalize does not mutate TradeResult or RiskState", async () => {
  const harness = createHarness();
  const beforeResult = JSON.stringify(harness.results[0]);
  const beforeRisk = JSON.stringify(harness.riskState);
  const journal = await harness.service.createFromTradeResult(userId, resultId);
  await harness.service.updateJournal(userId, String(journal._id), completeReflection);
  await harness.service.finalizeJournal(userId, String(journal._id));
  assert.equal(JSON.stringify(harness.results[0]), beforeResult);
  assert.equal(JSON.stringify(harness.riskState), beforeRisk);
});
test("archive sets ARCHIVED and archivedAt", async () => {
  const { service } = createHarness();
  const journal = await service.createFromTradeResult(userId, resultId);
  const archived = await service.archiveJournal(userId, String(journal._id));
  assert.equal(archived.status, "ARCHIVED"); assert.equal(archived.archivedAt, fixedNow);
});
test("list journals filters by user ownership", async () => {
  const ownId = new Types.ObjectId();
  const { service } = createHarness({ journals: [
    { _id: ownId, userId: new Types.ObjectId(userId) },
    { _id: new Types.ObjectId(), userId: new Types.ObjectId(otherUserId) },
  ] });
  const journals = await service.listJournals(userId);
  assert.equal(journals.length, 1); assert.equal(String(journals[0]!._id), String(ownId));
});
test("get journal rejects non-owned access", async () => {
  const journalId = new Types.ObjectId();
  const { service } = createHarness({ journals: [
    { _id: journalId, userId: new Types.ObjectId(otherUserId) },
  ] });
  await assert.rejects(service.getJournal(userId, String(journalId)), /NOT_FOUND/);
});
test("audit service records create update finalize and archive", async () => {
  const { auditEvents, service } = createHarness();
  const journal = await service.createFromTradeResult(userId, resultId);
  await service.updateJournal(userId, String(journal._id), completeReflection);
  await service.finalizeJournal(userId, String(journal._id));
  await service.archiveJournal(userId, String(journal._id));
  assert.deepEqual(auditEvents.map((e) => e.action), [
    "TRADE_JOURNAL_CREATED", "TRADE_JOURNAL_UPDATED",
    "TRADE_JOURNAL_FINALIZED", "TRADE_JOURNAL_ARCHIVED",
  ]);
});
test("AI fields are not generated in Phase 8", async () => {
  const { service } = createHarness();
  const journal = await service.createFromTradeResult(userId, resultId);
  assert.equal(journal.aiSummary, undefined);
  assert.equal(journal.aiReviewId, undefined);
  assert.equal(journal.aiGeneratedAt, undefined);
});
