import type { FactorContributionAggregationExecutionSuccess } from "./factor-contribution-aggregation-execution.types.js";
import type { ValidatedFactorAggregateNormalizationPolicy } from "./factor-aggregate-normalization.types.js";
import type { FactorKey } from "./factor-registry.types.js";

export type FactorAggregateNormalizationExecutionRequest = {
  policy: ValidatedFactorAggregateNormalizationPolicy;
  aggregation: FactorContributionAggregationExecutionSuccess;
};

export const FACTOR_AGGREGATE_NORMALIZATION_EXECUTION_FAILURE_CODES = [
  "INVALID_REQUEST", "INVALID_VALIDATED_POLICY", "INVALID_AGGREGATION_RESULT",
  "AGGREGATION_POLICY_MISMATCH", "FACTOR_MISMATCH", "SOURCE_RANGE_MISMATCH",
  "NON_FINITE_RAW_AGGREGATE", "RAW_AGGREGATE_OUT_OF_RANGE", "UNSUPPORTED_METHOD",
  "UNSUPPORTED_OUT_OF_RANGE_POLICY", "UNSUPPORTED_PRECISION_POLICY",
  "NON_FINITE_NORMALIZED_SCORE", "NORMALIZED_SCORE_OUT_OF_RANGE",
] as const;

export type FactorAggregateNormalizationExecutionFailureCode =
  (typeof FACTOR_AGGREGATE_NORMALIZATION_EXECUTION_FAILURE_CODES)[number];

export type FactorAggregateNormalizationExecutionSuccess = {
  normalized: true;
  normalizationPolicyId: string;
  normalizationPolicyVersion: number;
  aggregationPolicyId: string;
  aggregationPolicyVersion: number;
  planId: string;
  planVersion: number;
  factorKey: FactorKey;
  method: "PIECEWISE_LINEAR_ZERO_ANCHORED";
  sourceRange: { minimumPoints: number; neutralPoints: 0; maximumPoints: number };
  targetRange: { minimumScore: number; neutralScore: number; maximumScore: number };
  rawAggregatePoints: number;
  segment: "LOWER" | "NEUTRAL" | "UPPER";
  normalizedScore: number;
  outOfRangePolicy: "FAIL";
  precisionPolicy: "PRESERVE_NATIVE";
};

export type FactorAggregateNormalizationExecutionFailure = {
  normalized: false;
  normalizationPolicyId: string | null;
  aggregationPolicyId: string | null;
  factorKey: string | null;
  code: FactorAggregateNormalizationExecutionFailureCode;
};

export type FactorAggregateNormalizationExecutionResult =
  | FactorAggregateNormalizationExecutionSuccess
  | FactorAggregateNormalizationExecutionFailure;
