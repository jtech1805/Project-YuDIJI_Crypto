import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  FactorContributionAggregationExecutionService,
} from "../../../src/services/factor-contribution-aggregation-execution.service.js";
import type {
  ValidatedFactorContributionAggregationPolicy,
} from "../../../src/types/factor-contribution-aggregation.types.js";
import type {
  FactorEvaluatorPlanRunReport,
} from "../../../src/types/factor-evaluator-plan-runner.types.js";

type Outcome = "PASS" | "FAIL" | "NEUTRAL" | "UNAVAILABLE";

const identities = [
  { evaluatorId: "TEST_ALPHA_V1", evaluatorVersion: 1, configurationVersion: 2 },
  { evaluatorId: "TEST_BETA_V1", evaluatorVersion: 2, configurationVersion: 3 },
  { evaluatorId: "TEST_GAMMA_V1", evaluatorVersion: 3, configurationVersion: 4 },
] as const;

const policy = (
  count = 3,
  weights: readonly number[] = [1.5, 2, 4],
  bounds = { minimumPoints: -20, maximumPoints: 20 },
): ValidatedFactorContributionAggregationPolicy => ({
  policyId: "TEST_MARKET_PRICE_AGGREGATION_POLICY_V1",
  policyVersion: 1,
  planId: "TEST_MARKET_PRICE_PLAN_V1",
  planVersion: 1,
  factorKey: "MARKET.PRICE",
  method: "WEIGHTED_SUM",
  bounds,
  outcomeEligibility: {
    PASS: "ELIGIBLE",
    FAIL: "ELIGIBLE",
    NEUTRAL: "ELIGIBLE",
    UNAVAILABLE: "INELIGIBLE",
  },
  entries: identities.slice(0, count).map((identity, index) => ({
    order: index + 1,
    ...identity,
    weight: weights[index] ?? 1,
  })),
});

const execution = (
  index: number,
  outcome: Outcome,
  contribution: { points: number; minimumPoints: number; maximumPoints: number },
) => {
  const identity = identities[index]!;
  return {
    executed: true as const,
    ...identity,
    factorKey: "MARKET.PRICE" as const,
    execution: {
      evaluated: true as const,
      result: {
        evaluator: { ...identity },
        factorKey: "MARKET.PRICE" as const,
        subject: { type: "INSTRUMENT", key: "BTCUSDT" },
        outcome,
        contribution,
        reasonCode: `${outcome}_RESULT`,
        evidence: {
          evidenceId: "E-1",
          factorDefinitionVersion: 1,
          source: { sourceType: "MARKET_DATA", provider: "BINANCE", sourceId: "PRICE_V1" },
          observedAt: new Date("2026-08-01T09:00:00.000Z"),
          evaluatedAt: new Date("2026-08-01T09:00:01.000Z"),
        },
        diagnostics: { hidden: "must not leak" },
      },
    },
  };
};

const evaluatedStep = (
  index: number,
  outcome: Outcome,
  contribution: { points: number; minimumPoints: number; maximumPoints: number },
) => ({
  order: index + 1,
  ...identities[index]!,
  status: "ATTEMPTED" as const,
  disposition: "EVALUATED" as const,
  execution: execution(index, outcome, contribution),
});

const typedFailureStep = (index: number) => ({
  order: index + 1,
  ...identities[index]!,
  status: "ATTEMPTED" as const,
  disposition: "TYPED_EVALUATOR_FAILURE" as const,
  execution: {
    executed: true as const,
    ...identities[index]!,
    factorKey: "MARKET.PRICE" as const,
    execution: {
      evaluated: false as const,
      evaluatorId: identities[index]!.evaluatorId,
      factorKey: "MARKET.PRICE",
      code: "EVALUATION_FAILED" as const,
    },
  },
});

const boundaryFailureStep = (index: number) => ({
  order: index + 1,
  ...identities[index]!,
  status: "ATTEMPTED" as const,
  disposition: "BOUNDARY_FAILURE" as const,
  execution: {
    executed: false as const,
    evaluatorId: identities[index]!.evaluatorId,
    factorKey: "MARKET.PRICE",
    code: "EVALUATOR_EXECUTION_FAILED" as const,
  },
});

