import assert from "node:assert/strict";
import test from "node:test";
import { CompiledRulebookCompatibilityValidationService } from "../../../src/services/compiled-rulebook/compiled-rulebook-compatibility-validation.service.js";
import type { TemplateRuleCompilationMapping } from "../../../src/types/template-rule-compilation-mapping.types.js";

const mapping = (change: any = {}): TemplateRuleCompilationMapping => ({ identity: { mappingId: "BTC_ETF_FLOW_GENERIC_FACTOR_MAPPING", mappingVersion: 1 }, source: { evaluatorKey: "GENERIC_FACTOR:CRYPTO.ETF_NET_FLOW" }, factor: { factorKey: "CRYPTO.ETF_NET_FLOW", factorVersion: 1 }, subjectBinding: { type: "FIXED", subject: { type: "ASSET", key: "BTC" } }, evaluator: { evaluatorId: "GENERIC_RELATIONSHIP_FACTOR_EVALUATOR", evaluatorVersion: 1, configurationId: "BTC_ETF_FLOW_DIRECT", configurationVersion: 1 }, relationshipType: "DIRECT", missingDataMappings: [{ sourcePolicy: "BLOCK", requirementLevel: "MANDATORY", optionalBehavior: null }, { sourcePolicy: "PARTIAL", requirementLevel: "OPTIONAL", optionalBehavior: "PARTIAL" }, { sourcePolicy: "IGNORE", requirementLevel: "OPTIONAL", optionalBehavior: "OMIT" }], weightPolicy: { type: "USE_EFFECTIVE_TEMPLATE_WEIGHT" }, provider: { providerBindingId: "BTC_ETF_FLOW_PROVIDER_BINDING", providerBindingVersion: 1, resolutionPolicyId: "BTC_ETF_FLOW_RESOLUTION_POLICY", resolutionPolicyVersion: 1 }, executionPolicies: { aggregationPolicyId: "DEFAULT_AGGREGATION", aggregationPolicyVersion: 1, normalizationPolicyId: "DEFAULT_NORMALIZATION", normalizationPolicyVersion: 1, decisionBandPolicyId: "DEFAULT_DECISION_BANDS", decisionBandPolicyVersion: 1 }, compileEligible: true, ...change });
const template = (policy: any = "BLOCK", evaluator: any = {}) => ({ templateId: "BTC_CONTEXT_EXPERIMENTAL", templateVersion: 1, templateKind: "USER" as const, status: "DRAFT" as const, visibility: "PRIVATE" as const, scope: { marketType: "CRYPTO", tradeStyle: "INTRADAY", instrumentType: "SPOT", allowedTradableSymbols: [] }, aggregationMode: "WEIGHTED_SUM" as const, sections: [{ sectionKey: "CRYPTO_CONTEXT", weight: 100, enabled: true, missingDataPolicy: policy, evaluators: [{ evaluatorKey: "GENERIC_FACTOR:CRYPTO.ETF_NET_FLOW", label: "ETF flow", weight: 100, enabled: true, config: {}, ...evaluator }] }] });
const exact = (value: any) => ({ getExact: (_id: string, version: number) => version === 1 ? value : null, getLatest: () => { throw new Error("latest"); } });
const deps = (map: any = mapping(), ineligible: string | null = null): any => ({ mappings: { findBySourceEvaluatorKey: () => ({ status: "UNIQUE", mapping: map }) }, factorDefinitions: exact({ compileEligible: ineligible !== "factor" }), evaluatorDeclarations: exact({ supportedFactorKeys: ["CRYPTO.ETF_NET_FLOW"], supportedRelationshipTypes: ["DIRECT", "INVERSE"], compileEligible: ineligible !== "evaluator" }), evaluatorConfigurations: exact({ evaluatorId: "GENERIC_RELATIONSHIP_FACTOR_EVALUATOR", evaluatorVersion: 1, supportedFactorKeys: ["CRYPTO.ETF_NET_FLOW"], supportedRelationshipTypes: ["DIRECT", "INVERSE"], compileEligible: ineligible !== "config" }), providerBindings: exact({ factorKey: "CRYPTO.ETF_NET_FLOW", factorVersion: 1, compileEligible: ineligible !== "binding" }), resolutionPolicies: exact({ compileEligible: ineligible !== "resolution" }), aggregationPolicies: exact({ compileEligible: ineligible !== "aggregation" }), normalizationPolicies: exact({ compileEligible: ineligible !== "normalization" }), decisionBandPolicies: exact({ compileEligible: ineligible !== "bands" }) });
const validate = (t: any = template(), d: any = deps()) => new CompiledRulebookCompatibilityValidationService(d).validate(t);
const code = (expected: string, result: any) => assert.equal(result.compatible ? "COMPATIBLE" : result.code, expected);

