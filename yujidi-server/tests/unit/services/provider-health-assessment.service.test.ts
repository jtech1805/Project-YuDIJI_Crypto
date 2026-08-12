import assert from "node:assert/strict";
import test from "node:test";

import { ProviderHealthAssessmentService } from "../../../src/services/providers/provider-health-assessment.service.js";
import {
  PROVIDER_HEALTH_ASSESSMENT_FAILURE_CODES,
  PROVIDER_HEALTH_REASON_CODES,
  PROVIDER_HEALTH_STATES,
} from "../../../src/types/provider-health.types.js";

const service = new ProviderHealthAssessmentService();
const AS_OF = new Date("2026-08-01T12:00:00.000Z");

const provider = (overrides: Record<string, unknown> = {}) => ({
  providerKey: "BINANCE_PUBLIC_MARKET",
  displayName: "Binance Public Market Data",
  providerType: "DIRECT",
  authorityLevel: "EXCHANGE",
  costTier: "FREE",
  supportedFactorKeys: ["MARKET.PRICE"],
  enabled: true,
  ...overrides,
});

const policy = (overrides: Record<string, unknown> = {}) => ({
  policyId: "TEST_PROVIDER_HEALTH_POLICY_V1",
  policyVersion: 1,
  maximumTelemetryAgeMs: 60_000,
  degradedErrorRate: 0.2,
  unavailableErrorRate: 0.5,
  degradedConsecutiveFailures: 2,
  unavailableConsecutiveFailures: 5,
  degradedAverageLatencyMs: 1_000,
  unavailableAverageLatencyMs: 5_000,
  requireRecentSuccess: true,
  maximumSuccessAgeMs: 120_000,
  ...overrides,
});

const telemetry = (overrides: Record<string, unknown> = {}) => ({
  providerKey: "BINANCE_PUBLIC_MARKET",
  windowStartedAt: new Date("2026-08-01T11:59:00.000Z"),
  windowEndedAt: new Date("2026-08-01T11:59:55.000Z"),
  totalAttempts: 20,
  successfulAttempts: 20,
  failedAttempts: 0,
  consecutiveFailures: 0,
  averageLatencyMs: 250,
  maximumLatencyMs: 600,
  lastSuccessAt: new Date("2026-08-01T11:59:55.000Z"),
  lastFailureAt: null,
  operatorDisabled: false,
  ...overrides,
});

const assess = (overrides: Record<string, unknown> = {}) => service.assess({
  provider: provider(), telemetry: telemetry(), policy: policy(), asOf: AS_OF,
  ...overrides,
} as never);

const expectState = (result: ReturnType<typeof assess>, state: string, reasons: string[]) => {
  assert.equal(result.assessed, true);
  if (!result.assessed) return;
  assert.equal(result.state, state);
  assert.deepEqual(result.reasonCodes, reasons);
};

const expectFailure = (result: ReturnType<typeof assess>, code: string) => {
  assert.equal(result.assessed, false);
  if (!result.assessed) assert.equal(result.code, code);
};

test("exports frozen health, reason, and failure vocabularies", () => {
  assert.deepEqual(PROVIDER_HEALTH_STATES, ["HEALTHY", "DEGRADED", "UNAVAILABLE", "UNKNOWN"]);
  assert.deepEqual(PROVIDER_HEALTH_REASON_CODES, ["OPERATOR_DISABLED", "NO_TELEMETRY", "TELEMETRY_STALE", "NO_RECENT_SUCCESS", "CONSECUTIVE_FAILURE_LIMIT_REACHED", "ERROR_RATE_UNAVAILABLE_THRESHOLD_REACHED", "ERROR_RATE_DEGRADED_THRESHOLD_REACHED", "LATENCY_UNAVAILABLE_THRESHOLD_REACHED", "LATENCY_DEGRADED_THRESHOLD_REACHED", "RECENT_FAILURES_PRESENT", "WITHIN_HEALTHY_THRESHOLDS"]);
  assert.equal(PROVIDER_HEALTH_ASSESSMENT_FAILURE_CODES.length, 6);
  assert(Object.isFrozen(PROVIDER_HEALTH_STATES));
});

