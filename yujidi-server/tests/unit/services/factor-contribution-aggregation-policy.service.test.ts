import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  FactorContributionAggregationPolicyService,
} from "../../../src/services/factor-contribution-aggregation-policy.service.js";
import {
  MAX_AGGREGATION_POLICY_ENTRIES,
  MAX_AGGREGATION_WEIGHT,
} from "../../../src/types/factor-contribution-aggregation.types.js";
import type {
  ValidatedFactorEvaluatorExecutionPlan,
} from "../../../src/types/factor-evaluator-execution-plan.types.js";

const plan = (count = 3): ValidatedFactorEvaluatorExecutionPlan => ({
  planId: "TEST_MARKET_PRICE_PLAN_V1",
  planVersion: 1,
  factorKey: "MARKET.PRICE",
  failurePolicy: "STOP_ON_ANY_FAILURE",
  steps: Array.from({ length: count }, (_, index) => ({
    order: index + 1,
    evaluatorId: `TEST_EVALUATOR_${String(index + 1).padStart(2, "0")}_V1`,
    evaluatorVersion: index + 1,
    configurationVersion: index + 2,
    supportedFactorKeys: ["MARKET.PRICE"] as const,
  })),
});

const policy = (validatedPlan = plan()) => ({
  policyId: "TEST_MARKET_PRICE_AGGREGATION_POLICY_V1",
  policyVersion: 1,
  planId: validatedPlan.planId,
  planVersion: validatedPlan.planVersion,
  factorKey: validatedPlan.factorKey,
  method: "WEIGHTED_SUM" as const,
  bounds: { minimumPoints: -10, maximumPoints: 10 },
  entries: validatedPlan.steps.map((step, index) => ({
    order: step.order,
    evaluatorId: step.evaluatorId,
    evaluatorVersion: step.evaluatorVersion,
    configurationVersion: step.configurationVersion,
    weight: index + 0.5,
  })),
});

const failure = (
  code: string,
  policyId: string | null = "TEST_MARKET_PRICE_AGGREGATION_POLICY_V1",
  evaluatorId: string | null = null,
  entryOrder: number | null = null,
) => ({ valid: false, code, policyId, evaluatorId, entryOrder });

const service = new FactorContributionAggregationPolicyService();

