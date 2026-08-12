import { FACTOR_DECISION_BAND_LABELS, type FactorDecisionBandDefinition,
  type ValidatedFactorDecisionBandPolicy } from "../../types/factor-decision-band.types.js";
import type { FactorAggregateNormalizationExecutionSuccess } from "../../types/factor-aggregate-normalization-execution.types.js";
import type { FactorDecisionBandExecutionFailureCode, FactorDecisionBandExecutionResult } from "../../types/factor-decision-band-execution.types.js";
import { matchDecisionBands } from "./decision-band-classification-core.js";

const ID = /^[A-Z0-9_]+$/;
export class FactorDecisionBandExecutionService {
  public execute(request: unknown): FactorDecisionBandExecutionResult {
    if (!record(request) || !("policy" in request) || !("normalization" in request)) return failure("INVALID_REQUEST", null, null, null);
    const policy = request.policy; const normalization = request.normalization;
    const bandId = safeId(policy, "decisionBandPolicyId"); const normalizationId = safeId(normalization, "normalizationPolicyId");
    const factor = safeString(normalization, "factorKey");
    if (!validPolicyBoundary(policy)) return failure("INVALID_VALIDATED_POLICY", bandId, normalizationId, factor);
    if (!validNormalizationBoundary(normalization)) return failure("INVALID_NORMALIZATION_RESULT", policy.decisionBandPolicyId, normalizationId, factor);
    if (policy.normalizationPolicyId !== normalization.normalizationPolicyId
      || policy.normalizationPolicyVersion !== normalization.normalizationPolicyVersion) return failure("NORMALIZATION_POLICY_MISMATCH", policy.decisionBandPolicyId, normalization.normalizationPolicyId, normalization.factorKey);
    if (policy.factorKey !== normalization.factorKey) return failure("FACTOR_MISMATCH", policy.decisionBandPolicyId, normalization.normalizationPolicyId, normalization.factorKey);
    if (policy.normalizedRange.minimumScore !== normalization.targetRange.minimumScore
      || policy.normalizedRange.maximumScore !== normalization.targetRange.maximumScore) return failure("NORMALIZED_RANGE_MISMATCH", policy.decisionBandPolicyId, normalization.normalizationPolicyId, normalization.factorKey);
    const score = normalization.normalizedScore;
    if (!finite(score)) return failure("NON_FINITE_NORMALIZED_SCORE", policy.decisionBandPolicyId, normalization.normalizationPolicyId, normalization.factorKey);
    if (score < policy.normalizedRange.minimumScore || score > policy.normalizedRange.maximumScore) return failure("NORMALIZED_SCORE_OUT_OF_RANGE", policy.decisionBandPolicyId, normalization.normalizationPolicyId, normalization.factorKey);
    const matches = matchDecisionBands(policy.bands, score);
    if (matches.length === 0) return failure("NO_MATCHING_BAND", policy.decisionBandPolicyId, normalization.normalizationPolicyId, normalization.factorKey);
    if (matches.length > 1) return failure("MULTIPLE_MATCHING_BANDS", policy.decisionBandPolicyId, normalization.normalizationPolicyId, normalization.factorKey);
    const band = matches[0]!;
    return Object.freeze({ classified: true,
      decisionBandPolicyId: policy.decisionBandPolicyId, decisionBandPolicyVersion: policy.decisionBandPolicyVersion,
      normalizationPolicyId: normalization.normalizationPolicyId, normalizationPolicyVersion: normalization.normalizationPolicyVersion,
      aggregationPolicyId: normalization.aggregationPolicyId, aggregationPolicyVersion: normalization.aggregationPolicyVersion,
      planId: normalization.planId, planVersion: normalization.planVersion, factorKey: normalization.factorKey,
      normalizedRange: Object.freeze({ ...policy.normalizedRange }), normalizedScore: score,
      band: Object.freeze({ ...band, minimumInclusive: true as const }),
    });
  }
}
const validPolicyBoundary = (v: unknown): v is ValidatedFactorDecisionBandPolicy => record(v)
  && identifier(v.decisionBandPolicyId) && positiveInt(v.decisionBandPolicyVersion)
  && identifier(v.normalizationPolicyId) && positiveInt(v.normalizationPolicyVersion) && trimmed(v.factorKey)
  && record(v.normalizedRange) && finite(v.normalizedRange.minimumScore) && finite(v.normalizedRange.maximumScore)
  && v.normalizedRange.minimumScore < v.normalizedRange.maximumScore && Array.isArray(v.bands)
  && dense(v.bands) && v.bands.length === 5 && v.bands.every((band: unknown, i: number) => validBand(band, i));
const validBand = (v: unknown, i: number): v is FactorDecisionBandDefinition => record(v)
  && positiveInt(v.order) && FACTOR_DECISION_BAND_LABELS.includes(v.label)
  && finite(v.minimumScore) && finite(v.maximumScore) && v.minimumScore < v.maximumScore
  && v.minimumInclusive === true && typeof v.maximumInclusive === "boolean" && v.order === i + 1;
const validNormalizationBoundary = (v: unknown): v is FactorAggregateNormalizationExecutionSuccess => record(v)
  && v.normalized === true && identifier(v.normalizationPolicyId) && positiveInt(v.normalizationPolicyVersion)
  && identifier(v.aggregationPolicyId) && positiveInt(v.aggregationPolicyVersion)
  && identifier(v.planId) && positiveInt(v.planVersion) && trimmed(v.factorKey)
  && v.method === "PIECEWISE_LINEAR_ZERO_ANCHORED" && record(v.sourceRange) && record(v.targetRange)
  && finite(v.targetRange.minimumScore) && finite(v.targetRange.neutralScore) && finite(v.targetRange.maximumScore)
  && v.targetRange.minimumScore < v.targetRange.neutralScore && v.targetRange.neutralScore < v.targetRange.maximumScore
  && ["LOWER", "NEUTRAL", "UPPER"].includes(v.segment) && v.outOfRangePolicy === "FAIL"
  && v.precisionPolicy === "PRESERVE_NATIVE";
const failure = (code: FactorDecisionBandExecutionFailureCode, decisionBandPolicyId: string | null,
  normalizationPolicyId: string | null, factorKey: string | null): FactorDecisionBandExecutionResult => Object.freeze({ classified: false, decisionBandPolicyId, normalizationPolicyId, factorKey, code });
const record = (v: unknown): v is Record<string, any> => typeof v === "object" && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const positiveInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0;
const identifier = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 120 && v.trim() === v && ID.test(v);
const trimmed = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.trim() === v;
const dense = (v: readonly unknown[]) => { for (let i = 0; i < v.length; i += 1) if (!(i in v)) return false; return true; };
const safeId = (v: unknown, key: string): string | null => record(v) && identifier(v[key]) ? v[key] : null;
const safeString = (v: unknown, key: string): string | null => record(v) && trimmed(v[key]) ? v[key] : null;
