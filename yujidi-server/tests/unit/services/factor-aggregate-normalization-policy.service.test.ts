import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  FactorAggregateNormalizationPolicyService,
} from "../../../src/services/factor-aggregate-normalization-policy.service.js";
import type {
  ValidatedFactorContributionAggregationPolicy,
} from "../../../src/types/factor-contribution-aggregation.types.js";

const aggregationPolicy = (
  bounds = { minimumPoints: -10, maximumPoints: 10 },
): ValidatedFactorContributionAggregationPolicy => ({
  policyId: "TEST_MARKET_PRICE_AGGREGATION_POLICY_V1",
  policyVersion: 1,
  planId: "TEST_MARKET_PRICE_PLAN_V1",
  planVersion: 1,
  factorKey: "MARKET.PRICE",
  method: "WEIGHTED_SUM",
  bounds,
  outcomeEligibility: {
    PASS: "ELIGIBLE",
    FAIL: "ELIGIBLE",
    NEUTRAL: "ELIGIBLE",
    UNAVAILABLE: "INELIGIBLE",
  },
  entries: [{
    order: 1,
    evaluatorId: "TEST_EVALUATOR_V1",
    evaluatorVersion: 1,
    configurationVersion: 1,
    weight: 1,
  }],
});

const policy = (
  sourceRange = { minimumPoints: -10, neutralPoints: 0 as const, maximumPoints: 10 },
  targetRange = { minimumScore: 0, neutralScore: 50, maximumScore: 100 },
) => ({
  normalizationPolicyId: "TEST_MARKET_PRICE_NORMALIZATION_POLICY_V1",
  normalizationPolicyVersion: 1,
  aggregationPolicyId: "TEST_MARKET_PRICE_AGGREGATION_POLICY_V1",
  aggregationPolicyVersion: 1,
  factorKey: "MARKET.PRICE" as const,
  method: "PIECEWISE_LINEAR_ZERO_ANCHORED" as const,
  sourceRange,
  targetRange,
  outOfRangePolicy: "FAIL" as const,
  precisionPolicy: "PRESERVE_NATIVE" as const,
});

const failure = (
  code: string,
  normalizationPolicyId: string | null = "TEST_MARKET_PRICE_NORMALIZATION_POLICY_V1",
  aggregationPolicyId: string | null = "TEST_MARKET_PRICE_AGGREGATION_POLICY_V1",
  factorKey: string | null = "MARKET.PRICE",
) => ({ valid: false, code, normalizationPolicyId, aggregationPolicyId, factorKey });

const service = new FactorAggregateNormalizationPolicyService();

