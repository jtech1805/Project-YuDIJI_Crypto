import {
  MAX_AGGREGATION_POLICY_ENTRIES,
  MAX_AGGREGATION_WEIGHT,
  type ValidatedFactorContributionAggregationEntry,
  type ValidatedFactorContributionAggregationPolicy,
} from "../../types/factor-contribution-aggregation.types.js";
import {
  EXPLICIT_FACTOR_EVALUATOR_EXECUTION_FAILURE_CODES,
} from "../../types/factor-evaluator-execution.types.js";
import {
  FACTOR_EVALUATOR_FAILURE_CODES,
} from "../../types/factor-evaluator.types.js";
import {
  FACTOR_EVALUATOR_PLAN_FAILURE_POLICIES,
} from "../../types/factor-evaluator-execution-plan.types.js";
import {
  FACTOR_EVALUATOR_PLAN_RUN_STATUSES,
  FACTOR_EVALUATOR_PLAN_STEP_DISPOSITIONS,
  FACTOR_EVALUATOR_PLAN_STEP_STATUSES,
  FACTOR_EVALUATOR_PLAN_TERMINATION_REASONS,
  type FactorEvaluatorPlanRunReport,
  type FactorEvaluatorPlanStepReport,
} from "../../types/factor-evaluator-plan-runner.types.js";
import type {
  EligibleFactorContributionAggregationStep,
  FactorContributionAggregationExecutionFailure,
  FactorContributionAggregationExecutionFailureCode,
  FactorContributionAggregationExecutionResult,
  FactorContributionAggregationStepResult,
  FactorContributionAggregationSummary,
  IneligibleFactorContributionAggregationStep,
} from "../../types/factor-contribution-aggregation-execution.types.js";

const MAX_IDENTIFIER_LENGTH = 120;

type Contribution = {
  points: number;
  minimumPoints: number;
  maximumPoints: number;
};

type ClassifiedEligible = {
  kind: "ELIGIBLE";
  reason: "PASS" | "FAIL" | "NEUTRAL";
  contribution: Contribution;
};

type ClassifiedIneligible = {
  kind: "INELIGIBLE";
  reason:
    | "UNAVAILABLE"
    | "TYPED_EVALUATOR_FAILURE"
    | "BOUNDARY_FAILURE"
    | "SKIPPED_AFTER_TERMINATION";
  outcome: "UNAVAILABLE" | null;
};

type Classified = ClassifiedEligible | ClassifiedIneligible;

