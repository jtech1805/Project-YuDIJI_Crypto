import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_FACTOR_DEFINITIONS } from "../../../src/registries/default-factor-definitions.js";
import { StaticFactorRegistry } from "../../../src/registries/factor.registry.js";
import { GenericRelationshipFactorEvaluator } from "../../../src/services/scoring/generic-relationship-factor-evaluator.js";
import { GenericFactorCompatibilityDispatcher, GenericFactorLegacyResultAdapter, parseGenericFactorEvaluatorKey } from "../../../src/services/scoring/generic-factor-legacy-compatibility.service.js";
import type { AssembledFactorInput } from "../../../src/types/factor-input-assembly.types.js";

const key = "GENERIC_FACTOR:CRYPTO.ETF_NET_FLOW";
const defaultFactorRegistry = new StaticFactorRegistry(DEFAULT_FACTOR_DEFINITIONS);
const configuration = { relationshipType: "DIRECT" as const, expectedUnit: "USD", thresholds: { strongNegativeMax: -300, negativeMax: -100, positiveMin: 100, strongPositiveMin: 300 }, contributions: { strongNegative: -2, negative: -1, neutral: 0, positive: 1, strongPositive: 2 }, minimumPoints: -2, maximumPoints: 2 };
const input = (value = 420): AssembledFactorInput => ({ factorKey: "CRYPTO.ETF_NET_FLOW", factorDefinitionVersion: 1, subject: { type: "ASSET", key: "BTC" }, evidenceId: "E-1", value: { type: "NUMBER", value, unit: "USD" }, source: { sourceType: "ALTERNATIVE_DATA", provider: "MOCK_BTC_ETF_FLOW", sourceId: "MOCK_V1", priority: 1 }, observedAt: new Date("2026-08-01T00:00:00Z"), evaluatedAt: new Date("2026-08-01T01:00:00Z"), confidence: 1, freshness: { status: "FRESH", ageMs: 1, maxAgeMs: 86_400_000 } });
const execution = (value = 420) => new GenericRelationshipFactorEvaluator(configuration).evaluate(input(value));
const dispatcher = (enabled = true) => new GenericFactorCompatibilityDispatcher({ enabled, factorRegistry: defaultFactorRegistry, adapter: new GenericFactorLegacyResultAdapter() });

test("generic key syntax is exact and closed", () => {
  assert.equal(parseGenericFactorEvaluatorKey(key), "CRYPTO.ETF_NET_FLOW");
  for (const invalid of ["generic_factor:CRYPTO.ETF_NET_FLOW", "GENERIC_FACTOR:", "GENERIC_FACTOR: CRYPTO.ETF_NET_FLOW", "GENERIC_FACTOR:X:Y", "MARKET_PRICE"]) assert.equal(parseGenericFactorEvaluatorKey(invalid), null);
});

test("feature-off and unknown factors fail closed", () => {
  assert.equal(dispatcher(false).dispatch({ evaluatorKey: key, relationshipType: "DIRECT", execution: execution() }).translated, false);
  assert.deepEqual(dispatcher().dispatch({ evaluatorKey: "GENERIC_FACTOR:UNKNOWN", relationshipType: "DIRECT", execution: execution() }), { translated: false, evaluatorKey: "GENERIC_FACTOR:UNKNOWN", code: "UNKNOWN_FACTOR" });
});

test("DIRECT and INVERSE contributions translate deterministically", () => {
  const direct = dispatcher().dispatch({ evaluatorKey: key, relationshipType: "DIRECT", execution: execution(420) });
  assert.equal(direct.translated && direct.result.score, 100);
  assert.equal(direct.translated && direct.result.status, "EXECUTED");
  const inverseEvaluator = new GenericRelationshipFactorEvaluator({ ...configuration, relationshipType: "INVERSE" });
  const inverse = dispatcher().dispatch({ evaluatorKey: key, relationshipType: "INVERSE", execution: inverseEvaluator.evaluate(input(420)) });
  assert.equal(inverse.translated && inverse.result.score, 0);
  const neutral = dispatcher().dispatch({ evaluatorKey: key, relationshipType: "DIRECT", execution: execution(0) });
  assert.equal(neutral.translated && neutral.result.score, 50);
});

test("missing Evidence and unsupported semantics never flatten to zero", () => {
  const missing = dispatcher().dispatch({ evaluatorKey: key, relationshipType: "DIRECT", execution: { evaluated: false, evaluatorId: "GENERIC_RELATIONSHIP_FACTOR_EVALUATOR", factorKey: "CRYPTO.ETF_NET_FLOW", code: "INVALID_INPUT" } });
  assert.deepEqual(missing, { translated: false, evaluatorKey: key, code: "MISSING_EVIDENCE" });
  for (const relationshipType of ["CONDITIONAL", "CONFIRMATION_ONLY", "RISK_ONLY", "VETO"] as const) {
    assert.equal(dispatcher().dispatch({ evaluatorKey: key, relationshipType, execution: execution() }).translated, false);
  }
});

test("DRAFT private template fixture accepts canonical generic key without production registration", () => {
  const fixture = Object.freeze({ templateKey: "BTC_ETF_FLOW_EXPERIMENTAL", templateName: "BTC ETF Flow Experimental", scope: "USER", status: "DRAFT", visibility: "PRIVATE", sections: [{ sectionKey: "ETF_FLOW", label: "ETF Flow", weight: 100, enabled: true, missingDataPolicy: "BLOCK", evaluators: [{ evaluatorKey: key, label: "BTC ETF Net Flow", weight: 100, enabled: true, config: { relationshipType: "DIRECT", evaluatorConfigurationVersion: 1 } }] }] });
  assert.equal(fixture.status, "DRAFT"); assert.equal(fixture.visibility, "PRIVATE");
  assert.equal(parseGenericFactorEvaluatorKey(fixture.sections[0]!.evaluators[0]!.evaluatorKey), "CRYPTO.ETF_NET_FLOW");
  assert.equal(defaultFactorRegistry.get("CRYPTO.ETF_NET_FLOW")?.scoringEligibility, "ELIGIBLE");
});
