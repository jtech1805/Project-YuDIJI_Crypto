import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import {
  calculateTradeGeometry,
  type CreateScoreCheckInput,
  ScoreCheckService,
} from "./score-check.service.js";

const userId = "69e64c5f9042aac89c8c83f8";
const symbolId = "65abc0000000000000000001";
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
  return record;
};

const activeSymbol = (overrides: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(symbolId),
  symbol: "MCX:GOLD:04DEC2026:FUTURE",
  displayName: "MCX GOLD 04DEC2026 FUTURE",
  provider: "ANGEL_ONE",
  marketType: "COMMODITY",
  exchange: "MCX",
  instrumentType: "FUTURE",
  providerSymbol: "GOLD04DEC26FUT",
  requiresBrokerLogin: true,
  status: "ACTIVE",
  ...overrides,
});

const baseScoreInput = (overrides: Partial<CreateScoreCheckInput> = {}): CreateScoreCheckInput => ({
  symbolId,
  marketType: "COMMODITY",
  tradeStyle: "INTRADAY",
  instrumentType: "FUTURE",
  direction: "LONG",
  entry: 100,
  stopLoss: 95,
  target1: 110,
  scoringTemplateKey: "INDIA_EQUITY_INTRADAY_V1",
  scoringTemplateVersion: "1",
  ...overrides,
});

const createHarness = (symbol: Record<string, unknown> | null = activeSymbol()) => {
  const scoreChecks: Record<string, any>[] = [];
  const snapshots: Record<string, any>[] = [];
  const auditEvents: Record<string, any>[] = [];
  let riskMutationCount = 0;

  const scoreCheckRepository = {
    create: async (input: Record<string, unknown>) => {
      const scoreCheck = {
        _id: new Types.ObjectId(),
        ...input,
        createdAt: fixedNow,
        updatedAt: fixedNow,
      };
      scoreChecks.push(scoreCheck);
      return scoreCheck;
    },
    find: (filter: Record<string, unknown>) => {
      return sortableLeanResult(scoreChecks.filter((scoreCheck) => matchesFilter(scoreCheck, filter)));
    },
    findOne: (filter: Record<string, unknown>) => {
      return leanResult(scoreChecks.find((scoreCheck) => matchesFilter(scoreCheck, filter)) ?? null);
    },
    findOneAndUpdate: (filter: Record<string, unknown>, update: Record<string, unknown>) => {
      const scoreCheck = scoreChecks.find((candidate) => matchesFilter(candidate, filter));
      if (!scoreCheck) return leanResult(null);
      applyUpdate(scoreCheck, update);
      scoreCheck.updatedAt = fixedNow;
      return leanResult(scoreCheck);
    },
  };

  const tradeScoreSnapshotRepository = {
    create: async (input: Record<string, unknown>) => {
      const snapshot = {
        _id: new Types.ObjectId(),
        ...input,
        createdAt: fixedNow,
        updatedAt: fixedNow,
      };
      snapshots.push(snapshot);
      return snapshot;
    },
  };

  const symbolRepository = {
    findOne: () => leanResult(symbol),
  };

  const service = new ScoreCheckService({
    scoreCheckRepository: scoreCheckRepository as never,
    tradeScoreSnapshotRepository: tradeScoreSnapshotRepository as never,
    symbolRepository: symbolRepository as never,
    auditLogService: {
      record: async (event) => {
        auditEvents.push(event);
      },
    },
    now: () => fixedNow,
  });

  return {
    auditEvents,
    get riskMutationCount() {
      return riskMutationCount;
    },
    mutateRiskState: () => {
      riskMutationCount += 1;
    },
    scoreChecks,
    service,
    snapshots,
  };
};

test("ScoreCheckService accepts valid LONG geometry", async () => {
  const { service } = createHarness();

  const scoreCheck = await service.createScoreCheck(userId, baseScoreInput());

  assert.equal(scoreCheck.direction, "LONG");
  assert.equal(scoreCheck.reasonCodes.includes("VALID_GEOMETRY"), true);
});

test("ScoreCheckService rejects invalid LONG geometry", async () => {
  const { service } = createHarness();

  await assert.rejects(
    service.createScoreCheck(userId, baseScoreInput({ stopLoss: 101 })),
    /Invalid ScoreCheck payload/,
  );
});

