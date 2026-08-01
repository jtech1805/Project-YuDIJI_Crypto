import { FACTOR_DECISION_BAND_LABELS, type FactorDecisionBandDefinition,
  type FactorDecisionBandPolicyFailureCode, type FactorDecisionBandPolicyValidationResult,
} from "../types/factor-decision-band.types.js";
import type { ValidatedFactorAggregateNormalizationPolicy } from "../types/factor-aggregate-normalization.types.js";

const ID = /^[A-Z0-9_]+$/;
export class FactorDecisionBandPolicyService {
  public validate(request: unknown): FactorDecisionBandPolicyValidationResult {
    if (!record(request) || !("policy" in request) || !("normalizationPolicy" in request)) return failure("INVALID_REQUEST", null, null, null);
    const raw = request.policy; const normalization = request.normalizationPolicy;
    const bandId = safeId(raw, "decisionBandPolicyId");
    const normalizationId = safeId(raw, "normalizationPolicyId");
    const factor = safeString(raw, "factorKey");
    if (!validNormalization(normalization)) return failure("INVALID_NORMALIZATION_POLICY", bandId, normalizationId, factor);
    if (!record(raw)) return failure("INVALID_DECISION_BAND_POLICY", null, normalization.normalizationPolicyId, normalization.factorKey);
    if (!identifier(raw.decisionBandPolicyId)) return failure("INVALID_POLICY_ID", null, normalizationId, factor);
    if (!positiveInt(raw.decisionBandPolicyVersion)) return failure("INVALID_POLICY_VERSION", raw.decisionBandPolicyId, normalizationId, factor);
    if (raw.normalizationPolicyId !== normalization.normalizationPolicyId
      || raw.normalizationPolicyVersion !== normalization.normalizationPolicyVersion) {
      return failure("NORMALIZATION_POLICY_MISMATCH", raw.decisionBandPolicyId, normalizationId, factor);
    }
    if (raw.factorKey !== normalization.factorKey) return failure("FACTOR_MISMATCH", raw.decisionBandPolicyId, normalization.normalizationPolicyId, factor);
    if (!record(raw.normalizedRange)
      || raw.normalizedRange.minimumScore !== normalization.targetRange.minimumScore
      || raw.normalizedRange.maximumScore !== normalization.targetRange.maximumScore) {
      return failure("NORMALIZED_RANGE_MISMATCH", raw.decisionBandPolicyId, normalization.normalizationPolicyId, raw.factorKey);
    }
    if (!Array.isArray(raw.bands) || !dense(raw.bands) || raw.bands.length !== 5) return failure("INVALID_BAND_COUNT", raw.decisionBandPolicyId, normalization.normalizationPolicyId, raw.factorKey);
    for (const band of raw.bands) if (!validBandShape(band)) return failure("INVALID_BAND", raw.decisionBandPolicyId, normalization.normalizationPolicyId, raw.factorKey);
    const bands = raw.bands as FactorDecisionBandDefinition[];
    for (let i = 0; i < bands.length; i += 1) if (bands[i]!.order !== i + 1) return failure("INVALID_BAND_ORDER", raw.decisionBandPolicyId, normalization.normalizationPolicyId, raw.factorKey);
    if (new Set(bands.map((b) => b.label)).size !== bands.length) return failure("DUPLICATE_BAND_LABEL", raw.decisionBandPolicyId, normalization.normalizationPolicyId, raw.factorKey);
    for (let i = 0; i < bands.length; i += 1) if (bands[i]!.label !== FACTOR_DECISION_BAND_LABELS[i]) return failure("INVALID_BAND_LABEL_ORDER", raw.decisionBandPolicyId, normalization.normalizationPolicyId, raw.factorKey);
    for (const band of bands) if (!finite(band.minimumScore) || !finite(band.maximumScore) || band.minimumScore >= band.maximumScore) return failure("INVALID_BAND_BOUNDARY", raw.decisionBandPolicyId, normalization.normalizationPolicyId, raw.factorKey);
    for (let i = 0; i < bands.length; i += 1) if (bands[i]!.minimumInclusive !== true || bands[i]!.maximumInclusive !== (i === bands.length - 1)) return failure("INVALID_BOUNDARY_INCLUSIVITY", raw.decisionBandPolicyId, normalization.normalizationPolicyId, raw.factorKey);
    if (bands[0]!.minimumScore !== raw.normalizedRange.minimumScore
      || bands[bands.length - 1]!.maximumScore !== raw.normalizedRange.maximumScore) return failure("INCOMPLETE_RANGE_COVERAGE", raw.decisionBandPolicyId, normalization.normalizationPolicyId, raw.factorKey);
    for (let i = 1; i < bands.length; i += 1) if (bands[i]!.minimumScore > bands[i - 1]!.maximumScore) return failure("BAND_GAP", raw.decisionBandPolicyId, normalization.normalizationPolicyId, raw.factorKey);
    for (let i = 1; i < bands.length; i += 1) if (bands[i]!.minimumScore < bands[i - 1]!.maximumScore) return failure("BAND_OVERLAP", raw.decisionBandPolicyId, normalization.normalizationPolicyId, raw.factorKey);
    return Object.freeze({ valid: true, policy: Object.freeze({
      decisionBandPolicyId: raw.decisionBandPolicyId,
      decisionBandPolicyVersion: raw.decisionBandPolicyVersion,
      normalizationPolicyId: normalization.normalizationPolicyId,
      normalizationPolicyVersion: normalization.normalizationPolicyVersion,
      factorKey: normalization.factorKey,
      normalizedRange: Object.freeze({ minimumScore: raw.normalizedRange.minimumScore, maximumScore: raw.normalizedRange.maximumScore }),
      bands: Object.freeze(bands.map((band) => Object.freeze({ ...band }))),
    }) });
  }
}
const validNormalization = (v: unknown): v is ValidatedFactorAggregateNormalizationPolicy => record(v)
  && identifier(v.normalizationPolicyId) && positiveInt(v.normalizationPolicyVersion)
  && identifier(v.aggregationPolicyId) && positiveInt(v.aggregationPolicyVersion) && trimmed(v.factorKey)
  && v.method === "PIECEWISE_LINEAR_ZERO_ANCHORED" && record(v.sourceRange)
  && finite(v.sourceRange.minimumPoints) && v.sourceRange.minimumPoints < 0 && v.sourceRange.neutralPoints === 0
  && finite(v.sourceRange.maximumPoints) && v.sourceRange.maximumPoints > 0 && record(v.targetRange)
  && finite(v.targetRange.minimumScore) && finite(v.targetRange.neutralScore) && finite(v.targetRange.maximumScore)
  && v.targetRange.minimumScore < v.targetRange.neutralScore && v.targetRange.neutralScore < v.targetRange.maximumScore
  && v.outOfRangePolicy === "FAIL" && v.precisionPolicy === "PRESERVE_NATIVE";
const validBandShape = (v: unknown): v is FactorDecisionBandDefinition => record(v)
  && positiveInt(v.order) && typeof v.label === "string" && typeof v.minimumInclusive === "boolean"
  && typeof v.maximumInclusive === "boolean" && "minimumScore" in v && "maximumScore" in v;
const failure = (code: FactorDecisionBandPolicyFailureCode, decisionBandPolicyId: string | null,
  normalizationPolicyId: string | null, factorKey: string | null): FactorDecisionBandPolicyValidationResult => Object.freeze({ valid: false, code, decisionBandPolicyId, normalizationPolicyId, factorKey });
const record = (v: unknown): v is Record<string, any> => typeof v === "object" && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const positiveInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0;
const identifier = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 120 && v.trim() === v && ID.test(v);
const trimmed = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.trim() === v;
const dense = (v: readonly unknown[]) => { for (let i = 0; i < v.length; i += 1) if (!(i in v)) return false; return true; };
const safeId = (v: unknown, key: string): string | null => record(v) && identifier(v[key]) ? v[key] : null;
const safeString = (v: unknown, key: string): string | null => record(v) && trimmed(v[key]) ? v[key] : null;
