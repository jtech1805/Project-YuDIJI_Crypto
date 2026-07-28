import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import {
  buildRiskBucketKey,
  type CreateTradePlanInput,
  TradePlanService,
} from "../../../src/services/trade-plan.service.js";

const userId = "69e64c5f9042aac89c8c83f8";
const fixedNow = new Date("2026-06-23T09:00:00.000Z");

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
    if (value && typeof value === "object" && "$in" in value) {
      if (!value.$in.includes(recordValue)) return false;
      continue;
    }
    if (value && typeof value === "object" && "$ne" in value) {
      if (idString(recordValue) === idString(value.$ne)) return false;
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
  if (update.$setOnInsert && typeof update.$setOnInsert === "object") {
    for (const [key, value] of Object.entries(update.$setOnInsert)) {
      if (record[key] === undefined) {
        record[key] = value;
      }
    }
  }
  return record;
};

const basePlanInput = (overrides: Partial<CreateTradePlanInput> = {}): CreateTradePlanInput => ({
  name: "MCX Gold Intraday",
  marketType: "COMMODITY",
  tradeStyle: "INTRADAY",
  instrumentType: "FUTURE",
  planMode: "FIXED_TRADE_COUNT",
  startingCapital: 100000,
  currency: "INR",
  maxRiskPerTradePercent: 1,
  maxDailyLossPercent: 3,
  maxConsecutiveLosses: 3,
  maxTrades: 10,
  reviewCadence: "DAILY",
  riskTemplateKey: "mcx-intraday-default",
  riskTemplateVersion: "1",
  ...overrides,
});

const createHarness = () => {
  const plans: Record<string, any>[] = [];
  const adjustments: Record<string, any>[] = [];
  const riskStates: Record<string, any>[] = [];
  const auditEvents: Record<string, any>[] = [];

  const tradePlanRepository = {
    create: async (input: Record<string, unknown>) => {
      const plan = {
        _id: new Types.ObjectId(),
        ...input,
        createdAt: fixedNow,
        updatedAt: fixedNow,
      };
      plans.push(plan);
      return plan;
    },
    find: (filter: Record<string, unknown>) => {
      return sortableLeanResult(plans.filter((plan) => matchesFilter(plan, filter)));
    },
    findOne: (filter: Record<string, unknown>) => {
      return leanResult(plans.find((plan) => matchesFilter(plan, filter)) ?? null);
    },
    findOneAndUpdate: (filter: Record<string, unknown>, update: Record<string, unknown>) => {
      const plan = plans.find((candidate) => matchesFilter(candidate, filter));
      if (!plan) return leanResult(null);
      applyUpdate(plan, update);
      plan.updatedAt = fixedNow;
      return leanResult(plan);
    },
  };

  const capitalAdjustmentRepository = {
    create: async (input: Record<string, unknown>) => {
      const event = {
        _id: new Types.ObjectId(),
        ...input,
        createdAt: fixedNow,
      };
      adjustments.push(event);
      return event;
    },
  };

  const riskStateRepository = {
    findOneAndUpdate: (
      filter: Record<string, unknown>,
      update: Record<string, unknown>,
      _options: Record<string, unknown>,
    ) => {
      let riskState = riskStates.find((candidate) => matchesFilter(candidate, filter));
      if (!riskState) {
        riskState = {
          _id: new Types.ObjectId(),
        };
        applyUpdate(riskState, update);
        riskState.createdAt = fixedNow;
        riskState.updatedAt = fixedNow;
        riskStates.push(riskState);
      }
      return leanResult(riskState);
    },
  };

  const service = new TradePlanService({
    tradePlanRepository: tradePlanRepository as never,
    capitalAdjustmentRepository: capitalAdjustmentRepository as never,
    riskStateRepository: riskStateRepository as never,
    auditLogService: {
      record: async (event) => {
        auditEvents.push(event);
      },
    },
    now: () => fixedNow,
  });

  return {
    adjustments,
    auditEvents,
    plans,
    riskStates,
    service,
  };
};

test("TradePlanService creates TradePlan in DRAFT", async () => {
  const { auditEvents, service } = createHarness();

  const plan = await service.createTradePlan(userId, basePlanInput());

  assert.equal(plan.status, "DRAFT");
  assert.equal(plan.currentCapital, 100000);
  assert.equal(plan.tradeStyle, "INTRADAY");
  assert.equal(auditEvents.at(-1)?.action, "TRADE_PLAN_CREATED");
});

test("TradePlanService rejects invalid startingCapital", async () => {
  const { service } = createHarness();

  await assert.rejects(
    service.createTradePlan(userId, basePlanInput({ startingCapital: 0 })),
    /Invalid TradePlan payload/,
  );
});

test("TradePlanService rejects FIXED_TRADE_COUNT without maxTrades", async () => {
  const { service } = createHarness();

  await assert.rejects(
    service.createTradePlan(userId, {
      ...basePlanInput(),
      maxTrades: undefined,
    }),
    /Invalid TradePlan payload/,
  );
});

test("TradePlanService rejects DATE_RANGE without valid endDate", async () => {
  const { service } = createHarness();

  await assert.rejects(
    service.createTradePlan(userId, basePlanInput({ planMode: "DATE_RANGE", maxTrades: undefined })),
    /Invalid TradePlan payload/,
  );

  await assert.rejects(
    service.createTradePlan(
      userId,
      basePlanInput({
        planMode: "DATE_RANGE",
        maxTrades: undefined,
        startDate: new Date("2026-06-24T00:00:00.000Z"),
        endDate: new Date("2026-06-23T00:00:00.000Z"),
      }),
    ),
    /Invalid TradePlan payload/,
  );
});