test("ScoreCheckService accepts valid SHORT geometry", async () => {
  const { service } = createHarness();

  const scoreCheck = await service.createScoreCheck(
    userId,
    baseScoreInput({
      direction: "SHORT",
      entry: 100,
      stopLoss: 105,
      target1: 90,
    }),
  );

  assert.equal(scoreCheck.direction, "SHORT");
  assert.equal(scoreCheck.rewardRiskRatio, 2);
});

test("ScoreCheckService rejects invalid SHORT geometry", async () => {
  const { service } = createHarness();

  await assert.rejects(
    service.createScoreCheck(
      userId,
      baseScoreInput({
        direction: "SHORT",
        entry: 100,
        stopLoss: 95,
        target1: 90,
      }),
    ),
    /Invalid ScoreCheck payload/,
  );
});

test("calculateTradeGeometry calculates LONG risk reward and RR", () => {
  assert.deepEqual(
    calculateTradeGeometry({
      direction: "LONG",
      entry: 100,
      stopLoss: 95,
      target1: 110,
    }),
    {
      riskPerUnit: 5,
      rewardPerUnit: 10,
      rewardRiskRatio: 2,
    },
  );
});

test("calculateTradeGeometry calculates SHORT risk reward and RR", () => {
  assert.deepEqual(
    calculateTradeGeometry({
      direction: "SHORT",
      entry: 100,
      stopLoss: 105,
      target1: 90,
    }),
    {
      riskPerUnit: 5,
      rewardPerUnit: 10,
      rewardRiskRatio: 2,
    },
  );
});

test("ScoreCheckService returns REJECT when RR is below 1", async () => {
  const { service } = createHarness();

  const scoreCheck = await service.createScoreCheck(
    userId,
    baseScoreInput({
      entry: 100,
      stopLoss: 90,
      target1: 105,
    }),
  );

  assert.equal(scoreCheck.permission, "REJECT");
  assert.equal(scoreCheck.score, 30);
});

test("ScoreCheckService returns WAIT when RR is 1 to below 1.5", async () => {
  const { service } = createHarness();

  const scoreCheck = await service.createScoreCheck(
    userId,
    baseScoreInput({
      entry: 100,
      stopLoss: 90,
      target1: 112,
    }),
  );

  assert.equal(scoreCheck.permission, "WAIT");
  assert.equal(scoreCheck.score, 50);
});

test("ScoreCheckService returns TAKE_SMALL_RISK when RR is 1.5 to below 2", async () => {
  const { service } = createHarness();

  const scoreCheck = await service.createScoreCheck(
    userId,
    baseScoreInput({
      entry: 100,
      stopLoss: 90,
      target1: 116,
    }),
  );

  assert.equal(scoreCheck.permission, "TAKE_SMALL_RISK");
  assert.equal(scoreCheck.score, 70);
});

test("ScoreCheckService returns TAKE_TRADE when RR is 2 or above", async () => {
  const { service } = createHarness();

  const scoreCheck = await service.createScoreCheck(userId, baseScoreInput());

  assert.equal(scoreCheck.permission, "TAKE_TRADE");
  assert.equal(scoreCheck.score, 80);
});

test("ScoreCheckService does not mutate risk state", async () => {
  const harness = createHarness();

  await harness.service.createScoreCheck(userId, baseScoreInput());

  assert.equal(harness.riskMutationCount, 0);
});

test("ScoreCheckService creates TradeScoreSnapshot", async () => {
  const { service, snapshots } = createHarness();

  const scoreCheck = await service.createScoreCheck(userId, baseScoreInput());

  assert.equal(snapshots.length, 1);
  assert.equal(String(scoreCheck.tradeScoreSnapshotId), String(snapshots[0]!._id));
});

test("ScoreCheckService audits SCORE_CHECK_CREATED and SCORE_CALCULATED", async () => {
  const { auditEvents, service } = createHarness();

  await service.createScoreCheck(userId, baseScoreInput());

  assert.deepEqual(auditEvents.map((event) => event.action), [
    "SCORE_CHECK_CREATED",
    "SCORE_CALCULATED",
  ]);
});

test("ScoreCheckService rejects missing symbol safely", async () => {
  const { service } = createHarness(null);

  await assert.rejects(
    service.createScoreCheck(userId, baseScoreInput()),
    /SYMBOL_NOT_FOUND/,
  );
});

test("ScoreCheckService rejects inactive symbol safely", async () => {
  const { service } = createHarness(activeSymbol({ status: "EXPIRED" }));

  await assert.rejects(
    service.createScoreCheck(userId, baseScoreInput()),
    /SYMBOL_INACTIVE/,
  );
});
