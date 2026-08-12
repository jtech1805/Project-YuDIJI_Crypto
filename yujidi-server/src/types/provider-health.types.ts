import type {
  ProviderDefinition,
  ProviderKey,
} from "./provider-definition.types.js";

export const PROVIDER_HEALTH_STATES = Object.freeze([
  "HEALTHY",
  "DEGRADED",
  "UNAVAILABLE",
  "UNKNOWN",
] as const);
export type ProviderHealthState = (typeof PROVIDER_HEALTH_STATES)[number];

export const PROVIDER_HEALTH_REASON_CODES = Object.freeze([
  "OPERATOR_DISABLED",
  "NO_TELEMETRY",
  "TELEMETRY_STALE",
  "NO_RECENT_SUCCESS",
  "CONSECUTIVE_FAILURE_LIMIT_REACHED",
  "ERROR_RATE_UNAVAILABLE_THRESHOLD_REACHED",
  "ERROR_RATE_DEGRADED_THRESHOLD_REACHED",
  "LATENCY_UNAVAILABLE_THRESHOLD_REACHED",
  "LATENCY_DEGRADED_THRESHOLD_REACHED",
  "RECENT_FAILURES_PRESENT",
  "WITHIN_HEALTHY_THRESHOLDS",
] as const);
export type ProviderHealthReasonCode =
  (typeof PROVIDER_HEALTH_REASON_CODES)[number];

export type ProviderHealthTelemetry = {
  providerKey: ProviderKey;
  windowStartedAt: Date;
  windowEndedAt: Date;
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  consecutiveFailures: number;
  averageLatencyMs: number | null;
  maximumLatencyMs: number | null;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  operatorDisabled: boolean;
};

export type ProviderHealthThresholdPolicy = {
  policyId: string;
  policyVersion: number;
  maximumTelemetryAgeMs: number;
  degradedErrorRate: number;
  unavailableErrorRate: number;
  degradedConsecutiveFailures: number;
  unavailableConsecutiveFailures: number;
  degradedAverageLatencyMs: number;
  unavailableAverageLatencyMs: number;
  requireRecentSuccess: boolean;
  maximumSuccessAgeMs: number | null;
};

export type ProviderHealthAssessmentRequest = {
  provider: ProviderDefinition;
  telemetry: ProviderHealthTelemetry | null;
  policy: ProviderHealthThresholdPolicy;
  asOf: Date;
};

export type ProviderHealthDerivedMetrics = {
  errorRate: number | null;
  telemetryAgeMs: number | null;
  successAgeMs: number | null;
};

export type ProviderHealthAssessmentSuccess = {
  assessed: true;
  providerKey: ProviderKey;
  policyId: string;
  policyVersion: number;
  state: ProviderHealthState;
  reasonCodes: readonly ProviderHealthReasonCode[];
  metrics: ProviderHealthDerivedMetrics;
};

export const PROVIDER_HEALTH_ASSESSMENT_FAILURE_CODES = Object.freeze([
  "INVALID_REQUEST",
  "INVALID_PROVIDER_DEFINITION",
  "INVALID_TELEMETRY",
  "PROVIDER_KEY_MISMATCH",
  "INVALID_POLICY",
  "INVALID_AS_OF",
] as const);
export type ProviderHealthAssessmentFailureCode =
  (typeof PROVIDER_HEALTH_ASSESSMENT_FAILURE_CODES)[number];

export type ProviderHealthAssessmentFailure = {
  assessed: false;
  providerKey: string | null;
  policyId: string | null;
  code: ProviderHealthAssessmentFailureCode;
};

export type ProviderHealthAssessmentResult =
  | ProviderHealthAssessmentSuccess
  | ProviderHealthAssessmentFailure;
