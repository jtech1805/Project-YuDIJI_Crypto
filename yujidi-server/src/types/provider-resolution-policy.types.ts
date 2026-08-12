import type { FactorKey } from "./factor-registry.types.js";
import type { ProviderHealthState } from "./provider-health.types.js";
import type { ProviderType } from "./provider-definition.types.js";

export const PROVIDER_RESOLUTION_STATUSES = Object.freeze([
  "RESOLVED",
  "DEGRADED_PRIMARY_USED",
  "FALLBACK_USED",
  "PROXY_USED",
  "MANUAL_REQUIRED",
  "UNRESOLVED",
] as const);
export type ProviderResolutionStatus =
  (typeof PROVIDER_RESOLUTION_STATUSES)[number];

export const PROVIDER_RESOLUTION_WARNING_CODES = Object.freeze([
  "PREFERRED_PROVIDER_DEGRADED",
  "PREFERRED_PROVIDER_UNAVAILABLE",
  "PREFERRED_PROVIDER_UNKNOWN",
  "FALLBACK_PROVIDER_SELECTED",
  "PROXY_PROVIDER_SELECTED",
  "MANUAL_PROVIDER_SELECTED",
  "DEGRADED_PROVIDER_SELECTED",
  "NO_USABLE_PROVIDER",
  "MANUAL_INTERVENTION_REQUIRED",
] as const);
export type ProviderResolutionWarningCode =
  (typeof PROVIDER_RESOLUTION_WARNING_CODES)[number];

export type ProviderHealthAcceptanceRule = {
  allowedStates: readonly ProviderHealthState[];
};

export type ProviderResolutionConfidenceAdjustments = {
  resolved: number;
  degradedPrimaryUsed: number;
  fallbackUsed: number;
  proxyUsed: number;
  manualRequired: number;
  unresolved: number;
};

export type ProviderTypeResolutionRule = {
  providerType: ProviderType;
  successStatus: ProviderResolutionStatus;
  requiredWarningCodes: readonly ProviderResolutionWarningCode[];
};

export type ProviderResolutionPolicy = {
  policyId: string;
  policyVersion: number;
  factorKey: FactorKey;
  preferredProviderRule: ProviderHealthAcceptanceRule;
  fallbackProviderRule: ProviderHealthAcceptanceRule;
  allowDegradedPreferredProvider: boolean;
  noUsableProviderOutcome: "MANUAL_REQUIRED" | "UNRESOLVED";
  confidenceAdjustments: ProviderResolutionConfidenceAdjustments;
};

export type ValidatedProviderResolutionPolicy = {
  policyId: string;
  policyVersion: number;
  factorKey: FactorKey;
  preferredProviderRule: {
    allowedStates: readonly ProviderHealthState[];
  };
  fallbackProviderRule: {
    allowedStates: readonly ProviderHealthState[];
  };
  allowDegradedPreferredProvider: boolean;
  noUsableProviderOutcome: "MANUAL_REQUIRED" | "UNRESOLVED";
  confidenceAdjustments: Readonly<ProviderResolutionConfidenceAdjustments>;
};

export const PROVIDER_RESOLUTION_POLICY_FAILURE_CODES = Object.freeze([
  "INVALID_REQUEST",
  "INVALID_POLICY",
  "INVALID_POLICY_ID",
  "INVALID_POLICY_VERSION",
  "INVALID_FACTOR_KEY",
  "INVALID_PREFERRED_PROVIDER_RULE",
  "INVALID_FALLBACK_PROVIDER_RULE",
  "EMPTY_ALLOWED_HEALTH_STATES",
  "DUPLICATE_ALLOWED_HEALTH_STATE",
  "UNUSABLE_HEALTH_STATE_ALLOWED",
  "INVALID_DEGRADED_PRIMARY_FLAG",
  "INCONSISTENT_DEGRADED_PRIMARY_RULE",
  "INVALID_NO_USABLE_PROVIDER_OUTCOME",
  "INVALID_CONFIDENCE_ADJUSTMENTS",
  "INVALID_RESOLVED_CONFIDENCE_ADJUSTMENT",
  "POSITIVE_CONFIDENCE_ADJUSTMENT",
] as const);
export type ProviderResolutionPolicyFailureCode =
  (typeof PROVIDER_RESOLUTION_POLICY_FAILURE_CODES)[number];

export type ProviderResolutionPolicyValidationResult =
  | {
      valid: true;
      policy: ValidatedProviderResolutionPolicy;
    }
  | {
      valid: false;
      code: ProviderResolutionPolicyFailureCode;
      policyId: string | null;
      factorKey: string | null;
    };