const skippedStep = (index: number) => ({
  order: index + 1,
  ...identities[index]!,
  status: "SKIPPED" as const,
  disposition: "SKIPPED_AFTER_TERMINATION" as const,
  execution: null,
});

const report = (steps: readonly any[], status: "COMPLETED" | "STOPPED" = "COMPLETED"):
FactorEvaluatorPlanRunReport => ({
  ran: true,
  planId: "TEST_MARKET_PRICE_PLAN_V1",
  planVersion: 1,
  factorKey: "MARKET.PRICE",
  failurePolicy: "CONTINUE_ALWAYS",
  status,
  termination: status === "COMPLETED"
    ? { reason: "NONE", stepOrder: null, evaluatorId: null }
    : { reason: "BOUNDARY_FAILURE", stepOrder: 2, evaluatorId: "TEST_BETA_V1" },
  summary: {
    totalSteps: steps.length,
    attemptedSteps: steps.filter((step) => step.status === "ATTEMPTED").length,
    skippedSteps: steps.filter((step) => step.status === "SKIPPED").length,
    evaluatedSteps: steps.filter((step) => step.disposition === "EVALUATED").length,
    typedEvaluatorFailures: steps.filter(
      (step) => step.disposition === "TYPED_EVALUATOR_FAILURE",
    ).length,
    boundaryFailures: steps.filter((step) => step.disposition === "BOUNDARY_FAILURE").length,
  },
  steps,
});

const failure = (
  code: string,
  entryOrder: number | null = null,
  evaluatorId: string | null = null,
  policyId: string | null = "TEST_MARKET_PRICE_AGGREGATION_POLICY_V1",
  planId: string | null = "TEST_MARKET_PRICE_PLAN_V1",
  factorKey: string | null = "MARKET.PRICE",
) => ({ aggregated: false, policyId, planId, factorKey, code, entryOrder, evaluatorId });

const service = new FactorContributionAggregationExecutionService();

test("aggregates one PASS with raw positive weight and theoretical bounds", () => {
  const value = service.execute({
    policy: policy(1, [1.5], { minimumPoints: -3, maximumPoints: 3 }),
    report: report([evaluatedStep(0, "PASS", {
      points: 2, minimumPoints: -2, maximumPoints: 2,
    })]),
  });
  assert.equal(value.aggregated, true);
  if (!value.aggregated) return;
  assert.equal(value.aggregatePoints, 3);
  assert.deepEqual(value.bounds, {
    declared: { minimumPoints: -3, maximumPoints: 3 },
    theoretical: { minimumPoints: -3, maximumPoints: 3 },
  });
  assert.deepEqual(value.steps[0], {
    order: 1,
    ...identities[0],
    eligibility: "ELIGIBLE",
    reason: "PASS",
    outcome: "PASS",
    contribution: { points: 2, minimumPoints: -2, maximumPoints: 2 },
    weight: 1.5,
    weightedContribution: { points: 3, minimumPoints: -3, maximumPoints: 3 },
  });
});

test("aggregates PASS, FAIL, and NEUTRAL in exact order without normalization", () => {
  const value = service.execute({
    policy: policy(),
    report: report([
      evaluatedStep(0, "PASS", { points: 2, minimumPoints: -2, maximumPoints: 2 }),
      evaluatedStep(1, "FAIL", { points: -1, minimumPoints: -2, maximumPoints: 2 }),
      evaluatedStep(2, "NEUTRAL", { points: 0, minimumPoints: -1, maximumPoints: 1 }),
    ]),
  });
  assert.equal(value.aggregated, true);
  if (!value.aggregated) return;
  assert.equal(value.aggregatePoints, 1);
  assert.deepEqual(value.steps.map((step) => step.reason), ["PASS", "FAIL", "NEUTRAL"]);
  assert.deepEqual(value.summary, {
    totalSteps: 3, eligibleSteps: 3, ineligibleSteps: 0,
    passSteps: 1, failSteps: 1, neutralSteps: 1, unavailableSteps: 0,
    typedEvaluatorFailures: 0, boundaryFailures: 0, skippedSteps: 0,
  });
});

