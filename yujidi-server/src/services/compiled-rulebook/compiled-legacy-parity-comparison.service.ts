import { PARITY_DIAGNOSTIC_FIELDS, type CompiledLegacyParityComparisonRequest, type CompiledLegacyParityComparisonResult, type CompiledLegacyParityPolicy, type CompiledLegacyParityResult, type NumericParityResult, type ParitySemanticDimensionPolicy, type SemanticParityDimensionResult } from "../../types/compiled-legacy-parity.types.js";
import { CompiledLegacyParityPolicyService } from "./compiled-legacy-parity-policy.service.js";

export class CompiledLegacyParityComparisonService {
  public constructor(private readonly policies = new CompiledLegacyParityPolicyService()) {}
  public compare(request: unknown): CompiledLegacyParityComparisonResult {
    if (!record(request) || !("policy" in request) || !record(request.legacy) || !record(request.compiled) || !record(request.legacyNumericEligibility) || typeof request.legacyNumericEligibility.eligible !== "boolean" || !(request.legacyNumericEligibility.reasonCode === null || semantic(request.legacyNumericEligibility.reasonCode))) return failure("INVALID_COMPARISON_REQUEST");
    const validated = this.policies.validate(request.policy); if (!validated.valid) return failure("INVALID_PARITY_POLICY");
    if (!validLegacy(request.legacy)) return failure("INVALID_LEGACY_RESULT");
    if (!validCompiled(request.compiled)) return failure("INVALID_COMPILED_RESULT");
    const typed = request as CompiledLegacyParityComparisonRequest; const p = validated.policy;
    const numeric = compareNumeric(p, typed); const dimensions = p.semanticDimensions.map((dimension) => compareSemantic(dimension, typed));
    const requested = [...(p.numeric.enabled ? [numeric.status] : []), ...dimensions.map((d) => d.status)];
    const comparable = requested.filter((status) => status === "MATCH" || status === "MISMATCH").length;
    const overallComparability: CompiledLegacyParityResult["overallComparability"] = comparable === 0 ? "NOT_COMPARABLE" : comparable === requested.length ? "FULLY_COMPARABLE" : "PARTIALLY_COMPARABLE";
    const result: CompiledLegacyParityResult = { policy: { policyId: p.policyId, policyVersion: p.policyVersion }, overallComparability,
      legacyProjection: { score: typed.legacy.score, permission: typed.legacy.permission, scoreStatus: typed.legacy.scoreStatus, dataConfidence: typed.legacy.dataConfidence },
      compiledProjection: { normalizedScore: typed.compiled.normalizedScore, executionStatus: typed.compiled.status, decisionBand: typed.compiled.decisionBand?.label ?? null, evaluatedAt: typed.compiled.evaluatedAt ? new Date(typed.compiled.evaluatedAt.getTime()) : null },
      numeric, semanticDimensions: dimensions,
      nonComparableDiagnostics: PARITY_DIAGNOSTIC_FIELDS.map((field) => ({ field, classification: "DIAGNOSTIC_ONLY", reasonCode: "STRUCTURALLY_OR_SEMANTICALLY_NON_COMPARABLE" })),
      warnings: Object.freeze([]), reasonCodes: Object.freeze([overallComparability]), };
    return deepFreeze({ compared: true, result });
  }
}
const compareNumeric = (p: CompiledLegacyParityPolicy, r: CompiledLegacyParityComparisonRequest): NumericParityResult => {
  const legacyOriginal = r.legacy.score; const compiledOriginal = r.compiled.normalizedScore;
  if (!p.numeric.enabled) return frozenNumeric("UNAVAILABLE", "NUMERIC_COMPARISON_DISABLED", legacyOriginal, compiledOriginal, null, null);
  if (!r.legacyNumericEligibility.eligible) return frozenNumeric("UNAVAILABLE", r.legacyNumericEligibility.reasonCode ?? "LEGACY_NUMERIC_INELIGIBLE", legacyOriginal, compiledOriginal, null, null);
  if (compiledOriginal === null) return frozenNumeric("UNAVAILABLE", "COMPILED_NORMALIZED_SCORE_UNAVAILABLE", legacyOriginal, null, canonical(legacyOriginal, p.numeric.canonicalization.decimalPlaces), null);
  const legacyCanonical = canonical(legacyOriginal, p.numeric.canonicalization.decimalPlaces); const compiledCanonical = canonical(compiledOriginal, p.numeric.canonicalization.decimalPlaces);
  return frozenNumeric(legacyCanonical === compiledCanonical ? "MATCH" : "MISMATCH", legacyCanonical === compiledCanonical ? "NUMERIC_EXACT_MATCH" : "NUMERIC_EXACT_MISMATCH", legacyOriginal, compiledOriginal, legacyCanonical, compiledCanonical);
};
const compareSemantic = (p: ParitySemanticDimensionPolicy, r: CompiledLegacyParityComparisonRequest): SemanticParityDimensionResult => {
  const legacyValue = p.legacySource === "PERMISSION" ? r.legacy.permission : r.legacy.scoreStatus;
  const compiledValue = p.compiledSource === "DECISION_BAND" ? r.compiled.decisionBand?.label ?? null : r.compiled.status;
  if (compiledValue === null) return Object.freeze({ dimensionId: p.dimensionId, legacySource: p.legacySource, compiledSource: p.compiledSource, legacyValue, compiledValue, status: "UNAVAILABLE", reasonCode: "COMPILED_SEMANTIC_SOURCE_UNAVAILABLE" });
  const mapping = p.mappings.find((m) => m.legacyValue === legacyValue && m.compiledValue === compiledValue);
  if (!mapping) return Object.freeze({ dimensionId: p.dimensionId, legacySource: p.legacySource, compiledSource: p.compiledSource, legacyValue, compiledValue, status: "UNMAPPABLE", reasonCode: "SEMANTIC_PAIR_UNMAPPED" });
  return Object.freeze({ dimensionId: p.dimensionId, legacySource: p.legacySource, compiledSource: p.compiledSource, legacyValue, compiledValue, status: mapping.outcome, reasonCode: mapping.outcome === "MATCH" ? "SEMANTIC_MAPPING_MATCH" : "SEMANTIC_MAPPING_MISMATCH" });
};
const validLegacy = (v: Record<string, any>) => finite(v.score) && semantic(v.permission) && semantic(v.scoreStatus) && semantic(v.dataConfidence) && Array.isArray(v.reasonCodes) && dense(v.reasonCodes) && v.reasonCodes.every(semantic) && Array.isArray(v.warnings) && dense(v.warnings) && v.warnings.every(semantic) && record(v.breakdown);
const validCompiled = (v: Record<string, any>) => ["COMPLETED", "PARTIAL", "BLOCKED", "INSUFFICIENT_INPUT"].includes(v.status) && (v.normalizedScore === null || finite(v.normalizedScore)) && (v.decisionBand === null || record(v.decisionBand)) && (v.evaluatedAt === null || validDate(v.evaluatedAt)) && Array.isArray(v.bindingTraces) && record(v.counts);
const canonical = (v: number, places: number) => Object.is(v, -0) || Number(v.toFixed(places)) === 0 ? (0).toFixed(places) : v.toFixed(places);
const frozenNumeric = (status: NumericParityResult["status"], reasonCode: string, legacyOriginal: number | null, compiledOriginal: number | null, legacyCanonical: string | null, compiledCanonical: string | null): NumericParityResult => Object.freeze({ status, reasonCode, legacyOriginal, compiledOriginal, legacyCanonical, compiledCanonical });
const failure = (code: Extract<CompiledLegacyParityComparisonResult, { compared: false }>["code"]): CompiledLegacyParityComparisonResult => Object.freeze({ compared: false, code });
const record = (v: unknown): v is Record<string, any> => typeof v === "object" && v !== null && !Array.isArray(v); const semantic = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 120 && v.trim() === v; const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v); const validDate = (v: unknown): v is Date => v instanceof Date && Number.isFinite(v.getTime()); const dense = (v: readonly unknown[]) => v.every((_, i) => i in v); const deepFreeze = <T>(v: T): T => { if (typeof v !== "object" || v === null || Object.isFrozen(v)) return v; for (const x of Object.values(v)) deepFreeze(x); return Object.freeze(v); };
