export const COMPILED_RULEBOOK_AGGREGATION_STRATEGIES = Object.freeze(["COMPILED_WEIGHTED_MEAN"] as const);
export type CompiledRulebookAggregationPolicyDefinition = Readonly<{
  policyId: string;
  policyVersion: number;
  strategy: "COMPILED_WEIGHTED_MEAN";
  partialWeightBehavior: "RETAIN_IN_DENOMINATOR";
  omittedWeightBehavior: "REMOVE_FROM_DENOMINATOR";
  compileEligible: boolean;
}>;
export interface VersionedCompiledRulebookAggregationPolicyRegistry {
  getExact(id: string, version: number): CompiledRulebookAggregationPolicyDefinition | null;
  getLatest(id: string): CompiledRulebookAggregationPolicyDefinition | null;
  listVersions(id: string): readonly CompiledRulebookAggregationPolicyDefinition[];
}
export type CompiledRulebookAggregationPolicyRegistryErrorCode = "INVALID_COLLECTION" | "INVALID_POLICY" | "DUPLICATE_VERSION";
export class CompiledRulebookAggregationPolicyRegistryError extends Error {
  public constructor(public readonly code: CompiledRulebookAggregationPolicyRegistryErrorCode) {
    super(`Compiled rulebook aggregation-policy authority failed: ${code}`);
    this.name = "CompiledRulebookAggregationPolicyRegistryError";
  }
}
