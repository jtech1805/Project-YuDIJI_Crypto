import type {
  ValidatedFactorContributionAggregationPolicy,
} from "./factor-contribution-aggregation.types.js";
import type { FactorKey } from "./factor-registry.types.js";

export type FactorAggregateNormalizationPolicyIdentity = {
  normalizationPolicyId: string;
  normalizationPolicyVersion: number;
};

export const FACTOR_AGGREGATE_NORMALIZATION_METHODS = [
  "PIECEWISE_LINEAR_ZERO_ANCHORED",
] as const;

export type FactorAggregateNormalizationMethod =
  (typeof FACTOR_AGGREGATE_NORMALIZATION_METHODS)[number];

export const FACTOR_AGGREGATE_NORMALIZATION_OUT_OF_RANGE_POLICIES = [
  "FAIL",
] as const;

export type FactorAggregateNormalizationOutOfRangePolicy =
  (typeof FACTOR_AGGREGATE_NORMALIZATION_OUT_OF_RANGE_POLICIES)[number];

export const FACTOR_AGGREGATE_NORMALIZATION_PRECISION_POLICIES = [
  "PRESERVE_NATIVE",
] as const;

export type FactorAggregateNormalizationPrecisionPolicy =
  (typeof FACTOR_AGGREGATE_NORMALIZATION_PRECISION_POLICIES)[number];

export type FactorAggregateNormalizationSourceRange = {
  minimumPoints: number;
  neutralPoints: 0;
  maximumPoints: number;
};

export type FactorAggregateNormalizationTargetRange = {
  minimumScore: number;
  neutralScore: number;
  maximumScore: number;
};

export type FactorAggregateNormalizationPolicy =
  FactorAggregateNormalizationPolicyIdentity & {
    aggregationPolicyId: string;
    aggregationPolicyVersion: number;
    factorKey: FactorKey;
    method: "PIECEWISE_LINEAR_ZERO_ANCHORED";
    sourceRange: FactorAggregateNormalizationSourceRange;
    targetRange: FactorAggregateNormalizationTargetRange;
    outOfRangePolicy: "FAIL";
    precisionPolicy: "PRESERVE_NATIVE";
  };

export type ValidatedFactorAggregateNormalizationPolicy =
  FactorAggregateNormalizationPolicy;

export type FactorAggregateNormalizationPolicyValidationRequest = {
  policy: unknown;
  aggregationPolicy: ValidatedFactorContributionAggregationPolicy;
};

export const FACTOR_AGGREGATE_NORMALIZATION_POLICY_FAILURE_CODES = [
  "INVALID_REQUEST",
  "INVALID_AGGREGATION_POLICY",
  "INVALID_NORMALIZATION_POLICY",
  "INVALID_POLICY_ID",
  "INVALID_POLICY_VERSION",
  "AGGREGATION_POLICY_MISMATCH",
  "FACTOR_MISMATCH",
  "INVALID_METHOD",
  "INVALID_SOURCE_RANGE",
  "SOURCE_RANGE_MISMATCH",
  "INVALID_TARGET_RANGE",
  "INVALID_OUT_OF_RANGE_POLICY",
  "INVALID_PRECISION_POLICY",
] as const;

export type FactorAggregateNormalizationPolicyFailureCode =
  (typeof FACTOR_AGGREGATE_NORMALIZATION_POLICY_FAILURE_CODES)[number];

export type FactorAggregateNormalizationPolicyValidationResult =
  | {
      valid: true;
      policy: ValidatedFactorAggregateNormalizationPolicy;
    }
  | {
      valid: false;
      code: FactorAggregateNormalizationPolicyFailureCode;
      normalizationPolicyId: string | null;
      aggregationPolicyId: string | null;
      factorKey: string | null;
    };
