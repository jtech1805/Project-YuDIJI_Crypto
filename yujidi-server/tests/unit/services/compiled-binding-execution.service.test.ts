import assert from "node:assert/strict";
import test from "node:test";
import { StaticCompiledEvaluatorImplementationRegistry } from "../../../src/registries/compiled-evaluator-implementation.registry.js";
import { CompiledBindingExecutionService } from "../../../src/services/compiled-binding-execution.service.js";
import { CompiledGenericRelationshipEvaluator } from "../../../src/services/compiled-generic-relationship-evaluator.js";

const config = (relationshipType: "DIRECT" | "INVERSE" = "DIRECT") => ({ configurationType: "GENERIC_RELATIONSHIP", configurationId: `ETF_${relationshipType}`, configurationVersion: 1, evaluatorId: "GENERIC_RELATIONSHIP_FACTOR_EVALUATOR", evaluatorVersion: 1, supportedFactorKeys: ["CRYPTO.ETF_NET_FLOW"], supportedRelationshipTypes: [relationshipType], compileEligible: true, configuration: { relationshipType, expectedUnit: "USD", thresholds: { strongNegativeMax: -300, negativeMax: -100, positiveMin: 100, strongPositiveMin: 300 }, contributions: { strongNegative: -2, negative: -1, neutral: 0, positive: 1, strongPositive: 2 }, minimumPoints: -2, maximumPoints: 2 } });
const binding = (relationshipType: "DIRECT" | "INVERSE" = "DIRECT", requirementLevel: "MANDATORY" | "OPTIONAL" = "MANDATORY", optionalBehavior: "PARTIAL" | "OMIT" | null = null): any => ({ bindingId: "ETF_BINDING", order: 0, factor: { factorKey: "CRYPTO.ETF_NET_FLOW", factorVersion: 1 }, subjectBinding: { type: "FIXED", subject: { type: "ASSET", key: "BTC" } }, evaluator: { evaluatorId: "GENERIC_RELATIONSHIP_FACTOR_EVALUATOR", evaluatorVersion: 1, configurationId: `ETF_${relationshipType}`, configurationVersion: 1 }, relationshipType, requirementLevel, optionalBehavior, weight: 100, provider: { providerBindingId: "ETF_PROVIDERS", providerBindingVersion: 1, resolutionPolicyId: "ETF_RESOLUTION", resolutionPolicyVersion: 1 }, executionPolicies: { aggregationPolicyId: "COMPILED_MEAN", aggregationPolicyVersion: 1, normalizationPolicyId: "NORMALIZE", normalizationPolicyVersion: 1, decisionBandPolicyId: "BANDS", decisionBandPolicyVersion: 1 } });
const resolved = (relationshipType: "DIRECT" | "INVERSE" = "DIRECT", value = 400): any => {
  const b = binding(relationshipType); const providerAttestation = { providerBindingId: "ETF_PROVIDERS", providerBindingVersion: 1, resolutionPolicyId: "ETF_RESOLUTION", resolutionPolicyVersion: 1, selectedProviderKey: "PRIMARY", resolutionOutcome: "RESOLVED" };
  const observation = { factor: { ...b.factor }, subject: { type: "ASSET", key: "BTC" }, value, unit: "USD", observedAt: new Date("2026-01-01T00:00:00Z"), confidence: 0.75, providerAttestation: { ...providerAttestation } };
  return { rulebook: { rulebookId: "ETF_RULEBOOK", rulebookVersion: 1 }, binding: b, resolvedSubject: { type: "ASSET", key: "BTC" }, selectedObservation: observation,
    freshness: { status: "FRESH", ageMs: 3600000, maxAgeMs: 86400000 }, input: { factor: { ...b.factor }, subject: { type: "ASSET", key: "BTC" }, value: { type: "NUMBER", value, unit: "USD" }, observedAt: new Date("2026-01-01T00:00:00Z"), evaluatedAt: new Date("2026-01-01T01:00:00Z"), confidence: 0.75, freshness: { status: "FRESH", ageMs: 3600000, maxAgeMs: 86400000 }, providerAttestation: { ...providerAttestation } },
    lineage: { factor: { ...b.factor }, evaluator: { ...b.evaluator }, provider: { ...b.provider }, executionPolicies: { ...b.executionPolicies } } };
};
const declaration = (change: any = {}) => ({ evaluatorId: "GENERIC_RELATIONSHIP_FACTOR_EVALUATOR", evaluatorVersion: 1, implementationKey: "GENERIC_RELATIONSHIP_FACTOR_EVALUATOR", supportedFactorKeys: ["CRYPTO.ETF_NET_FLOW"], supportedRelationshipTypes: ["DIRECT", "INVERSE"], compileEligible: true, ...change });
const create = (changes: any = {}) => {
  const calls: string[] = []; const latest = () => { throw new Error("getLatest forbidden"); };
  const implementation = changes.implementation ?? new CompiledGenericRelationshipEvaluator();
  const service = new CompiledBindingExecutionService({
    evaluatorDeclarations: { getExact: (...args: any[]) => { calls.push(`declaration:${args.join(":")}`); return changes.declaration === undefined ? declaration() : changes.declaration; }, getLatest: latest } as any,
    evaluatorConfigurations: { getExact: (id: string, version: number) => { calls.push(`configuration:${id}:${version}`); return changes.configuration === undefined ? config(id.endsWith("INVERSE") ? "INVERSE" : "DIRECT") : changes.configuration; }, getLatest: latest } as any,
    evaluatorImplementations: changes.registry ?? new StaticCompiledEvaluatorImplementationRegistry(implementation ? [implementation] : []),
  }); return { service, calls };
};

