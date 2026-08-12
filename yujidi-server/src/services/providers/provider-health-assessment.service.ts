import { FACTOR_KEYS } from "../../types/factor-registry.types.js";
import {
  PROVIDER_AUTHORITY_LEVELS,
  PROVIDER_COST_TIERS,
  PROVIDER_TYPES,
  type ProviderDefinition,
} from "../../types/provider-definition.types.js";
import type {
  ProviderHealthAssessmentFailureCode,
  ProviderHealthAssessmentRequest,
  ProviderHealthAssessmentResult,
  ProviderHealthDerivedMetrics,
  ProviderHealthReasonCode,
  ProviderHealthTelemetry,
  ProviderHealthThresholdPolicy,
  ProviderHealthState,
} from "../../types/provider-health.types.js";

const IDENTIFIER_PATTERN = /^[A-Z0-9_]+$/;

export class ProviderHealthAssessmentService {
  public assess(request: ProviderHealthAssessmentRequest): ProviderHealthAssessmentResult {
    if (!isRecord(request)
      || !("provider" in request)
      || !("telemetry" in request)
      || !("policy" in request)
      || !("asOf" in request)) {
      return failure("INVALID_REQUEST", request);
    }
    if (!isProviderDefinition(request.provider)) {
      return failure("INVALID_PROVIDER_DEFINITION", request);
    }
    if (!isPolicy(request.policy)) {
      return failure("INVALID_POLICY", request);
    }
    if (!isDate(request.asOf)) {
      return failure("INVALID_AS_OF", request);
    }
    if (request.telemetry !== null
      && !isTelemetry(request.telemetry, request.asOf.getTime())) {
      return failure("INVALID_TELEMETRY", request);
    }
    if (request.telemetry !== null
      && request.telemetry.providerKey !== request.provider.providerKey) {
      return failure("PROVIDER_KEY_MISMATCH", request);
    }

    const providerKey = request.provider.providerKey;
    const policy = request.policy;
    const telemetry = request.telemetry;
    if (telemetry?.operatorDisabled === true) {
      return success(providerKey, policy, "UNAVAILABLE", ["OPERATOR_DISABLED"], metrics(telemetry, request.asOf));
    }
    if (telemetry === null) {
      return success(providerKey, policy, "UNKNOWN", ["NO_TELEMETRY"], {
        errorRate: null, telemetryAgeMs: null, successAgeMs: null,
      });
    }
    const derived = metrics(telemetry, request.asOf);
    if (telemetry.totalAttempts === 0) {
      return success(providerKey, policy, "UNKNOWN", ["NO_TELEMETRY"], derived);
    }
    if ((derived.telemetryAgeMs as number) > policy.maximumTelemetryAgeMs) {
      return success(providerKey, policy, "UNKNOWN", ["TELEMETRY_STALE"], derived);
    }

    const unavailable: ProviderHealthReasonCode[] = [];
    if (policy.requireRecentSuccess
      && (derived.successAgeMs === null
        || derived.successAgeMs > (policy.maximumSuccessAgeMs as number))) {
      unavailable.push("NO_RECENT_SUCCESS");
    }
    if (telemetry.consecutiveFailures >= policy.unavailableConsecutiveFailures) {
      unavailable.push("CONSECUTIVE_FAILURE_LIMIT_REACHED");
    }
    if (derived.errorRate !== null
      && derived.errorRate >= policy.unavailableErrorRate) {
      unavailable.push("ERROR_RATE_UNAVAILABLE_THRESHOLD_REACHED");
    }
    if (telemetry.averageLatencyMs !== null
      && telemetry.averageLatencyMs >= policy.unavailableAverageLatencyMs) {
      unavailable.push("LATENCY_UNAVAILABLE_THRESHOLD_REACHED");
    }
    if (unavailable.length > 0) {
      return success(providerKey, policy, "UNAVAILABLE", unavailable, derived);
    }

    const degraded: ProviderHealthReasonCode[] = [];
    if (derived.errorRate !== null && derived.errorRate >= policy.degradedErrorRate) {
      degraded.push("ERROR_RATE_DEGRADED_THRESHOLD_REACHED");
    }
    if (telemetry.averageLatencyMs !== null
      && telemetry.averageLatencyMs >= policy.degradedAverageLatencyMs) {
      degraded.push("LATENCY_DEGRADED_THRESHOLD_REACHED");
    }
    if (telemetry.failedAttempts > 0
      || telemetry.consecutiveFailures >= policy.degradedConsecutiveFailures) {
      degraded.push("RECENT_FAILURES_PRESENT");
    }
    return degraded.length > 0
      ? success(providerKey, policy, "DEGRADED", degraded, derived)
      : success(providerKey, policy, "HEALTHY", ["WITHIN_HEALTHY_THRESHOLDS"], derived);
  }
}

const isProviderDefinition = (value: unknown): value is ProviderDefinition => {
  if (!isRecord(value)
    || !identifier(value.providerKey)
    || !trimmedText(value.displayName, 160)
    || !PROVIDER_TYPES.includes(value.providerType as never)
    || !PROVIDER_AUTHORITY_LEVELS.includes(value.authorityLevel as never)
    || !PROVIDER_COST_TIERS.includes(value.costTier as never)
    || value.enabled !== true
    || !Array.isArray(value.supportedFactorKeys)
    || value.supportedFactorKeys.length === 0
    || !value.supportedFactorKeys.every((key) => FACTOR_KEYS.includes(key as never))) return false;
  return new Set(value.supportedFactorKeys).size === value.supportedFactorKeys.length;
};

