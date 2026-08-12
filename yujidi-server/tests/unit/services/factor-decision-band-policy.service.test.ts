import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { FactorDecisionBandPolicyService } from "../../../src/services/scoring/factor-decision-band-policy.service.js";

const normalization = (min = 0, neutral = 50, max = 100) => ({
  normalizationPolicyId: "TEST_NORMALIZATION_V1", normalizationPolicyVersion: 1,
  aggregationPolicyId: "TEST_AGGREGATION_V1", aggregationPolicyVersion: 1,
  factorKey: "MARKET.PRICE" as const, method: "PIECEWISE_LINEAR_ZERO_ANCHORED" as const,
  sourceRange: { minimumPoints: -10, neutralPoints: 0 as const, maximumPoints: 10 },
  targetRange: { minimumScore: min, neutralScore: neutral, maximumScore: max },
  outOfRangePolicy: "FAIL" as const, precisionPolicy: "PRESERVE_NATIVE" as const,
});
const bands = (points = [0, 20, 40, 60, 80, 100]) => ["STRONG_NEGATIVE", "NEGATIVE", "NEUTRAL", "POSITIVE", "STRONG_POSITIVE"].map((label, i) => ({
  order: i + 1, label, minimumScore: points[i]!, maximumScore: points[i + 1]!,
  minimumInclusive: true, maximumInclusive: i === 4,
}));
const policy = (points?: number[]) => ({ decisionBandPolicyId: "TEST_BANDS_V1", decisionBandPolicyVersion: 1,
  normalizationPolicyId: "TEST_NORMALIZATION_V1", normalizationPolicyVersion: 1,
  factorKey: "MARKET.PRICE" as const, normalizedRange: { minimumScore: points?.[0] ?? 0, maximumScore: points?.[5] ?? 100 }, bands: bands(points) });
const service = new FactorDecisionBandPolicyService();
const code = (value: any) => service.validate(value).valid ? null : (service.validate(value) as any).code;

