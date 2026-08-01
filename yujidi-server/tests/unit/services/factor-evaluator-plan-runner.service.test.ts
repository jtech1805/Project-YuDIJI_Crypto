import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  FactorEvaluatorPlanRunnerService,
} from "../../../src/services/factor-evaluator-plan-runner.service.js";
import type {
  ExplicitFactorEvaluatorExecutionResult,
} from "../../../src/types/factor-evaluator-execution.types.js";
import type { AssembledFactorInput } from "../../../src/types/factor-input-assembly.types.js";
import type {
  FactorEvaluatorPlanFailurePolicy,
  ValidatedFactorEvaluatorExecutionPlan,
} from "../../../src/types/factor-evaluator-execution-plan.types.js";

const evaluatorIds = ["TEST_ALPHA_V1", "TEST_BETA_V1", "TEST_GAMMA_V1"] as const;

const input = (): AssembledFactorInput => ({
  factorKey: "MARKET.PRICE",
  factorDefinitionVersion: 1,
  subject: { type: "INSTRUMENT", key: "BTCUSDT" },
  evidenceId: "E-1",
  value: { type: "NUMBER", value: 65_000, unit: "USDT" },
  source: {
    sourceType: "MARKET_DATA",
    provider: "BINANCE",
    sourceId: "BINANCE_PUBLIC_MARKET_PRICE_V1",
    priority: 100,
  },
  observedAt: new Date("2026-07-31T09:00:00.000Z"),
  evaluatedAt: new Date("2026-07-31T09:00:01.000Z"),
  confidence: 0.9,
  freshness: { status: "FRESH", ageMs: 1_000, maxAgeMs: 10_000 },
});

const plan = (
  failurePolicy: FactorEvaluatorPlanFailurePolicy = "STOP_ON_ANY_FAILURE",
  count = 3,
): ValidatedFactorEvaluatorExecutionPlan => Object.freeze({
  planId: "TEST_MARKET_PRICE_PLAN_V1",
  planVersion: 1,
  factorKey: "MARKET.PRICE",
  failurePolicy,
  steps: Object.freeze(evaluatorIds.slice(0, count).map((evaluatorId, index) => Object.freeze({
    order: index + 1,
    evaluatorId,
    evaluatorVersion: index + 2,
    configurationVersion: index + 3,
    supportedFactorKeys: Object.freeze(["MARKET.PRICE"] as const),
  }))),
});

const evaluated = (
  evaluatorId: string,
  evaluatorVersion: number,
  configurationVersion: number,
  points = 1,
): ExplicitFactorEvaluatorExecutionResult => Object.freeze({
  executed: true,
  evaluatorId,
  evaluatorVersion,
  configurationVersion,
  factorKey: "MARKET.PRICE",
  execution: Object.freeze({
    evaluated: true,
    result: Object.freeze({
      evaluator: Object.freeze({ evaluatorId, evaluatorVersion, configurationVersion }),
      factorKey: "MARKET.PRICE",
      subject: Object.freeze({ type: "INSTRUMENT", key: "BTCUSDT" }),
      outcome: points > 0 ? "PASS" : "FAIL",
      contribution: Object.freeze({
        points,
        minimumPoints: -10,
        maximumPoints: 10,
      }),
      reasonCode: points > 0 ? "PASS" : "FAIL",
      evidence: Object.freeze({
        evidenceId: "E-1",
        factorDefinitionVersion: 1,
        source: Object.freeze({
          sourceType: "MARKET_DATA",
          provider: "BINANCE",
          sourceId: "BINANCE_PUBLIC_MARKET_PRICE_V1",
        }),
        observedAt: new Date("2026-07-31T09:00:00.000Z"),
        evaluatedAt: new Date("2026-07-31T09:00:01.000Z"),
      }),
      diagnostics: Object.freeze({}),
    }),
  }),
});

