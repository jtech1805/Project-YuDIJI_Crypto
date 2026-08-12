import type {
  ValidatedFactorEvaluatorExecutionPlan,
} from "./factor-evaluator-execution-plan.types.js";
import type { FactorKey } from "./factor-registry.types.js";

export const MAX_AGGREGATION_POLICY_ENTRIES = 20;
export const MAX_AGGREGATION_WEIGHT = 100;

export type FactorContributionAggregationPolicyIdentity = {
  policyId: string;
  policyVersion: number;
};

export const FACTOR_CONTRIBUTION_AGGREGATION_ELIGIBILITIES = [
  "ELIGIBLE",
  "INELIGIBLE",
] as const;

export type FactorContributionAggregationEligibility =
  (typeof FACTOR_CONTRIBUTION_AGGREGATION_ELIGIBILITIES)[number];

export type FactorOutcomeAggregationEligibility = {
  PASS: "ELIGIBLE";
  FAIL: "ELIGIBLE";
  NEUTRAL: "ELIGIBLE";
  UNAVAILABLE: "INELIGIBLE";
};

export const FACTOR_OUTCOME_AGGREGATION_ELIGIBILITY:
Readonly<FactorOutcomeAggregationEligibility> = Object.freeze({
  PASS: "ELIGIBLE",
  FAIL: "ELIGIBLE",
  NEUTRAL: "ELIGIBLE",
  UNAVAILABLE: "INELIGIBLE",
});

export const FACTOR_CONTRIBUTION_AGGREGATION_METHODS = [
  "WEIGHTED_SUM",
] as const;

export type FactorContributionAggregationMethod =
  (typeof FACTOR_CONTRIBUTION_AGGREGATION_METHODS)[number];

export type FactorContributionAggregationEntry = {
  order: number;
  evaluatorId: string;
  evaluatorVersion: number;
  configurationVersion: number;
  weight: number;
};

export type FactorContributionAggregateBounds = {
  minimumPoints: number;
  maximumPoints: number;
};

export type FactorContributionAggregationPolicy =
  FactorContributionAggregationPolicyIdentity & {
    planId: string;
    planVersion: number;
    factorKey: FactorKey;
    method: "WEIGHTED_SUM";
    bounds: FactorContributionAggregateBounds;
    entries: readonly FactorContributionAggregationEntry[];
  };

export type ValidatedFactorContributionAggregationEntry =
  FactorContributionAggregationEntry;

export type ValidatedFactorContributionAggregationPolicy =
  FactorContributionAggregationPolicyIdentity & {
    planId: string;
    planVersion: number;
    factorKey: FactorKey;
    method: "WEIGHTED_SUM";
    bounds: FactorContributionAggregateBounds;
    outcomeEligibility: FactorOutcomeAggregationEligibility;
    entries: readonly ValidatedFactorContributionAggregationEntry[];
  };

export const FACTOR_CONTRIBUTION_AGGREGATION_POLICY_FAILURE_CODES = [
  "INVALID_POLICY",
  "INVALID_POLICY_ID",
  "INVALID_POLICY_VERSION",
  "INVALID_PLAN_REFERENCE",
  "FACTOR_MISMATCH",
  "INVALID_AGGREGATION_METHOD",
  "INVALID_BOUNDS",
  "EMPTY_ENTRIES",
  "TOO_MANY_ENTRIES",
  "INVALID_ENTRY",
  "INVALID_ENTRY_ORDER",
  "DUPLICATE_ENTRY_ORDER",
  "DUPLICATE_EVALUATOR_ID",
  "ENTRY_COUNT_MISMATCH",
  "PLAN_ENTRY_MISMATCH",
  "INVALID_WEIGHT",
] as const;

export type FactorContributionAggregationPolicyFailureCode =
  (typeof FACTOR_CONTRIBUTION_AGGREGATION_POLICY_FAILURE_CODES)[number];

export type FactorContributionAggregationPolicyValidationResult =
  | {
      valid: true;
      policy: ValidatedFactorContributionAggregationPolicy;
    }
  | {
      valid: false;
      code: FactorContributionAggregationPolicyFailureCode;
      policyId: string | null;
      evaluatorId: string | null;
      entryOrder: number | null;
    };

export type FactorContributionAggregationPolicyValidationParams = {
  policy: unknown;
  plan: ValidatedFactorEvaluatorExecutionPlan;
};
