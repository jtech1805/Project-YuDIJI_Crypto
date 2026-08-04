import assert from "node:assert/strict";
import test from "node:test";
import { CompiledObservationAttestationValidationService } from "../../../src/services/compiled-observation-attestation-validation.service.js";
import { CompiledShadowInputAssemblyService } from "../../../src/services/compiled-shadow-input-assembly.service.js";

const providerBinding = { providerBindingId: "ETF_PROVIDERS", providerBindingVersion: 1, factorKey: "CRYPTO.ETF_NET_FLOW", factorVersion: 1, orderedProviderKeys: ["PRIMARY", "BACKUP"], compileEligible: true };
const resolutionPolicy = { definition: { policyId: "ETF_RESOLUTION", policyVersion: 1, factorKey: "CRYPTO.ETF_NET_FLOW" }, compileEligible: true };
const factor = { definition: { factorKey: "CRYPTO.ETF_NET_FLOW", version: 1, displayName: "ETF", description: "ETF", status: "ACTIVE", valueTypes: ["NUMBER"], subjectTypes: ["ASSET"], unit: { policy: "ALLOW_LIST", allowedUnits: ["USD"] }, freshness: { kind: "MAX_AGE", maxAgeMs: 86_400_000 }, scoringEligibility: "ELIGIBLE" }, compileEligible: true };
const latest = () => { throw new Error("getLatest forbidden"); };
const createService = (changes: any = {}) => {
  const providerBindings = { getExact: changes.providerExact ?? (() => providerBinding), getLatest: latest };
  const resolutionPolicies = { getExact: changes.resolutionExact ?? (() => resolutionPolicy), getLatest: latest };
  return new CompiledShadowInputAssemblyService({
    factorDefinitions: { getExact: changes.factorExact ?? (() => changes.factor ?? factor), getLatest: latest } as any,
    attestation: new CompiledObservationAttestationValidationService({ providerBindings, resolutionPolicies }),
  });
};
const binding = (subjectBinding: any = { type: "FIXED", subject: { type: "ASSET", key: "BTC" } }) => ({
  bindingId: "ETF_FLOW", order: 0, factor: { factorKey: "CRYPTO.ETF_NET_FLOW", factorVersion: 1 }, subjectBinding,
  evaluator: { evaluatorId: "GENERIC_RELATIONSHIP_FACTOR_EVALUATOR", evaluatorVersion: 1, configurationId: "ETF_DIRECT", configurationVersion: 1 },
  relationshipType: "DIRECT", requirementLevel: "MANDATORY", optionalBehavior: null, weight: 100,
  provider: { providerBindingId: "ETF_PROVIDERS", providerBindingVersion: 1, resolutionPolicyId: "ETF_RESOLUTION", resolutionPolicyVersion: 1 },
  executionPolicies: { aggregationPolicyId: "COMPILED_WEIGHTED_MEAN_V1", aggregationPolicyVersion: 1, normalizationPolicyId: "NORMALIZE", normalizationPolicyVersion: 1, decisionBandPolicyId: "BANDS", decisionBandPolicyVersion: 1 },
});
const observation = (change: any = {}) => ({
  factor: { factorKey: "CRYPTO.ETF_NET_FLOW", factorVersion: 1 }, subject: { type: "ASSET", key: "BTC" }, value: 25, unit: "USD",
  observedAt: new Date("2026-01-01T00:00:00.000Z"), confidence: 0.9,
  providerAttestation: { providerBindingId: "ETF_PROVIDERS", providerBindingVersion: 1, resolutionPolicyId: "ETF_RESOLUTION", resolutionPolicyVersion: 1, selectedProviderKey: "PRIMARY", resolutionOutcome: "RESOLVED" }, ...change,
});
const execution = (observations: any[] = [observation()]): any => ({ rulebook: { rulebookId: "ETF_RULEBOOK", rulebookVersion: 1 }, asOf: new Date("2026-01-02T00:00:00.000Z"), subjectContext: { tradedInstrument: null, underlyingAsset: null }, observations });
const assemble = (service = createService(), e: any = execution(), b: any = binding()) => service.assemble({ execution: e, binding: b });

test("prepares an ETF compiled input end-to-end without Evidence metadata", () => {
  const request = execution(); const compiledBinding = binding(); const result = assemble(createService(), request, compiledBinding);
  assert.equal(result.resolved, true); if (!result.resolved) return;
  assert.deepEqual(result.value.input.freshness, { status: "FRESH", ageMs: 86_400_000, maxAgeMs: 86_400_000 });
  assert.equal(result.value.input.evaluatedAt.getTime(), request.asOf.getTime());
  assert.equal("evidenceId" in result.value.input, false); assert.equal("source" in result.value.input, false);
  assert.deepEqual(result.value.lineage.factor, compiledBinding.factor); assert.deepEqual(result.value.lineage.provider, compiledBinding.provider);
});