test("classifies unavailable, typed failure, boundary failure, and skipped as excluded", () => {
  const steps = [
    evaluatedStep(0, "UNAVAILABLE", { points: 0, minimumPoints: 0, maximumPoints: 0 }),
    typedFailureStep(1),
    skippedStep(2),
  ];
  const value = service.execute({ policy: policy(), report: report(steps, "STOPPED") });
  assert.equal(value.aggregated, true);
  if (!value.aggregated) return;
  assert.equal(value.aggregatePoints, 0);
  assert.deepEqual(value.bounds.theoretical, { minimumPoints: 0, maximumPoints: 0 });
  assert.deepEqual(value.steps.map((step) => step.reason), [
    "UNAVAILABLE", "TYPED_EVALUATOR_FAILURE", "SKIPPED_AFTER_TERMINATION",
  ]);
  assert(value.steps.every((step) => step.eligibility === "INELIGIBLE"
    && step.contribution === null && step.weightedContribution === null));
  assert.deepEqual(value.summary, {
    totalSteps: 3, eligibleSteps: 0, ineligibleSteps: 3,
    passSteps: 0, failSteps: 0, neutralSteps: 0, unavailableSteps: 1,
    typedEvaluatorFailures: 1, boundaryFailures: 0, skippedSteps: 1,
  });
});

test("classifies boundary failures independently and accepts completed reports with failures", () => {
  const value = service.execute({
    policy: policy(1, [2]),
    report: report([boundaryFailureStep(0)]),
  });
  assert.equal(value.aggregated, true);
  if (!value.aggregated) return;
  assert.equal(value.steps[0]!.reason, "BOUNDARY_FAILURE");
  assert.equal(value.summary.boundaryFailures, 1);
});

test("rejects invalid requests, policies, and reports in frozen order", () => {
  for (const request of [null, undefined, [], "request", 1, {}, { policy: policy() },
    { report: report([boundaryFailureStep(0)]) }]) {
    assert.deepEqual(
      service.execute(request as never),
      failure("INVALID_REQUEST", null, null, null, null, null),
    );
  }
  assert.equal(service.execute({ policy: { ...policy(), method: "AVERAGE" },
    report: report([boundaryFailureStep(0)]) } as never).aggregated, false);
  assert.deepEqual(
    service.execute({
      policy: { ...policy(1), method: "AVERAGE" } as never,
      report: { ...report([boundaryFailureStep(0)]), planId: "OTHER" },
    }),
    failure("INVALID_VALIDATED_POLICY", null, null, undefined, "OTHER"),
  );
  for (const invalidReport of [null, {}, { ran: false }, { ...report([]), ran: false },
    { ...report([boundaryFailureStep(0)]), steps: [] }]) {
    const safePlanId = invalidReport && typeof invalidReport === "object"
      && typeof (invalidReport as any).planId === "string"
      ? (invalidReport as any).planId
      : null;
    const safeFactorKey = invalidReport && typeof invalidReport === "object"
      && typeof (invalidReport as any).factorKey === "string"
      ? (invalidReport as any).factorKey
      : null;
    assert.deepEqual(
      service.execute({ policy: policy(1), report: invalidReport } as never),
      failure(
        "INVALID_EXECUTION_REPORT",
        null,
        null,
        undefined,
        safePlanId,
        safeFactorKey,
      ),
    );
  }
});

test("rejects plan identity and factor mismatches before coverage", () => {
  const baseReport = report([boundaryFailureStep(0)]);
  for (const changed of [{ planId: "OTHER_PLAN" }, { planVersion: 2 }]) {
    assert.deepEqual(
      service.execute({ policy: policy(1), report: { ...baseReport, ...changed } }),
      failure("PLAN_IDENTITY_MISMATCH", null, null,
        undefined, String(changed.planId ?? baseReport.planId)),
    );
  }
  assert.deepEqual(
    service.execute({
      policy: policy(1),
      report: { ...baseReport, factorKey: "OTHER.FACTOR" } as never,
    }),
    failure("FACTOR_MISMATCH", null, null, undefined, undefined, "OTHER.FACTOR"),
  );
});

