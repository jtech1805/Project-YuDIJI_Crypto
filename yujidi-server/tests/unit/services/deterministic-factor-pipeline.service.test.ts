import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DeterministicFactorPipelineService } from "../../../src/services/deterministic-factor-pipeline.service.js";

const input = () => ({ factorKey: "MARKET.PRICE" as const, factorDefinitionVersion: 1, subject: { type: "INSTRUMENT", key: "BTCUSDT" }, evidenceId: "E-1",
  value: { type: "NUMBER" as const, value: 100, unit: "USD" }, source: { sourceType: "MARKET_DATA", provider: "TEST", sourceId: "S-1", priority: 1 },
  observedAt: new Date("2026-08-01T00:00:00Z"), evaluatedAt: new Date("2026-08-01T00:00:01Z"), confidence: null,
  freshness: { status: "FRESH" as const, ageMs: 1000, maxAgeMs: 5000 } });
const plan = () => ({ planId: "TEST_PLAN_V1", planVersion: 1, factorKey: "MARKET.PRICE" as const, failurePolicy: "CONTINUE_ALWAYS" as const,
  steps: [{ order: 1, evaluatorId: "TEST_EVALUATOR_V1", evaluatorVersion: 1, configurationVersion: 1, supportedFactorKeys: ["MARKET.PRICE" as const] }] });
const aggregationPolicy = () => ({ policyId: "TEST_AGGREGATION_V1", policyVersion: 1, planId: "TEST_PLAN_V1", planVersion: 1, factorKey: "MARKET.PRICE" as const,
  method: "WEIGHTED_SUM" as const, bounds: { minimumPoints: -10, maximumPoints: 10 }, outcomeEligibility: { PASS: "ELIGIBLE" as const, FAIL: "ELIGIBLE" as const, NEUTRAL: "ELIGIBLE" as const, UNAVAILABLE: "INELIGIBLE" as const },
  entries: [{ order: 1, evaluatorId: "TEST_EVALUATOR_V1", evaluatorVersion: 1, configurationVersion: 1, weight: 1 }] });
const normalizationPolicy = () => ({ normalizationPolicyId: "TEST_NORMALIZATION_V1", normalizationPolicyVersion: 1, aggregationPolicyId: "TEST_AGGREGATION_V1", aggregationPolicyVersion: 1,
  factorKey: "MARKET.PRICE" as const, method: "PIECEWISE_LINEAR_ZERO_ANCHORED" as const, sourceRange: { minimumPoints: -10, neutralPoints: 0 as const, maximumPoints: 10 },
  targetRange: { minimumScore: 0, neutralScore: 50, maximumScore: 100 }, outOfRangePolicy: "FAIL" as const, precisionPolicy: "PRESERVE_NATIVE" as const });
const decisionPolicy = () => ({ decisionBandPolicyId: "TEST_BANDS_V1", decisionBandPolicyVersion: 1, normalizationPolicyId: "TEST_NORMALIZATION_V1", normalizationPolicyVersion: 1,
  factorKey: "MARKET.PRICE" as const, normalizedRange: { minimumScore: 0, maximumScore: 100 }, bands: ["STRONG_NEGATIVE", "NEGATIVE", "NEUTRAL", "POSITIVE", "STRONG_POSITIVE"].map((label, i) => ({ order: i + 1, label, minimumScore: i * 20, maximumScore: (i + 1) * 20, minimumInclusive: true, maximumInclusive: i === 4 })) });
const report = { ran: true as const, planId: "TEST_PLAN_V1", planVersion: 1, factorKey: "MARKET.PRICE" as const, failurePolicy: "CONTINUE_ALWAYS" as const, status: "COMPLETED" as const,
  termination: { reason: "NONE" as const, stepOrder: null, evaluatorId: null }, summary: { totalSteps: 1, attemptedSteps: 1, skippedSteps: 0, evaluatedSteps: 1, typedEvaluatorFailures: 0, boundaryFailures: 0 }, steps: [] };
const aggregate = { aggregated: true as const, policyId: "TEST_AGGREGATION_V1", policyVersion: 1, planId: "TEST_PLAN_V1", planVersion: 1, factorKey: "MARKET.PRICE" as const,
  method: "WEIGHTED_SUM" as const, aggregatePoints: 0, bounds: { declared: { minimumPoints: -10, maximumPoints: 10 }, theoretical: { minimumPoints: -1, maximumPoints: 1 } }, summary: {} as any, steps: [] };