const typedFailure = (
  evaluatorId: string,
  evaluatorVersion: number,
  configurationVersion: number,
): ExplicitFactorEvaluatorExecutionResult => Object.freeze({
  executed: true,
  evaluatorId,
  evaluatorVersion,
  configurationVersion,
  factorKey: "MARKET.PRICE",
  execution: Object.freeze({
    evaluated: false,
    evaluatorId,
    factorKey: "MARKET.PRICE",
    code: "EVALUATION_FAILED",
  }),
});

const boundaryFailure = (
  evaluatorId: string,
  code = "EVALUATOR_EXECUTION_FAILED" as const,
): ExplicitFactorEvaluatorExecutionResult => Object.freeze({
  executed: false,
  evaluatorId,
  factorKey: "MARKET.PRICE",
  code,
});

const harness = (
  results: readonly (ExplicitFactorEvaluatorExecutionResult | Error | unknown)[],
) => {
  const calls: Array<{ evaluatorId: string; input: AssembledFactorInput }> = [];
  let index = 0;
  const runner = new FactorEvaluatorPlanRunnerService({
    executionService: {
      execute(request) {
        calls.push(request);
        const next = results[index++];
        if (next instanceof Error) throw next;
        return next as ExplicitFactorEvaluatorExecutionResult;
      },
    },
  });
  return { runner, calls };
};

const runFailure = (
  code: string,
  planId: string | null = null,
  factorKey: string | null = null,
) => ({ ran: false, planId, factorKey, code });

test("rejects invalid requests and malformed assembled-input boundaries before execution", () => {
  for (const request of [null, undefined, [], "request", 1, {}, { plan: plan() }, { input: input() }]) {
    const value = harness([]);
    assert.deepEqual(value.runner.run(request as never), runFailure("INVALID_REQUEST"));
    assert.equal(value.calls.length, 0);
  }
  for (const invalidInput of [
    null,
    {},
    { ...input(), factorKey: "" },
    { ...input(), subject: null },
    { ...input(), evidenceId: "" },
    { ...input(), value: null },
  ]) {
    const value = harness([]);
    const expectedFactor = invalidInput
      && typeof invalidInput === "object"
      && typeof (invalidInput as { factorKey?: unknown }).factorKey === "string"
      && (invalidInput as { factorKey: string }).factorKey.length > 0
      ? (invalidInput as { factorKey: string }).factorKey
      : null;
    assert.deepEqual(
      value.runner.run({ plan: plan(), input: invalidInput } as never),
      runFailure("INVALID_REQUEST", "TEST_MARKET_PRICE_PLAN_V1", expectedFactor),
    );
    assert.equal(value.calls.length, 0);
  }
});

test("defensively rejects malformed validated plans before Phase 2G", () => {
  const base = plan() as any;
  const invalidPlans = [
    null,
    { ...base, planId: "bad" },
    { ...base, planVersion: 0 },
    { ...base, failurePolicy: "UNKNOWN" },
    { ...base, steps: [] },
    {
      ...base,
      steps: Array.from({ length: 21 }, (_, index) => ({
        ...base.steps[0],
        order: index + 1,
        evaluatorId: `TEST_${index + 1}`,
      })),
    },
    { ...base, steps: [{ ...base.steps[0], order: 2 }] },
    { ...base, steps: [{ ...base.steps[0], evaluatorVersion: 0 }] },
    { ...base, steps: [{ ...base.steps[0], configurationVersion: 1.5 }] },
  ];
  for (const invalidPlan of invalidPlans) {
    const value = harness([]);
    assert.deepEqual(
      value.runner.run({ plan: invalidPlan, input: input() } as never),
      runFailure(
        "INVALID_VALIDATED_PLAN",
        typeof invalidPlan?.planId === "string" && /^[A-Z0-9_]+$/.test(invalidPlan.planId)
          ? invalidPlan.planId
          : null,
        "MARKET.PRICE",
      ),
    );
    assert.equal(value.calls.length, 0);
  }
});

