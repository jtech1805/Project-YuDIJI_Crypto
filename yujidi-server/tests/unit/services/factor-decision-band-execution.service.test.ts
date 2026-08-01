import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { FactorDecisionBandExecutionService } from "../../../src/services/factor-decision-band-execution.service.js";

const labels = ["STRONG_NEGATIVE", "NEGATIVE", "NEUTRAL", "POSITIVE", "STRONG_POSITIVE"] as const;
const policy = (points = [0, 20, 40, 60, 80, 100]) => ({ decisionBandPolicyId: "TEST_BANDS_V1", decisionBandPolicyVersion: 1,
  normalizationPolicyId: "TEST_NORMALIZATION_V1", normalizationPolicyVersion: 1, factorKey: "MARKET.PRICE" as const,
  normalizedRange: { minimumScore: points[0]!, maximumScore: points[5]! }, bands: labels.map((label, i) => ({ order: i + 1, label,
    minimumScore: points[i]!, maximumScore: points[i + 1]!, minimumInclusive: true, maximumInclusive: i === 4 })) });
const normalization = (score: number, min = 0, max = 100) => ({ normalized: true as const,
  normalizationPolicyId: "TEST_NORMALIZATION_V1", normalizationPolicyVersion: 1,
  aggregationPolicyId: "TEST_AGGREGATION_V1", aggregationPolicyVersion: 1,
  planId: "TEST_PLAN_V1", planVersion: 1, factorKey: "MARKET.PRICE" as const,
  method: "PIECEWISE_LINEAR_ZERO_ANCHORED" as const,
  sourceRange: { minimumPoints: -10, neutralPoints: 0 as const, maximumPoints: 10 },
  targetRange: { minimumScore: min, neutralScore: (min + max) / 2, maximumScore: max },
  rawAggregatePoints: 0, segment: "NEUTRAL" as const, normalizedScore: score,
  outOfRangePolicy: "FAIL" as const, precisionPolicy: "PRESERVE_NATIVE" as const });
const service = new FactorDecisionBandExecutionService();
const resultCode = (request: any) => { const result = service.execute(request); return result.classified ? null : result.code; };

test("classifies minimum, interiors, shared boundaries, neutral, positive, and maximum", () => {
  const cases = [[0, "STRONG_NEGATIVE"], [10, "STRONG_NEGATIVE"], [20, "NEGATIVE"], [50, "NEUTRAL"], [70, "POSITIVE"], [80, "STRONG_POSITIVE"], [100, "STRONG_POSITIVE"]] as const;
  for (const [score, label] of cases) { const result = service.execute({ policy: policy(), normalization: normalization(score) }); assert.equal(result.classified, true); if (result.classified) assert.equal(result.band.label, label); }
});
test("supports non-0-100 ranges", () => {
  const points = [-1, -.8, -.2, .2, .7, 1]; const result = service.execute({ policy: policy(points), normalization: normalization(-.2, -1, 1) });
  assert.equal(result.classified && result.band.label, "NEUTRAL");
});
test("rejects invalid request and runtime boundaries", () => {
  assert.equal(resultCode(null), "INVALID_REQUEST"); assert.equal(resultCode({ policy: {}, normalization: normalization(0) }), "INVALID_VALIDATED_POLICY");
  assert.equal(resultCode({ policy: policy(), normalization: {} }), "INVALID_NORMALIZATION_RESULT");
});
test("requires exact normalization identity, factor, and range", () => {
  assert.equal(resultCode({ policy: policy(), normalization: { ...normalization(0), normalizationPolicyVersion: 2 } }), "NORMALIZATION_POLICY_MISMATCH");
  assert.equal(resultCode({ policy: policy(), normalization: { ...normalization(0), factorKey: "OTHER" } }), "FACTOR_MISMATCH");
  assert.equal(resultCode({ policy: policy(), normalization: normalization(0, 0, 101) }), "NORMALIZED_RANGE_MISMATCH");
});
test("fails closed for non-finite and out-of-range scores", () => {
  assert.equal(resultCode({ policy: policy(), normalization: normalization(Number.NaN) }), "NON_FINITE_NORMALIZED_SCORE");
  assert.equal(resultCode({ policy: policy(), normalization: normalization(-1) }), "NORMALIZED_SCORE_OUT_OF_RANGE");
  assert.equal(resultCode({ policy: policy(), normalization: normalization(101) }), "NORMALIZED_SCORE_OUT_OF_RANGE");
});
test("defensively reports zero and multiple matches through runtime bypass", () => {
  const gap = policy(); gap.bands[1]!.minimumScore = 21;
  assert.equal(resultCode({ policy: gap, normalization: normalization(20.5) }), "NO_MATCHING_BAND");
  const overlap = policy(); overlap.bands[1]!.minimumScore = 19;
  assert.equal(resultCode({ policy: overlap, normalization: normalization(19.5) }), "MULTIPLE_MATCHING_BANDS");
});
test("preserves identities and returns minimized immutable deterministic output", () => {
  const a = service.execute({ policy: policy(), normalization: normalization(40) });
  const b = service.execute({ policy: policy(), normalization: normalization(40) }); assert.deepEqual(a, b); assert.equal(a.classified, true); if (!a.classified) return;
  assert.equal(a.band.label, "NEUTRAL"); assert(Object.isFrozen(a) && Object.isFrozen(a.band) && Object.isFrozen(a.normalizedRange));
  assert.deepEqual([a.decisionBandPolicyId, a.normalizationPolicyId, a.aggregationPolicyId, a.planId], ["TEST_BANDS_V1", "TEST_NORMALIZATION_V1", "TEST_AGGREGATION_V1", "TEST_PLAN_V1"]);
  const json = JSON.stringify(a); for (const forbidden of ["steps", "summary", "timestamp", "confidence", "permission", "BUY", "SELL", "HOLD"]) assert.equal(json.includes(forbidden), false);
});
test("implementation adds no rounding, persistence, runtime, or trade action", () => {
  const source = readFileSync(new URL("../../../src/services/factor-decision-band-execution.service.ts", import.meta.url), "utf8");
  for (const forbidden of ["Math.round", "toFixed", "mongoose", "controller", "placeOrder", "positionSize", "stopLoss", "takeProfit"]) assert.equal(source.includes(forbidden), false);
});