test("accepts standard, asymmetric, and non-0-100 ranges without midpoint assumptions", () => {
  const cases = [
    {
      aggregate: aggregationPolicy(),
      value: policy(),
    },
    {
      aggregate: aggregationPolicy({ minimumPoints: -5, maximumPoints: 20 }),
      value: policy(
        { minimumPoints: -5, neutralPoints: 0, maximumPoints: 20 },
        { minimumScore: 0, neutralScore: 40, maximumScore: 120 },
      ),
    },
    {
      aggregate: aggregationPolicy({ minimumPoints: -5, maximumPoints: 20 }),
      value: policy(
        { minimumPoints: -5, neutralPoints: 0, maximumPoints: 20 },
        { minimumScore: -1, neutralScore: 0, maximumScore: 1 },
      ),
    },
  ];
  for (const item of cases) {
    const result = service.validate({ policy: item.value, aggregationPolicy: item.aggregate });
    assert.equal(result.valid, true);
    if (!result.valid) continue;
    assert.deepEqual(result.policy, item.value);
    const serialized = JSON.stringify(result.policy);
    for (const forbidden of [
      "normalizedScore", "lowerSlope", "upperSlope", "decimalPlaces",
      "roundingMode", "epsilon", "clamp",
    ]) assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test("rejects invalid requests before either boundary", () => {
  for (const request of [null, undefined, [], "request", 1, {},
    { policy: policy() }, { aggregationPolicy: aggregationPolicy() }]) {
    assert.deepEqual(
      service.validate(request as never),
      failure("INVALID_REQUEST", null, null, null),
    );
  }
});

test("rejects malformed aggregation policies before normalization identity", () => {
  for (const invalid of [null, {}, { ...aggregationPolicy(), policyVersion: 0 },
    { ...aggregationPolicy(), bounds: { minimumPoints: 1, maximumPoints: 10 } },
    { ...aggregationPolicy(), entries: [] },
    { ...aggregationPolicy(), outcomeEligibility: {} }]) {
    assert.deepEqual(
      service.validate({
        policy: { ...policy(), normalizationPolicyId: "bad" },
        aggregationPolicy: invalid,
      } as never),
      failure("INVALID_AGGREGATION_POLICY", null, null, null),
    );
  }
});

test("rejects invalid normalization-policy runtime objects and identity", () => {
  for (const invalid of [null, undefined, [], "policy", 1, () => { }]) {
    assert.deepEqual(
      service.validate({ policy: invalid, aggregationPolicy: aggregationPolicy() }),
      failure("INVALID_NORMALIZATION_POLICY", null),
    );
  }
  for (const normalizationPolicyId of [
    "", " POLICY", "POLICY ", "policy", "POLICY-ID", "POLICY.ID",
    "A".repeat(121), 1,
  ]) {
    assert.deepEqual(
      service.validate({
        policy: { ...policy(), normalizationPolicyId },
        aggregationPolicy: aggregationPolicy(),
      }),
      failure("INVALID_POLICY_ID", null),
    );
  }
  for (const normalizationPolicyVersion of [0, -1, 1.5, Number.NaN, Infinity, "1"]) {
    assert.deepEqual(
      service.validate({
        policy: { ...policy(), normalizationPolicyVersion },
        aggregationPolicy: aggregationPolicy(),
      }),
      failure("INVALID_POLICY_VERSION"),
    );
  }
});

test("requires exact aggregation identity and factor before method or ranges", () => {
  for (const changed of [
    { aggregationPolicyId: "OTHER_POLICY" },
    { aggregationPolicyVersion: 2 },
  ]) {
    assert.deepEqual(
      service.validate({
        policy: { ...policy(), ...changed, factorKey: "OTHER" },
        aggregationPolicy: aggregationPolicy(),
      }),
      failure("AGGREGATION_POLICY_MISMATCH", undefined,
        String(changed.aggregationPolicyId ?? "TEST_MARKET_PRICE_AGGREGATION_POLICY_V1"),
        "OTHER"),
    );
  }
  assert.deepEqual(
    service.validate({
      policy: { ...policy(), factorKey: "OTHER" },
      aggregationPolicy: aggregationPolicy(),
    }),
    failure("FACTOR_MISMATCH", undefined, undefined, "OTHER"),
  );
});

test("supports only the exact piecewise zero-anchored method", () => {
  for (const method of ["LINEAR", "linear", "PIECEWISE_LINEAR_ZERO_ANCHORED ", null]) {
    assert.deepEqual(
      service.validate({
        policy: { ...policy(), method },
        aggregationPolicy: aggregationPolicy(),
      }),
      failure("INVALID_METHOD"),
    );
  }
});

test("requires a finite two-sided zero-anchored source range", () => {
  for (const sourceRange of [
    null,
    {},
    { minimumPoints: Number.NaN, neutralPoints: 0, maximumPoints: 10 },
    { minimumPoints: -10, neutralPoints: 0, maximumPoints: Infinity },
    { minimumPoints: 0, neutralPoints: 0, maximumPoints: 10 },
    { minimumPoints: 1, neutralPoints: 0, maximumPoints: 10 },
    { minimumPoints: -10, neutralPoints: 0, maximumPoints: 0 },
    { minimumPoints: -10, neutralPoints: 0, maximumPoints: -1 },
    { minimumPoints: -10, neutralPoints: 1, maximumPoints: 10 },
  ]) {
    assert.deepEqual(
      service.validate({
        policy: { ...policy(), sourceRange },
        aggregationPolicy: aggregationPolicy(),
      }),
      failure("INVALID_SOURCE_RANGE"),
    );
  }
});

test("requires callers to declare source bounds that exactly match aggregation bounds", () => {
  for (const sourceRange of [
    { minimumPoints: -9, neutralPoints: 0, maximumPoints: 10 },
    { minimumPoints: -10, neutralPoints: 0, maximumPoints: 9 },
  ]) {
    assert.deepEqual(
      service.validate({
        policy: { ...policy(), sourceRange },
        aggregationPolicy: aggregationPolicy(),
      }),
      failure("SOURCE_RANGE_MISMATCH"),
    );
  }
  assert.deepEqual(
    service.validate({
      policy: { ...policy(), sourceRange: undefined },
      aggregationPolicy: aggregationPolicy(),
    }),
    failure("INVALID_SOURCE_RANGE"),
  );
});

test("requires finite strictly ordered target ranges", () => {
  for (const targetRange of [
    null,
    {},
    { minimumScore: Number.NaN, neutralScore: 50, maximumScore: 100 },
    { minimumScore: 0, neutralScore: 50, maximumScore: Infinity },
    { minimumScore: 50, neutralScore: 50, maximumScore: 100 },
    { minimumScore: 0, neutralScore: 100, maximumScore: 100 },
    { minimumScore: 60, neutralScore: 50, maximumScore: 100 },
    { minimumScore: 0, neutralScore: 110, maximumScore: 100 },
  ]) {
    assert.deepEqual(
      service.validate({
        policy: { ...policy(), targetRange },
        aggregationPolicy: aggregationPolicy(),
      }),
      failure("INVALID_TARGET_RANGE"),
    );
  }
});

test("supports only fail-closed out-of-range and native precision policies", () => {
  for (const outOfRangePolicy of ["CLAMP", "EXTEND_LINEARLY", "fail", null]) {
    assert.deepEqual(
      service.validate({
        policy: { ...policy(), outOfRangePolicy },
        aggregationPolicy: aggregationPolicy(),
      }),
      failure("INVALID_OUT_OF_RANGE_POLICY"),
    );
  }
  for (const precisionPolicy of ["ROUND_2_DECIMALS", "FIXED", "preserve_native", null]) {
    assert.deepEqual(
      service.validate({
        policy: { ...policy(), precisionPolicy },
        aggregationPolicy: aggregationPolicy(),
      }),
      failure("INVALID_PRECISION_POLICY"),
    );
  }
});

test("returns deeply frozen snapshots independent from both source policies", () => {
  const sourceAggregation = aggregationPolicy();
  const sourcePolicy = policy();
  const result = service.validate({ policy: sourcePolicy, aggregationPolicy: sourceAggregation });
  assert.equal(result.valid, true);
  if (!result.valid) return;
  const snapshot = structuredClone(result.policy);
  sourcePolicy.normalizationPolicyId = "MUTATED";
  sourcePolicy.sourceRange.minimumPoints = -99;
  sourcePolicy.targetRange.neutralScore = 40;
  (sourceAggregation as any).policyId = "MUTATED_AGGREGATION";
  sourceAggregation.bounds.minimumPoints = -99;
  assert.deepEqual(result.policy, snapshot);
  assert(Object.isFrozen(result.policy));
  assert(Object.isFrozen(result.policy.sourceRange));
  assert(Object.isFrozen(result.policy.targetRange));
  assert.throws(() => { (result.policy.sourceRange as any).minimumPoints = -20; }, TypeError);
});

test("is deterministic and preserves the frozen first-failure order", () => {
  assert.deepEqual(
    service.validate({ policy: policy(), aggregationPolicy: aggregationPolicy() }),
    service.validate({ policy: policy(), aggregationPolicy: aggregationPolicy() }),
  );
  assert.deepEqual(
    service.validate({
      policy: { ...policy(), normalizationPolicyId: "bad", aggregationPolicyId: "OTHER" },
      aggregationPolicy: aggregationPolicy(),
    }),
    failure("INVALID_POLICY_ID", null, "OTHER"),
  );
  assert.deepEqual(
    service.validate({
      policy: { ...policy(), sourceRange: null, targetRange: null },
      aggregationPolicy: aggregationPolicy(),
    }),
    failure("INVALID_SOURCE_RANGE"),
  );
});

test("service performs validation only with no Phase 2K, arithmetic, decisions, or I/O", () => {
  const source = readFileSync(
    new URL(
      "../../../src/services/factor-aggregate-normalization-policy.service.ts",
      import.meta.url,
    ),
    "utf8",
  ).toLowerCase();
  for (const forbidden of [
    "factor-contribution-aggregation-execution",
    "aggregatepoints",
    "normalizedscore",
    "lowerslope",
    "upperslope",
    "math.round",
    "tofixed",
    "interpolat",
    "decision",
    "scoring",
    "template",
    "controller",
    "scheduler",
    "mongoose",
    "axios",
    "evidence",
    "provider",
    "llm",
    "date.now",
    "math.random",
    "randomuuid",
  ]) assert.equal(source.includes(forbidden), false, forbidden);
});
