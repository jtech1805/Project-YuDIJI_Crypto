import assert from "node:assert/strict";
import test from "node:test";

import { ProviderResolutionPolicyService } from "../../../src/services/providers/provider-resolution-policy.service.js";
import {
  PROVIDER_RESOLUTION_POLICY_FAILURE_CODES,
  PROVIDER_RESOLUTION_STATUSES,
  PROVIDER_RESOLUTION_WARNING_CODES,
} from "../../../src/types/provider-resolution-policy.types.js";

const service = new ProviderResolutionPolicyService();
const confidence = (overrides: Record<string, unknown> = {}) => ({
  resolved: 0,
  degradedPrimaryUsed: -0.1,
  fallbackUsed: -0.15,
  proxyUsed: -0.25,
  manualRequired: -0.4,
  unresolved: -1,
  ...overrides,
});
const policy = (overrides: Record<string, unknown> = {}) => ({
  policyId: "MARKET_PRICE_PROVIDER_RESOLUTION_V1",
  policyVersion: 1,
  factorKey: "MARKET.PRICE",
  preferredProviderRule: { allowedStates: ["HEALTHY"] },
  fallbackProviderRule: { allowedStates: ["HEALTHY", "DEGRADED"] },
  allowDegradedPreferredProvider: false,
  noUsableProviderOutcome: "MANUAL_REQUIRED",
  confidenceAdjustments: confidence(),
  ...overrides,
});
const validate = (value: unknown = policy()) => service.validate(value);
const expectFailure = (value: unknown, code: string) => {
  const result = validate(value);
  assert.equal(result.valid, false);
  if (!result.valid) assert.equal(result.code, code);
};

test("exports frozen resolution statuses, warning requirements, and failures", () => {
  assert.deepEqual(PROVIDER_RESOLUTION_STATUSES, ["RESOLVED", "DEGRADED_PRIMARY_USED", "FALLBACK_USED", "PROXY_USED", "MANUAL_REQUIRED", "UNRESOLVED"]);
  assert.deepEqual(PROVIDER_RESOLUTION_WARNING_CODES, ["PREFERRED_PROVIDER_DEGRADED", "PREFERRED_PROVIDER_UNAVAILABLE", "PREFERRED_PROVIDER_UNKNOWN", "FALLBACK_PROVIDER_SELECTED", "PROXY_PROVIDER_SELECTED", "MANUAL_PROVIDER_SELECTED", "DEGRADED_PROVIDER_SELECTED", "NO_USABLE_PROVIDER", "MANUAL_INTERVENTION_REQUIRED"]);
  assert.equal(PROVIDER_RESOLUTION_POLICY_FAILURE_CODES.length, 16);
  assert(Object.isFrozen(PROVIDER_RESOLUTION_STATUSES));
});

test("validates a strict preferred and degraded fallback policy", () => {
  const result = validate();
  assert.equal(result.valid, true);
  if (!result.valid) return;
  assert.deepEqual(result.policy.preferredProviderRule.allowedStates, ["HEALTHY"]);
  assert.deepEqual(result.policy.fallbackProviderRule.allowedStates, ["HEALTHY", "DEGRADED"]);
  assert.equal(result.policy.noUsableProviderOutcome, "MANUAL_REQUIRED");
});

test("validates explicitly permitted degraded primary and unresolved outcome", () => {
  const result = validate(policy({
    preferredProviderRule: { allowedStates: ["HEALTHY", "DEGRADED"] },
    allowDegradedPreferredProvider: true,
    noUsableProviderOutcome: "UNRESOLVED",
  }));
  assert.equal(result.valid, true);
});

test("rejects invalid requests and policy objects", () => {
  for (const value of [null, [], "policy", 1]) expectFailure(value, "INVALID_REQUEST");
  for (const value of [{}, { policy: null }, { policy: [] }, { policy: "bad" }]) expectFailure(value, "INVALID_POLICY");
});

test("validates policy ID, version, and canonical factor in order", () => {
  for (const policyId of ["", "lower", "HAS-HYPHEN", " BAD", "BAD ", "A".repeat(121), 1]) expectFailure(policy({ policyId }), "INVALID_POLICY_ID");
  for (const policyVersion of [0, -1, 1.5, "1"]) expectFailure(policy({ policyVersion }), "INVALID_POLICY_VERSION");
  for (const factorKey of ["UNKNOWN", "market.price", null]) expectFailure(policy({ factorKey }), "INVALID_FACTOR_KEY");
  expectFailure(policy({ policyId: "bad", policyVersion: 0, factorKey: "UNKNOWN" }), "INVALID_POLICY_ID");
  expectFailure(policy({ policyVersion: 0, factorKey: "UNKNOWN" }), "INVALID_POLICY_VERSION");
});

test("rejects malformed preferred and fallback rules", () => {
  for (const rule of [null, [], "rule", {}, { allowedStates: "HEALTHY" }, { allowedStates: [1] }]) expectFailure(policy({ preferredProviderRule: rule }), "INVALID_PREFERRED_PROVIDER_RULE");
  for (const rule of [null, [], "rule", {}, { allowedStates: "HEALTHY" }, { allowedStates: [1] }]) expectFailure(policy({ fallbackProviderRule: rule }), "INVALID_FALLBACK_PROVIDER_RULE");
  expectFailure(policy({ preferredProviderRule: null, fallbackProviderRule: null }), "INVALID_PREFERRED_PROVIDER_RULE");
});