test("accepts standard, non-0-100, and asymmetric threshold policies", () => {
  for (const [n, p] of [[normalization(), policy()], [normalization(-1, 0, 1), policy([-1, -.8, -.2, .1, .7, 1])], [normalization(0, 40, 120), policy([0, 10, 35, 55, 90, 120])]] as const) assert.equal(service.validate({ policy: p, normalizationPolicy: n }).valid, true);
});
test("rejects invalid requests, boundaries, objects, identity and version in order", () => {
  assert.equal(code(null), "INVALID_REQUEST");
  assert.equal(code({ policy: policy(), normalizationPolicy: {} }), "INVALID_NORMALIZATION_POLICY");
  assert.equal(code({ policy: null, normalizationPolicy: normalization() }), "INVALID_DECISION_BAND_POLICY");
  assert.equal(code({ policy: { ...policy(), decisionBandPolicyId: "bad" }, normalizationPolicy: normalization() }), "INVALID_POLICY_ID");
  assert.equal(code({ policy: { ...policy(), decisionBandPolicyVersion: 0 }, normalizationPolicy: normalization() }), "INVALID_POLICY_VERSION");
});
test("requires exact normalization identity, factor, and normalized range", () => {
  assert.equal(code({ policy: { ...policy(), normalizationPolicyVersion: 2 }, normalizationPolicy: normalization() }), "NORMALIZATION_POLICY_MISMATCH");
  assert.equal(code({ policy: { ...policy(), factorKey: "OTHER" }, normalizationPolicy: normalization() }), "FACTOR_MISMATCH");
  assert.equal(code({ policy: { ...policy(), normalizedRange: { minimumScore: 0, maximumScore: 99 } }, normalizationPolicy: normalization() }), "NORMALIZED_RANGE_MISMATCH");
});
test("requires a dense exact five-band array", () => {
  assert.equal(code({ policy: { ...policy(), bands: bands().slice(0, 4) }, normalizationPolicy: normalization() }), "INVALID_BAND_COUNT");
  assert.equal(code({ policy: { ...policy(), bands: [...bands(), bands()[0]] }, normalizationPolicy: normalization() }), "INVALID_BAND_COUNT");
  const sparse = bands(); delete (sparse as any)[2];
  assert.equal(code({ policy: { ...policy(), bands: sparse }, normalizationPolicy: normalization() }), "INVALID_BAND_COUNT");
});
test("rejects band shapes, orders, duplicates and semantic reordering", () => {
  assert.equal(code({ policy: { ...policy(), bands: bands().map((b, i) => i ? b : { ...b, order: 0 }) }, normalizationPolicy: normalization() }), "INVALID_BAND");
  assert.equal(code({ policy: { ...policy(), bands: bands().map((b, i) => i === 1 ? { ...b, order: 1 } : b) }, normalizationPolicy: normalization() }), "INVALID_BAND_ORDER");
  assert.equal(code({ policy: { ...policy(), bands: bands().map((b, i) => i === 1 ? { ...b, label: "STRONG_NEGATIVE" } : b) }, normalizationPolicy: normalization() }), "DUPLICATE_BAND_LABEL");
  assert.equal(code({ policy: { ...policy(), bands: bands().map((b, i, a) => i === 0 ? { ...b, label: a[1]!.label } : i === 1 ? { ...b, label: a[0]!.label } : b) }, normalizationPolicy: normalization() }), "INVALID_BAND_LABEL_ORDER");
});
test("rejects zero, negative, and non-finite widths", () => {
  for (const value of [20, 21, Number.NaN, Infinity]) {
    const changed = bands().map((b, i) => i === 0 ? { ...b, minimumScore: value } : b);
    assert.equal(code({ policy: { ...policy(), bands: changed }, normalizationPolicy: normalization() }), "INVALID_BAND_BOUNDARY");
  }
});
test("enforces inclusivity, complete endpoints, gaps, and overlaps", () => {
  assert.equal(code({ policy: { ...policy(), bands: bands().map((b, i) => i === 0 ? { ...b, minimumInclusive: false } : b) }, normalizationPolicy: normalization() }), "INVALID_BOUNDARY_INCLUSIVITY");
  assert.equal(code({ policy: { ...policy(), bands: bands().map((b, i) => i === 0 ? { ...b, minimumScore: 1 } : b) }, normalizationPolicy: normalization() }), "INCOMPLETE_RANGE_COVERAGE");
  assert.equal(code({ policy: { ...policy(), bands: bands().map((b, i) => i === 1 ? { ...b, minimumScore: 21 } : b) }, normalizationPolicy: normalization() }), "BAND_GAP");
  assert.equal(code({ policy: { ...policy(), bands: bands().map((b, i) => i === 1 ? { ...b, minimumScore: 19 } : b) }, normalizationPolicy: normalization() }), "BAND_OVERLAP");
});
test("returns a deeply immutable defensive deterministic snapshot", () => {
  const raw = policy(); const a = service.validate({ policy: raw, normalizationPolicy: normalization() });
  const b = service.validate({ policy: raw, normalizationPolicy: normalization() }); assert.deepEqual(a, b);
  assert.equal(a.valid, true); if (!a.valid) return;
  assert(Object.isFrozen(a.policy) && Object.isFrozen(a.policy.normalizedRange) && Object.isFrozen(a.policy.bands));
  assert(a.policy.bands.every(Object.isFrozen)); raw.bands[0]!.maximumScore = 19; assert.equal(a.policy.bands[0]!.maximumScore, 20);
  const json = JSON.stringify(a); for (const forbidden of ["normalizedScore", "BUY", "SELL", "HOLD", "permission", "confidence"]) assert.equal(json.includes(forbidden), false);
});
test("implementation has no runtime, persistence, or trade integration", () => {
  const source = readFileSync(new URL("../../../src/services/scoring/factor-decision-band-policy.service.ts", import.meta.url), "utf8");
  for (const forbidden of ["scoring-engine", "mongoose", "controller", "placeOrder", "positionSize", "normalizedScore"]) assert.equal(source.includes(forbidden), false);
});
