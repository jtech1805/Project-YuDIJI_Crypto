import type { CompiledRulebookDecisionResult, CompiledRulebookNormalizationResult } from "../../types/compiled-rulebook-execution.types.js";
import type { VersionedDecisionBandPolicy } from "../../types/versioned-decision-band-policy.types.js";
import { matchDecisionBands } from "../scoring/decision-band-classification-core.js";
export type CompiledDecisionProjection = Readonly<{ classified: true; result: CompiledRulebookDecisionResult }> | Readonly<{ classified: false; code: "COMPILED_DECISION_INVALID_NORMALIZATION" | "COMPILED_DECISION_NO_MATCHING_BAND" | "COMPILED_DECISION_MULTIPLE_MATCHING_BANDS" }>;
export class CompiledRulebookDecisionClassificationService {
  public classify(normalization: CompiledRulebookNormalizationResult, policy: VersionedDecisionBandPolicy): CompiledDecisionProjection {
    const p = policy.definition;
    if (!policy.compileEligible || p.normalizationPolicyId !== normalization.normalizationPolicyId || p.normalizationPolicyVersion !== normalization.normalizationPolicyVersion || p.factorKey !== normalization.factor.factorKey || p.normalizedRange.minimumScore !== 0 || p.normalizedRange.maximumScore !== 100 || !Number.isFinite(normalization.normalizedScore)) return Object.freeze({ classified: false, code: "COMPILED_DECISION_INVALID_NORMALIZATION" });
    const matches = matchDecisionBands(p.bands, normalization.normalizedScore);
    if (matches.length === 0) return Object.freeze({ classified: false, code: "COMPILED_DECISION_NO_MATCHING_BAND" });
    if (matches.length > 1) return Object.freeze({ classified: false, code: "COMPILED_DECISION_MULTIPLE_MATCHING_BANDS" });
    return Object.freeze({ classified: true, result: freeze({ decisionBandPolicyId: p.decisionBandPolicyId, decisionBandPolicyVersion: p.decisionBandPolicyVersion, normalizationPolicyId: p.normalizationPolicyId, normalizationPolicyVersion: p.normalizationPolicyVersion, factor: { ...normalization.factor }, normalizedScore: normalization.normalizedScore, band: { ...matches[0]! } }) });
  }
}
const freeze = <T>(v: T): T => { if (typeof v !== "object" || v === null || Object.isFrozen(v)) return v; for (const x of Object.values(v)) freeze(x); return Object.freeze(v); };
