import type { FactorKey } from "./factor-registry.types.js";
import type { FactorProviderBinding, ProviderKey, ProviderType, ValidatedProviderCatalog } from "./provider-definition.types.js";
import type { ProviderHealthAssessmentSuccess, ProviderHealthState } from "./provider-health.types.js";
import type { ProviderResolutionWarningCode, ValidatedProviderResolutionPolicy } from "./provider-resolution-policy.types.js";

export type ProviderResolutionExecutionRequest = { catalog: ValidatedProviderCatalog; binding: FactorProviderBinding; healthAssessments: readonly ProviderHealthAssessmentSuccess[]; policy: ValidatedProviderResolutionPolicy };
export const PROVIDER_RESOLUTION_ATTEMPT_OUTCOMES = Object.freeze(["SELECTED", "REJECTED_HEALTH", "NOT_ATTEMPTED"] as const);
export type ProviderResolutionAttemptOutcome = (typeof PROVIDER_RESOLUTION_ATTEMPT_OUTCOMES)[number];
export type ProviderResolutionAttempt = { order: number; providerKey: ProviderKey; providerType: ProviderType; healthState: ProviderHealthState; outcome: ProviderResolutionAttemptOutcome };
type ResolutionBase = { factorKey: FactorKey; policyId: string; policyVersion: number; requestedProviderKey: ProviderKey; confidenceAdjustment: number; warningCodes: readonly ProviderResolutionWarningCode[]; attempts: readonly ProviderResolutionAttempt[] };
export type ProviderResolutionSelectedResult = ResolutionBase & { resolved: true; selectedProviderKey: ProviderKey; selectedProviderType: ProviderType; selectedProviderOrder: number; resolutionStatus: "RESOLVED" | "DEGRADED_PRIMARY_USED" | "FALLBACK_USED" | "PROXY_USED" };
export type ProviderResolutionNoProviderResult = ResolutionBase & { resolved: false; selectedProviderKey: null; selectedProviderType: null; selectedProviderOrder: null; resolutionStatus: "MANUAL_REQUIRED" | "UNRESOLVED" };
export const PROVIDER_RESOLUTION_EXECUTION_FAILURE_CODES = Object.freeze(["INVALID_REQUEST", "INVALID_CATALOG_BOUNDARY", "INVALID_BINDING_BOUNDARY", "INVALID_POLICY_BOUNDARY", "INVALID_HEALTH_ASSESSMENTS_BOUNDARY", "FACTOR_MISMATCH", "BINDING_NOT_IN_CATALOG", "BOUND_PROVIDER_MISSING_FROM_CATALOG", "HEALTH_ASSESSMENT_MISSING", "DUPLICATE_HEALTH_ASSESSMENT", "UNEXPECTED_HEALTH_ASSESSMENT", "HEALTH_PROVIDER_MISMATCH", "INVALID_RESOLUTION_STATE"] as const);
export type ProviderResolutionExecutionFailureCode = (typeof PROVIDER_RESOLUTION_EXECUTION_FAILURE_CODES)[number];
export type ProviderResolutionExecutionFailure = { executed: false; code: ProviderResolutionExecutionFailureCode; factorKey: string | null; policyId: string | null };
export type ProviderResolutionExecutionResult = { executed: true; result: ProviderResolutionSelectedResult | ProviderResolutionNoProviderResult } | ProviderResolutionExecutionFailure;