export class FactorContributionAggregationExecutionService {
  public execute(request: unknown): FactorContributionAggregationExecutionResult {
    if (!record(request) || !("policy" in request) || !("report" in request)) {
      return failure("INVALID_REQUEST", null, null, null);
    }

    const policy = request.policy;
    const report = request.report;
    const policyId = safeIdentifier(policy, "policyId");
    const reportPlanId = safeIdentifier(report, "planId");
    const reportFactor = safeTrimmed(report, "factorKey");

    if (!validPolicyBoundary(policy)) {
      return failure(
        "INVALID_VALIDATED_POLICY",
        policyId,
        reportPlanId,
        reportFactor,
      );
    }
    if (!validReportBoundary(report)) {
      return failure(
        "INVALID_EXECUTION_REPORT",
        policy.policyId,
        reportPlanId,
        reportFactor,
      );
    }
    if (policy.planId !== report.planId || policy.planVersion !== report.planVersion) {
      return failure(
        "PLAN_IDENTITY_MISMATCH",
        policy.policyId,
        report.planId,
        report.factorKey,
      );
    }
    if (policy.factorKey !== report.factorKey) {
      return failure(
        "FACTOR_MISMATCH",
        policy.policyId,
        report.planId,
        report.factorKey,
      );
    }
    if (policy.entries.length !== report.steps.length) {
      return failure(
        "STEP_COUNT_MISMATCH",
        policy.policyId,
        report.planId,
        report.factorKey,
      );
    }

    for (let index = 0; index < policy.entries.length; index += 1) {
      const entry = policy.entries[index]!;
      const step = report.steps[index]!;
      if (!sameIdentity(entry, step)) {
        return failure(
          "STEP_IDENTITY_MISMATCH",
          policy.policyId,
          report.planId,
          report.factorKey,
          step.order,
          step.evaluatorId,
        );
      }
    }

    const classified: Classified[] = [];
    for (let index = 0; index < report.steps.length; index += 1) {
      const step = report.steps[index]!;
      const classification = classifyStep(step, report.factorKey);
      if (typeof classification === "string") {
        return failure(
          classification,
          policy.policyId,
          report.planId,
          report.factorKey,
          step.order,
          step.evaluatorId,
        );
      }
      classified.push(classification);
    }

    let theoreticalMinimum = 0;
    let theoreticalMaximum = 0;
    let lastEligible: ValidatedFactorContributionAggregationEntry | null = null;
    for (let index = 0; index < classified.length; index += 1) {
      const classification = classified[index]!;
      if (classification.kind !== "ELIGIBLE") continue;
      const entry = policy.entries[index]!;
      lastEligible = entry;
      const weightedMinimum = classification.contribution.minimumPoints * entry.weight;
      const weightedMaximum = classification.contribution.maximumPoints * entry.weight;
      if (!finite(weightedMinimum) || !finite(weightedMaximum)) {
        return failure(
          "NON_FINITE_WEIGHTED_CONTRIBUTION",
          policy.policyId,
          report.planId,
          report.factorKey,
          entry.order,
          entry.evaluatorId,
        );
      }
      theoreticalMinimum += weightedMinimum;
      theoreticalMaximum += weightedMaximum;
      if (!finite(theoreticalMinimum) || !finite(theoreticalMaximum)) {
        return failure(
          "NON_FINITE_AGGREGATE",
          policy.policyId,
          report.planId,
          report.factorKey,
          entry.order,
          entry.evaluatorId,
        );
      }
    }
    if (theoreticalMinimum < policy.bounds.minimumPoints
      || theoreticalMaximum > policy.bounds.maximumPoints) {
      return failure(
        "THEORETICAL_BOUNDS_EXCEEDED",
        policy.policyId,
        report.planId,
        report.factorKey,
        lastEligible?.order ?? null,
        lastEligible?.evaluatorId ?? null,
      );
    }

    const projected: FactorContributionAggregationStepResult[] = [];
    let aggregatePoints = 0;
    for (let index = 0; index < classified.length; index += 1) {
      const classification = classified[index]!;
      const entry = policy.entries[index]!;
      if (classification.kind === "INELIGIBLE") {
        projected.push(ineligibleProjection(entry, classification));
        continue;
      }
      const weightedPoints = classification.contribution.points * entry.weight;
      const weightedMinimum = classification.contribution.minimumPoints * entry.weight;
      const weightedMaximum = classification.contribution.maximumPoints * entry.weight;
      if (!finite(weightedPoints)
        || !finite(weightedMinimum)
        || !finite(weightedMaximum)) {
        return failure(
          "NON_FINITE_WEIGHTED_CONTRIBUTION",
          policy.policyId,
          report.planId,
          report.factorKey,
          entry.order,
          entry.evaluatorId,
        );
      }
      aggregatePoints += weightedPoints;
      if (!finite(aggregatePoints)) {
        return failure(
          "NON_FINITE_AGGREGATE",
          policy.policyId,
          report.planId,
          report.factorKey,
          entry.order,
          entry.evaluatorId,
        );
      }
      projected.push(eligibleProjection(
        entry,
        classification,
        weightedPoints,
        weightedMinimum,
        weightedMaximum,
      ));
    }
    if (aggregatePoints < policy.bounds.minimumPoints
      || aggregatePoints > policy.bounds.maximumPoints) {
      return failure(
        "AGGREGATE_OUT_OF_BOUNDS",
        policy.policyId,
        report.planId,
        report.factorKey,
        lastEligible?.order ?? null,
        lastEligible?.evaluatorId ?? null,
      );
    }

    const summary = summarize(projected);
    return Object.freeze({
      aggregated: true,
      policyId: policy.policyId,
      policyVersion: policy.policyVersion,
      planId: policy.planId,
      planVersion: policy.planVersion,
      factorKey: policy.factorKey,
      method: "WEIGHTED_SUM",
      aggregatePoints,
      bounds: Object.freeze({
        declared: Object.freeze({
          minimumPoints: policy.bounds.minimumPoints,
          maximumPoints: policy.bounds.maximumPoints,
        }),
        theoretical: Object.freeze({
          minimumPoints: theoreticalMinimum,
          maximumPoints: theoreticalMaximum,
        }),
      }),
      summary,
      steps: Object.freeze(projected),
    });
  }
}

