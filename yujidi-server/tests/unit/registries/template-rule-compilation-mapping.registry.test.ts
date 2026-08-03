import assert from "node:assert/strict";
import test from "node:test";
import {
  StaticTemplateRuleCompilationMappingRegistry,
  createDefaultTemplateRuleCompilationMappingRegistry,
  isTemplateRuleSourceCoordinate,
} from "../../../src/registries/template-rule-compilation-mapping.registry.js";
import { TemplateRuleCompilationMappingRegistryError, type TemplateRuleCompilationMapping } from "../../../src/types/template-rule-compilation-mapping.types.js";

const mapping = (overrides: Record<string, any> = {}): TemplateRuleCompilationMapping => ({
  identity: { mappingId: "BTC_ETF_FLOW_GENERIC_FACTOR_MAPPING", mappingVersion: 1 },
  source: { evaluatorKey: "GENERIC_FACTOR:CRYPTO.ETF_NET_FLOW" },
  factor: { factorKey: "CRYPTO.ETF_NET_FLOW", factorVersion: 1 },
  subjectBinding: { type: "FIXED", subject: { type: "ASSET", key: "BTC" } },
  evaluator: { evaluatorId: "GENERIC_RELATIONSHIP_FACTOR_EVALUATOR", evaluatorVersion: 1, configurationId: "BTC_ETF_FLOW_DIRECT", configurationVersion: 1 },
  relationshipType: "DIRECT",
  missingDataMappings: [
    { sourcePolicy: "BLOCK", requirementLevel: "MANDATORY", optionalBehavior: null },
    { sourcePolicy: "PARTIAL", requirementLevel: "OPTIONAL", optionalBehavior: "PARTIAL" },
    { sourcePolicy: "IGNORE", requirementLevel: "OPTIONAL", optionalBehavior: "OMIT" },
  ],
  weightPolicy: { type: "USE_EFFECTIVE_TEMPLATE_WEIGHT" },
  provider: { providerBindingId: "BTC_ETF_FLOW_PROVIDER_BINDING", providerBindingVersion: 1, resolutionPolicyId: "BTC_ETF_FLOW_RESOLUTION_POLICY", resolutionPolicyVersion: 1 },
  executionPolicies: { aggregationPolicyId: "DEFAULT_AGGREGATION", aggregationPolicyVersion: 1, normalizationPolicyId: "DEFAULT_NORMALIZATION", normalizationPolicyVersion: 1, decisionBandPolicyId: "DEFAULT_DECISION_BANDS", decisionBandPolicyVersion: 1 },
  compileEligible: true,
  ...overrides,
});

const dependencies = (ineligible: string | null = null) => ({
  factorDefinitions: exact({ definition: { factorKey: "CRYPTO.ETF_NET_FLOW", version: 1 }, compileEligible: ineligible !== "factor" }),
  evaluatorDeclarations: exact({ evaluatorId: "GENERIC_RELATIONSHIP_FACTOR_EVALUATOR", evaluatorVersion: 1, supportedFactorKeys: ["CRYPTO.ETF_NET_FLOW"], supportedRelationshipTypes: ["DIRECT", "INVERSE", "CONDITIONAL", "CONFIRMATION_ONLY", "RISK_ONLY", "VETO"], compileEligible: ineligible !== "evaluator" }),
  evaluatorConfigurations: exact({ configurationId: "BTC_ETF_FLOW_DIRECT", configurationVersion: 1, evaluatorId: "GENERIC_RELATIONSHIP_FACTOR_EVALUATOR", evaluatorVersion: 1, supportedFactorKeys: ["CRYPTO.ETF_NET_FLOW"], supportedRelationshipTypes: ["DIRECT", "INVERSE", "CONDITIONAL", "CONFIRMATION_ONLY", "RISK_ONLY", "VETO"], compileEligible: ineligible !== "configuration" }),
  providerBindings: exact({ providerBindingId: "BTC_ETF_FLOW_PROVIDER_BINDING", providerBindingVersion: 1, factorKey: "CRYPTO.ETF_NET_FLOW", factorVersion: 1, compileEligible: ineligible !== "binding" }),
  resolutionPolicies: exact({ definition: { policyId: "BTC_ETF_FLOW_RESOLUTION_POLICY", policyVersion: 1 }, compileEligible: ineligible !== "resolution" }),
  aggregationPolicies: exact({ definition: { policyId: "DEFAULT_AGGREGATION", policyVersion: 1 }, compileEligible: ineligible !== "aggregation" }),
  normalizationPolicies: exact({ definition: { normalizationPolicyId: "DEFAULT_NORMALIZATION", normalizationPolicyVersion: 1 }, compileEligible: ineligible !== "normalization" }),
  decisionBandPolicies: exact({ definition: { decisionBandPolicyId: "DEFAULT_DECISION_BANDS", decisionBandPolicyVersion: 1 }, compileEligible: ineligible !== "bands" }),
});
const exact = (value: any) => ({ getExact: (_id: string, version: number) => version === 1 ? value : null });
const error = (code: string, fn: () => unknown) => assert.throws(fn, (e: any) => e instanceof TemplateRuleCompilationMappingRegistryError && e.code === code);

