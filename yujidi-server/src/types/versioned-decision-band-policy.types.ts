import type { FactorDecisionBandPolicy, ValidatedFactorDecisionBandPolicy } from "./factor-decision-band.types.js";
import type { ValidatedFactorAggregateNormalizationPolicy } from "./factor-aggregate-normalization.types.js";
export type VersionedDecisionBandPolicy = Readonly<{ definition: ValidatedFactorDecisionBandPolicy; compileEligible: boolean }>;
export type DecisionBandPolicyRegistration = Readonly<{ definition: FactorDecisionBandPolicy; normalizationPolicy: ValidatedFactorAggregateNormalizationPolicy; compileEligible: boolean }>;
export interface VersionedDecisionBandPolicyRegistry { getExact(id: string, version: number): VersionedDecisionBandPolicy | null; getLatest(id: string): VersionedDecisionBandPolicy | null; listVersions(id: string): readonly VersionedDecisionBandPolicy[]; }
export type VersionedDecisionBandPolicyRegistryErrorCode = "INVALID_COLLECTION" | "INVALID_POLICY" | "INVALID_COMPILE_ELIGIBILITY" | "DUPLICATE_VERSION";
export class VersionedDecisionBandPolicyRegistryError extends Error { public constructor(public readonly code: VersionedDecisionBandPolicyRegistryErrorCode) { super(`Versioned decision-band-policy authority failed: ${code}`); this.name = "VersionedDecisionBandPolicyRegistryError"; } }