test("rejects exact plan/input factor mismatch before execution", () => {
  const value = harness([]);
  assert.deepEqual(
    value.runner.run({
      plan: plan(),
      input: { ...input(), factorKey: "OTHER.FACTOR" } as never,
    }),
    runFailure("FACTOR_MISMATCH", "TEST_MARKET_PRICE_PLAN_V1", "OTHER.FACTOR"),
  );
  assert.equal(value.calls.length, 0);
});

test("attempts evaluated steps exactly once in order with the unchanged input", () => {
  const assembled = input();
  const configuredPlan = plan("CONTINUE_ALWAYS");
  const results = configuredPlan.steps.map((step, index) =>
    evaluated(step.evaluatorId, step.evaluatorVersion, step.configurationVersion, index - 1));
  const value = harness(results);
  const result = value.runner.run({ plan: configuredPlan, input: assembled });
  assert.equal(result.ran, true);
  if (!result.ran) return;
  assert.equal(result.status, "COMPLETED");
  assert.deepEqual(result.termination, { reason: "NONE", stepOrder: null, evaluatorId: null });
  assert.deepEqual(result.steps.map(({ disposition }) => disposition), [
    "EVALUATED", "EVALUATED", "EVALUATED",
  ]);
  assert.deepEqual(value.calls.map(({ evaluatorId }) => evaluatorId), [...evaluatorIds]);
  assert(value.calls.every((call) => call.input === assembled));
  assert.deepEqual(result.summary, {
    totalSteps: 3,
    attemptedSteps: 3,
    skippedSteps: 0,
    evaluatedSteps: 3,
    typedEvaluatorFailures: 0,
    boundaryFailures: 0,
  });
  for (const forbidden of ["totalPoints", "score", "average", "weightedScore"]) {
    assert.equal(forbidden in result.summary, false);
  }
});

test("single final failure completes under every policy and preserves its category", () => {
  for (const failurePolicy of [
    "STOP_ON_ANY_FAILURE",
    "CONTINUE_ON_EVALUATOR_FAILURE",
    "CONTINUE_ALWAYS",
  ] as const) {
    const single = plan(failurePolicy, 1);
    const step = single.steps[0]!;
    for (const [output, disposition, countKey] of [
      [typedFailure(step.evaluatorId, step.evaluatorVersion, step.configurationVersion),
        "TYPED_EVALUATOR_FAILURE", "typedEvaluatorFailures"],
      [boundaryFailure(step.evaluatorId), "BOUNDARY_FAILURE", "boundaryFailures"],
    ] as const) {
      const result = harness([output]).runner.run({ plan: single, input: input() });
      assert.equal(result.ran, true);
      if (!result.ran) continue;
      assert.equal(result.status, "COMPLETED");
      assert.deepEqual(result.termination, { reason: "NONE", stepOrder: null, evaluatorId: null });
      assert.equal(result.steps[0]!.disposition, disposition);
      assert.equal(result.summary[countKey], 1);
    }
  }
});

test("STOP_ON_ANY_FAILURE stops on typed evaluator failure and reports skipped metadata", () => {
  const configuredPlan = plan("STOP_ON_ANY_FAILURE");
  const [first, second] = configuredPlan.steps;
  const value = harness([
    evaluated(first!.evaluatorId, first!.evaluatorVersion, first!.configurationVersion),
    typedFailure(second!.evaluatorId, second!.evaluatorVersion, second!.configurationVersion),
  ]);
  const result = value.runner.run({ plan: configuredPlan, input: input() });
  assert.equal(result.ran, true);
  if (!result.ran) return;
  assert.equal(result.status, "STOPPED");
  assert.deepEqual(result.termination, {
    reason: "TYPED_EVALUATOR_FAILURE",
    stepOrder: 2,
    evaluatorId: second!.evaluatorId,
  });
  assert.deepEqual(result.steps.map(({ disposition }) => disposition), [
    "EVALUATED", "TYPED_EVALUATOR_FAILURE", "SKIPPED_AFTER_TERMINATION",
  ]);
  assert.deepEqual(result.steps[2], {
    order: 3,
    evaluatorId: "TEST_GAMMA_V1",
    evaluatorVersion: 4,
    configurationVersion: 5,
    status: "SKIPPED",
    disposition: "SKIPPED_AFTER_TERMINATION",
    execution: null,
  });
  assert.deepEqual(value.calls.map(({ evaluatorId }) => evaluatorId), [
    "TEST_ALPHA_V1", "TEST_BETA_V1",
  ]);
  assert.deepEqual(result.summary, {
    totalSteps: 3,
    attemptedSteps: 2,
    skippedSteps: 1,
    evaluatedSteps: 1,
    typedEvaluatorFailures: 1,
    boundaryFailures: 0,
  });
});