test("assesses healthy telemetry with exact derived metrics", () => {
  const result = assess();
  expectState(result, "HEALTHY", ["WITHIN_HEALTHY_THRESHOLDS"]);
  if (result.assessed) assert.deepEqual(result.metrics, { errorRate: 0, telemetryAgeMs: 5_000, successAgeMs: 5_000 });
});

test("assesses exact degraded error-rate and latency thresholds", () => {
  expectState(assess({ telemetry: telemetry({ totalAttempts: 10, successfulAttempts: 8, failedAttempts: 2, consecutiveFailures: 0, lastFailureAt: new Date("2026-08-01T11:59:54Z"), averageLatencyMs: 1000, maximumLatencyMs: 1200 }) }), "DEGRADED", ["ERROR_RATE_DEGRADED_THRESHOLD_REACHED", "LATENCY_DEGRADED_THRESHOLD_REACHED", "RECENT_FAILURES_PRESENT"]);
});

test("recent failures and degraded consecutive failures are degraded", () => {
  expectState(assess({ telemetry: telemetry({ totalAttempts: 20, successfulAttempts: 19, failedAttempts: 1, consecutiveFailures: 1, lastFailureAt: new Date("2026-08-01T11:59:54Z") }) }), "DEGRADED", ["RECENT_FAILURES_PRESENT"]);
  expectState(assess({ telemetry: telemetry({ totalAttempts: 20, successfulAttempts: 18, failedAttempts: 2, consecutiveFailures: 2, lastFailureAt: new Date("2026-08-01T11:59:54Z") }) }), "DEGRADED", ["RECENT_FAILURES_PRESENT"]);
});

test("assesses each exact unavailable threshold", () => {
  expectState(assess({ telemetry: telemetry({ totalAttempts: 10, successfulAttempts: 5, failedAttempts: 5, consecutiveFailures: 0, lastFailureAt: new Date("2026-08-01T11:59:54Z") }) }), "UNAVAILABLE", ["ERROR_RATE_UNAVAILABLE_THRESHOLD_REACHED"]);
  expectState(assess({ telemetry: telemetry({ totalAttempts: 20, successfulAttempts: 15, failedAttempts: 5, consecutiveFailures: 5, lastFailureAt: new Date("2026-08-01T11:59:54Z") }) }), "UNAVAILABLE", ["CONSECUTIVE_FAILURE_LIMIT_REACHED"]);
  expectState(assess({ telemetry: telemetry({ averageLatencyMs: 5000, maximumLatencyMs: 6000 }) }), "UNAVAILABLE", ["LATENCY_UNAVAILABLE_THRESHOLD_REACHED"]);
});

test("returns multiple unavailable reasons in frozen prescribed order", () => {
  const result = assess({ telemetry: telemetry({ windowStartedAt: new Date("2026-08-01T11:57:00Z"), totalAttempts: 10, successfulAttempts: 4, failedAttempts: 6, consecutiveFailures: 5, averageLatencyMs: 6000, maximumLatencyMs: 7000, lastSuccessAt: new Date("2026-08-01T11:57:00Z"), lastFailureAt: new Date("2026-08-01T11:59:54Z") }) });
  expectState(result, "UNAVAILABLE", ["NO_RECENT_SUCCESS", "CONSECUTIVE_FAILURE_LIMIT_REACHED", "ERROR_RATE_UNAVAILABLE_THRESHOLD_REACHED", "LATENCY_UNAVAILABLE_THRESHOLD_REACHED"]);
  if (result.assessed) assert(Object.isFrozen(result.reasonCodes));
});

test("operator disablement has assessment precedence after validation", () => {
  expectState(assess({ telemetry: telemetry({ operatorDisabled: true, totalAttempts: 10, successfulAttempts: 4, failedAttempts: 6, consecutiveFailures: 5, averageLatencyMs: 6000, maximumLatencyMs: 7000, lastFailureAt: new Date("2026-08-01T11:59:54Z") }) }), "UNAVAILABLE", ["OPERATOR_DISABLED"]);
  expectFailure(assess({ telemetry: telemetry({ operatorDisabled: true, totalAttempts: -1 }) }), "INVALID_TELEMETRY");
});