test("executes DIRECT and INVERSE with exact lineage and score", () => {
  for (const relationship of ["DIRECT", "INVERSE"] as const) {
    const { service, calls } = create(); const result = service.execute(resolved(relationship));
    assert.equal(result.produced, true); if (!result.produced) continue;
    assert.equal(result.result.executionStatus, "EXECUTED"); assert.equal(result.result.disposition, "INCLUDED");
    assert.equal(result.result.rawEvaluatorResult?.contribution.points, relationship === "DIRECT" ? 2 : -2);
    assert.equal(result.result.bindingScore, relationship === "DIRECT" ? 100 : 0);
    assert.deepEqual(calls, [`declaration:GENERIC_RELATIONSHIP_FACTOR_EVALUATOR:1`, `configuration:ETF_${relationship}:1`]);
  }
});

test("preserves provider lineage confidence freshness and cloned timestamps", () => {
  const source = resolved(); const result = create().service.execute(source); assert(result.produced); if (!result.produced) return;
  assert.deepEqual(result.result.providerAttestation, source.input.providerAttestation); assert.equal(result.result.confidence, 0.75);
  assert.deepEqual(result.result.freshness, source.input.freshness); assert.notEqual(result.result.observedAt, source.input.observedAt);
  assert.notEqual(result.result.evaluatedAt, source.input.evaluatedAt); assert(Object.isFrozen(result.result) && Object.isFrozen(result.result.binding.provider));
});

test("identical inputs produce deeply equal detached outputs", () => {
  const runtime = create().service; const input = resolved(); const first = runtime.execute(input); const second = runtime.execute(input);
  assert.deepEqual(first, second); assert(first.produced && second.produced); if (!first.produced || !second.produced) return;
  assert.notEqual(first.result, second.result); input.input.observedAt.setUTCFullYear(2030); assert.equal(first.result.observedAt?.getUTCFullYear(), 2026);
});

