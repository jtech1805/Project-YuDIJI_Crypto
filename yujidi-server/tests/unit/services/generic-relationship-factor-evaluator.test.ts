import assert from "node:assert/strict";
import test from "node:test";
import { FactorEvaluatorContractService } from "../../../src/services/scoring/factor-evaluator-contract.service.js";
import { GenericRelationshipFactorEvaluator, validateGenericConditionalBinding, validateGenericRelationshipConfiguration } from "../../../src/services/scoring/generic-relationship-factor-evaluator.js";
import type { AssembledFactorInput } from "../../../src/types/factor-input-assembly.types.js";
import type { GenericRelationshipEvaluatorConfiguration } from "../../../src/types/generic-relationship-evaluator.types.js";
import { classifyGenericFactorRelationship } from "../../../src/types/generic-factor-relationship.types.js";

const config = (relationshipType: "DIRECT" | "INVERSE" = "DIRECT"): GenericRelationshipEvaluatorConfiguration => ({
  relationshipType, expectedUnit: "USD",
  thresholds: { strongNegativeMax: -300_000_000, negativeMax: -100_000_000, positiveMin: 100_000_000, strongPositiveMin: 300_000_000 },
  contributions: { strongNegative: -2, negative: -1, neutral: 0, positive: 1, strongPositive: 2 },
  minimumPoints: -2, maximumPoints: 2,
});
const input = (value: number, unit = "USD"): AssembledFactorInput => ({
  factorKey: "CRYPTO.ETF_NET_FLOW", factorDefinitionVersion: 1,
  subject: { type: "ASSET", key: "BTC" }, evidenceId: "E-ETF-1",
  value: { type: "NUMBER", value, unit },
  source: { sourceType: "ALTERNATIVE_DATA", provider: "MOCK_BTC_ETF_FLOW", sourceId: "MOCK_BTC_ETF_FLOW_V1", priority: 1 },
  observedAt: new Date("2026-08-01T00:00:00Z"), evaluatedAt: new Date("2026-08-01T01:00:00Z"),
  confidence: 1, freshness: { status: "FRESH", ageMs: 3_600_000, maxAgeMs: 86_400_000 },
});

for (const [relationship, value, outcome, points] of [
  ["DIRECT", 420_000_000, "PASS", 2], ["DIRECT", 180_000_000, "PASS", 1],
  ["DIRECT", 0, "NEUTRAL", 0], ["DIRECT", -180_000_000, "FAIL", -1],
  ["DIRECT", -420_000_000, "FAIL", -2], ["INVERSE", 420_000_000, "FAIL", -2],
  ["INVERSE", 180_000_000, "FAIL", -1], ["INVERSE", 0, "NEUTRAL", 0],
  ["INVERSE", -180_000_000, "PASS", 1], ["INVERSE", -420_000_000, "PASS", 2],
] as const) test(`${relationship} golden band ${value}`, () => {
  const evaluator = new GenericRelationshipFactorEvaluator(config(relationship));
  const result = evaluator.evaluate(input(value));
  assert.equal(result.evaluated, true);
  if (!result.evaluated) return;
  assert.equal(result.result.outcome, outcome);
  assert.equal(result.result.contribution.points, points);
  assert.deepEqual(new FactorEvaluatorContractService().validateResult({ evaluator, input: input(value), execution: result }).valid, true);
});

test("exact boundaries and native precision are deterministic", () => {
  const evaluator = new GenericRelationshipFactorEvaluator(config());
  for (const [value, points] of [[-300_000_000, -2], [-100_000_000, -1], [100_000_000, 1], [300_000_000, 2], [100_000_000.125, 1]] as const) {
    const first = evaluator.evaluate(input(value)); const second = evaluator.evaluate(input(value));
    assert.deepEqual(first, second);
    assert.equal(first.evaluated && first.result.contribution.points, points);
  }
});

test("configuration validation is ordered and fail closed", () => {
  assert.deepEqual(validateGenericRelationshipConfiguration({ ...config(), relationshipType: "CONDITIONAL" }, "CRYPTO.ETF_NET_FLOW"), { valid: false, code: "CONDITION_BINDING_REQUIRED" });
  assert.deepEqual(validateGenericRelationshipConfiguration({ ...config(), expectedUnit: "EUR" }, "CRYPTO.ETF_NET_FLOW"), { valid: false, code: "INVALID_UNIT" });
  assert.deepEqual(validateGenericRelationshipConfiguration({ ...config(), thresholds: { ...config().thresholds, negativeMax: -300_000_000 } }, "CRYPTO.ETF_NET_FLOW"), { valid: false, code: "UNORDERED_THRESHOLDS" });
  assert.deepEqual(validateGenericRelationshipConfiguration({ ...config(), contributions: { ...config().contributions, positive: Infinity } }, "CRYPTO.ETF_NET_FLOW"), { valid: false, code: "NON_FINITE_CONTRIBUTION" });
});

test("wrong factor/unit fail and output is detached and frozen", () => {
  const evaluator = new GenericRelationshipFactorEvaluator(config());
  assert.equal(evaluator.evaluate({ ...input(1), factorKey: "MARKET.PRICE" }).evaluated, false);
  assert.equal(evaluator.evaluate(input(1, "EUR")).evaluated, false);
  const source = input(420_000_000); const result = evaluator.evaluate(source);
  source.subject.key = "ETH";
  assert.equal(result.evaluated && result.result.subject.key, "BTC");
  assert.equal(result.evaluated && Object.isFrozen(result.result), true);
});

test("deferred golden semantics produce no directional points", () => {
  const expected = [
    ["CONDITIONAL", "CONDITION_BINDING_REQUIRED"], ["CONFIRMATION_ONLY", "CROSS_FACTOR_DEFERRED"],
    ["RISK_ONLY", "RISK_AXIS_DEFERRED"], ["VETO", "VETO_CHANNEL_DEFERRED"],
  ] as const;
  for (const [relationship, support] of expected) {
    const classification = classifyGenericFactorRelationship(relationship);
    assert.equal(classification?.supportState, support);
    assert.equal(relationship === "CONDITIONAL" ? true : classification?.producesDirectionalContribution, relationship === "CONDITIONAL");
  }
});

test("CONDITIONAL true, false, and missing golden bindings remain explicit and deferred", () => {
  assert.deepEqual(validateGenericConditionalBinding(true), {
    valid: true, condition: true, executionStatus: "DEFERRED", reasonCode: "CONDITIONAL_EXECUTION_DEFERRED",
  });
  assert.deepEqual(validateGenericConditionalBinding(false), {
    valid: true, condition: false, executionStatus: "DEFERRED", reasonCode: "CONDITIONAL_EXECUTION_DEFERRED",
  });
  assert.deepEqual(validateGenericConditionalBinding(undefined), {
    valid: false, condition: null, executionStatus: "DEFERRED", reasonCode: "CONDITION_BINDING_REQUIRED",
  });
});

test("registration is explicit and empty registry remains empty", async () => {
  const { StaticDeterministicFactorEvaluatorRegistry } = await import("../../../src/registries/deterministic-factor-evaluator.registry.js");
  const contractService = new FactorEvaluatorContractService();
  assert.deepEqual(new StaticDeterministicFactorEvaluatorRegistry({ evaluators: [], contractService }).list(), []);
  assert.equal(new StaticDeterministicFactorEvaluatorRegistry({ evaluators: [new GenericRelationshipFactorEvaluator(config())], contractService }).list().length, 1);
});
