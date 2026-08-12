import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { DeterministicFactorEvaluator } from "../../../src/ports/deterministic-factor-evaluator.port.js";
import {
  FactorEvaluatorExecutionPlanService,
} from "../../../src/services/scoring/factor-evaluator-execution-plan.service.js";
import {
  MAX_EVALUATORS_PER_EXECUTION_PLAN,
} from "../../../src/types/factor-evaluator-execution-plan.types.js";

const ids = [
  "TEST_MARKET_PRICE_STRUCTURE_V1",
  "TEST_MARKET_PRICE_CONTEXT_V1",
  "TEST_MARKET_PRICE_CONFIRMATION_V1",
] as const;

const evaluator = (
  evaluatorId: string,
  overrides: Record<string, unknown> = {},
): DeterministicFactorEvaluator => ({
  evaluatorId,
  evaluatorVersion: 2,
  configurationVersion: 3,
  supportedFactorKeys: ["MARKET.PRICE"],
  evaluate() {
    throw new Error("plan validation must never execute evaluators");
  },
  ...overrides,
}) as DeterministicFactorEvaluator;

const validPlan = (count = 1) => ({
  planId: "TEST_MARKET_PRICE_EXECUTION_PLAN_V1",
  planVersion: 1,
  factorKey: "MARKET.PRICE" as const,
  failurePolicy: "STOP_ON_ANY_FAILURE" as const,
  steps: Array.from({ length: count }, (_, index) => ({
    order: index + 1,
    evaluatorId: count <= ids.length
      ? ids[index]!
      : `TEST_MARKET_PRICE_EVALUATOR_${String(index + 1).padStart(2, "0")}_V1`,
  })),
});

const harness = (
  implementations: readonly DeterministicFactorEvaluator[] = ids.map((id) => evaluator(id)),
) => {
  const byId = new Map(implementations.map((item) => [item.evaluatorId, item]));
  const calls: string[] = [];
  const service = new FactorEvaluatorExecutionPlanService({
    evaluatorRegistry: {
      getById(evaluatorId) {
        calls.push(evaluatorId);
        return byId.get(evaluatorId) ?? null;
      },
    },
  });
  return { service, calls, implementations };
};

const failure = (
  code: string,
  planId: string | null = "TEST_MARKET_PRICE_EXECUTION_PLAN_V1",
  evaluatorId: string | null = null,
  stepOrder: number | null = null,
) => ({ valid: false, code, planId, evaluatorId, stepOrder });

test("accepts one or multiple explicit steps and snapshots metadata in exact order", () => {
  const value = harness();
  const result = value.service.validate(validPlan(3));
  assert.deepEqual(result, {
    valid: true,
    plan: {
      planId: "TEST_MARKET_PRICE_EXECUTION_PLAN_V1",
      planVersion: 1,
      factorKey: "MARKET.PRICE",
      failurePolicy: "STOP_ON_ANY_FAILURE",
      steps: ids.map((evaluatorId, index) => ({
        order: index + 1,
        evaluatorId,
        evaluatorVersion: 2,
        configurationVersion: 3,
        supportedFactorKeys: ["MARKET.PRICE"],
      })),
    },
  });
  assert.deepEqual(value.calls, [...ids]);
  assert.equal("evaluate" in (result.valid ? result.plan.steps[0]! : {}), false);
});

test("rejects invalid runtime plan values before registry lookup", () => {
  for (const plan of [null, undefined, [], "plan", 1, () => {}]) {
    const value = harness();
    assert.deepEqual(value.service.validate(plan), failure("INVALID_PLAN", null));
    assert.equal(value.calls.length, 0);
  }
});

test("validates exact bounded plan identity before later fields", () => {
  for (const planId of ["", " PLAN", "PLAN ", "plan", "PLAN-ID", "PLAN.ID", "A".repeat(121), 7]) {
    const value = harness();
    assert.deepEqual(
      value.service.validate({ ...validPlan(), planId }),
      failure("INVALID_PLAN_ID", null),
    );
    assert.equal(value.calls.length, 0);
  }
  for (const planVersion of [0, -1, 1.5, Number.NaN, Infinity, "1"]) {
    const value = harness();
    assert.deepEqual(
      value.service.validate({ ...validPlan(), planVersion }),
      failure("INVALID_PLAN_VERSION"),
    );
    assert.equal(value.calls.length, 0);
  }
});

