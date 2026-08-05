import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../../../src/errors/AppError.js";
import { BTC_ETF_FLOW_AUTHORITY_IDS, BTC_ETF_FLOW_COMPILED_AGGREGATION_POLICY, BTC_ETF_FLOW_TEMPLATE_SNAPSHOT, createBtcEtfFlowCompilationAuthorities } from "../../../src/registries/btc-etf-flow-characterization.authorities.js";
import { BTC_ETF_FLOW_CHARACTERIZATION_PROVIDER, BTC_ETF_FLOW_CHARACTERIZATION_PROVIDER_KEY, createDefaultProviderAuthorityRegistry } from "../../../src/registries/provider-authority.registry.js";
import { ProviderResolutionRunnerRegistry } from "../../../src/registries/provider-resolution-runner.registry.js";
import { CompiledRulebookCompatibilityValidationService } from "../../../src/services/compiled-rulebook-compatibility-validation.service.js";
import { DeterministicCompiledRulebookCompilerService } from "../../../src/services/deterministic-compiled-rulebook-compiler.service.js";
import { ProviderCatalogService } from "../../../src/services/provider-catalog.service.js";
import { ProviderResolutionExecutionService } from "../../../src/services/provider-resolution-execution.service.js";
import { ProviderResolutionCompositionService } from "../../../src/services/provider-resolution-composition.service.js";
import { ScoringTemplateRegistryService } from "../../../src/services/scoring-template-registry.service.js";

test("template capabilities preserve seven public templates and isolate exact internal compilation lookup", () => {
  const registry = new ScoringTemplateRegistryService();
  assert.equal(registry.list().length, 7);
  assert(!registry.list().some((template) => String(template.key) === BTC_ETF_FLOW_AUTHORITY_IDS.templateKey));
  const registration = registry.getExact(BTC_ETF_FLOW_AUTHORITY_IDS.templateKey, 1);
  assert.deepEqual(registration.capabilities, { listable: false, scoreCheckSelectable: false, duplicable: false, compileEligible: true });
  assert.equal(registry.getForCompilation(BTC_ETF_FLOW_AUTHORITY_IDS.templateKey, 1).key, BTC_ETF_FLOW_AUTHORITY_IDS.templateKey);
  for (const action of [() => registry.getForScoreCheck(BTC_ETF_FLOW_AUTHORITY_IDS.templateKey as never), () => registry.getForDuplication(BTC_ETF_FLOW_AUTHORITY_IDS.templateKey as never)]) {
    assert.throws(action, (error: unknown) => error instanceof AppError && error.message === "SCORING_TEMPLATE_NOT_ELIGIBLE");
  }
  for (const template of registry.list()) {
    const publicRegistration = registry.getExact(template.key, template.version);
    assert.equal(publicRegistration.capabilities.listable, true);
    assert.equal(publicRegistration.capabilities.scoreCheckSelectable, true);
    assert.equal(publicRegistration.capabilities.duplicable, true);
  }
  assert(Object.isFrozen(registration) && Object.isFrozen(registration.template.sections));
});

test("characterization provider is compile/replay eligible, non-live, and has no runner", () => {
  const authority = createDefaultProviderAuthorityRegistry().getExact(BTC_ETF_FLOW_CHARACTERIZATION_PROVIDER_KEY)!;
  assert.deepEqual(authority.capabilities, { compileEligible: true, liveExecutionEligible: false, replayFixtureEligible: true });
  assert.match(authority.providerDefinition.displayName, /internal non-live.*characterization/i);
  assert.equal(new ProviderResolutionRunnerRegistry([]).get(BTC_ETF_FLOW_CHARACTERIZATION_PROVIDER_KEY), null);
  assert(Object.isFrozen(authority) && Object.isFrozen(authority.capabilities));
});

test("Phase 3 rejects characterization authority before live selection", () => {
  const provider = BTC_ETF_FLOW_CHARACTERIZATION_PROVIDER.providerDefinition;
  const binding = { factorKey: "CRYPTO.ETF_NET_FLOW" as const, orderedProviderKeys: [provider.providerKey] };
  const catalog = new ProviderCatalogService().validate({ providers: [provider], bindings: [binding] });
  assert(catalog.valid);
  const result = new ProviderResolutionExecutionService().execute({ catalog: catalog.catalog, binding, healthAssessments: [{ assessed: true, providerKey: provider.providerKey, policyId: BTC_ETF_FLOW_AUTHORITY_IDS.resolutionPolicyId, policyVersion: 1, state: "HEALTHY", reasonCodes: [], metrics: { errorRate: null, telemetryAgeMs: null, successAgeMs: null } }], policy: { policyId: BTC_ETF_FLOW_AUTHORITY_IDS.resolutionPolicyId, policyVersion: 1, factorKey: "CRYPTO.ETF_NET_FLOW", preferredProviderRule: { allowedStates: ["HEALTHY"] }, fallbackProviderRule: { allowedStates: ["HEALTHY"] }, allowDegradedPreferredProvider: false, noUsableProviderOutcome: "UNRESOLVED", confidenceAdjustments: { resolved: 0, degradedPrimaryUsed: -0.1, fallbackUsed: -0.2, proxyUsed: -0.3, manualRequired: -0.4, unresolved: -0.5 } } });
  assert.deepEqual(result, { executed: false, code: "PROVIDER_NOT_LIVE_EXECUTION_ELIGIBLE", factorKey: "CRYPTO.ETF_NET_FLOW", policyId: BTC_ETF_FLOW_AUTHORITY_IDS.resolutionPolicyId });
});