test("STOP_ON_ANY_FAILURE stops on boundary failure", () => {
  const configuredPlan = plan("STOP_ON_ANY_FAILURE");
  const first = configuredPlan.steps[0]!;
  const result = harness([boundaryFailure(first.evaluatorId)]).runner.run({
    plan: configuredPlan,
    input: input(),
  });
  assert.equal(result.ran, true);
  if (!result.ran) return;
  assert.equal(result.status, "STOPPED");
  assert.deepEqual(result.termination, {
    reason: "BOUNDARY_FAILURE",
    stepOrder: 1,
    evaluatorId: first.evaluatorId,
  });
  assert.equal(result.summary.skippedSteps, 2);
});

test("CONTINUE_ON_EVALUATOR_FAILURE continues typed failures but stops on boundary failure", () => {
  const configuredPlan = plan("CONTINUE_ON_EVALUATOR_FAILURE");
  const [first, second] = configuredPlan.steps;
  const value = harness([
    typedFailure(first!.evaluatorId, first!.evaluatorVersion, first!.configurationVersion),
    boundaryFailure(second!.evaluatorId),
  ]);
  const result = value.runner.run({ plan: configuredPlan, input: input() });
  assert.equal(result.ran, true);
  if (!result.ran) return;
  assert.deepEqual(result.steps.map(({ disposition }) => disposition), [
    "TYPED_EVALUATOR_FAILURE", "BOUNDARY_FAILURE", "SKIPPED_AFTER_TERMINATION",
  ]);
  assert.equal(result.status, "STOPPED");
  assert.equal(result.termination.reason, "BOUNDARY_FAILURE");
});

test("CONTINUE_ALWAYS preserves multiple failures and completes", () => {
  const configuredPlan = plan("CONTINUE_ALWAYS");
  const [first, second, third] = configuredPlan.steps;
  const value = harness([
    typedFailure(first!.evaluatorId, first!.evaluatorVersion, first!.configurationVersion),
    boundaryFailure(second!.evaluatorId),
    evaluated(third!.evaluatorId, third!.evaluatorVersion, third!.configurationVersion),
  ]);
  const result = value.runner.run({ plan: configuredPlan, input: input() });
  assert.equal(result.ran, true);
  if (!result.ran) return;
  assert.equal(result.status, "COMPLETED");
  assert.deepEqual(result.steps.map(({ disposition }) => disposition), [
    "TYPED_EVALUATOR_FAILURE", "BOUNDARY_FAILURE", "EVALUATED",
  ]);
  assert.deepEqual(result.summary, {
    totalSteps: 3,
    attemptedSteps: 3,
    skippedSteps: 0,
    evaluatedSteps: 1,
    typedEvaluatorFailures: 1,
    boundaryFailures: 1,
  });
});

test("final-step failures remain completed under stop policies", () => {
  for (const outputKind of ["typed", "boundary"] as const) {
    const configuredPlan = plan("STOP_ON_ANY_FAILURE", 2);
    const [first, last] = configuredPlan.steps;
    const finalOutput = outputKind === "typed"
      ? typedFailure(last!.evaluatorId, last!.evaluatorVersion, last!.configurationVersion)
      : boundaryFailure(last!.evaluatorId);
    const result = harness([
      evaluated(first!.evaluatorId, first!.evaluatorVersion, first!.configurationVersion),
      finalOutput,
    ]).runner.run({ plan: configuredPlan, input: input() });
    assert.equal(result.ran, true);
    if (!result.ran) continue;
    assert.equal(result.status, "COMPLETED");
    assert.equal(result.termination.reason, "NONE");
    assert.equal(result.summary.attemptedSteps, 2);
  }
});