test("registers the complete ETF-flow proof with exact immutable history", () => {
  const source: any = mapping();
  const registry = new StaticTemplateRuleCompilationMappingRegistry([source], dependencies() as any);
  source.subjectBinding.subject.key = "ETH";
  assert.equal(registry.getExact("BTC_ETF_FLOW_GENERIC_FACTOR_MAPPING", 1)?.subjectBinding.type, "FIXED");
  assert.equal((registry.getExact("BTC_ETF_FLOW_GENERIC_FACTOR_MAPPING", 1)?.subjectBinding as any).subject.key, "BTC");
  assert.equal(Object.isFrozen(registry.getExact("BTC_ETF_FLOW_GENERIC_FACTOR_MAPPING", 1)?.missingDataMappings), true);
});

test("supports latest and ascending version history without exact substitution", () => {
  const v2 = mapping({ identity: { mappingId: "BTC_ETF_FLOW_GENERIC_FACTOR_MAPPING", mappingVersion: 2 }, relationshipType: "INVERSE" });
  const registry = new StaticTemplateRuleCompilationMappingRegistry([v2, mapping()], dependencies() as any);
  assert.deepEqual(registry.listVersions("BTC_ETF_FLOW_GENERIC_FACTOR_MAPPING").map((v) => v.identity.mappingVersion), [1, 2]);
  assert.equal(registry.getLatest("BTC_ETF_FLOW_GENERIC_FACTOR_MAPPING")?.identity.mappingVersion, 2);
  assert.equal(registry.getExact("BTC_ETF_FLOW_GENERIC_FACTOR_MAPPING", 3), null);
});

test("normalizes evaluator-key lookup and distinguishes unique, missing and ambiguous", () => {
  const second = mapping({ identity: { mappingId: "ETF_FLOW_TRADED_MAPPING", mappingVersion: 1 }, subjectBinding: { type: "TRADED_INSTRUMENT" } });
  const unique = new StaticTemplateRuleCompilationMappingRegistry([mapping()], dependencies() as any);
  assert.equal(unique.findBySourceEvaluatorKey(" generic_factor:crypto.etf_net_flow ").status, "UNIQUE");
  assert.equal(unique.findBySourceEvaluatorKey("UNKNOWN").status, "NOT_FOUND");
  const ambiguous = new StaticTemplateRuleCompilationMappingRegistry([mapping(), second], dependencies() as any);
  assert.equal(ambiguous.findBySourceEvaluatorKey("GENERIC_FACTOR:CRYPTO.ETF_NET_FLOW").status, "AMBIGUOUS");
});

test("compile-ineligible mappings remain exact history but are excluded from authoring lookup", () => {
  const registry = new StaticTemplateRuleCompilationMappingRegistry([mapping({ compileEligible: false })], dependencies() as any);
  assert.ok(registry.getExact("BTC_ETF_FLOW_GENERIC_FACTOR_MAPPING", 1));
  assert.equal(registry.findBySourceEvaluatorKey("GENERIC_FACTOR:CRYPTO.ETF_NET_FLOW").status, "NOT_FOUND");
});

