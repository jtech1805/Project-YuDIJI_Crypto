import { CompiledRulebookAggregationPolicyRegistryError, type CompiledRulebookAggregationPolicyDefinition, type VersionedCompiledRulebookAggregationPolicyRegistry } from "../types/compiled-rulebook-aggregation-policy.types.js";
import { ImmutableHistoricalAuthority } from "./historical-authority.internal.js";
const ID = /^[A-Z0-9_]{1,120}$/;
export const DEFAULT_COMPILED_RULEBOOK_AGGREGATION_POLICIES: readonly CompiledRulebookAggregationPolicyDefinition[] = Object.freeze([]);
export class StaticVersionedCompiledRulebookAggregationPolicyRegistry implements VersionedCompiledRulebookAggregationPolicyRegistry {
  private readonly authority: ImmutableHistoricalAuthority<CompiledRulebookAggregationPolicyDefinition>;
  public constructor(values: readonly CompiledRulebookAggregationPolicyDefinition[]) {
    if (!Array.isArray(values) || !values.every((_, index) => index in values)) throw new CompiledRulebookAggregationPolicyRegistryError("INVALID_COLLECTION");
    const seen = new Set<string>(); const entries = [];
    for (const value of values as readonly unknown[]) {
      if (!valid(value)) throw new CompiledRulebookAggregationPolicyRegistryError("INVALID_POLICY");
      const key = `${value.policyId}:${value.policyVersion}`;
      if (seen.has(key)) throw new CompiledRulebookAggregationPolicyRegistryError("DUPLICATE_VERSION");
      seen.add(key); entries.push({ id: value.policyId, version: value.policyVersion, value });
    }
    this.authority = new ImmutableHistoricalAuthority(entries);
  }
  public getExact(id: string, version: number) { return ID.test(id) && positive(version) ? this.authority.getExact(id, version) : null; }
  public getLatest(id: string) { return ID.test(id) ? this.authority.getLatest(id) : null; }
  public listVersions(id: string) { return ID.test(id) ? this.authority.listVersions(id) : Object.freeze([]); }
}
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
const valid = (value: unknown): value is CompiledRulebookAggregationPolicyDefinition => typeof value === "object" && value !== null && !Array.isArray(value) && ID.test((value as any).policyId) && positive((value as any).policyVersion) && (value as any).strategy === "COMPILED_WEIGHTED_MEAN" && (value as any).partialWeightBehavior === "RETAIN_IN_DENOMINATOR" && (value as any).omittedWeightBehavior === "REMOVE_FROM_DENOMINATOR" && typeof (value as any).compileEligible === "boolean";
