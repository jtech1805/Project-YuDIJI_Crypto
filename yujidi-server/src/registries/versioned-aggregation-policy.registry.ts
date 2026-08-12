import type { FactorContributionAggregationPolicyService } from "../services/scoring/factor-contribution-aggregation-policy.service.js";
import { VersionedAggregationPolicyRegistryError, type AggregationPolicyRegistration, type VersionedAggregationPolicy, type VersionedAggregationPolicyRegistry } from "../types/versioned-aggregation-policy.types.js";
import { ImmutableHistoricalAuthority } from "./historical-authority.internal.js";
const ID = /^[A-Z0-9_]{1,120}$/;
export const DEFAULT_VERSIONED_AGGREGATION_POLICIES: readonly AggregationPolicyRegistration[] = Object.freeze([]);
export class StaticVersionedAggregationPolicyRegistry implements VersionedAggregationPolicyRegistry {
  private readonly authority: ImmutableHistoricalAuthority<VersionedAggregationPolicy>;
  public constructor(values: readonly AggregationPolicyRegistration[], validator: Pick<FactorContributionAggregationPolicyService, "validate">) {
    if (!Array.isArray(values) || !dense(values) || !validator || typeof validator.validate !== "function") throw new VersionedAggregationPolicyRegistryError("INVALID_COLLECTION");
    const seen = new Set<string>(); const entries = [];
    for (const value of values as readonly unknown[]) { if (!record(value) || !record(value.definition) || !positive(value.definition.policyVersion)) throw new VersionedAggregationPolicyRegistryError("INVALID_POLICY"); const result = validator.validate({ policy: value.definition, plan: value.plan }); if (!result.valid) throw new VersionedAggregationPolicyRegistryError("INVALID_POLICY"); if (typeof value.compileEligible !== "boolean") throw new VersionedAggregationPolicyRegistryError("INVALID_COMPILE_ELIGIBILITY"); const key = `${result.policy.policyId}:${result.policy.policyVersion}`; if (seen.has(key)) throw new VersionedAggregationPolicyRegistryError("DUPLICATE_VERSION"); seen.add(key); entries.push({ id: result.policy.policyId, version: result.policy.policyVersion, value: { definition: result.policy, compileEligible: value.compileEligible } }); } this.authority = new ImmutableHistoricalAuthority(entries);
  }
  public getExact(id: string, version: number) { return identifier(id) && positive(version) ? this.authority.getExact(id, version) : null; } public getLatest(id: string) { return identifier(id) ? this.authority.getLatest(id) : null; } public listVersions(id: string) { return identifier(id) ? this.authority.listVersions(id) : Object.freeze([]); }
}
const identifier = (v: unknown): v is string => typeof v === "string" && ID.test(v); const positive = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) > 0; const record = (v: unknown): v is Record<string, any> => typeof v === "object" && v !== null && !Array.isArray(v); const dense = (v: readonly unknown[]) => v.every((_, i) => i in v);