test("TradePlanService activates DRAFT plan and initializes TradePlanRiskState once", async () => {
  const { auditEvents, riskStates, service } = createHarness();
  const plan = await service.createTradePlan(userId, basePlanInput());

  const activatedPlan = await service.activateTradePlan(userId, String(plan._id));

  assert.equal(activatedPlan.status, "ACTIVE");
  assert.equal(riskStates.length, 1);
  assert.equal(riskStates[0]!.riskMode, "NORMAL_RISK");
  assert.equal(riskStates[0]!.riskBucketKey, `${userId}:COMMODITY:INTRADAY:FUTURE`);
  assert.equal(auditEvents.some((event) => event.action === "TRADE_PLAN_RISK_STATE_INITIALIZED"), true);
  assert.equal(auditEvents.at(-1)?.action, "TRADE_PLAN_ACTIVATED");
});

test("TradePlanService does not activate a non-DRAFT plan", async () => {
  const { service } = createHarness();
  const plan = await service.createTradePlan(userId, basePlanInput());
  await service.activateTradePlan(userId, String(plan._id));

  await assert.rejects(
    service.activateTradePlan(userId, String(plan._id)),
    /Only DRAFT TradePlans can be activated/,
  );
});

test("TradePlanService rejects core field updates after activation", async () => {
  const { service } = createHarness();
  const plan = await service.createTradePlan(userId, basePlanInput());
  await service.activateTradePlan(userId, String(plan._id));

  await assert.rejects(
    service.updateTradePlan(userId, String(plan._id), { maxRiskPerTradePercent: 2 }),
    /Active TradePlan can only update/,
  );
});

test("TradePlanService pauses active plan", async () => {
  const { auditEvents, service } = createHarness();
  const plan = await service.createTradePlan(userId, basePlanInput());
  await service.activateTradePlan(userId, String(plan._id));

  const pausedPlan = await service.pauseTradePlan(userId, String(plan._id));

  assert.equal(pausedPlan.status, "PAUSED");
  assert.equal(auditEvents.at(-1)?.action, "TRADE_PLAN_PAUSED");
});

test("TradePlanService stops active or paused plan", async () => {
  const { auditEvents, service } = createHarness();
  const plan = await service.createTradePlan(userId, basePlanInput());
  await service.activateTradePlan(userId, String(plan._id));
  await service.pauseTradePlan(userId, String(plan._id));

  const stoppedPlan = await service.stopTradePlan(userId, String(plan._id));

  assert.equal(stoppedPlan.status, "STOPPED");
  assert.equal(auditEvents.at(-1)?.action, "TRADE_PLAN_STOPPED");
});

test("TradePlanService completes active or paused plan", async () => {
  const { auditEvents, service } = createHarness();
  const plan = await service.createTradePlan(userId, basePlanInput());
  await service.activateTradePlan(userId, String(plan._id));

  const completedPlan = await service.completeTradePlan(userId, String(plan._id));

  assert.equal(completedPlan.status, "COMPLETED");
  assert.equal(auditEvents.at(-1)?.action, "TRADE_PLAN_COMPLETED");
});

test("TradePlanService archives stopped, completed, or draft plan", async () => {
  const { auditEvents, service } = createHarness();
  const plan = await service.createTradePlan(userId, basePlanInput());

  const archivedPlan = await service.archiveTradePlan(userId, String(plan._id));

  assert.equal(archivedPlan.status, "ARCHIVED");
  assert.equal(auditEvents.at(-1)?.action, "TRADE_PLAN_ARCHIVED");
});

test("TradePlanService capital adjustment creates event and updates currentCapital", async () => {
  const { adjustments, auditEvents, service } = createHarness();
  const plan = await service.createTradePlan(userId, basePlanInput());

  const result = await service.createCapitalAdjustment(userId, String(plan._id), {
    adjustmentType: "DEPOSIT",
    amount: 25000,
    currency: "INR",
    reason: "Top up",
  });

  assert.equal(adjustments.length, 1);
  assert.equal(result.tradePlan.currentCapital, 125000);
  assert.equal(result.event.adjustmentType, "DEPOSIT");
  assert.equal(auditEvents.at(-1)?.action, "CAPITAL_ADJUSTED");
});

test("TradePlanService audit service is called on lifecycle changes", async () => {
  const { auditEvents, service } = createHarness();
  const plan = await service.createTradePlan(userId, basePlanInput());
  await service.activateTradePlan(userId, String(plan._id));
  await service.completeTradePlan(userId, String(plan._id));

  const actions = auditEvents.map((event) => event.action);
  assert.deepEqual(actions, [
    "TRADE_PLAN_CREATED",
    "TRADE_PLAN_RISK_STATE_INITIALIZED",
    "TRADE_PLAN_ACTIVATED",
    "TRADE_PLAN_COMPLETED",
  ]);
});

test("buildRiskBucketKey is deterministic", () => {
  assert.equal(
    buildRiskBucketKey({
      userId,
      marketType: "commodity",
      tradeStyle: "intraday",
      instrumentType: "future",
    }),
    `${userId}:COMMODITY:INTRADAY:FUTURE`,
  );
});
