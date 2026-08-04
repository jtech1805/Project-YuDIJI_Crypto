import type { CompiledRulebookPolicyConsistencyResult } from "../types/compiled-rulebook-runtime.types.js";
import type { CompiledFactorBinding } from "../types/compiled-rulebook.types.js";
export class CompiledRulebookPolicyConsistencyService {
  public validate(bindings: unknown): CompiledRulebookPolicyConsistencyResult {
    if (!Array.isArray(bindings) || bindings.length === 0 || !bindings.every(valid)) return fail("INVALID_BINDING_COLLECTION");
    const first = bindings[0]!.executionPolicies;
    for (const binding of bindings) {
      const policy = binding.executionPolicies;
      if (policy.aggregationPolicyId !== first.aggregationPolicyId || policy.aggregationPolicyVersion !== first.aggregationPolicyVersion) return fail("INCONSISTENT_AGGREGATION_POLICY_LINEAGE");
      if (policy.normalizationPolicyId !== first.normalizationPolicyId || policy.normalizationPolicyVersion !== first.normalizationPolicyVersion) return fail("INCONSISTENT_NORMALIZATION_POLICY_LINEAGE");
      if (policy.decisionBandPolicyId !== first.decisionBandPolicyId || policy.decisionBandPolicyVersion !== first.decisionBandPolicyVersion) return fail("INCONSISTENT_DECISION_BAND_POLICY_LINEAGE");
    }
    return Object.freeze({ consistent: true, lineage: Object.freeze({ ...first }) });
  }
}
const ID = /^[A-Z0-9_]{1,120}$/;
const valid = (value: unknown): value is CompiledFactorBinding => {
  if (typeof value !== "object" || value === null || Array.isArray(value) || typeof (value as any).executionPolicies !== "object" || (value as any).executionPolicies === null) return false;
  const p = (value as any).executionPolicies;
  return ID.test(p.aggregationPolicyId) && positive(p.aggregationPolicyVersion) && ID.test(p.normalizationPolicyId) && positive(p.normalizationPolicyVersion) && ID.test(p.decisionBandPolicyId) && positive(p.decisionBandPolicyVersion);
};
const positive = (value: unknown) => Number.isSafeInteger(value) && (value as number) > 0;
const fail = (code: Extract<CompiledRulebookPolicyConsistencyResult, { consistent: false }>["code"]): CompiledRulebookPolicyConsistencyResult => Object.freeze({ consistent: false, code });
