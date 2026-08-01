import type { ValidatedFactorAggregateNormalizationPolicy } from "./factor-aggregate-normalization.types.js";
import type { FactorKey } from "./factor-registry.types.js";

export const FACTOR_DECISION_BAND_LABELS = [
  "STRONG_NEGATIVE", "NEGATIVE", "NEUTRAL", "POSITIVE", "STRONG_POSITIVE",
] as const;
export type FactorDecisionBandLabel = (typeof FACTOR_DECISION_BAND_LABELS)[number];

export type FactorDecisionBandPolicyIdentity = {
  decisionBandPolicyId: string;
  decisionBandPolicyVersion: number;
};
export type FactorDecisionBandDefinition = {
  order: number;
  label: FactorDecisionBandLabel;
  minimumScore: number;
  maximumScore: number;
  minimumInclusive: boolean;
  maximumInclusive: boolean;
};
export type FactorDecisionBandPolicy = FactorDecisionBandPolicyIdentity & {
  normalizationPolicyId: string;
  normalizationPolicyVersion: number;
  factorKey: FactorKey;
  normalizedRange: { minimumScore: number; maximumScore: number };
  bands: readonly FactorDecisionBandDefinition[];
};
export type ValidatedFactorDecisionBandPolicy = FactorDecisionBandPolicy;
export type FactorDecisionBandPolicyValidationRequest = {
  policy: unknown;
  normalizationPolicy: ValidatedFactorAggregateNormalizationPolicy;
};
export const FACTOR_DECISION_BAND_POLICY_FAILURE_CODES = [
  "INVALID_REQUEST", "INVALID_NORMALIZATION_POLICY", "INVALID_DECISION_BAND_POLICY",
  "INVALID_POLICY_ID", "INVALID_POLICY_VERSION", "NORMALIZATION_POLICY_MISMATCH",
  "FACTOR_MISMATCH", "NORMALIZED_RANGE_MISMATCH", "INVALID_BAND_COUNT", "INVALID_BAND",
  "INVALID_BAND_ORDER", "DUPLICATE_BAND_LABEL", "INVALID_BAND_LABEL_ORDER",
  "INVALID_BAND_BOUNDARY", "BAND_GAP", "BAND_OVERLAP", "INCOMPLETE_RANGE_COVERAGE",
  "INVALID_BOUNDARY_INCLUSIVITY",
] as const;
export type FactorDecisionBandPolicyFailureCode =
  (typeof FACTOR_DECISION_BAND_POLICY_FAILURE_CODES)[number];
export type FactorDecisionBandPolicyValidationResult =
  | { valid: true; policy: ValidatedFactorDecisionBandPolicy }
  | { valid: false; code: FactorDecisionBandPolicyFailureCode; decisionBandPolicyId: string | null;
      normalizationPolicyId: string | null; factorKey: string | null };