test("composition rejects characterization authority before runner lookup", async () => {
  let runnerLookups = 0;
  const selected = { executed: true as const, result: { factorKey: "CRYPTO.ETF_NET_FLOW" as const, policyId: BTC_ETF_FLOW_AUTHORITY_IDS.resolutionPolicyId, policyVersion: 1, requestedProviderKey: BTC_ETF_FLOW_CHARACTERIZATION_PROVIDER_KEY, confidenceAdjustment: 0, warningCodes: [], attempts: [{ order: 0, providerKey: BTC_ETF_FLOW_CHARACTERIZATION_PROVIDER_KEY, providerType: "DIRECT" as const, healthState: "HEALTHY" as const, outcome: "SELECTED" as const }], resolved: true as const, selectedProviderKey: BTC_ETF_FLOW_CHARACTERIZATION_PROVIDER_KEY, selectedProviderType: "DIRECT" as const, selectedProviderOrder: 0, resolutionStatus: "RESOLVED" as const } };
  const result = await new ProviderResolutionCompositionService().compose({ resolution: selected, providerBinding: { providerBindingId: BTC_ETF_FLOW_AUTHORITY_IDS.providerBindingId, providerBindingVersion: 1, factorKey: "CRYPTO.ETF_NET_FLOW", factorVersion: 1, orderedProviderKeys: [BTC_ETF_FLOW_CHARACTERIZATION_PROVIDER_KEY], compileEligible: true, liveExecutionEligible: false, replayFixtureEligible: true }, resolvedAt: new Date("2026-01-01T00:00:00.000Z"), runnerRegistry: { get: () => { runnerLookups++; return null; } }, executionInput: { adapter: { adapterId: "NEVER_RUN", readCandidates: async () => [] } }, evidenceRepository: { findByEvidenceId: async () => null }, attestationService: { insert: async () => { throw new Error("must not insert"); } }, attestationIdentityFactory: { create: () => { throw new Error("must not create"); } } });
  assert.equal(result.composed, false);
  assert.equal((result as { code: string }).code, "PROVIDER_NOT_LIVE_EXECUTION_ELIGIBLE");
  assert.equal(runnerLookups, 0);
});

test("exact internal authority chain validates and compiles deterministically", () => {
  const authorities = createBtcEtfFlowCompilationAuthorities();
  const compatibility = new CompiledRulebookCompatibilityValidationService(authorities).validate(BTC_ETF_FLOW_TEMPLATE_SNAPSHOT);
  assert(compatibility.compatible);
  const binding = compatibility.specification.resolvedBindings[0]!;
  assert.deepEqual(binding.factor, { factorKey: "CRYPTO.ETF_NET_FLOW", factorVersion: 1 });
  assert.deepEqual(binding.subjectBinding, { type: "FIXED", subject: { type: "ASSET", key: "BTC" } });
  assert.equal(binding.relationshipType, "DIRECT");
  assert.equal(binding.mapping.mappingId, BTC_ETF_FLOW_AUTHORITY_IDS.mappingId);
  assert.equal(binding.provider.providerBindingId, BTC_ETF_FLOW_AUTHORITY_IDS.providerBindingId);
  assert.equal(binding.provider.resolutionPolicyId, BTC_ETF_FLOW_AUTHORITY_IDS.resolutionPolicyId);
  assert.deepEqual(authorities.compiledAggregationPolicies.getExact(BTC_ETF_FLOW_AUTHORITY_IDS.aggregationPolicyId, 1), BTC_ETF_FLOW_COMPILED_AGGREGATION_POLICY);
  assert(authorities.evaluatorImplementations.getExact("GENERIC_RELATIONSHIP_FACTOR_EVALUATOR", 1));
  const compiler = new DeterministicCompiledRulebookCompilerService();
  const request = { rulebookIdentity: { rulebookId: "CRYPTO_BTC_ETF_FLOW_DAILY_RULEBOOK", rulebookVersion: 1 }, compilerLineage: { compilerId: "DETERMINISTIC_COMPILED_RULEBOOK_COMPILER", compilerVersion: 1, compiledAt: new Date("2026-01-01T00:00:00.000Z") }, specification: compatibility.specification };
  const first = compiler.compile(request); const second = compiler.compile(request);
  assert(first.compiled && second.compiled);
  assert.deepEqual(first, second);
  assert.match(first.rulebook.compilation.compilationInputHash, /^[a-f0-9]{64}$/);
  assert(Object.isFrozen(first.rulebook) && Object.isFrozen(first.rulebook.factorBindings));
  assert.equal(first.rulebook.factorBindings[0]!.executionPolicies.normalizationPolicyId, BTC_ETF_FLOW_AUTHORITY_IDS.normalizationPolicyId);
  assert.equal(first.rulebook.factorBindings[0]!.executionPolicies.decisionBandPolicyId, BTC_ETF_FLOW_AUTHORITY_IDS.decisionBandPolicyId);
});