const normalized = { normalized: true as const, normalizationPolicyId: "TEST_NORMALIZATION_V1", normalizationPolicyVersion: 1, aggregationPolicyId: "TEST_AGGREGATION_V1", aggregationPolicyVersion: 1,
  planId: "TEST_PLAN_V1", planVersion: 1, factorKey: "MARKET.PRICE" as const, method: "PIECEWISE_LINEAR_ZERO_ANCHORED" as const,
  sourceRange: { minimumPoints: -10, neutralPoints: 0 as const, maximumPoints: 10 }, targetRange: { minimumScore: 0, neutralScore: 50, maximumScore: 100 }, rawAggregatePoints: 0,
  segment: "NEUTRAL" as const, normalizedScore: 50, outOfRangePolicy: "FAIL" as const, precisionPolicy: "PRESERVE_NATIVE" as const };
const classified = { classified: true as const, decisionBandPolicyId: "TEST_BANDS_V1", decisionBandPolicyVersion: 1, normalizationPolicyId: "TEST_NORMALIZATION_V1", normalizationPolicyVersion: 1,
  aggregationPolicyId: "TEST_AGGREGATION_V1", aggregationPolicyVersion: 1, planId: "TEST_PLAN_V1", planVersion: 1, factorKey: "MARKET.PRICE" as const,
  normalizedRange: { minimumScore: 0, maximumScore: 100 }, normalizedScore: 50, band: { order: 3, label: "NEUTRAL" as const, minimumScore: 40, maximumScore: 60, minimumInclusive: true as const, maximumInclusive: false } };
const request = () => ({ input: input(), evaluatorPlan: plan(), aggregationPolicy: aggregationPolicy(), normalizationPolicy: normalizationPolicy(), decisionBandPolicy: decisionPolicy() });
const dependencies = (overrides: any = {}) => { const calls: string[] = []; return { calls, deps: {
  evaluatorPlanRunner: { run: (value: any) => { calls.push("2I"); return overrides.run?.(value) ?? report; } },
  aggregationExecution: { execute: (value: any) => { calls.push("2K"); return overrides.aggregate?.(value) ?? aggregate; } },
  normalizationExecution: { execute: (value: any) => { calls.push("2M"); return overrides.normalize?.(value) ?? normalized; } },
  decisionBandExecution: { execute: (value: any) => { calls.push("2O"); return overrides.classify?.(value) ?? classified; } },
} }; };

test("runs all stages exactly once in order and preserves complete lineage", () => { const d = dependencies(); const result = new DeterministicFactorPipelineService(d.deps).execute(request());
  assert.equal(result.completed, true); assert.deepEqual(d.calls, ["2I", "2K", "2M", "2O"]); if (!result.completed) return;
  assert.deepEqual(result.stages.map((s) => s.status), ["COMPLETED", "COMPLETED", "COMPLETED", "COMPLETED", "COMPLETED"]);
  assert.deepEqual(result.identities, { evaluatorPlan: { planId: "TEST_PLAN_V1", planVersion: 1 }, aggregationPolicy: { policyId: "TEST_AGGREGATION_V1", policyVersion: 1 }, normalizationPolicy: { normalizationPolicyId: "TEST_NORMALIZATION_V1", normalizationPolicyVersion: 1 }, decisionBandPolicy: { decisionBandPolicyId: "TEST_BANDS_V1", decisionBandPolicyVersion: 1 } });
});
test("a strong negative analytical label still completes", () => { const d = dependencies({ classify: () => ({ ...classified, band: { ...classified.band, order: 1, label: "STRONG_NEGATIVE", minimumScore: 0, maximumScore: 20 } }) }); assert.equal(new DeterministicFactorPipelineService(d.deps).execute(request()).completed, true); });
test("rejects invalid requests and each malformed boundary without stage calls", () => { for (const value of [null, {}, { ...request(), input: {} }, { ...request(), evaluatorPlan: {} }, { ...request(), aggregationPolicy: {} }, { ...request(), normalizationPolicy: {} }, { ...request(), decisionBandPolicy: {} }]) { const d = dependencies(); const result = new DeterministicFactorPipelineService(d.deps).execute(value as any); assert.equal(result.completed, false); assert.deepEqual(d.calls, []); } });
test("preflight rejects every lineage mismatch without stage calls", () => { const cases = [
  { input: { ...input(), factorKey: "OTHER" } }, { aggregationPolicy: { ...aggregationPolicy(), planVersion: 2 } },
  { aggregationPolicy: { ...aggregationPolicy(), entries: [] } }, { normalizationPolicy: { ...normalizationPolicy(), aggregationPolicyVersion: 2 } },
  { normalizationPolicy: { ...normalizationPolicy(), sourceRange: { minimumPoints: -9, neutralPoints: 0, maximumPoints: 10 } } },
  { decisionBandPolicy: { ...decisionPolicy(), normalizationPolicyVersion: 2 } }, { decisionBandPolicy: { ...decisionPolicy(), normalizedRange: { minimumScore: 0, maximumScore: 99 } } },
 ]; for (const changed of cases) { const d = dependencies(); const result = new DeterministicFactorPipelineService(d.deps).execute({ ...request(), ...changed } as any); assert.equal(result.completed, false); assert.deepEqual(d.calls, []); } });