const classifyStep = (
  step: FactorEvaluatorPlanStepReport,
  factorKey: string,
): Classified | "INVALID_STEP_EXECUTION" | "INVALID_CONTRIBUTION" => {
  if (step.status === "SKIPPED") {
    return step.disposition === "SKIPPED_AFTER_TERMINATION" && step.execution === null
      ? { kind: "INELIGIBLE", reason: "SKIPPED_AFTER_TERMINATION", outcome: null }
      : "INVALID_STEP_EXECUTION";
  }
  if (step.status !== "ATTEMPTED" || !record(step.execution)) {
    return "INVALID_STEP_EXECUTION";
  }
  const execution = step.execution;
  if (step.disposition === "BOUNDARY_FAILURE") {
    return execution.executed === false
      && validBoundaryExecution(execution)
      ? { kind: "INELIGIBLE", reason: "BOUNDARY_FAILURE", outcome: null }
      : "INVALID_STEP_EXECUTION";
  }
  if (execution.executed !== true
    || execution.evaluatorId !== step.evaluatorId
    || execution.evaluatorVersion !== step.evaluatorVersion
    || execution.configurationVersion !== step.configurationVersion
    || execution.factorKey !== factorKey
    || !record(execution.execution)) return "INVALID_STEP_EXECUTION";

  if (step.disposition === "TYPED_EVALUATOR_FAILURE") {
    return execution.execution.evaluated === false
      && validTypedFailure(execution.execution)
      ? { kind: "INELIGIBLE", reason: "TYPED_EVALUATOR_FAILURE", outcome: null }
      : "INVALID_STEP_EXECUTION";
  }
  if (step.disposition !== "EVALUATED"
    || execution.execution.evaluated !== true
    || !record(execution.execution.result)
    || !["PASS", "FAIL", "NEUTRAL", "UNAVAILABLE"].includes(
      execution.execution.result.outcome,
    )) return "INVALID_STEP_EXECUTION";

  const outcome = execution.execution.result.outcome as
    "PASS" | "FAIL" | "NEUTRAL" | "UNAVAILABLE";
  const contribution = execution.execution.result.contribution;
  if (!validContribution(contribution)) return "INVALID_CONTRIBUTION";
  if (!validOutcomeContribution(outcome, contribution)) {
    return "INVALID_STEP_EXECUTION";
  }
  if (outcome === "UNAVAILABLE") {
    return { kind: "INELIGIBLE", reason: "UNAVAILABLE", outcome };
  }
  return { kind: "ELIGIBLE", reason: outcome, contribution: cloneContribution(contribution) };
};

const validPolicyBoundary = (
  value: unknown,
): value is ValidatedFactorContributionAggregationPolicy => {
  if (!record(value)
    || !identifier(value.policyId)
    || !positiveInteger(value.policyVersion)
    || !identifier(value.planId)
    || !positiveInteger(value.planVersion)
    || !trimmed(value.factorKey)
    || value.method !== "WEIGHTED_SUM"
    || !validDeclaredBounds(value.bounds)
    || !record(value.outcomeEligibility)
    || value.outcomeEligibility.PASS !== "ELIGIBLE"
    || value.outcomeEligibility.FAIL !== "ELIGIBLE"
    || value.outcomeEligibility.NEUTRAL !== "ELIGIBLE"
    || value.outcomeEligibility.UNAVAILABLE !== "INELIGIBLE"
    || !Array.isArray(value.entries)
    || !dense(value.entries)
    || value.entries.length === 0
    || value.entries.length > MAX_AGGREGATION_POLICY_ENTRIES) return false;
  for (let index = 0; index < value.entries.length; index += 1) {
    const entry = value.entries[index];
    if (!record(entry)
      || entry.order !== index + 1
      || !identifier(entry.evaluatorId)
      || !positiveInteger(entry.evaluatorVersion)
      || !positiveInteger(entry.configurationVersion)
      || !finite(entry.weight)
      || entry.weight <= 0
      || entry.weight > MAX_AGGREGATION_WEIGHT) return false;
  }
  return true;
};

