import type { FactorAggregateNormalizationExecutionSuccess } from "./factor-aggregate-normalization-execution.types.js";
import type { FactorDecisionBandLabel, ValidatedFactorDecisionBandPolicy } from "./factor-decision-band.types.js";
import type { FactorKey } from "./factor-registry.types.js";

export type FactorDecisionBandExecutionRequest = {
  policy: ValidatedFactorDecisionBandPolicy;
  normalization: FactorAggregateNormalizationExecutionSuccess;
};
export const FACTOR_DECISION_BAND_EXECUTION_FAILURE_CODES = [
  "INVALID_REQUEST", "INVALID_VALIDATED_POLICY", "INVALID_NORMALIZATION_RESULT",
  "NORMALIZATION_POLICY_MISMATCH", "FACTOR_MISMATCH", "NORMALIZED_RANGE_MISMATCH",
  "NON_FINITE_NORMALIZED_SCORE", "NORMALIZED_SCORE_OUT_OF_RANGE", "NO_MATCHING_BAND",
  "MULTIPLE_MATCHING_BANDS",
] as const;
export type FactorDecisionBandExecutionFailureCode =
  (typeof FACTOR_DECISION_BAND_EXECUTION_FAILURE_CODES)[number];
export type FactorDecisionBandExecutionSuccess = {
  classified: true;
  decisionBandPolicyId: string;
  decisionBandPolicyVersion: number;
  normalizationPolicyId: string;
  normalizationPolicyVersion: number;
  aggregationPolicyId: string;
  aggregationPolicyVersion: number;
  planId: string;
  planVersion: number;
  factorKey: FactorKey;
  normalizedRange: { minimumScore: number; maximumScore: number };
  normalizedScore: number;
  band: { order: number; label: FactorDecisionBandLabel; minimumScore: number; maximumScore: number;
    minimumInclusive: true; maximumInclusive: boolean };
};
export type FactorDecisionBandExecutionFailure = {
  classified: false;
  decisionBandPolicyId: string | null;
  normalizationPolicyId: string | null;
  factorKey: string | null;
  code: FactorDecisionBandExecutionFailureCode;
};
export type FactorDecisionBandExecutionResult = FactorDecisionBandExecutionSuccess | FactorDecisionBandExecutionFailure;