test("rejects unsupported factors and invalid exact failure policies", () => {
  for (const factorKey of ["UNKNOWN", "market.price", " MARKET.PRICE", null]) {
    const value = harness();
    assert.deepEqual(
      value.service.validate({ ...validPlan(), factorKey }),
      failure("UNSUPPORTED_FACTOR"),
    );
    assert.equal(value.calls.length, 0);
  }
  for (const failurePolicy of [
    "UNKNOWN", "stop_on_any_failure", " STOP_ON_ANY_FAILURE", "STOP_ON_ANY_FAILURE ", null,
  ]) {
    const value = harness();
    assert.deepEqual(
      value.service.validate({ ...validPlan(), failurePolicy }),
      failure("INVALID_FAILURE_POLICY"),
    );
    assert.equal(value.calls.length, 0);
  }
});

test("requires a dense non-empty array bounded at twenty steps", () => {
  for (const steps of [null, {}, "steps"]) {
    const value = harness();
    assert.deepEqual(value.service.validate({ ...validPlan(), steps }), failure("INVALID_PLAN"));
    assert.equal(value.calls.length, 0);
  }
  const empty = harness();
  assert.deepEqual(empty.service.validate({ ...validPlan(), steps: [] }), failure("EMPTY_PLAN"));
  const sparse = new Array(1);
  const sparseValue = harness();
  assert.deepEqual(
    sparseValue.service.validate({ ...validPlan(), steps: sparse }),
    failure("INVALID_PLAN"),
  );
  const twenty = validPlan(MAX_EVALUATORS_PER_EXECUTION_PLAN);
  const twentyValue = harness(twenty.steps.map(({ evaluatorId }) => evaluator(evaluatorId)));
  assert.equal(twentyValue.service.validate(twenty).valid, true);
  assert.equal(twentyValue.calls.length, 20);
  const twentyOne = validPlan(MAX_EVALUATORS_PER_EXECUTION_PLAN + 1);
  const exceeded = harness();
  assert.deepEqual(
    exceeded.service.validate(twentyOne),
    failure("TOO_MANY_EVALUATORS"),
  );
  assert.equal(exceeded.calls.length, 0);
});

test("rejects malformed steps and invalid numeric orders safely", () => {
  for (const step of [null, [], {}, { order: 1 }, { order: 1, evaluatorId: "" },
    { order: 1, evaluatorId: " ID" }, { order: 1, evaluatorId: "ID " },
    { order: 1, evaluatorId: 1 }]) {
    const value = harness();
    assert.deepEqual(
      value.service.validate({ ...validPlan(), steps: [step] }),
      failure("INVALID_STEP", undefined, null, null),
    );
    assert.equal(value.calls.length, 0);
  }
  for (const order of [0, -1, 1.5, Number.NaN, Infinity, "1"]) {
    const value = harness();
    assert.deepEqual(
      value.service.validate({ ...validPlan(), steps: [{ order, evaluatorId: ids[0] }] }),
      failure("INVALID_STEP_ORDER", undefined, ids[0], null),
    );
    assert.equal(value.calls.length, 0);
  }
});

test("rejects duplicate, non-contiguous, and array-mismatched orders without sorting", () => {
  const cases = [
    {
      steps: [{ order: 1, evaluatorId: ids[0] }, { order: 1, evaluatorId: ids[1] }],
      expected: failure("DUPLICATE_STEP_ORDER", undefined, ids[1], 1),
    },
    {
      steps: [{ order: 1, evaluatorId: ids[0] }, { order: 3, evaluatorId: ids[1] }],
      expected: failure("INVALID_STEP_ORDER", undefined, ids[1], 3),
    },
    {
      steps: [{ order: 2, evaluatorId: ids[0] }, { order: 1, evaluatorId: ids[1] }],
      expected: failure("INVALID_STEP_ORDER", undefined, ids[0], 2),
    },
  ];
  for (const { steps, expected } of cases) {
    const value = harness();
    assert.deepEqual(value.service.validate({ ...validPlan(), steps }), expected);
    assert.equal(value.calls.length, 0);
  }
});

test("rejects duplicate evaluator IDs before any registry lookup", () => {
  const value = harness();
  const steps = [
    { order: 1, evaluatorId: ids[0] },
    { order: 2, evaluatorId: ids[0] },
  ];
  assert.deepEqual(
    value.service.validate({ ...validPlan(), steps }),
    failure("DUPLICATE_EVALUATOR_ID", undefined, ids[0], 2),
  );
  assert.equal(value.calls.length, 0);
});

