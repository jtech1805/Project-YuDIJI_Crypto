import type { CompiledRulebookNormalizationResult } from "../types/compiled-rulebook-execution.types.js";
import type { CompiledFactorDefinitionLineage, CompiledExecutionPolicyLineage } from "../types/compiled-rulebook.types.js";
import type { VersionedNormalizationPolicy } from "../types/versioned-normalization-policy.types.js";

export class CompiledRulebookNormalizationService {
  public project(request: Readonly<{ aggregate: number; lineage: CompiledExecutionPolicyLineage; factor: CompiledFactorDefinitionLineage; policy: VersionedNormalizationPolicy }>): CompiledRulebookNormalizationResult | null {
    const { aggregate, lineage, factor, policy } = request;
    if (!Number.isFinite(aggregate) || aggregate < 0 || aggregate > 100 || !compatible(policy, lineage, factor.factorKey)) return null;
    return freeze({ normalizationPolicyId: lineage.normalizationPolicyId, normalizationPolicyVersion: lineage.normalizationPolicyVersion,
      aggregationPolicyId: lineage.aggregationPolicyId, aggregationPolicyVersion: lineage.aggregationPolicyVersion, factor: { ...factor },
      inputRange: { minimumScore: 0, maximumScore: 100 }, outputRange: { minimumScore: 0, maximumScore: 100 }, aggregateScore: aggregate,
      normalizedScore: aggregate, method: "ALREADY_NORMALIZED_WEIGHTED_MEAN", precisionPolicy: "PRESERVE_NATIVE" });
  }
}
export const compatible = (p: VersionedNormalizationPolicy, l: CompiledExecutionPolicyLineage, factorKey: string): boolean => p.compileEligible === true
  && p.definition.normalizationPolicyId === l.normalizationPolicyId && p.definition.normalizationPolicyVersion === l.normalizationPolicyVersion
  && p.definition.factorKey === factorKey && p.definition.method === "PIECEWISE_LINEAR_ZERO_ANCHORED" && p.definition.outOfRangePolicy === "FAIL"
  && p.definition.precisionPolicy === "PRESERVE_NATIVE" && p.definition.targetRange.minimumScore === 0 && p.definition.targetRange.neutralScore === 50 && p.definition.targetRange.maximumScore === 100;
const freeze = <T>(v: T): T => { if (typeof v !== "object" || v === null || Object.isFrozen(v)) return v; for (const x of Object.values(v)) freeze(x); return Object.freeze(v); };