const validReportBoundary = (value: unknown): value is FactorEvaluatorPlanRunReport => {
  if (!record(value)
    || value.ran !== true
    || !identifier(value.planId)
    || !positiveInteger(value.planVersion)
    || !trimmed(value.factorKey)
    || !FACTOR_EVALUATOR_PLAN_FAILURE_POLICIES.includes(value.failurePolicy)
    || !FACTOR_EVALUATOR_PLAN_RUN_STATUSES.includes(value.status)
    || !record(value.termination)
    || !FACTOR_EVALUATOR_PLAN_TERMINATION_REASONS.includes(value.termination.reason)
    || !nullablePositiveInteger(value.termination.stepOrder)
    || !nullableIdentifier(value.termination.evaluatorId)
    || !validReportSummary(value.summary)
    || !Array.isArray(value.steps)
    || !dense(value.steps)
    || value.steps.length === 0
    || value.steps.length > MAX_AGGREGATION_POLICY_ENTRIES) return false;
  for (const step of value.steps) {
    if (!record(step)
      || !positiveInteger(step.order)
      || !identifier(step.evaluatorId)
      || !positiveInteger(step.evaluatorVersion)
      || !positiveInteger(step.configurationVersion)
      || !FACTOR_EVALUATOR_PLAN_STEP_STATUSES.includes(step.status)
      || !FACTOR_EVALUATOR_PLAN_STEP_DISPOSITIONS.includes(step.disposition)
      || (step.execution !== null && !record(step.execution))) return false;
  }
  return true;
};

const validReportSummary = (value: unknown): boolean => {
  if (!record(value)) return false;
  for (const key of [
    "totalSteps", "attemptedSteps", "skippedSteps", "evaluatedSteps",
    "typedEvaluatorFailures", "boundaryFailures",
  ]) {
    if (!nonNegativeInteger(value[key])) return false;
  }
  return true;
};

const validContribution = (value: unknown): value is Contribution =>
  record(value)
  && finite(value.points)
  && finite(value.minimumPoints)
  && finite(value.maximumPoints)
  && value.minimumPoints <= value.maximumPoints
  && value.points >= value.minimumPoints
  && value.points <= value.maximumPoints;

const validOutcomeContribution = (outcome: string, value: Contribution): boolean => {
  if (outcome === "PASS") return value.points > 0;
  if (outcome === "FAIL") return value.points < 0;
  return value.points === 0;
};

const validBoundaryExecution = (value: Record<string, any>): boolean =>
  (value.evaluatorId === null || typeof value.evaluatorId === "string")
  && (value.factorKey === null || typeof value.factorKey === "string")
  && EXPLICIT_FACTOR_EVALUATOR_EXECUTION_FAILURE_CODES.includes(value.code);

const validTypedFailure = (value: Record<string, any>): boolean =>
  (value.evaluatorId === null || typeof value.evaluatorId === "string")
  && (value.factorKey === null || typeof value.factorKey === "string")
  && FACTOR_EVALUATOR_FAILURE_CODES.includes(value.code);

const sameIdentity = (
  entry: ValidatedFactorContributionAggregationEntry,
  step: FactorEvaluatorPlanStepReport,
): boolean => entry.order === step.order
  && entry.evaluatorId === step.evaluatorId
  && entry.evaluatorVersion === step.evaluatorVersion
  && entry.configurationVersion === step.configurationVersion;

const eligibleProjection = (
  entry: ValidatedFactorContributionAggregationEntry,
  classification: ClassifiedEligible,
  weightedPoints: number,
  weightedMinimum: number,
  weightedMaximum: number,
): EligibleFactorContributionAggregationStep => Object.freeze({
  order: entry.order,
  evaluatorId: entry.evaluatorId,
  evaluatorVersion: entry.evaluatorVersion,
  configurationVersion: entry.configurationVersion,
  eligibility: "ELIGIBLE",
  reason: classification.reason,
  outcome: classification.reason,
  contribution: Object.freeze(cloneContribution(classification.contribution)),
  weight: entry.weight,
  weightedContribution: Object.freeze({
    points: weightedPoints,
    minimumPoints: weightedMinimum,
    maximumPoints: weightedMaximum,
  }),
});

