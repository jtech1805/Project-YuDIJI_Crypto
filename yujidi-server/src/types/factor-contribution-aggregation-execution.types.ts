import type {
  ValidatedFactorContributionAggregationPolicy,
} from "./factor-contribution-aggregation.types.js";
import type { FactorEvaluatorPlanRunReport } from "./factor-evaluator-plan-runner.types.js";
import type { FactorKey } from "./factor-registry.types.js";

export type FactorContributionAggregationExecutionRequest = {
  policy: ValidatedFactorContributionAggregationPolicy;
  report: FactorEvaluatorPlanRunReport;
};

export const FACTOR_CONTRIBUTION_AGGREGATION_EXECUTION_FAILURE_CODES = [
  "INVALID_REQUEST",
  "INVALID_VALIDATED_POLICY",
  "INVALID_EXECUTION_REPORT",
  "PLAN_IDENTITY_MISMATCH",
  "FACTOR_MISMATCH",
  "STEP_COUNT_MISMATCH",
  "STEP_IDENTITY_MISMATCH",
  "INVALID_STEP_EXECUTION",
  "INVALID_CONTRIBUTION",
  "THEORETICAL_BOUNDS_EXCEEDED",
  "NON_FINITE_WEIGHTED_CONTRIBUTION",
  "NON_FINITE_AGGREGATE",
  "AGGREGATE_OUT_OF_BOUNDS",
] as const;

export type FactorContributionAggregationExecutionFailureCode =
  (typeof FACTOR_CONTRIBUTION_AGGREGATION_EXECUTION_FAILURE_CODES)[number];

export const FACTOR_CONTRIBUTION_AGGREGATION_STEP_ELIGIBILITY_REASONS = [
  "PASS",
  "FAIL",
  "NEUTRAL",
  "UNAVAILABLE",
  "TYPED_EVALUATOR_FAILURE",
  "BOUNDARY_FAILURE",
  "SKIPPED_AFTER_TERMINATION",
] as const;

export type FactorContributionAggregationStepEligibilityReason =
  (typeof FACTOR_CONTRIBUTION_AGGREGATION_STEP_ELIGIBILITY_REASONS)[number];

export type EligibleFactorContributionAggregationStep = {
  order: number;
  evaluatorId: string;
  evaluatorVersion: number;
  configurationVersion: number;
  eligibility: "ELIGIBLE";
  reason: "PASS" | "FAIL" | "NEUTRAL";
  outcome: "PASS" | "FAIL" | "NEUTRAL";
  contribution: {
    points: number;
    minimumPoints: number;
    maximumPoints: number;
  };
  weight: number;
  weightedContribution: {
    points: number;
    minimumPoints: number;
    maximumPoints: number;
  };
};

export type IneligibleFactorContributionAggregationStep = {
  order: number;
  evaluatorId: string;
  evaluatorVersion: number;
  configurationVersion: number;
  eligibility: "INELIGIBLE";
  reason:
    | "UNAVAILABLE"
    | "TYPED_EVALUATOR_FAILURE"
    | "BOUNDARY_FAILURE"
    | "SKIPPED_AFTER_TERMINATION";
  outcome: "UNAVAILABLE" | null;
  contribution: null;
  weight: number;
  weightedContribution: null;
};

export type FactorContributionAggregationStepResult =
  | EligibleFactorContributionAggregationStep
  | IneligibleFactorContributionAggregationStep;

export type FactorContributionAggregationSummary = {
  totalSteps: number;
  eligibleSteps: number;
  ineligibleSteps: number;
  passSteps: number;
  failSteps: number;
  neutralSteps: number;
  unavailableSteps: number;
  typedEvaluatorFailures: number;
  boundaryFailures: number;
  skippedSteps: number;
};

export type FactorContributionAggregationBoundsResult = {
  declared: {
    minimumPoints: number;
    maximumPoints: number;
  };
  theoretical: {
    minimumPoints: number;
    maximumPoints: number;
  };
};

export type FactorContributionAggregationExecutionSuccess = {
  aggregated: true;
  policyId: string;
  policyVersion: number;
  planId: string;
  planVersion: number;
  factorKey: FactorKey;
  method: "WEIGHTED_SUM";
  aggregatePoints: number;
  bounds: FactorContributionAggregationBoundsResult;
  summary: FactorContributionAggregationSummary;
  steps: readonly FactorContributionAggregationStepResult[];
};

export type FactorContributionAggregationExecutionFailure = {
  aggregated: false;
  policyId: string | null;
  planId: string | null;
  factorKey: string | null;
  code: FactorContributionAggregationExecutionFailureCode;
  entryOrder: number | null;
  evaluatorId: string | null;
};

export type FactorContributionAggregationExecutionResult =
  | FactorContributionAggregationExecutionSuccess
  | FactorContributionAggregationExecutionFailure;