test("returns detached deeply frozen deterministic outputs", () => {
  const request = execution(); const compiledBinding = binding(); const service = createService();
  const first = assemble(service, request, compiledBinding); const second = assemble(service, request, compiledBinding);
  assert.deepEqual(first, second); assert.equal(first.resolved, true); if (!first.resolved) return;
  assert(Object.isFrozen(first.value) && Object.isFrozen(first.value.input) && Object.isFrozen(first.value.binding.provider));
  assert.notEqual(first.value.binding, compiledBinding); assert.notEqual(first.value.selectedObservation, request.observations[0]);
  assert.notEqual(first.value.input.evaluatedAt, request.asOf); assert.notEqual(first.value.input.observedAt, request.observations[0]!.observedAt);
  request.asOf.setUTCFullYear(2030); request.observations[0]!.observedAt.setUTCFullYear(2030);
  assert.equal(first.value.input.evaluatedAt.getUTCFullYear(), 2026); assert.equal(first.value.input.observedAt.getUTCFullYear(), 2026);
});

test("supports dynamic subject variants with explicit context", () => {
  const underlying = execution(); underlying.subjectContext.underlyingAsset = { type: "ASSET", key: "BTC" };
  assert.equal(assemble(createService(), underlying, binding({ type: "UNDERLYING_ASSET" })).resolved, true);
  const traded = execution([observation({ subject: { type: "INSTRUMENT", key: "NSE:TATASTEEL" } })]);
  traded.subjectContext.tradedInstrument = { type: "INSTRUMENT", key: "NSE:TATASTEEL" };
  const tradedFactor = { ...factor, definition: { ...factor.definition, subjectTypes: ["INSTRUMENT"] } };
  assert.equal(assemble(createService({ factor: tradedFactor }), traded, binding({ type: "TRADED_INSTRUMENT" })).resolved, true);
});

test("fails request envelope in deterministic order", () => {
  assert.equal((createService().assemble(null) as any).code, "INVALID_EXECUTION_REQUEST");
  assert.equal((assemble(createService(), { ...execution(), rulebook: { rulebookId: "bad", rulebookVersion: 0 }, asOf: new Date("bad") }) as any).code, "INVALID_RULEBOOK_IDENTITY");
  assert.equal((assemble(createService(), { ...execution(), asOf: new Date("bad") }) as any).code, "INVALID_EXECUTION_AS_OF");
  assert.equal((assemble(createService(), { ...execution(), subjectContext: {} }) as any).code, "INVALID_SUBJECT_CONTEXT");
  assert.equal((assemble(createService(), { ...execution(), observations: [] }) as any).code, "EMPTY_OBSERVATION_COLLECTION");
});

test("preserves selection and attestation failures", () => {
  assert.equal((assemble(createService(), execution([observation(), observation()])) as any).code, "DUPLICATE_OBSERVATION");
  assert.equal((assemble(createService(), execution([observation({ value: 30 }), observation()])) as any).code, "AMBIGUOUS_OBSERVATION");
  assert.equal((assemble(createService(), execution([observation({ subject: { type: "ASSET", key: "ETH" } })])) as any).code, "OBSERVATION_NOT_FOUND");
  const badProvider = observation(); badProvider.providerAttestation.selectedProviderKey = "OUTSIDE";
  const result = assemble(createService(), execution([badProvider]));
  assert.deepEqual(result, { resolved: false, code: "OBSERVATION_ATTESTATION_FAILED", attestationCode: "SELECTED_PROVIDER_NOT_IN_BINDING" });
});

test("requires exact compile-eligible factor definition and compatibility", () => {
  assert.equal((assemble(createService({ factorExact: () => null })) as any).code, "FACTOR_DEFINITION_NOT_FOUND");
  assert.equal((assemble(createService({ factor: { ...factor, compileEligible: false } })) as any).code, "FACTOR_DEFINITION_NOT_COMPILE_ELIGIBLE");
  assert.equal((assemble(createService({ factor: { ...factor, definition: { ...factor.definition, subjectTypes: ["INSTRUMENT"] } } })) as any).code, "FACTOR_SUBJECT_NOT_ALLOWED");
  assert.equal((assemble(createService(), execution([observation({ unit: "INR" })])) as any).code, "FACTOR_UNIT_NOT_ALLOWED");
});

test("applies exact existing freshness boundary semantics", () => {
  assert.equal(assemble(createService()).resolved, true);
  assert.equal((assemble(createService(), execution([observation({ observedAt: new Date("2025-12-31T23:59:59.999Z") })])) as any).code, "STALE_OBSERVATION");
  assert.equal((assemble(createService(), execution([observation({ observedAt: new Date("2026-01-02T00:00:00.001Z") })])) as any).code, "OBSERVATION_IN_FUTURE");
  for (const kind of ["VALIDITY_INTERVAL", "NON_EXPIRING"] as const) {
    const custom = { ...factor, definition: { ...factor.definition, freshness: { kind } } };
    const result = assemble(createService({ factor: custom })); assert.equal(result.resolved, true);
    if (result.resolved) assert.deepEqual(result.value.freshness, { status: "NOT_APPLICABLE", policy: kind });
  }
  const invalid = { ...factor, definition: { ...factor.definition, freshness: { kind: "MAX_AGE", maxAgeMs: 0 } } };
  assert.equal((assemble(createService({ factor: invalid })) as any).code, "INVALID_FRESHNESS_POLICY");
});
