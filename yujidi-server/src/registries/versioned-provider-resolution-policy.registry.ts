import type { ProviderResolutionPolicyService } from "../services/providers/provider-resolution-policy.service.js";
import { VersionedProviderResolutionPolicyRegistryError, type ProviderResolutionPolicyRegistration, type VersionedProviderResolutionPolicy, type VersionedProviderResolutionPolicyRegistry } from "../types/versioned-provider-resolution-policy.types.js";
import { ImmutableHistoricalAuthority } from "./historical-authority.internal.js";
const ID = /^[A-Z0-9_]{1,120}$/;
export const DEFAULT_VERSIONED_PROVIDER_RESOLUTION_POLICIES: readonly ProviderResolutionPolicyRegistration[] = Object.freeze([]);
export class StaticVersionedProviderResolutionPolicyRegistry implements VersionedProviderResolutionPolicyRegistry {
  private readonly authority: ImmutableHistoricalAuthority<VersionedProviderResolutionPolicy>;
  public constructor(values: readonly ProviderResolutionPolicyRegistration[], validator: Pick<ProviderResolutionPolicyService, "validate">) {
    if (!Array.isArray(values) || !dense(values) || !validator || typeof validator.validate !== "function") throw new VersionedProviderResolutionPolicyRegistryError("INVALID_COLLECTION");
    const seen = new Set<string>(); const entries = [];
    for (const value of values as readonly unknown[]) {
      if (!record(value)) throw new VersionedProviderResolutionPolicyRegistryError("INVALID_POLICY");
      if (!record(value.definition) || !positive(value.definition.policyVersion)) throw new VersionedProviderResolutionPolicyRegistryError("INVALID_POLICY");
      const result = validator.validate(value.definition); if (!result.valid) throw new VersionedProviderResolutionPolicyRegistryError("INVALID_POLICY");
      if (typeof value.compileEligible !== "boolean") throw new VersionedProviderResolutionPolicyRegistryError("INVALID_COMPILE_ELIGIBILITY");
      const key = `${result.policy.policyId}:${result.policy.policyVersion}`; if (seen.has(key)) throw new VersionedProviderResolutionPolicyRegistryError("DUPLICATE_VERSION"); seen.add(key);
      if (value.liveExecutionEligible !== undefined && typeof value.liveExecutionEligible !== "boolean") throw new VersionedProviderResolutionPolicyRegistryError("INVALID_POLICY");
      if (value.replayFixtureEligible !== undefined && typeof value.replayFixtureEligible !== "boolean") throw new VersionedProviderResolutionPolicyRegistryError("INVALID_POLICY");
      entries.push({ id: result.policy.policyId, version: result.policy.policyVersion, value: { definition: result.policy, compileEligible: value.compileEligible, liveExecutionEligible: value.liveExecutionEligible ?? true, replayFixtureEligible: value.replayFixtureEligible ?? false } });
    } this.authority = new ImmutableHistoricalAuthority(entries);
  }
  public getExact(id: string, version: number) { return identifier(id) && positive(version) ? this.authority.getExact(id, version) : null; }
  public getLatest(id: string) { return identifier(id) ? this.authority.getLatest(id) : null; }
  public listVersions(id: string) { return identifier(id) ? this.authority.listVersions(id) : Object.freeze([]); }
}
const identifier = (v: unknown): v is string => typeof v === "string" && ID.test(v); const positive = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) > 0; const record = (v: unknown): v is Record<string, any> => typeof v === "object" && v !== null && !Array.isArray(v); const dense = (v: readonly unknown[]) => v.every((_, i) => i in v);
