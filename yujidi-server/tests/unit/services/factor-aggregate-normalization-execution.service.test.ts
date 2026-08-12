import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { FactorAggregateNormalizationExecutionService } from "../../../src/services/scoring/factor-aggregate-normalization-execution.service.js";

const policy = (source = { minimumPoints: -10, neutralPoints: 0 as const, maximumPoints: 20 },
  target = { minimumScore: 0, neutralScore: 40, maximumScore: 100 }) => ({
  normalizationPolicyId: "TEST_NORMALIZATION_V1", normalizationPolicyVersion: 1,
  aggregationPolicyId: "TEST_AGGREGATION_V1", aggregationPolicyVersion: 1,
  factorKey: "MARKET.PRICE" as const, method: "PIECEWISE_LINEAR_ZERO_ANCHORED" as const,
  sourceRange: source, targetRange: target, outOfRangePolicy: "FAIL" as const,
  precisionPolicy: "PRESERVE_NATIVE" as const,
});
const aggregation = (points: number, bounds = { minimumPoints: -10, maximumPoints: 20 }) => ({
  aggregated: true as const, policyId: "TEST_AGGREGATION_V1", policyVersion: 1,
  planId: "TEST_PLAN_V1", planVersion: 1, factorKey: "MARKET.PRICE" as const,
  method: "WEIGHTED_SUM" as const, aggregatePoints: points,
  bounds: { declared: bounds, theoretical: { minimumPoints: -5, maximumPoints: 5 } },
  summary: {}, steps: [],
});
const service = new FactorAggregateNormalizationExecutionService();
const fail = (code: string) => ({ normalized: false, normalizationPolicyId: "TEST_NORMALIZATION_V1",
  aggregationPolicyId: "TEST_AGGREGATION_V1", factorKey: "MARKET.PRICE", code });

test("maps exact anchors including negative zero", () => {
  for (const [raw, score, segment] of [[-10, 0, "LOWER"], [0, 40, "NEUTRAL"], [-0, 40, "NEUTRAL"], [20, 100, "UPPER"]] as const) {
    const result = service.execute({ policy: policy(), aggregation: aggregation(raw) });
    assert.equal(result.normalized, true);
    if (result.normalized) assert.deepEqual([result.normalizedScore, result.segment], [score, segment]);
  }
});
test("maps independent lower and upper segments for asymmetric ranges", () => {
  const lower = service.execute({ policy: policy(), aggregation: aggregation(-5) });
  const upper = service.execute({ policy: policy(), aggregation: aggregation(10) });
  assert.equal(lower.normalized && lower.normalizedScore, 20);
  assert.equal(upper.normalized && upper.normalizedScore, 70);
});
test("supports non-midpoint targets and preserves native decimals", () => {
  const result = service.execute({ policy: policy(), aggregation: aggregation(1 / 3) });
  assert.equal(result.normalized, true);
  if (result.normalized) assert.equal(result.normalizedScore, 40 + ((1 / 3) / 20) * 60);
});
test("rejects request and validated boundaries", () => {
  assert.equal(service.execute(null).normalized, false);
  assert.equal(service.execute({ policy: {}, aggregation: aggregation(0) }).normalized, false);
  assert.equal(service.execute({ policy: policy(), aggregation: {} }).normalized, false);
});
test("requires exact aggregation identity then factor", () => {
  assert.deepEqual(service.execute({ policy: policy(), aggregation: { ...aggregation(0), policyVersion: 2 } }), fail("AGGREGATION_POLICY_MISMATCH"));
  assert.deepEqual(service.execute({ policy: policy(), aggregation: { ...aggregation(0), factorKey: "OTHER" } }),
    { ...fail("FACTOR_MISMATCH"), factorKey: "OTHER" });
});
test("requires exact declared source bounds", () => {
  assert.deepEqual(service.execute({ policy: policy(), aggregation: aggregation(0, { minimumPoints: -9, maximumPoints: 20 }) }), fail("SOURCE_RANGE_MISMATCH"));
});
test("fails closed for non-finite and out-of-range raw values", () => {
  for (const raw of [Number.NaN, Infinity]) assert.deepEqual(service.execute({ policy: policy(), aggregation: aggregation(raw) }), fail("NON_FINITE_RAW_AGGREGATE"));
  assert.deepEqual(service.execute({ policy: policy(), aggregation: aggregation(-11) }), fail("RAW_AGGREGATE_OUT_OF_RANGE"));
  assert.deepEqual(service.execute({ policy: policy(), aggregation: aggregation(21) }), fail("RAW_AGGREGATE_OUT_OF_RANGE"));
});
test("rejects unsupported frozen policy settings through runtime bypass", () => {
  for (const [key, value, code] of [["method", "LINEAR", "UNSUPPORTED_METHOD"], ["outOfRangePolicy", "CLAMP", "UNSUPPORTED_OUT_OF_RANGE_POLICY"], ["precisionPolicy", "ROUND", "UNSUPPORTED_PRECISION_POLICY"]] as const) {
    assert.deepEqual(service.execute({ policy: { ...policy(), [key]: value }, aggregation: aggregation(0) }), fail(code));
  }
});
test("returns minimized deeply immutable deterministic results", () => {
  const source = policy(); const aggregate = aggregation(5);
  const a = service.execute({ policy: source, aggregation: aggregate });
  const b = service.execute({ policy: source, aggregation: aggregate });
  assert.deepEqual(a, b); assert.equal(Object.isFrozen(a), true);
  if (!a.normalized) return;
  assert.equal(Object.isFrozen(a.sourceRange), true); assert.equal(Object.isFrozen(a.targetRange), true);
  const json = JSON.stringify(a);
  for (const forbidden of ["steps", "summary", "band", "decision", "BUY", "SELL", "HOLD", "timestamp"]) assert.equal(json.includes(forbidden), false);
});
test("implementation contains no rounding, clamping, persistence, or decision integration", () => {
  const source = readFileSync(new URL("../../../src/services/scoring/factor-aggregate-normalization-execution.service.ts", import.meta.url), "utf8");
  for (const forbidden of ["Math.round", "toFixed", "mongoose", "controller", "placeOrder", "positionSize", "stopLoss", "takeProfit"]) assert.equal(source.includes(forbidden), false);
});