test("rejects step-count and every corresponding identity mismatch", () => {
  assert.deepEqual(
    service.execute({ policy: policy(2), report: report([boundaryFailureStep(0)]) }),
    failure("STEP_COUNT_MISMATCH"),
  );
  const base = boundaryFailureStep(0);
  for (const changed of [
    { order: 2 }, { evaluatorId: "OTHER_V1" }, { evaluatorVersion: 9 },
    { configurationVersion: 9 },
  ]) {
    const changedStep = { ...base, ...changed };
    assert.deepEqual(
      service.execute({ policy: policy(1), report: report([changedStep]) }),
      failure("STEP_IDENTITY_MISMATCH", changedStep.order, changedStep.evaluatorId),
    );
  }
});

test("rejects contradictory status, disposition, and execution combinations", () => {
  const valid = evaluatedStep(0, "PASS", { points: 1, minimumPoints: 0, maximumPoints: 1 });
  const contradictions = [
    { ...valid, execution: boundaryFailureStep(0).execution },
    { ...valid, disposition: "TYPED_EVALUATOR_FAILURE" },
    { ...skippedStep(0), execution: boundaryFailureStep(0).execution },
    { ...boundaryFailureStep(0), execution: valid.execution },
  ];
  for (const step of contradictions) {
    assert.deepEqual(
      service.execute({ policy: policy(1), report: report([step]) }),
      failure("INVALID_STEP_EXECUTION", 1, "TEST_ALPHA_V1"),
    );
  }
});

test("rejects invalid contributions and exact Phase 2E outcome semantics", () => {
  for (const contribution of [
    { points: Number.NaN, minimumPoints: -1, maximumPoints: 1 },
    { points: 0, minimumPoints: 2, maximumPoints: 1 },
    { points: -2, minimumPoints: -1, maximumPoints: 1 },
    { points: 2, minimumPoints: -1, maximumPoints: 1 },
  ]) {
    assert.deepEqual(
      service.execute({
        policy: policy(1),
        report: report([evaluatedStep(0, "PASS", contribution)]),
      }),
      failure("INVALID_CONTRIBUTION", 1, "TEST_ALPHA_V1"),
    );
  }
  assert.deepEqual(
    service.execute({
      policy: policy(1),
      report: report([evaluatedStep(0, "UNAVAILABLE", {
        points: 1, minimumPoints: 0, maximumPoints: 1,
      })]),
    }),
    failure("INVALID_STEP_EXECUTION", 1, "TEST_ALPHA_V1"),
  );
});

test("preserves native unrounded multiplication and excludes ineligible bounds", () => {
  const value = service.execute({
    policy: policy(2, [1.1, 99], { minimumPoints: -2, maximumPoints: 2 }),
    report: report([
      evaluatedStep(0, "PASS", { points: 0.2, minimumPoints: 0, maximumPoints: 1 }),
      typedFailureStep(1),
    ]),
  });
  assert.equal(value.aggregated, true);
  if (!value.aggregated) return;
  assert.equal(value.aggregatePoints, 0.2 * 1.1);
  assert.deepEqual(value.bounds.theoretical, { minimumPoints: 0, maximumPoints: 1.1 });
});