test("rejects duplicate versions and indistinguishable eligible semantics", () => {
  error("DUPLICATE_MAPPING_VERSION", () => new StaticTemplateRuleCompilationMappingRegistry([mapping(), mapping()], dependencies() as any));
  const same = mapping({ identity: { mappingId: "SECOND_MAPPING", mappingVersion: 1 } });
  error("SEMANTIC_MAPPING_CONFLICT", () => new StaticTemplateRuleCompilationMappingRegistry([mapping(), same], dependencies() as any));
});

test("validates identity, source, subject, weight and reference shapes deterministically", () => {
  error("INVALID_MAPPING_ID", () => new StaticTemplateRuleCompilationMappingRegistry([mapping({ identity: { mappingId: "bad", mappingVersion: 1 } })], dependencies() as any));
  error("INVALID_MAPPING_VERSION", () => new StaticTemplateRuleCompilationMappingRegistry([mapping({ identity: { mappingId: "GOOD", mappingVersion: 0 } })], dependencies() as any));
  error("INVALID_SOURCE_EVALUATOR_KEY", () => new StaticTemplateRuleCompilationMappingRegistry([mapping({ source: { evaluatorKey: " " } })], dependencies() as any));
  error("INVALID_SUBJECT_BINDING", () => new StaticTemplateRuleCompilationMappingRegistry([mapping({ subjectBinding: { type: "FIXED", subject: { type: "ASSET", key: "" } } })], dependencies() as any));
  error("INVALID_WEIGHT_POLICY", () => new StaticTemplateRuleCompilationMappingRegistry([mapping({ weightPolicy: { type: "CALCULATE" } })], dependencies() as any));
});

test("accepts all subject instructions without resolving subjects", () => {
  for (const subjectBinding of [{ type: "FIXED", subject: { type: "ASSET", key: "BTC" } }, { type: "TRADED_INSTRUMENT" }, { type: "UNDERLYING_ASSET" }]) {
    assert.ok(new StaticTemplateRuleCompilationMappingRegistry([mapping({ subjectBinding })], dependencies() as any));
  }
});

test("enforces the missing-data compatibility matrix", () => {
  const duplicate = [...mapping().missingDataMappings, { sourcePolicy: "BLOCK", requirementLevel: "MANDATORY", optionalBehavior: null }];
  error("DUPLICATE_MISSING_DATA_POLICY", () => new StaticTemplateRuleCompilationMappingRegistry([mapping({ missingDataMappings: duplicate })], dependencies() as any));
  error("ZERO_MISSING_DATA_POLICY_UNSUPPORTED", () => new StaticTemplateRuleCompilationMappingRegistry([mapping({ missingDataMappings: [{ sourcePolicy: "ZERO", requirementLevel: "OPTIONAL", optionalBehavior: "OMIT" }] })], dependencies() as any));
  error("INVALID_MISSING_DATA_MAPPING", () => new StaticTemplateRuleCompilationMappingRegistry([mapping({ missingDataMappings: [{ sourcePolicy: "BLOCK", requirementLevel: "OPTIONAL", optionalBehavior: "OMIT" }] })], dependencies() as any));
});

test("deferred relationships are historical only", () => {
  for (const relationshipType of ["CONDITIONAL", "CONFIRMATION_ONLY", "RISK_ONLY", "VETO"] as const) {
    error("DEFERRED_RELATIONSHIP_NOT_COMPILE_ELIGIBLE", () => new StaticTemplateRuleCompilationMappingRegistry([mapping({ relationshipType })], dependencies() as any));
    assert.ok(new StaticTemplateRuleCompilationMappingRegistry([mapping({ relationshipType, compileEligible: false })], dependencies() as any));
  }
});

test("compile-eligible mappings require every exact reference to be eligible", () => {
  for (const name of ["factor", "evaluator", "configuration", "binding", "resolution", "aggregation", "normalization", "bands"]) {
    error("REFERENCE_NOT_COMPILE_ELIGIBLE", () => new StaticTemplateRuleCompilationMappingRegistry([mapping()], dependencies(name) as any));
  }
});