test("fails exact declarations configurations implementations and compatibility in order", () => {
  assert.equal((create({ declaration: null }).service.execute(resolved()) as any).result.executionFailureCode, "EVALUATOR_DECLARATION_NOT_FOUND");
  assert.equal((create({ declaration: declaration({ compileEligible: false }) }).service.execute(resolved()) as any).result.executionFailureCode, "EVALUATOR_DECLARATION_NOT_COMPILE_ELIGIBLE");
  assert.equal((create({ declaration: declaration({ supportedFactorKeys: [] }) }).service.execute(resolved()) as any).result.executionFailureCode, "EVALUATOR_FACTOR_NOT_SUPPORTED");
  assert.equal((create({ declaration: declaration({ supportedRelationshipTypes: [] }) }).service.execute(resolved()) as any).result.executionFailureCode, "EVALUATOR_RELATIONSHIP_NOT_SUPPORTED");
  assert.equal((create({ configuration: null }).service.execute(resolved()) as any).result.executionFailureCode, "EVALUATOR_CONFIGURATION_NOT_FOUND");
  assert.equal((create({ configuration: { ...config(), compileEligible: false } }).service.execute(resolved()) as any).result.executionFailureCode, "EVALUATOR_CONFIGURATION_NOT_COMPILE_ELIGIBLE");
  assert.equal((create({ configuration: { ...config(), evaluatorVersion: 2 } }).service.execute(resolved()) as any).result.executionFailureCode, "EVALUATOR_CONFIGURATION_LINEAGE_MISMATCH");
  assert.equal((create({ configuration: { ...config(), supportedFactorKeys: [] } }).service.execute(resolved()) as any).result.executionFailureCode, "EVALUATOR_CONFIGURATION_FACTOR_NOT_SUPPORTED");
  assert.equal((create({ configuration: { ...config(), supportedRelationshipTypes: [] } }).service.execute(resolved()) as any).result.executionFailureCode, "EVALUATOR_CONFIGURATION_RELATIONSHIP_NOT_SUPPORTED");
  assert.equal((create({ configuration: { ...config(), configuration: { ...config().configuration, relationshipType: "INVERSE" } } }).service.execute(resolved()) as any).result.executionFailureCode, "EVALUATOR_CONFIGURATION_RELATIONSHIP_MISMATCH");
  assert.equal((create({ registry: new StaticCompiledEvaluatorImplementationRegistry([]) }).service.execute(resolved()) as any).result.executionFailureCode, "EVALUATOR_IMPLEMENTATION_NOT_FOUND");
});

test("rejects implementation identity mismatch and sanitizes thrown execution", () => {
  const mismatch = { implementationKey: "GENERIC_RELATIONSHIP_FACTOR_EVALUATOR", evaluatorId: "OTHER", evaluatorVersion: 1, evaluate: () => { throw new Error("secret"); } };
  assert.equal((create({ registry: { getExact: () => mismatch } }).service.execute(resolved()) as any).result.executionFailureCode, "EVALUATOR_IMPLEMENTATION_IDENTITY_MISMATCH");
  const throwing = { implementationKey: "GENERIC_RELATIONSHIP_FACTOR_EVALUATOR", evaluatorId: "GENERIC_RELATIONSHIP_FACTOR_EVALUATOR", evaluatorVersion: 1, evaluate: () => { throw new Error("secret"); } };
  const result = create({ registry: { getExact: () => throwing } }).service.execute(resolved());
  assert.equal((result as any).result.executionFailureCode, "EVALUATOR_EXECUTION_FAILED"); assert.equal(JSON.stringify(result).includes("secret"), false);
});

test("maps every preparation category and reuses mandatory partial omit dispositions", () => {
  const rulebook = { rulebookId: "ETF_RULEBOOK", rulebookVersion: 1 };
  for (const code of ["MISSING_TRADED_INSTRUMENT", "MISSING_UNDERLYING_ASSET", "OBSERVATION_NOT_FOUND", "STALE_OBSERVATION"] as const) {
    const result = create().service.fromPreparation({ rulebook, binding: binding(), preparation: { resolved: false, code } });
    assert(result.produced); if (result.produced) { assert.equal(result.result.inputState, "MISSING"); assert.equal(result.result.disposition, "BLOCKING"); }
  }
  const partial = create().service.fromPreparation({ rulebook, binding: binding("DIRECT", "OPTIONAL", "PARTIAL"), preparation: { resolved: false, code: "OBSERVATION_NOT_FOUND" } });
  const omit = create().service.fromPreparation({ rulebook, binding: binding("DIRECT", "OPTIONAL", "OMIT"), preparation: { resolved: false, code: "INVALID_SHADOW_OBSERVATION" } });
  assert(partial.produced && omit.produced); if (partial.produced && omit.produced) { assert.equal(partial.result.disposition, "PARTIAL"); assert.equal(omit.result.disposition, "OMITTED"); assert.equal(omit.result.inputState, "INVALID"); }
});

test("preserves nested provider attestation preparation failure", () => {
  const result = create().service.fromPreparation({ rulebook: { rulebookId: "ETF_RULEBOOK", rulebookVersion: 1 }, binding: binding(), preparation: { resolved: false, code: "OBSERVATION_ATTESTATION_FAILED", attestationCode: "SELECTED_PROVIDER_NOT_IN_BINDING" } });
  assert(result.produced); if (result.produced) { assert.equal(result.result.inputState, "INVALID"); assert.equal(result.result.attestationFailureCode, "SELECTED_PROVIDER_NOT_IN_BINDING"); }
});