test("resolves the continuous ETF-flow proof into immutable compiler-ready lineage", () => {
  const result = validate(); assert(result.compatible); const b = result.specification.resolvedBindings[0]!;
  assert.equal(result.specification.sourceTemplate.templateSnapshotHash.length, 64); assert.equal(b.source.effectiveWeight, 100);
  assert.equal(b.requirement.requirementLevel, "MANDATORY"); assert.equal(b.sourceRule.sectionIndex, 0); assert(Object.isFrozen(result.specification.resolvedBindings));
  assert.equal("rulebookId" in result.specification, false);
});
test("BLOCK PARTIAL and IGNORE translate from section policy while override remains metadata", () => {
  for (const [policy, level, behavior] of [["BLOCK", "MANDATORY", null], ["PARTIAL", "OPTIONAL", "PARTIAL"], ["IGNORE", "OPTIONAL", "OMIT"]]) {
    const result = validate(template(policy, { missingDataPolicy: "ZERO" })); assert(result.compatible); const b = result.specification.resolvedBindings[0]!;
    assert.deepEqual([b.requirement.requirementLevel, b.requirement.optionalBehavior], [level, behavior]); assert.equal(b.source.legacyEffectiveMissingDataPolicy, policy); assert.equal(b.source.evaluatorMissingDataPolicy, "ZERO");
  }
  code("UNSUPPORTED_LEGACY_ZERO_MISSING_DATA", validate(template("ZERO")));
});
test("configured weights preserve native two-layer precision", () => {
  const t: any = template(); t.sections[0].weight = 40; t.sections[0].evaluators[0].weight = 25;
  t.sections[0].evaluators.push({ ...t.sections[0].evaluators[0], evaluatorKey: "SECOND_IN_SECTION", weight: 75 });
  t.sections.push({ ...t.sections[0], sectionKey: "SECOND_SECTION", weight: 60, evaluators: [{ ...t.sections[0].evaluators[0], evaluatorKey: "THIRD", weight: 100 }] });
  const d = deps(); d.mappings.findBySourceEvaluatorKey = (key: string) => ({ status: "UNIQUE", mapping: key.includes("GENERIC_FACTOR") ? mapping() : mapping({ identity: { mappingId: key, mappingVersion: 1 }, subjectBinding: { type: "FIXED", subject: { type: "ASSET", key } } }) });
  const result = validate(t, d); assert(result.compatible); assert.equal(result.specification.resolvedBindings[0]!.source.effectiveWeight, 10);
});
test("disabled sections and evaluators remain hash material but create no bindings", () => {
  const t: any = template(); t.sections.push({ ...t.sections[0], sectionKey: "OFF", weight: 1, enabled: false }); t.sections[0].evaluators.push({ ...t.sections[0].evaluators[0], evaluatorKey: "OFF", weight: 1, enabled: false });
  const result = validate(t); assert(result.compatible); assert.equal(result.specification.resolvedBindings.length, 1);
});
test("missing and ambiguous mappings fail without first-match behavior", () => {
  for (const [status, expected] of [["NOT_FOUND", "TEMPLATE_RULE_MAPPING_NOT_FOUND"], ["AMBIGUOUS", "TEMPLATE_RULE_MAPPING_AMBIGUOUS"]]) {
    const d = deps(); d.mappings.findBySourceEvaluatorKey = () => status === "AMBIGUOUS" ? { status, mappings: [mapping(), mapping()] } : { status };
    code(expected!, validate(template(), d));
  }
});
test("all exact reference families fail independently and getLatest is never called", () => {
  const cases = [["factorDefinitions", "FACTOR_DEFINITION_NOT_FOUND"], ["evaluatorDeclarations", "EVALUATOR_DECLARATION_NOT_FOUND"], ["evaluatorConfigurations", "EVALUATOR_CONFIGURATION_NOT_FOUND"], ["providerBindings", "PROVIDER_BINDING_NOT_FOUND"], ["resolutionPolicies", "RESOLUTION_POLICY_NOT_FOUND"], ["aggregationPolicies", "AGGREGATION_POLICY_NOT_FOUND"], ["normalizationPolicies", "NORMALIZATION_POLICY_NOT_FOUND"], ["decisionBandPolicies", "DECISION_BAND_POLICY_NOT_FOUND"]];
  for (const [key, expected] of cases) { const d = deps(); d[key!] = exact(null); code(expected!, validate(template(), d)); }
  assert(validate().compatible);
});
test("every compile-ineligible reference fails independently", () => {
  const expected: any = { factor: "FACTOR_REFERENCE_NOT_COMPILE_ELIGIBLE", evaluator: "EVALUATOR_REFERENCE_NOT_COMPILE_ELIGIBLE", config: "CONFIGURATION_REFERENCE_NOT_COMPILE_ELIGIBLE", binding: "PROVIDER_BINDING_NOT_COMPILE_ELIGIBLE", resolution: "RESOLUTION_POLICY_NOT_COMPILE_ELIGIBLE", aggregation: "AGGREGATION_POLICY_NOT_COMPILE_ELIGIBLE", normalization: "NORMALIZATION_POLICY_NOT_COMPILE_ELIGIBLE", bands: "DECISION_BAND_POLICY_NOT_COMPILE_ELIGIBLE" };
  for (const [key, value] of Object.entries(expected)) code(value as string, validate(template(), deps(mapping(), key)));
});
test("deferred relationships and unsupported aggregation modes fail", () => {
  for (const relationshipType of ["CONDITIONAL", "CONFIRMATION_ONLY", "RISK_ONLY", "VETO"]) {
    const d = deps(mapping({ relationshipType }));
    d.evaluatorDeclarations = exact({ supportedFactorKeys: ["CRYPTO.ETF_NET_FLOW"], supportedRelationshipTypes: [relationshipType], compileEligible: true });
    d.evaluatorConfigurations = exact({ evaluatorId: "GENERIC_RELATIONSHIP_FACTOR_EVALUATOR", evaluatorVersion: 1, supportedFactorKeys: ["CRYPTO.ETF_NET_FLOW"], supportedRelationshipTypes: [relationshipType], compileEligible: true });
    code("DEFERRED_RELATIONSHIP_NOT_EXECUTABLE", validate(template(), d));
  }
  code("UNSUPPORTED_AGGREGATION_MODE", validate({ ...template(), aggregationMode: "NORMALIZE_EXECUTED" }));
  code("UNSUPPORTED_AGGREGATION_MODE", validate({ ...template(), aggregationMode: null }));
});
test("duplicate occurrences are coordinates, then semantic duplicate/weight conflicts", () => {
  const same: any = template(); same.sections[0].evaluators.push({ ...same.sections[0].evaluators[0] }); same.sections[0].evaluators.forEach((e: any) => e.weight = 50);
  code("SEMANTIC_BINDING_DUPLICATE", validate(same));
  same.sections[0].evaluators[0].weight = 60; same.sections[0].evaluators[1].weight = 40;
  code("SEMANTIC_BINDING_WEIGHT_CONFLICT", validate(same));
});
test("status, enabled collections, and validation order fail closed", () => {
  code("TEMPLATE_STATUS_NOT_COMPILE_ELIGIBLE", validate({ ...template(), status: "ARCHIVED" }));
  const off: any = template(); off.sections[0].enabled = false; code("NO_ENABLED_SECTIONS", validate(off));
  const noEvaluators: any = template(); noEvaluators.sections[0].evaluators[0].enabled = false; code("NO_ENABLED_EVALUATORS", validate(noEvaluators));
  code("INVALID_TEMPLATE_ID", validate({ ...template(), templateId: " bad " }));
});
test("repeated validation is detached and deterministic with no execution or generated metadata", () => {
  const a = validate(); const b = validate(); assert.deepEqual(a, b); assert(a.compatible && b.compatible);
  assert.equal(JSON.stringify(a).match(/compiledAt|rulebookId|compilerId|Evidence|ScoreCheck/g), null);
});
