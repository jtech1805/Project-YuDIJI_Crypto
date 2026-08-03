import type { FactorAggregateNormalizationPolicy, ValidatedFactorAggregateNormalizationPolicy } from "./factor-aggregate-normalization.types.js";
import type { ValidatedFactorContributionAggregationPolicy } from "./factor-contribution-aggregation.types.js";
export type VersionedNormalizationPolicy = Readonly<{ definition: ValidatedFactorAggregateNormalizationPolicy; compileEligible: boolean }>;
export type NormalizationPolicyRegistration = Readonly<{ definition: FactorAggregateNormalizationPolicy; aggregationPolicy: ValidatedFactorContributionAggregationPolicy; compileEligible: boolean }>;
export interface VersionedNormalizationPolicyRegistry { getExact(id: string, version: number): VersionedNormalizationPolicy | null; getLatest(id: string): VersionedNormalizationPolicy | null; listVersions(id: string): readonly VersionedNormalizationPolicy[]; }
export type VersionedNormalizationPolicyRegistryErrorCode = "INVALID_COLLECTION" | "INVALID_POLICY" | "INVALID_COMPILE_ELIGIBILITY" | "DUPLICATE_VERSION";
export class VersionedNormalizationPolicyRegistryError extends Error { public constructor(public readonly code: VersionedNormalizationPolicyRegistryErrorCode) { super(`Versioned normalization-policy authority failed: ${code}`); this.name = "VersionedNormalizationPolicyRegistryError"; } }