const ineligibleProjection = (
  entry: ValidatedFactorContributionAggregationEntry,
  classification: ClassifiedIneligible,
): IneligibleFactorContributionAggregationStep => Object.freeze({
  order: entry.order,
  evaluatorId: entry.evaluatorId,
  evaluatorVersion: entry.evaluatorVersion,
  configurationVersion: entry.configurationVersion,
  eligibility: "INELIGIBLE",
  reason: classification.reason,
  outcome: classification.outcome,
  contribution: null,
  weight: entry.weight,
  weightedContribution: null,
});

const summarize = (
  steps: readonly FactorContributionAggregationStepResult[],
): FactorContributionAggregationSummary => {
  let eligibleSteps = 0;
  let passSteps = 0;
  let failSteps = 0;
  let neutralSteps = 0;
  let unavailableSteps = 0;
  let typedEvaluatorFailures = 0;
  let boundaryFailures = 0;
  let skippedSteps = 0;
  for (const step of steps) {
    if (step.eligibility === "ELIGIBLE") eligibleSteps += 1;
    if (step.reason === "PASS") passSteps += 1;
    if (step.reason === "FAIL") failSteps += 1;
    if (step.reason === "NEUTRAL") neutralSteps += 1;
    if (step.reason === "UNAVAILABLE") unavailableSteps += 1;
    if (step.reason === "TYPED_EVALUATOR_FAILURE") typedEvaluatorFailures += 1;
    if (step.reason === "BOUNDARY_FAILURE") boundaryFailures += 1;
    if (step.reason === "SKIPPED_AFTER_TERMINATION") skippedSteps += 1;
  }
  return Object.freeze({
    totalSteps: steps.length,
    eligibleSteps,
    ineligibleSteps: steps.length - eligibleSteps,
    passSteps,
    failSteps,
    neutralSteps,
    unavailableSteps,
    typedEvaluatorFailures,
    boundaryFailures,
    skippedSteps,
  });
};

const failure = (
  code: FactorContributionAggregationExecutionFailureCode,
  policyId: string | null,
  planId: string | null,
  factorKey: string | null,
  entryOrder: number | null = null,
  evaluatorId: string | null = null,
): FactorContributionAggregationExecutionFailure => Object.freeze({
  aggregated: false,
  policyId,
  planId,
  factorKey,
  code,
  entryOrder,
  evaluatorId,
});

const cloneContribution = (value: Contribution): Contribution => ({
  points: value.points,
  minimumPoints: value.minimumPoints,
  maximumPoints: value.maximumPoints,
});

const validDeclaredBounds = (value: unknown): boolean => record(value)
  && finite(value.minimumPoints)
  && finite(value.maximumPoints)
  && value.minimumPoints <= value.maximumPoints
  && value.minimumPoints <= 0
  && value.maximumPoints >= 0;

const safeIdentifier = (value: unknown, key: string): string | null =>
  record(value) && identifier(value[key]) ? value[key] : null;

const safeTrimmed = (value: unknown, key: string): string | null =>
  record(value) && trimmed(value[key]) ? value[key] : null;

const dense = (values: readonly unknown[]): boolean => {
  for (let index = 0; index < values.length; index += 1) {
    if (!(index in values)) return false;
  }
  return true;
};

const identifier = (value: unknown): value is string =>
  typeof value === "string"
  && value.length > 0
  && value.length <= MAX_IDENTIFIER_LENGTH
  && value.trim() === value
  && /^[A-Z0-9_]+$/.test(value);

const trimmed = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.trim() === value;

const positiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

const nonNegativeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

const nullablePositiveInteger = (value: unknown): boolean =>
  value === null || positiveInteger(value);

const nullableIdentifier = (value: unknown): boolean =>
  value === null || identifier(value);

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const record = (value: unknown): value is Record<string, any> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