test("exact lookup failures and lineage incompatibilities fail closed", () => {
  error("FACTOR_NOT_FOUND", () => new StaticTemplateRuleCompilationMappingRegistry([mapping({ factor: { factorKey: "CRYPTO.ETF_NET_FLOW", factorVersion: 2 } })], dependencies() as any));
  const badEvaluator: any = dependencies(); badEvaluator.evaluatorDeclarations = exact({ ...badEvaluator.evaluatorDeclarations.getExact("x", 1), supportedFactorKeys: ["MARKET.PRICE"] });
  error("EVALUATOR_FACTOR_INCOMPATIBLE", () => new StaticTemplateRuleCompilationMappingRegistry([mapping()], badEvaluator));
  const badBinding: any = dependencies(); badBinding.providerBindings = exact({ ...badBinding.providerBindings.getExact("x", 1), factorVersion: 2 });
  error("PROVIDER_BINDING_FACTOR_INCOMPATIBLE", () => new StaticTemplateRuleCompilationMappingRegistry([mapping()], badBinding));
});

test("every missing exact authority reference has a distinct failure", () => {
  const cases = [
    ["evaluatorDeclarations", "EVALUATOR_DECLARATION_NOT_FOUND"],
    ["evaluatorConfigurations", "CONFIGURATION_NOT_FOUND"],
    ["providerBindings", "PROVIDER_BINDING_NOT_FOUND"],
    ["resolutionPolicies", "RESOLUTION_POLICY_NOT_FOUND"],
    ["aggregationPolicies", "AGGREGATION_POLICY_NOT_FOUND"],
    ["normalizationPolicies", "NORMALIZATION_POLICY_NOT_FOUND"],
    ["decisionBandPolicies", "DECISION_BAND_POLICY_NOT_FOUND"],
  ] as const;
  for (const [authority, code] of cases) {
    const deps: any = dependencies(); deps[authority] = exact(null);
    error(code, () => new StaticTemplateRuleCompilationMappingRegistry([mapping()], deps));
  }
});

test("configuration compatibility is checked on evaluator, factor and relationship", () => {
  const cases = [
    [{ evaluatorId: "OTHER", evaluatorVersion: 1 }, "CONFIGURATION_EVALUATOR_INCOMPATIBLE"],
    [{ supportedFactorKeys: ["MARKET.PRICE"] }, "CONFIGURATION_FACTOR_INCOMPATIBLE"],
    [{ supportedRelationshipTypes: ["INVERSE"] }, "CONFIGURATION_RELATIONSHIP_INCOMPATIBLE"],
  ] as const;
  for (const [change, code] of cases) {
    const deps: any = dependencies();
    deps.evaluatorConfigurations = exact({ ...deps.evaluatorConfigurations.getExact("x", 1), ...change });
    error(code, () => new StaticTemplateRuleCompilationMappingRegistry([mapping()], deps));
  }
});

test("reference validation calls getExact only and never getLatest", () => {
  const deps: any = dependencies();
  for (const authority of Object.values(deps) as any[]) authority.getLatest = () => { throw new Error("getLatest called"); };
  assert.ok(new StaticTemplateRuleCompilationMappingRegistry([mapping()], deps));
});

test("source coordinates distinguish duplicate occurrences and validate structural integrity", () => {
  const first = { sectionIndex: 0, sectionKey: "ETF_FLOW", evaluatorIndex: 0, evaluatorKey: "GENERIC_FACTOR:CRYPTO.ETF_NET_FLOW" };
  const second = { ...first, evaluatorIndex: 1 };
  assert.equal(isTemplateRuleSourceCoordinate(first), true);
  assert.equal(isTemplateRuleSourceCoordinate(second), true);
  assert.notDeepEqual(first, second);
  assert.equal(isTemplateRuleSourceCoordinate({ ...first, evaluatorIndex: -1 }), false);
  assert.equal(isTemplateRuleSourceCoordinate({ ...first, sectionKey: "" }), false);
  assert.equal(isTemplateRuleSourceCoordinate({ ...first, evaluatorKey: "lower" }), false);
});

test("default mapping collection is empty", () => {
  const registry = createDefaultTemplateRuleCompilationMappingRegistry(dependencies() as any);
  assert.equal(registry.findBySourceEvaluatorKey("GENERIC_FACTOR:CRYPTO.ETF_NET_FLOW").status, "NOT_FOUND");
});