test("missing and empty telemetry produce unknown with null metrics", () => {
  for (const value of [null, telemetry({ totalAttempts: 0, successfulAttempts: 0, failedAttempts: 0, consecutiveFailures: 0, averageLatencyMs: null, maximumLatencyMs: null, lastSuccessAt: null, lastFailureAt: null })]) {
    const result = assess({ telemetry: value });
    expectState(result, "UNKNOWN", ["NO_TELEMETRY"]);
    if (result.assessed) assert.deepEqual(result.metrics, value === null ? { errorRate: null, telemetryAgeMs: null, successAgeMs: null } : { errorRate: null, telemetryAgeMs: 5000, successAgeMs: null });
  }
});

test("stale telemetry is unknown while exact freshness boundary remains current", () => {
  expectState(assess({ telemetry: telemetry({ windowStartedAt: new Date("2026-08-01T11:58:00Z"), windowEndedAt: new Date("2026-08-01T11:58:59.999Z"), lastSuccessAt: new Date("2026-08-01T11:58:59.999Z") }) }), "UNKNOWN", ["TELEMETRY_STALE"]);
  expectState(assess({ telemetry: telemetry({ windowEndedAt: new Date("2026-08-01T11:59:00Z"), lastSuccessAt: new Date("2026-08-01T11:59:00Z") }) }), "HEALTHY", ["WITHIN_HEALTHY_THRESHOLDS"]);
});

test("recent success absence and age use inclusive boundary", () => {
  expectState(assess({ telemetry: telemetry({ totalAttempts: 5, successfulAttempts: 0, failedAttempts: 5, consecutiveFailures: 0, lastSuccessAt: null, lastFailureAt: new Date("2026-08-01T11:59:54Z") }) }), "UNAVAILABLE", ["NO_RECENT_SUCCESS", "ERROR_RATE_UNAVAILABLE_THRESHOLD_REACHED"]);
  expectState(assess({ telemetry: telemetry({ windowStartedAt: new Date("2026-08-01T11:58:00Z"), lastSuccessAt: new Date("2026-08-01T11:58:00Z") }) }), "HEALTHY", ["WITHIN_HEALTHY_THRESHOLDS"]);
  expectState(assess({ telemetry: telemetry({ windowStartedAt: new Date("2026-08-01T11:57:59.999Z"), lastSuccessAt: new Date("2026-08-01T11:57:59.999Z") }) }), "UNAVAILABLE", ["NO_RECENT_SUCCESS"]);
});

test("preserves native error-rate precision", () => {
  const result = assess({ telemetry: telemetry({ totalAttempts: 3, successfulAttempts: 2, failedAttempts: 1, consecutiveFailures: 1, lastFailureAt: new Date("2026-08-01T11:59:54Z") }) });
  assert.equal(result.assessed && result.metrics.errorRate, 1 / 3);
});

test("rejects invalid requests in first-failure order", () => {
  for (const value of [null, [], {}, { provider: provider() }]) expectFailure(service.assess(value as never), "INVALID_REQUEST");
  expectFailure(assess({ provider: provider({ providerKey: "bad" }), policy: policy({ policyId: "bad" }) }), "INVALID_PROVIDER_DEFINITION");
  expectFailure(assess({ policy: policy({ policyId: "bad" }), asOf: "bad" }), "INVALID_POLICY");
  expectFailure(assess({ asOf: "bad", telemetry: telemetry({ totalAttempts: -1 }) }), "INVALID_AS_OF");
});

test("rejects malformed or disabled provider definitions", () => {
  for (const value of [null, provider({ enabled: false }), provider({ displayName: " bad" }), provider({ providerType: "OTHER" }), provider({ authorityLevel: "OTHER" }), provider({ costTier: "OTHER" }), provider({ supportedFactorKeys: [] })]) expectFailure(assess({ provider: value }), "INVALID_PROVIDER_DEFINITION");
});