test("typed stage failures short-circuit later stages with complete traces", () => { const cases = [
  [{ run: () => ({ ran: false, planId: "TEST_PLAN_V1", factorKey: "MARKET.PRICE", code: "INVALID_REQUEST" }) }, ["2I"], "EVALUATOR_EXECUTION"],
  [{ aggregate: () => ({ aggregated: false, code: "AGGREGATE_OUT_OF_BOUNDS" }) }, ["2I", "2K"], "CONTRIBUTION_AGGREGATION"],
  [{ normalize: () => ({ normalized: false, code: "RAW_AGGREGATE_OUT_OF_RANGE" }) }, ["2I", "2K", "2M"], "NORMALIZATION"],
  [{ classify: () => ({ classified: false, code: "NO_MATCHING_BAND" }) }, ["2I", "2K", "2M", "2O"], "DECISION_BAND_CLASSIFICATION"],
 ] as const; for (const [override, calls, stage] of cases) { const d = dependencies(override); const result = new DeterministicFactorPipelineService(d.deps).execute(request()); assert.equal(result.completed, false); assert.deepEqual(d.calls, calls); if (!result.completed) { assert.equal(result.failedStage, stage); assert.equal(result.stages.length, 5); } } });
test("unexpected exceptions are sanitized and short-circuit at every stage", () => { for (const key of ["run", "aggregate", "normalize", "classify"]) { const d = dependencies({ [key]: () => { throw new Error("secret"); } }); const result = new DeterministicFactorPipelineService(d.deps).execute(request()); assert.equal(result.completed, false); if (!result.completed) { assert.equal(result.code, "UNEXPECTED_STAGE_EXCEPTION"); assert.equal(result.stageFailureCode, null); assert.equal(JSON.stringify(result).includes("secret"), false); } } });
test("passes exact inputs and prior outputs to dependencies", () => { const req = request(); const seen: any[] = []; const d = dependencies({ run: (v: any) => { seen.push(v); return report; }, aggregate: (v: any) => { seen.push(v); return aggregate; }, normalize: (v: any) => { seen.push(v); return normalized; }, classify: (v: any) => { seen.push(v); return classified; } }); new DeterministicFactorPipelineService(d.deps).execute(req); assert.equal(seen[0].plan, req.evaluatorPlan); assert.equal(seen[0].input, req.input); assert.equal(seen[1].report, report); assert.equal(seen[2].aggregation, aggregate); assert.equal(seen[3].normalization, normalized); });
test("outputs are immutable, minimized, deterministic, and contain no generated metadata", () => { const d1 = dependencies(); const d2 = dependencies(); const a = new DeterministicFactorPipelineService(d1.deps).execute(request()); const b = new DeterministicFactorPipelineService(d2.deps).execute(request()); assert.deepEqual(a, b); assert(Object.isFrozen(a) && Object.isFrozen(a.stages)); const json = JSON.stringify(a); for (const word of ["provider payload", "legacyScore", "brokerAction", "pipelineId", "createdAt", "startedAt", "completedAt", "durationMs"]) assert.equal(json.includes(word), false); });
test("composition source delegates without duplicated phase logic or forbidden imports", () => { const source = readFileSync(new URL("../../../src/services/deterministic-factor-pipeline.service.ts", import.meta.url), "utf8"); for (const word of ["factor-input-assembly.service", "registry", "evidence-read", "evidence.repository", "provider", "scoring-engine", "controller", "scheduler", "Math.round", "toFixed", "aggregatePoints +=", "normalizedScore =", ".filter((band"]) assert.equal(source.toLowerCase().includes(word.toLowerCase()), false, word); });