test("accepts exact one-entry and multi-entry policies with frozen eligibility", () => {
  for (const count of [1, 3]) {
    const validatedPlan = plan(count);
    const result = service.validate({ policy: policy(validatedPlan), plan: validatedPlan });
    assert.equal(result.valid, true);
    if (!result.valid) continue;
    assert.deepEqual(result.policy.outcomeEligibility, {
      PASS: "ELIGIBLE",
      FAIL: "ELIGIBLE",
      NEUTRAL: "ELIGIBLE",
      UNAVAILABLE: "INELIGIBLE",
    });
    assert.deepEqual(
      result.policy.entries.map(({ evaluatorId }) => evaluatorId),
      validatedPlan.steps.map(({ evaluatorId }) => evaluatorId),
    );
    const serialized = JSON.stringify(result.policy);
    for (const forbidden of [
      "execution", "outcome\"", "points", "disposition", "runtimeStatus",
      "typedEvaluatorFailurePoints", "boundaryFailurePoints",
    ]) assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test("rejects invalid params and malformed validated-plan boundaries first", () => {
  for (const params of [null, undefined, [], "params", 1]) {
    assert.deepEqual(service.validate(params as never), failure("INVALID_POLICY", null));
  }
  assert.deepEqual(service.validate({} as never), failure("INVALID_PLAN_REFERENCE", null));
  assert.deepEqual(
    service.validate({ plan: plan() } as never),
    failure("INVALID_POLICY", null),
  );
  for (const invalidPlan of [
    null,
    {},
    { ...plan(), planId: "bad" },
    { ...plan(), planVersion: 0 },
    { ...plan(), factorKey: "" },
    { ...plan(), steps: [] },
    { ...plan(), steps: [{ ...plan(1).steps[0], order: 2 }] },
    { ...plan(), steps: [{ ...plan(1).steps[0], evaluatorVersion: 0 }] },
  ]) {
    assert.deepEqual(
      service.validate({ policy: policy(), plan: invalidPlan } as never),
      failure("INVALID_PLAN_REFERENCE", null),
    );
  }
  assert.deepEqual(
    service.validate({ policy: policy() } as never),
    failure("INVALID_PLAN_REFERENCE", null),
  );
});

test("rejects invalid policy runtime values and identifiers deterministically", () => {
  for (const invalidPolicy of [null, undefined, [], "policy", 1, () => {}]) {
    assert.deepEqual(
      service.validate({ policy: invalidPolicy, plan: plan() }),
      failure("INVALID_POLICY", null),
    );
  }
  for (const policyId of [
    "", " POLICY", "POLICY ", "policy", "POLICY-ID", "POLICY.ID",
    "A".repeat(121), 1,
  ]) {
    assert.deepEqual(
      service.validate({ policy: { ...policy(), policyId }, plan: plan() }),
      failure("INVALID_POLICY_ID", null),
    );
  }
  for (const policyVersion of [0, -1, 1.5, Number.NaN, Infinity, "1"]) {
    assert.deepEqual(
      service.validate({ policy: { ...policy(), policyVersion }, plan: plan() }),
      failure("INVALID_POLICY_VERSION"),
    );
  }
});

test("requires exact plan identity and factor before method, bounds, or entries", () => {
  for (const override of [
    { planId: "OTHER_PLAN" },
    { planVersion: 2 },
  ]) {
    assert.deepEqual(
      service.validate({ policy: { ...policy(), ...override, entries: [] }, plan: plan() }),
      failure("INVALID_PLAN_REFERENCE"),
    );
  }
  assert.deepEqual(
    service.validate({
      policy: { ...policy(), factorKey: "OTHER.FACTOR" },
      plan: plan(),
    }),
    failure("FACTOR_MISMATCH"),
  );
});

test("supports only WEIGHTED_SUM and explicit finite zero-containing bounds", () => {
  assert.deepEqual(
    service.validate({ policy: { ...policy(), method: "AVERAGE" }, plan: plan() }),
    failure("INVALID_AGGREGATION_METHOD"),
  );
  for (const bounds of [
    { minimumPoints: -10, maximumPoints: 10 },
    { minimumPoints: 0, maximumPoints: 10 },
    { minimumPoints: -10, maximumPoints: 0 },
  ]) {
    assert.equal(
      service.validate({ policy: { ...policy(), bounds }, plan: plan() }).valid,
      true,
    );
  }
  for (const bounds of [
    null,
    {},
    { minimumPoints: Number.NaN, maximumPoints: 10 },
    { minimumPoints: -10, maximumPoints: Infinity },
    { minimumPoints: 10, maximumPoints: -10 },
    { minimumPoints: 1, maximumPoints: 10 },
    { minimumPoints: -10, maximumPoints: -1 },
  ]) {
    assert.deepEqual(
      service.validate({ policy: { ...policy(), bounds }, plan: plan() }),
      failure("INVALID_BOUNDS"),
    );
  }
});

test("requires a dense non-empty entry array bounded at twenty", () => {
  for (const entries of [null, {}, "entries", new Array(1)]) {
    assert.deepEqual(
      service.validate({ policy: { ...policy(), entries }, plan: plan() }),
      failure("INVALID_POLICY"),
    );
  }
  assert.deepEqual(
    service.validate({ policy: { ...policy(), entries: [] }, plan: plan() }),
    failure("EMPTY_ENTRIES"),
  );
  const maximumPlan = plan(MAX_AGGREGATION_POLICY_ENTRIES);
  assert.equal(
    service.validate({ policy: policy(maximumPlan), plan: maximumPlan }).valid,
    true,
  );
  const oversizedPlan = plan(MAX_AGGREGATION_POLICY_ENTRIES + 1);
  assert.deepEqual(
    service.validate({ policy: policy(oversizedPlan), plan: oversizedPlan }),
    failure("INVALID_PLAN_REFERENCE", null),
  );
  assert.deepEqual(
    service.validate({
      policy: {
        ...policy(),
        entries: Array.from({ length: 21 }, (_, index) => ({
          order: index + 1,
          evaluatorId: `TEST_${index + 1}`,
          evaluatorVersion: 1,
          configurationVersion: 1,
          weight: 1,
        })),
      },
      plan: plan(),
    }),
    failure("TOO_MANY_ENTRIES"),
  );
});

test("rejects malformed entries, invalid orders, and invalid weights", () => {
  for (const entry of [
    null, [], {}, { order: 1 }, { order: 1, evaluatorId: "" },
    { order: 1, evaluatorId: "TEST", evaluatorVersion: 1 },
    {
      order: 1, evaluatorId: "TEST", evaluatorVersion: 1,
      configurationVersion: 1,
    },
  ]) {
    assert.deepEqual(
      service.validate({ policy: { ...policy(plan(1)), entries: [entry] }, plan: plan(1) }),
      failure("INVALID_ENTRY"),
    );
  }
  const base = policy(plan(1)).entries[0]!;
  for (const order of [0, -1, 1.5, Number.NaN, Infinity, "1"]) {
    assert.deepEqual(
      service.validate({
        policy: { ...policy(plan(1)), entries: [{ ...base, order }] },
        plan: plan(1),
      }),
      failure("INVALID_ENTRY_ORDER", undefined, base.evaluatorId),
    );
  }
  for (const weight of [0, -1, Number.NaN, Infinity, -Infinity, "1", null, 100.0001]) {
    assert.deepEqual(
      service.validate({
        policy: { ...policy(plan(1)), entries: [{ ...base, weight }] },
        plan: plan(1),
      }),
      failure("INVALID_WEIGHT", undefined, base.evaluatorId, 1),
    );
  }
  assert.equal(
    service.validate({
      policy: { ...policy(plan(1)), entries: [{ ...base, weight: MAX_AGGREGATION_WEIGHT }] },
      plan: plan(1),
    }).valid,
    true,
  );
});

test("rejects duplicate, gapped, and array-mismatched orders without sorting", () => {
  const validatedPlan = plan(2);
  const entries = policy(validatedPlan).entries;
  const cases = [
    {
      entries: [{ ...entries[0], order: 1 }, { ...entries[1], order: 1 }],
      expected: failure("DUPLICATE_ENTRY_ORDER", undefined, entries[1]!.evaluatorId, 1),
    },
    {
      entries: [{ ...entries[0], order: 1 }, { ...entries[1], order: 3 }],
      expected: failure("INVALID_ENTRY_ORDER", undefined, entries[1]!.evaluatorId, 3),
    },
    {
      entries: [{ ...entries[0], order: 2 }, { ...entries[1], order: 1 }],
      expected: failure("INVALID_ENTRY_ORDER", undefined, entries[0]!.evaluatorId, 2),
    },
  ];
  for (const value of cases) {
    assert.deepEqual(
      service.validate({
        policy: { ...policy(validatedPlan), entries: value.entries },
        plan: validatedPlan,
      }),
      value.expected,
    );
  }
});

test("rejects duplicate evaluator IDs before later plan mismatch", () => {
  const validatedPlan = plan(2);
  const entries = policy(validatedPlan).entries;
  assert.deepEqual(
    service.validate({
      policy: {
        ...policy(validatedPlan),
        entries: [entries[0], { ...entries[1], evaluatorId: entries[0]!.evaluatorId }],
      },
      plan: validatedPlan,
    }),
    failure("DUPLICATE_EVALUATOR_ID", undefined, entries[0]!.evaluatorId, 2),
  );
});

test("requires exact entry count and index-aligned plan metadata", () => {
  const validatedPlan = plan(3);
  assert.deepEqual(
    service.validate({
      policy: { ...policy(validatedPlan), entries: policy(validatedPlan).entries.slice(0, 2) },
      plan: validatedPlan,
    }),
    failure("ENTRY_COUNT_MISMATCH"),
  );

  const two = plan(2);
  const entries = policy(two).entries;
  for (const changed of [
    { evaluatorId: "TEST_OTHER_V1" },
    { evaluatorVersion: 99 },
    { configurationVersion: 99 },
  ]) {
    assert.deepEqual(
      service.validate({
        policy: {
          ...policy(two),
          entries: [entries[0], { ...entries[1], ...changed }],
        },
        plan: two,
      }),
      failure("PLAN_ENTRY_MISMATCH", undefined, String(
        "evaluatorId" in changed ? changed.evaluatorId : entries[1]!.evaluatorId,
      ), 2),
    );
  }
  assert.deepEqual(
    service.validate({
      policy: {
        ...policy(two),
        entries: [
          { ...entries[1], order: 1 },
          { ...entries[0], order: 2 },
        ],
      },
      plan: two,
    }),
    failure("PLAN_ENTRY_MISMATCH", undefined, entries[1]!.evaluatorId, 1),
  );
});

test("returns a defensively cloned deeply frozen policy independent of sources", () => {
  const sourcePlan = plan(1);
  const sourcePolicy = policy(sourcePlan);
  const result = service.validate({ policy: sourcePolicy, plan: sourcePlan });
  assert.equal(result.valid, true);
  if (!result.valid) return;
  const snapshot = structuredClone(result.policy);

  sourcePolicy.policyId = "MUTATED_POLICY";
  sourcePolicy.policyVersion = 99;
  sourcePolicy.factorKey = "OTHER" as never;
  sourcePolicy.method = "OTHER" as never;
  sourcePolicy.bounds.minimumPoints = -999;
  sourcePolicy.entries[0]!.weight = 99;
  (sourcePlan as any).planId = "MUTATED_PLAN";
  (sourcePlan.steps[0] as any).evaluatorVersion = 99;

  assert.deepEqual(result.policy, snapshot);
  assert(Object.isFrozen(result.policy));
  assert(Object.isFrozen(result.policy.bounds));
  assert(Object.isFrozen(result.policy.entries));
  assert(Object.isFrozen(result.policy.entries[0]));
  assert(Object.isFrozen(result.policy.outcomeEligibility));
  assert.throws(() => { (result.policy.entries as any).push({}); }, TypeError);
  assert.throws(() => { (result.policy.bounds as any).minimumPoints = -20; }, TypeError);
});

test("is deterministic and preserves frozen first-failure ordering", () => {
  assert.deepEqual(
    service.validate({ policy: policy(), plan: plan() }),
    service.validate({ policy: policy(), plan: plan() }),
  );
  assert.deepEqual(
    service.validate({
      policy: { ...policy(), policyId: "bad", bounds: null },
      plan: plan(),
    }),
    failure("INVALID_POLICY_ID", null),
  );
  assert.deepEqual(
    service.validate({
      policy: { ...policy(), bounds: null, entries: [null] },
      plan: plan(),
    }),
    failure("INVALID_BOUNDS"),
  );
});

test("service contains policy validation only and no runner, aggregation, scoring, or I/O", () => {
  const source = readFileSync(
    new URL(
      "../../../src/services/factor-contribution-aggregation-policy.service.ts",
      import.meta.url,
    ),
    "utf8",
  ).toLowerCase();
  for (const forbidden of [
    "factor-evaluator-plan-runner",
    "deterministic-factor-evaluator",
    "evaluator.registry",
    "factor-evaluator-contract.service",
    "evidence",
    "provider",
    "mongoose",
    "axios",
    "controller",
    "scheduler",
    "llm",
    "frontend",
    "contribution.points",
    "points *",
    "reduce(",
    "normalize",
    "clamp",
    "weightedscore",
  ]) assert.equal(source.includes(forbidden), false, forbidden);
});