test("fails closed on weighted overflow, aggregate overflow, and theoretical excess", () => {
  assert.deepEqual(
    service.execute({
      policy: policy(1, [100], { minimumPoints: -Number.MAX_VALUE, maximumPoints: Number.MAX_VALUE }),
      report: report([evaluatedStep(0, "PASS", {
        points: Number.MAX_VALUE, minimumPoints: 0, maximumPoints: Number.MAX_VALUE,
      })]),
    }),
    failure("NON_FINITE_WEIGHTED_CONTRIBUTION", 1, "TEST_ALPHA_V1"),
  );
  const large = Number.MAX_VALUE * 0.75;
  assert.deepEqual(
    service.execute({
      policy: policy(2, [1, 1], {
        minimumPoints: -Number.MAX_VALUE,
        maximumPoints: Number.MAX_VALUE,
      }),
      report: report([
        evaluatedStep(0, "PASS", { points: large, minimumPoints: 0, maximumPoints: large }),
        evaluatedStep(1, "PASS", { points: large, minimumPoints: 0, maximumPoints: large }),
      ]),
    }),
    failure("NON_FINITE_AGGREGATE", 2, "TEST_BETA_V1"),
  );
  assert.deepEqual(
    service.execute({
      policy: policy(1, [2], { minimumPoints: -10, maximumPoints: 10 }),
      report: report([evaluatedStep(0, "PASS", {
        points: 4, minimumPoints: -6, maximumPoints: 4,
      })]),
    }),
    failure("THEORETICAL_BOUNDS_EXCEEDED", 1, "TEST_ALPHA_V1"),
  );
});

test("accepts actual aggregate on inclusive declared boundaries", () => {
  for (const [outcome, points] of [["PASS", 2], ["FAIL", -2]] as const) {
    const value = service.execute({
      policy: policy(1, [1], { minimumPoints: -2, maximumPoints: 2 }),
      report: report([evaluatedStep(0, outcome, {
        points, minimumPoints: -2, maximumPoints: 2,
      })]),
    });
    assert.equal(value.aggregated, true);
    if (value.aggregated) assert.equal(value.aggregatePoints, points);
  }
});

test("projects minimized deeply frozen deterministic results without source mutation", () => {
  const sourcePolicy = policy(1, [1.5], { minimumPoints: -3, maximumPoints: 3 });
  const sourceReport = report([evaluatedStep(0, "PASS", {
    points: 2, minimumPoints: -2, maximumPoints: 2,
  })]);
  const beforePolicy = structuredClone(sourcePolicy);
  const beforeReport = structuredClone(sourceReport);
  const first = service.execute({ policy: sourcePolicy, report: sourceReport });
  const second = service.execute({ policy: sourcePolicy, report: sourceReport });
  assert.deepEqual(first, second);
  assert.deepEqual(sourcePolicy, beforePolicy);
  assert.deepEqual(sourceReport, beforeReport);
  assert.equal(first.aggregated, true);
  if (!first.aggregated) return;
  assert(Object.isFrozen(first));
  assert(Object.isFrozen(first.bounds));
  assert(Object.isFrozen(first.bounds.declared));
  assert(Object.isFrozen(first.summary));
  assert(Object.isFrozen(first.steps));
  assert(Object.isFrozen(first.steps[0]));
  assert.throws(() => { (first.steps as any).push({}); }, TypeError);
  const serialized = JSON.stringify(first);
  for (const forbidden of [
    "diagnostics", "reasonCode", "evidenceId", "provider", "execution\"",
    "aggregationId", "createdAt", "aggregatedAt", "durationMs", "score",
  ]) assert.equal(serialized.includes(forbidden), false, forbidden);
});

test("service remains dependency-free from runners, validators, evaluators, I/O, and scoring", () => {
  const source = readFileSync(
    new URL(
      "../../../src/services/factor-contribution-aggregation-execution.service.ts",
      import.meta.url,
    ),
    "utf8",
  ).toLowerCase();
  for (const forbidden of [
    "factor-contribution-aggregation-policy.service",
    "factor-evaluator-plan-runner.service",
    "explicit-factor-evaluator-execution.service",
    "deterministic-factor-evaluator",
    "evaluator.registry",
    "evidence",
    "provider",
    "mongoose",
    "axios",
    "scoring",
    "decision",
    "math.round",
    "tofixed",
    "normalize",
    "date.now",
    "math.random",
    "randomuuid",
  ]) assert.equal(source.includes(forbidden), false, forbidden);
});