test("uses exact ordered lookup, stops on absence, and checks exact factor support", () => {
  const missing = harness([evaluator(ids[0])]);
  assert.deepEqual(
    missing.service.validate(validPlan(3)),
    failure("EVALUATOR_NOT_FOUND", undefined, ids[1], 2),
  );
  assert.deepEqual(missing.calls, [ids[0], ids[1]]);

  const mismatched = harness([
    evaluator(ids[0]),
    evaluator(ids[1], { supportedFactorKeys: [] }),
    evaluator(ids[2]),
  ]);
  assert.deepEqual(
    mismatched.service.validate(validPlan(3)),
    failure("EVALUATOR_DOES_NOT_SUPPORT_FACTOR", undefined, ids[1], 2),
  );
  assert.deepEqual(mismatched.calls, [ids[0], ids[1]]);

  const exact = harness([evaluator(ids[0])]);
  assert.deepEqual(
    exact.service.validate({
      ...validPlan(),
      steps: [{ order: 1, evaluatorId: ids[0].toLowerCase() }],
    }),
    failure("EVALUATOR_NOT_FOUND", undefined, ids[0].toLowerCase(), 1),
  );
});

test("accepts and preserves each frozen failure policy", () => {
  for (const failurePolicy of [
    "STOP_ON_ANY_FAILURE",
    "CONTINUE_ON_EVALUATOR_FAILURE",
    "CONTINUE_ALWAYS",
  ] as const) {
    const result = harness().service.validate({ ...validPlan(), failurePolicy });
    assert.equal(result.valid, true);
    if (result.valid) assert.equal(result.plan.failurePolicy, failurePolicy);
  }
});

test("defensively snapshots and deeply freezes plans and evaluator metadata", () => {
  const sourceEvaluator = evaluator(ids[0]);
  const source = validPlan();
  const value = harness([sourceEvaluator]);
  const result = value.service.validate(source);
  assert.equal(result.valid, true);
  if (!result.valid) return;
  const snapshot = structuredClone(result.plan);

  source.planId = "MUTATED_PLAN";
  source.planVersion = 99;
  source.factorKey = "OTHER" as never;
  (source as any).failurePolicy = "CONTINUE_ALWAYS";
  source.steps[0]!.evaluatorId = "MUTATED_EVALUATOR";
  source.steps.push({ order: 2, evaluatorId: ids[1] });
  (sourceEvaluator as any).evaluatorVersion = 99;
  (sourceEvaluator as any).configurationVersion = 99;
  (sourceEvaluator.supportedFactorKeys as any).push("OTHER");

  assert.deepEqual(result.plan, snapshot);
  assert(Object.isFrozen(result.plan));
  assert(Object.isFrozen(result.plan.steps));
  assert(Object.isFrozen(result.plan.steps[0]));
  assert(Object.isFrozen(result.plan.steps[0]!.supportedFactorKeys));
  assert.throws(() => { (result.plan.steps as any).push({}); }, TypeError);
  assert.throws(() => { (result.plan.steps[0]!.supportedFactorKeys as any).push("OTHER"); }, TypeError);
});

test("is deterministic and returns the frozen first failure", () => {
  const first = harness().service.validate(validPlan(2));
  const second = harness().service.validate(validPlan(2));
  assert.deepEqual(first, second);

  const invalidIdentity = harness();
  assert.deepEqual(
    invalidIdentity.service.validate({ ...validPlan(), planId: "bad", steps: [] }),
    failure("INVALID_PLAN_ID", null),
  );
  const invalidPolicy = harness();
  assert.deepEqual(
    invalidPolicy.service.validate({
      ...validPlan(), failurePolicy: "bad", steps: [null],
    }),
    failure("INVALID_FAILURE_POLICY"),
  );
});

test("service remains isolated from execution, scoring, Evidence, and I/O", () => {
  const source = readFileSync(
    new URL("../../../src/services/scoring/factor-evaluator-execution-plan.service.ts", import.meta.url),
    "utf8",
  );
  for (const forbidden of [
    "explicit-factor-evaluator-execution",
    "factor-input-assembly",
    "evidence",
    "mongoose",
    "http",
    "provider",
    "scoring",
    "controller",
    "scheduler",
    "llm",
    ".evaluate(",
  ]) {
    assert.equal(source.toLowerCase().includes(forbidden), false, forbidden);
  }
});