test("rejects invalid policy identity, thresholds, and recent-success configuration", () => {
  const bad = [{ policyId: "bad" }, { policyVersion: 0 }, { maximumTelemetryAgeMs: 0 }, { degradedErrorRate: .5 }, { unavailableErrorRate: .2 }, { degradedConsecutiveFailures: 5 }, { unavailableConsecutiveFailures: 2 }, { degradedAverageLatencyMs: 5000 }, { unavailableAverageLatencyMs: 1000 }, { requireRecentSuccess: true, maximumSuccessAgeMs: null }, { requireRecentSuccess: false, maximumSuccessAgeMs: 1 }];
  for (const item of bad) expectFailure(assess({ policy: policy(item) }), "INVALID_POLICY");
});

test("rejects invalid telemetry counts, latency, and timestamps", () => {
  const bad = [{ totalAttempts: 19 }, { consecutiveFailures: 1 }, { averageLatencyMs: -1 }, { averageLatencyMs: Infinity }, { averageLatencyMs: 700, maximumLatencyMs: 600 }, { windowStartedAt: new Date("invalid") }, { windowStartedAt: new Date("2026-08-01T12:00:01Z") }, { windowEndedAt: new Date("2026-08-01T12:00:01Z") }, { lastSuccessAt: new Date("2026-08-01T11:58:59Z") }, { failedAttempts: 1, successfulAttempts: 19, lastFailureAt: null }, { successfulAttempts: 0, failedAttempts: 20, lastSuccessAt: AS_OF, lastFailureAt: new Date("2026-08-01T11:59:54Z") }];
  for (const item of bad) expectFailure(assess({ telemetry: telemetry(item) }), "INVALID_TELEMETRY");
});

test("validates telemetry before provider-key mismatch", () => {
  expectFailure(assess({ telemetry: telemetry({ providerKey: "OTHER", totalAttempts: -1 }) }), "INVALID_TELEMETRY");
  expectFailure(assess({ telemetry: telemetry({ providerKey: "OTHER" }) }), "PROVIDER_KEY_MISMATCH");
});

test("provider authority, type, and cost do not affect health", () => {
  const baseline = assess();
  assert.deepEqual(assess({ provider: provider({ providerType: "PROXY", authorityLevel: "APPROVED_PROXY", costTier: "PAID" }) }), baseline);
  assert.deepEqual(assess({ provider: provider({ providerType: "MANUAL", authorityLevel: "MANUAL_REVIEWED", costTier: "MANUAL" }) }), baseline);
});

test("returns minimized deeply frozen deterministic output detached from inputs", () => {
  const sourceProvider = provider(); const sourceTelemetry = telemetry(); const sourcePolicy = policy();
  const result = assess({ provider: sourceProvider, telemetry: sourceTelemetry, policy: sourcePolicy });
  sourceProvider.providerKey = "CHANGED"; sourceTelemetry.totalAttempts = 0; sourcePolicy.policyId = "CHANGED";
  assert.equal(result.assessed, true);
  if (!result.assessed) return;
  assert.equal(result.providerKey, "BINANCE_PUBLIC_MARKET");
  assert.equal(result.policyId, "TEST_PROVIDER_HEALTH_POLICY_V1");
  assert(Object.isFrozen(result)); assert(Object.isFrozen(result.metrics)); assert(Object.isFrozen(result.reasonCodes));
  assert.throws(() => (result.reasonCodes as string[]).push("OTHER"), TypeError);
  const serialized = JSON.stringify(result);
  for (const field of ["selectedProviderKey", "resolutionStatus", "fallback", "proxyUsed", "confidenceAdjustment", "telemetry", "assessmentId", "assessedAt", "createdAt", "durationMs"]) assert(!serialized.includes(`"${field}":`));
  assert(!serialized.includes('"provider":'));
  assert.deepEqual(assess(), assess());
});