test("rejects empty allowed health-state arrays", () => {
  expectFailure(policy({ preferredProviderRule: { allowedStates: [] } }), "EMPTY_ALLOWED_HEALTH_STATES");
  expectFailure(policy({ fallbackProviderRule: { allowedStates: [] } }), "EMPTY_ALLOWED_HEALTH_STATES");
});

test("rejects duplicate preferred and fallback health states", () => {
  expectFailure(policy({ preferredProviderRule: { allowedStates: ["HEALTHY", "HEALTHY"] } }), "DUPLICATE_ALLOWED_HEALTH_STATE");
  expectFailure(policy({ fallbackProviderRule: { allowedStates: ["DEGRADED", "DEGRADED"] } }), "DUPLICATE_ALLOWED_HEALTH_STATE");
});

test("UNKNOWN and UNAVAILABLE are never usable for preferred or fallback", () => {
  for (const state of ["UNKNOWN", "UNAVAILABLE"]) {
    expectFailure(policy({ preferredProviderRule: { allowedStates: [state] } }), "UNUSABLE_HEALTH_STATE_ALLOWED");
    expectFailure(policy({ fallbackProviderRule: { allowedStates: [state] } }), "UNUSABLE_HEALTH_STATE_ALLOWED");
  }
});

test("validates degraded-primary flag and consistency", () => {
  expectFailure(policy({ allowDegradedPreferredProvider: "true" }), "INVALID_DEGRADED_PRIMARY_FLAG");
  expectFailure(policy({ preferredProviderRule: { allowedStates: ["HEALTHY", "DEGRADED"] }, allowDegradedPreferredProvider: false, confidenceAdjustments: null }), "INCONSISTENT_DEGRADED_PRIMARY_RULE");
  const strictButEnabled = validate(policy({ allowDegradedPreferredProvider: true }));
  assert.equal(strictButEnabled.valid, true);
});

test("validates both no-usable-provider outcomes and rejects unknown values", () => {
  assert.equal(validate(policy({ noUsableProviderOutcome: "MANUAL_REQUIRED" })).valid, true);
  assert.equal(validate(policy({ noUsableProviderOutcome: "UNRESOLVED" })).valid, true);
  expectFailure(policy({ noUsableProviderOutcome: "FALLBACK" }), "INVALID_NO_USABLE_PROVIDER_OUTCOME");
});

test("rejects malformed and non-finite confidence adjustments", () => {
  for (const value of [null, [], {}, confidence({ fallbackUsed: NaN }), confidence({ proxyUsed: Infinity }), confidence({ unresolved: "-1" })]) expectFailure(policy({ confidenceAdjustments: value }), "INVALID_CONFIDENCE_ADJUSTMENTS");
});

test("resolved confidence adjustment must be exactly zero", () => {
  for (const resolved of [-0.1, 0.1, -Infinity]) {
    const expected = Number.isFinite(resolved) ? "INVALID_RESOLVED_CONFIDENCE_ADJUSTMENT" : "INVALID_CONFIDENCE_ADJUSTMENTS";
    expectFailure(policy({ confidenceAdjustments: confidence({ resolved }) }), expected);
  }
});

test("all exceptional confidence adjustments must be non-positive", () => {
  for (const key of ["degradedPrimaryUsed", "fallbackUsed", "proxyUsed", "manualRequired", "unresolved"]) {
    expectFailure(policy({ confidenceAdjustments: confidence({ [key]: 0.1 }) }), "POSITIVE_CONFIDENCE_ADJUSTMENT");
  }
});

test("preserves native confidence precision", () => {
  const result = validate(policy({ confidenceAdjustments: confidence({ fallbackUsed: -0.3333333333333333 }) }));
  assert.equal(result.valid, true);
  if (result.valid) assert.equal(result.policy.confidenceAdjustments.fallbackUsed, -0.3333333333333333);
});

test("validated output contains no order, health, selection, or generated metadata", () => {
  const result = validate();
  assert.equal(result.valid, true);
  if (!result.valid) return;
  const serialized = JSON.stringify(result.policy);
  for (const field of ["orderedProviderKeys", "preferredProviderKey", "fallbackProviderKeys", "healthState", "telemetry", "asOf", "selectedProviderKey", "resolutionStatus", "warningCodes", "policyHash", "validatedAt", "createdAt"]) assert(!serialized.includes(`"${field}":`));
});

test("returns a detached deeply frozen policy and protects future validation", () => {
  const preferred = ["HEALTHY"]; const fallback = ["HEALTHY", "DEGRADED"]; const adjustments = confidence();
  const source = policy({ preferredProviderRule: { allowedStates: preferred }, fallbackProviderRule: { allowedStates: fallback }, confidenceAdjustments: adjustments });
  const result = validate(source);
  assert.equal(result.valid, true);
  if (!result.valid) return;
  preferred.push("DEGRADED"); fallback.reverse(); adjustments.fallbackUsed = -99;
  assert.deepEqual(result.policy.preferredProviderRule.allowedStates, ["HEALTHY"]);
  assert.deepEqual(result.policy.fallbackProviderRule.allowedStates, ["HEALTHY", "DEGRADED"]);
  assert.equal(result.policy.confidenceAdjustments.fallbackUsed, -0.15);
  assert(Object.isFrozen(result.policy)); assert(Object.isFrozen(result.policy.preferredProviderRule)); assert(Object.isFrozen(result.policy.preferredProviderRule.allowedStates)); assert(Object.isFrozen(result.policy.fallbackProviderRule)); assert(Object.isFrozen(result.policy.confidenceAdjustments));
  assert.throws(() => (result.policy.fallbackProviderRule.allowedStates as string[]).reverse(), TypeError);
  assert.deepEqual(validate(), validate());
});