const isPolicy = (value: unknown): value is ProviderHealthThresholdPolicy =>
  isRecord(value)
  && identifier(value.policyId)
  && positiveInteger(value.policyVersion)
  && positiveInteger(value.maximumTelemetryAgeMs)
  && unitInterval(value.degradedErrorRate)
  && unitInterval(value.unavailableErrorRate)
  && value.degradedErrorRate < value.unavailableErrorRate
  && positiveInteger(value.degradedConsecutiveFailures)
  && positiveInteger(value.unavailableConsecutiveFailures)
  && value.degradedConsecutiveFailures < value.unavailableConsecutiveFailures
  && positiveFinite(value.degradedAverageLatencyMs)
  && positiveFinite(value.unavailableAverageLatencyMs)
  && value.degradedAverageLatencyMs < value.unavailableAverageLatencyMs
  && typeof value.requireRecentSuccess === "boolean"
  && (value.requireRecentSuccess
    ? positiveInteger(value.maximumSuccessAgeMs)
    : value.maximumSuccessAgeMs === null);

const isTelemetry = (value: unknown, asOfMs: number): value is ProviderHealthTelemetry => {
  if (!isRecord(value)
    || !identifier(value.providerKey)
    || !isDate(value.windowStartedAt)
    || !isDate(value.windowEndedAt)
    || value.windowStartedAt.getTime() > value.windowEndedAt.getTime()
    || value.windowEndedAt.getTime() > asOfMs
    || !nonNegativeInteger(value.totalAttempts)
    || !nonNegativeInteger(value.successfulAttempts)
    || !nonNegativeInteger(value.failedAttempts)
    || value.successfulAttempts + value.failedAttempts !== value.totalAttempts
    || !nonNegativeInteger(value.consecutiveFailures)
    || value.consecutiveFailures > value.failedAttempts
    || !nullableNonNegativeFinite(value.averageLatencyMs)
    || !nullableNonNegativeFinite(value.maximumLatencyMs)
    || (value.averageLatencyMs !== null && value.maximumLatencyMs !== null
      && value.averageLatencyMs > value.maximumLatencyMs)
    || !nullableDate(value.lastSuccessAt)
    || !nullableDate(value.lastFailureAt)
    || typeof value.operatorDisabled !== "boolean") return false;

  if ((value.successfulAttempts === 0) !== (value.lastSuccessAt === null)
    || (value.failedAttempts === 0) !== (value.lastFailureAt === null)) return false;
  if (value.totalAttempts === 0
    && (value.averageLatencyMs !== null || value.maximumLatencyMs !== null)) return false;
  return inWindow(value.lastSuccessAt, value.windowStartedAt, value.windowEndedAt)
    && inWindow(value.lastFailureAt, value.windowStartedAt, value.windowEndedAt);
};

const metrics = (
  telemetry: ProviderHealthTelemetry,
  asOf: Date,
): ProviderHealthDerivedMetrics => Object.freeze({
  errorRate: telemetry.totalAttempts === 0
    ? null
    : telemetry.failedAttempts / telemetry.totalAttempts,
  telemetryAgeMs: asOf.getTime() - telemetry.windowEndedAt.getTime(),
  successAgeMs: telemetry.lastSuccessAt === null
    ? null
    : asOf.getTime() - telemetry.lastSuccessAt.getTime(),
});

const success = (
  providerKey: string,
  policy: ProviderHealthThresholdPolicy,
  state: ProviderHealthState,
  reasonCodes: readonly ProviderHealthReasonCode[],
  derived: ProviderHealthDerivedMetrics,
): ProviderHealthAssessmentResult => Object.freeze({
  assessed: true as const,
  providerKey,
  policyId: policy.policyId,
  policyVersion: policy.policyVersion,
  state,
  reasonCodes: Object.freeze([...reasonCodes]),
  metrics: Object.freeze({ ...derived }),
});

const failure = (
  code: ProviderHealthAssessmentFailureCode,
  request: unknown,
): ProviderHealthAssessmentResult => Object.freeze({
  assessed: false as const,
  providerKey: safeNestedString(request, "provider", "providerKey"),
  policyId: safeNestedString(request, "policy", "policyId"),
  code,
});

const safeNestedString = (value: unknown, objectKey: string, key: string): string | null => {
  if (!isRecord(value) || !isRecord(value[objectKey])) return null;
  const nested = value[objectKey][key];
  return typeof nested === "string" ? nested : null;
};
const isRecord = (value: unknown): value is Record<string, any> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const identifier = (value: unknown): value is string =>
  typeof value === "string" && value.length >= 1 && value.length <= 120
  && value.trim() === value && IDENTIFIER_PATTERN.test(value);
const trimmedText = (value: unknown, maximum: number): value is string =>
  typeof value === "string" && value.length >= 1 && value.length <= maximum
  && value.trim() === value;
const isDate = (value: unknown): value is Date =>
  value instanceof Date && Number.isFinite(value.getTime());
const nullableDate = (value: unknown): value is Date | null => value === null || isDate(value);
const nonNegativeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;
const positiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;
const positiveFinite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;
const unitInterval = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
const nullableNonNegativeFinite = (value: unknown): value is number | null =>
  value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0);
const inWindow = (value: Date | null, start: Date, end: Date): boolean =>
  value === null || (value.getTime() >= start.getTime() && value.getTime() <= end.getTime());
