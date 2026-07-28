import assert from "node:assert/strict";
import test from "node:test";

import {
  FEATURE_FLAG_KEYS,
  FeatureFlagConfigurationError,
  createFeatureFlagService,
  parseFeatureFlags,
  sharedFeatureFlagService,
  type FeatureFlagKey,
} from "../../../src/config/feature-flags.js";

test("parseFeatureFlags defaults every approved flag to false", () => {
  const snapshot = parseFeatureFlags({});

  assert.equal(FEATURE_FLAG_KEYS.length, 9);
  assert.deepEqual(Object.keys(snapshot).sort(), [...FEATURE_FLAG_KEYS].sort());

  for (const flagKey of FEATURE_FLAG_KEYS) {
    assert.equal(snapshot[flagKey], false);
  }
});

test("parseFeatureFlags parses explicit true values", () => {
  const values = ["true", "TRUE", " true "];

  for (const value of values) {
    const snapshot = parseFeatureFlags({ EVIDENCE_PIPELINE_ENABLED: value });
    assert.equal(snapshot.EVIDENCE_PIPELINE_ENABLED, true);
  }
});

test("parseFeatureFlags parses false, unset, empty, and whitespace values", () => {
  const explicitFalseValues = ["false", "FALSE", " false ", "", "   "];

  for (const value of explicitFalseValues) {
    const snapshot = parseFeatureFlags({ EVIDENCE_PIPELINE_ENABLED: value });
    assert.equal(snapshot.EVIDENCE_PIPELINE_ENABLED, false);
  }

  const unsetSnapshot = parseFeatureFlags({});
  assert.equal(unsetSnapshot.EVIDENCE_PIPELINE_ENABLED, false);
});

test("parseFeatureFlags rejects unsupported non-empty values", () => {
  const invalidValues = ["1", "0", "yes", "no", "enabled", "disabled", "on", "off"];

  for (const value of invalidValues) {
    assert.throws(
      () => parseFeatureFlags({
        EVIDENCE_PIPELINE_ENABLED: value,
        MONGO_URI: "mongodb://example.invalid",
        JWT_ACCESS_SECRET: "secret-value",
      }),
      (error: unknown): boolean => {
        assert.ok(error instanceof FeatureFlagConfigurationError);
        assert.equal(error.flagKey, "EVIDENCE_PIPELINE_ENABLED");
        assert.match(error.message, /EVIDENCE_PIPELINE_ENABLED/);
        assert.doesNotMatch(error.message, /MONGO_URI/);
        assert.doesNotMatch(error.message, /JWT_ACCESS_SECRET/);
        assert.doesNotMatch(error.message, /secret-value/);
        assert.doesNotMatch(error.message, new RegExp(value));
        return true;
      },
    );
  }
});

test("parseFeatureFlags resolves independent flags independently", () => {
  const snapshot = parseFeatureFlags({
    EVIDENCE_PIPELINE_ENABLED: "true",
    GENERIC_EVALUATOR_ENABLED: "false",
    DECISION_AXES_ENABLED: "TRUE",
  });

  assert.equal(snapshot.EVIDENCE_PIPELINE_ENABLED, true);
  assert.equal(snapshot.GENERIC_EVALUATOR_ENABLED, false);
  assert.equal(snapshot.DECISION_AXES_ENABLED, true);
  assert.equal(snapshot.SOURCE_RESOLVER_FALLBACK_ENABLED, false);
});

test("feature flag snapshots are immutable and isolated from environment changes", () => {
  const environment: NodeJS.ProcessEnv = {
    EVIDENCE_PIPELINE_ENABLED: "true",
    GENERIC_EVALUATOR_ENABLED: "false",
  };

  const service = createFeatureFlagService(environment);
  environment.EVIDENCE_PIPELINE_ENABLED = "false";

  assert.equal(service.isEnabled("EVIDENCE_PIPELINE_ENABLED"), true);

  const firstSnapshot = service.snapshot();
  assert.equal(Object.isFrozen(firstSnapshot), true);

  assert.throws(() => {
    (firstSnapshot as Record<FeatureFlagKey, boolean>).EVIDENCE_PIPELINE_ENABLED = false;
  }, TypeError);

  assert.equal(service.isEnabled("EVIDENCE_PIPELINE_ENABLED"), true);

  const secondSnapshot = service.snapshot();
  assert.equal(secondSnapshot.EVIDENCE_PIPELINE_ENABLED, true);
  assert.notEqual(firstSnapshot, secondSnapshot);
});

test("isEnabled returns the parsed value for every known key", () => {
  const environment: NodeJS.ProcessEnv = {};
  for (const flagKey of FEATURE_FLAG_KEYS) {
    environment[flagKey] = "true";
  }

  const service = createFeatureFlagService(environment);

  for (const flagKey of FEATURE_FLAG_KEYS) {
    assert.equal(service.isEnabled(flagKey), true);
  }
});

test("sharedFeatureFlagService can be imported and read", () => {
  for (const flagKey of FEATURE_FLAG_KEYS) {
    assert.equal(typeof sharedFeatureFlagService.isEnabled(flagKey), "boolean");
  }
});