test("sanitizes unexpected throws and malformed or mismatched Phase 2G results", () => {
  for (const output of [
    new Error("secret stack"),
    null,
    {},
    { executed: true, evaluatorId: "WRONG", evaluatorVersion: 2,
      configurationVersion: 3, factorKey: "MARKET.PRICE",
      execution: { evaluated: false } },
  ]) {
    const configuredPlan = plan("STOP_ON_ANY_FAILURE");
    const value = harness([output]);
    const result = value.runner.run({ plan: configuredPlan, input: input() });
    assert.equal(result.ran, true);
    if (!result.ran) continue;
    assert.equal(result.steps[0]!.disposition, "BOUNDARY_FAILURE");
    const execution = result.steps[0]!.execution;
    assert(execution && !execution.executed);
    assert.equal(
      execution.code,
      output instanceof Error ? "EVALUATOR_EXECUTION_FAILED" : "INVALID_EVALUATOR_EXECUTION",
    );
    assert.equal(JSON.stringify(result).includes("secret"), false);
    assert.equal(value.calls.length, 1);
  }
});

test("does not mutate inputs and returns deeply immutable independent reports", () => {
  const configuredPlan = plan("CONTINUE_ALWAYS", 1);
  const assembled = input();
  const step = configuredPlan.steps[0]!;
  const sourceResult = structuredClone(
    evaluated(step.evaluatorId, step.evaluatorVersion, step.configurationVersion),
  ) as ExplicitFactorEvaluatorExecutionResult;
  Object.freeze(assembled.subject);
  Object.freeze(assembled.value);
  Object.freeze(assembled.source);
  Object.freeze(assembled.freshness);
  Object.freeze(assembled);
  const value = harness([sourceResult]);
  const result = value.runner.run({ plan: configuredPlan, input: assembled });
  assert.equal(result.ran, true);
  if (!result.ran) return;
  assert(Object.isFrozen(result));
  assert(Object.isFrozen(result.steps));
  assert(Object.isFrozen(result.steps[0]));
  assert(Object.isFrozen(result.summary));
  assert(Object.isFrozen(result.termination));
  assert(Object.isFrozen(result.steps[0]!.execution));
  const snapshot = structuredClone(result);
  assert.throws(() => { (result.steps as any).push({}); }, TypeError);
  assert.throws(() => { (result.summary as any).totalSteps = 99; }, TypeError);
  (sourceResult as any).evaluatorId = "MUTATED";
  assert.deepEqual(result, snapshot);
});

test("is deterministic, adds no runtime metadata, and leaks no input envelope", () => {
  const configuredPlan = plan("CONTINUE_ALWAYS", 1);
  const step = configuredPlan.steps[0]!;
  const make = () => harness([
    evaluated(step.evaluatorId, step.evaluatorVersion, step.configurationVersion),
  ]).runner.run({ plan: configuredPlan, input: input() });
  const first = make();
  const second = make();
  assert.deepEqual(first, second);
  const serialized = JSON.stringify(first);
  for (const forbidden of [
    "runId", "startedAt", "completedAt", "durationMs", "createdAt",
    "\"input\"", "\"value\":65000", "priority", "freshness",
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test("runner source has no direct evaluator, registry, plan validator, assembly, scoring, or I/O access", () => {
  const source = readFileSync(
    new URL("../../../src/services/factor-evaluator-plan-runner.service.ts", import.meta.url),
    "utf8",
  ).toLowerCase();
  for (const forbidden of [
    "deterministic-factor-evaluator",
    "evaluator.registry",
    "factor-evaluator-execution-plan.service",
    "factor-input-assembly.service",
    "evidence-read",
    "source-resolution",
    "mongoose",
    "axios",
    "scoring",
    "template",
    "decision",
    ".evaluate(",
    "date.now",
    "math.random",
    "randomuuid",
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});
