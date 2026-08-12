import type { CompiledLegacyParityPolicy, CompiledLegacyParityPolicyFailureCode, CompiledLegacyParityPolicyValidationResult, ParitySemanticDimensionPolicy } from "../../types/compiled-legacy-parity.types.js";

export class CompiledLegacyParityPolicyService {
  public validate(value: unknown): CompiledLegacyParityPolicyValidationResult {
    if (!record(value)) return fail("INVALID_PARITY_POLICY");
    if (!identifier(value.policyId)) return fail("INVALID_POLICY_ID");
    if (!positive(value.policyVersion)) return fail("INVALID_POLICY_VERSION");
    if (!record(value.numeric) || typeof value.numeric.enabled !== "boolean" || value.numeric.legacySource !== "SCORE" || value.numeric.compiledSource !== "NORMALIZED_SCORE" || value.numeric.forcedLegacyValueHandling !== "REQUIRE_EXPLICIT_ELIGIBILITY") return fail("INVALID_NUMERIC_POLICY");
    if (value.numeric.comparison !== "EXACT") return fail("UNSUPPORTED_NUMERIC_COMPARISON");
    if (!record(value.numeric.canonicalization) || value.numeric.canonicalization.method !== "DECIMAL_PLACES" || !Number.isSafeInteger(value.numeric.canonicalization.decimalPlaces) || value.numeric.canonicalization.decimalPlaces < 0 || value.numeric.canonicalization.decimalPlaces > 12) return fail("INVALID_NUMERIC_CANONICALIZATION");
    if (!Array.isArray(value.semanticDimensions) || !dense(value.semanticDimensions)) return fail("INVALID_SEMANTIC_DIMENSION");
    const dimensionIds = new Set<string>();
    for (const dimension of value.semanticDimensions) {
      if (!validDimension(dimension)) return fail("INVALID_SEMANTIC_DIMENSION");
      if (dimensionIds.has(dimension.dimensionId)) return fail("DUPLICATE_SEMANTIC_DIMENSION");
      dimensionIds.add(dimension.dimensionId);
      const pairs = new Map<string, string>();
      for (const mapping of dimension.mappings) {
        if (!record(mapping) || !semantic(mapping.legacyValue) || !semantic(mapping.compiledValue) || (mapping.outcome !== "MATCH" && mapping.outcome !== "MISMATCH")) return fail("INVALID_SEMANTIC_MAPPING");
        const key = `${mapping.legacyValue}\u0000${mapping.compiledValue}`; const prior = pairs.get(key);
        if (prior === mapping.outcome) return fail("DUPLICATE_SEMANTIC_MAPPING");
        if (prior !== undefined) return fail("CONTRADICTORY_SEMANTIC_MAPPING");
        pairs.set(key, mapping.outcome);
      }
    }
    return deepFreeze({ valid: true, policy: structuredClone(value as CompiledLegacyParityPolicy) });
  }
}
const validDimension = (v: unknown): v is ParitySemanticDimensionPolicy => record(v) && identifier(v.dimensionId) && (v.legacySource === "PERMISSION" || v.legacySource === "SCORE_STATUS") && (v.compiledSource === "DECISION_BAND" || v.compiledSource === "EXECUTION_STATUS") && Array.isArray(v.mappings) && dense(v.mappings) && v.mappings.length > 0;
const fail = (code: CompiledLegacyParityPolicyFailureCode): CompiledLegacyParityPolicyValidationResult => Object.freeze({ valid: false, code });
const record = (v: unknown): v is Record<string, any> => typeof v === "object" && v !== null && !Array.isArray(v); const identifier = (v: unknown): v is string => typeof v === "string" && /^[A-Z0-9_]{1,120}$/.test(v); const semantic = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 120 && v.trim() === v; const positive = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) > 0; const dense = (v: readonly unknown[]) => v.every((_, i) => i in v); const deepFreeze = <T>(v: T): T => { if (typeof v !== "object" || v === null || Object.isFrozen(v)) return v; for (const x of Object.values(v)) deepFreeze(x); return Object.freeze(v); };
