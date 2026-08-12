import type { FactorContributionAggregationPolicy, ValidatedFactorContributionAggregationPolicy } from "./factor-contribution-aggregation.types.js";
import type { ValidatedFactorEvaluatorExecutionPlan } from "./factor-evaluator-execution-plan.types.js";
export type VersionedAggregationPolicy = Readonly<{ definition: ValidatedFactorContributionAggregationPolicy; compileEligible: boolean }>;
export type AggregationPolicyRegistration = Readonly<{ definition: FactorContributionAggregationPolicy; plan: ValidatedFactorEvaluatorExecutionPlan; compileEligible: boolean }>;
export interface VersionedAggregationPolicyRegistry { getExact(id: string, version: number): VersionedAggregationPolicy | null; getLatest(id: string): VersionedAggregationPolicy | null; listVersions(id: string): readonly VersionedAggregationPolicy[]; }
export type VersionedAggregationPolicyRegistryErrorCode = "INVALID_COLLECTION" | "INVALID_POLICY" | "INVALID_COMPILE_ELIGIBILITY" | "DUPLICATE_VERSION";
export class VersionedAggregationPolicyRegistryError extends Error { public constructor(public readonly code: VersionedAggregationPolicyRegistryErrorCode) { super(`Versioned aggregation-policy authority failed: ${code}`); this.name = "VersionedAggregationPolicyRegistryError"; } }
