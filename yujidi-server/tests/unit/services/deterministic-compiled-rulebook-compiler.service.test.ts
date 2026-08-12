import assert from "node:assert/strict";
import test from "node:test";
import { DeterministicCompiledRulebookCompilerService } from "../../../src/services/compiled-rulebook/deterministic-compiled-rulebook-compiler.service.js";

const fixedDate = () => new Date("2026-08-03T00:00:00.000Z");
const resolvedBinding = (change: any = {}) => ({
  sourceRule: { sectionIndex: 0, sectionKey: "CRYPTO_CONTEXT", evaluatorIndex: 0, evaluatorKey: "GENERIC_FACTOR:CRYPTO.ETF_NET_FLOW" },
  source: { sectionWeight: 100, evaluatorWeight: 100, effectiveWeight: 100, sectionMissingDataPolicy: "BLOCK", evaluatorMissingDataPolicy: null, legacyEffectiveMissingDataPolicy: "BLOCK", sourceConfiguration: {} },
  mapping: { mappingId: "BTC_ETF_FLOW_GENERIC_FACTOR_MAPPING", mappingVersion: 1 },
  factor: { factorKey: "CRYPTO.ETF_NET_FLOW", factorVersion: 1 }, subjectBinding: { type: "FIXED", subject: { type: "ASSET", key: "BTC" } },
  evaluator: { evaluatorId: "GENERIC_RELATIONSHIP_FACTOR_EVALUATOR", evaluatorVersion: 1, configurationId: "BTC_ETF_FLOW_DIRECT", configurationVersion: 1 },
  relationshipType: "DIRECT", requirement: { requirementLevel: "MANDATORY", optionalBehavior: null },
  provider: { providerBindingId: "BTC_ETF_FLOW_PROVIDER_BINDING", providerBindingVersion: 1, resolutionPolicyId: "BTC_ETF_FLOW_RESOLUTION_POLICY", resolutionPolicyVersion: 1 },
  executionPolicies: { aggregationPolicyId: "DEFAULT_AGGREGATION", aggregationPolicyVersion: 1, normalizationPolicyId: "DEFAULT_NORMALIZATION", normalizationPolicyVersion: 1, decisionBandPolicyId: "DEFAULT_DECISION_BANDS", decisionBandPolicyVersion: 1 }, ...change,
});
const specification = (bindings: any[] = [resolvedBinding()], source: any = {}) => ({ sourceTemplate: { templateId: "BTC_CONTEXT_EXPERIMENTAL", templateVersion: 1, templateSnapshotHash: "a".repeat(64), templateKind: "USER", status: "DRAFT", visibility: "PRIVATE", scope: { marketType: "CRYPTO", tradeStyle: "INTRADAY", instrumentType: "SPOT", allowedTradableSymbols: [] }, aggregationMode: "WEIGHTED_SUM", ...source }, resolvedBindings: bindings, futureCrossFactorPolicy: null, futureDecisionPolicy: null });
const request = (change: any = {}) => ({ rulebookIdentity: { rulebookId: "BTC_CONTEXT_EXPERIMENTAL_RULEBOOK", rulebookVersion: 1 }, compilerLineage: { compilerId: "YUDIJI_RULEBOOK_COMPILER", compilerVersion: 1, compiledAt: fixedDate() }, specification: specification(), ...change });
const compiler = new DeterministicCompiledRulebookCompilerService();
const compile = (r: any = request(), c: any = compiler) => c.compile(r);
const failure = (expected: string, value: any) => { const result = compile(value); assert.equal(result.compiled ? "SUCCESS" : result.code, expected); };

test("compiles the ETF-flow proof through Phase 4A/4D1 validation", () => {
  const result = compile(); assert(result.compiled); const binding = result.rulebook.factorBindings[0]!;
  assert.match(result.rulebook.compilation.compilationInputHash, /^[a-f0-9]{64}$/);
  assert.match(binding.bindingId, /^BINDING_[A-F0-9]{64}$/); assert.equal(binding.bindingId.length, 72);
  assert.deepEqual([binding.order, binding.requirementLevel, binding.optionalBehavior, binding.weight], [0, "MANDATORY", null, 100]);
  assert.equal(result.rulebook.crossFactorPolicy, null); assert.equal(result.rulebook.decisionPolicy, null);
});
test("caller identities are validated and preserved", () => {
  for (const [value, code] of [[{ rulebookIdentity: { rulebookId: "bad", rulebookVersion: 1 } }, "INVALID_RULEBOOK_ID"], [{ rulebookIdentity: { rulebookId: "GOOD", rulebookVersion: 0 } }, "INVALID_RULEBOOK_VERSION"], [{ compilerLineage: { ...request().compilerLineage, compilerId: "bad" } }, "INVALID_COMPILER_ID"], [{ compilerLineage: { ...request().compilerLineage, compilerVersion: 0 } }, "INVALID_COMPILER_VERSION"], [{ compilerLineage: { ...request().compilerLineage, compiledAt: new Date("bad") } }, "INVALID_COMPILED_AT"]] as const) failure(code, { ...request(), ...value });
  const result = compile(); assert(result.compiled); assert.deepEqual(result.rulebook.identity, request().rulebookIdentity);
});
test("logical hash excludes compiledAt and rulebook identity but includes compiler version", () => {
  const base = compile(); assert(base.compiled);
  const variants = [request({ compilerLineage: { ...request().compilerLineage, compiledAt: new Date("2027-01-01") } }), request({ rulebookIdentity: { rulebookId: "OTHER", rulebookVersion: 9 } })];
  for (const variant of variants) { const result = compile(variant); assert(result.compiled); assert.equal(result.rulebook.compilation.compilationInputHash, base.rulebook.compilation.compilationInputHash); assert.deepEqual(result.rulebook.factorBindings, base.rulebook.factorBindings); }
  const changed = compile(request({ compilerLineage: { ...request().compilerLineage, compilerVersion: 2 } })); assert(changed.compiled); assert.notEqual(changed.rulebook.compilation.compilationInputHash, base.rulebook.compilation.compilationInputHash);
});
test("all material binding provenance and semantics affect logical hash", () => {
  const base = compile(); assert(base.compiled); const b = resolvedBinding();
  const changes = [
    { sourceRule: { ...b.sourceRule, evaluatorIndex: 1 } }, { mapping: { ...b.mapping, mappingVersion: 2 } }, { factor: { ...b.factor, factorVersion: 2 } },
    { subjectBinding: { type: "TRADED_INSTRUMENT" } }, { evaluator: { ...b.evaluator, evaluatorVersion: 2 } }, { evaluator: { ...b.evaluator, configurationVersion: 2 } },
    { relationshipType: "INVERSE" }, { requirement: { requirementLevel: "OPTIONAL", optionalBehavior: "PARTIAL" } },
    { source: { ...b.source, effectiveWeight: 50 } }, { provider: { ...b.provider, providerBindingVersion: 2 } }, { provider: { ...b.provider, resolutionPolicyVersion: 2 } },
    { executionPolicies: { ...b.executionPolicies, aggregationPolicyVersion: 2 } }, { executionPolicies: { ...b.executionPolicies, normalizationPolicyVersion: 2 } }, { executionPolicies: { ...b.executionPolicies, decisionBandPolicyVersion: 2 } },
  ];
  for (const change of changes) { const result = compile(request({ specification: specification([{ ...b, ...change }]) })); assert(result.compiled); assert.notEqual(result.rulebook.compilation.compilationInputHash, base.rulebook.compilation.compilationInputHash); }
});
test("PARTIAL and OMIT remain distinct compiled behavior", () => {
  const results = ["PARTIAL", "OMIT"].map((optionalBehavior) => compile(request({ specification: specification([resolvedBinding({ source: { ...resolvedBinding().source, sectionMissingDataPolicy: "PARTIAL", legacyEffectiveMissingDataPolicy: "PARTIAL" }, requirement: { requirementLevel: "OPTIONAL", optionalBehavior } })]) })));
  assert(results.every((r) => r.compiled)); if (results[0]!.compiled && results[1]!.compiled) { assert.notEqual(results[0]!.rulebook.compilation.compilationInputHash, results[1]!.rulebook.compilation.compilationInputHash); assert.deepEqual(results.map((r: any) => r.rulebook.factorBindings[0].optionalBehavior), ["PARTIAL", "OMIT"]); }
});
test("multi-binding compilation preserves source order and contiguous orders", () => {
  const second = resolvedBinding({ sourceRule: { ...resolvedBinding().sourceRule, evaluatorIndex: 1, evaluatorKey: "SECOND" }, mapping: { mappingId: "SECOND_MAPPING", mappingVersion: 1 }, subjectBinding: { type: "FIXED", subject: { type: "ASSET", key: "ETH" } } });
  const forward = compile(request({ specification: specification([resolvedBinding(), second]) })); const reverse = compile(request({ specification: specification([second, resolvedBinding()]) }));
  assert(forward.compiled && reverse.compiled); assert.deepEqual(forward.rulebook.factorBindings.map((b: any) => b.order), [0, 1]); assert.deepEqual(forward.rulebook.factorBindings.map((b: any) => b.subjectBinding.subject.key), ["BTC", "ETH"]); assert.deepEqual(reverse.rulebook.factorBindings.map((b: any) => b.subjectBinding.subject.key), ["ETH", "BTC"]); assert.notEqual(forward.rulebook.compilation.compilationInputHash, reverse.rulebook.compilation.compilationInputHash); assert.notEqual(forward.rulebook.factorBindings[0]!.bindingId, forward.rulebook.factorBindings[1]!.bindingId);
});
test("duplicate deterministic binding IDs fail explicitly", () => {
  const sameCoordinate = resolvedBinding({ mapping: { mappingId: "SAME", mappingVersion: 1 } });
  const second = { ...sameCoordinate, subjectBinding: { type: "FIXED", subject: { type: "ASSET", key: "ETH" } } };
  const result = compile(request({ specification: specification([sameCoordinate, second]) })); assert.equal(result.compiled, false); if (!result.compiled) assert.equal(result.code, "DUPLICATE_BINDING_ID");
});
test("invalid specifications and optional behavior fail before construction", () => {
  failure("INVALID_TEMPLATE_SNAPSHOT_HASH", request({ specification: specification([resolvedBinding()], { templateSnapshotHash: "BAD" }) }));
  failure("INVALID_SOURCE_RULE_COORDINATE", request({ specification: specification([resolvedBinding({ sourceRule: { ...resolvedBinding().sourceRule, sectionIndex: -1 } })]) }));
  failure("OPTIONAL_BEHAVIOR_NOT_REPRESENTABLE", request({ specification: specification([resolvedBinding({ requirement: { requirementLevel: "OPTIONAL", optionalBehavior: null } })]) }));
});
test("output is detached deeply frozen and compiledAt is cloned", () => {
  const input: any = request(); const result = compile(input); assert(result.compiled);
  assert.notEqual(result.rulebook.compilation.compiledAt, input.compilerLineage.compiledAt); assert(Object.isFrozen(result.rulebook.factorBindings)); assert(Object.isFrozen(result.rulebook.factorBindings[0]!.subjectBinding));
  input.rulebookIdentity.rulebookId = "CHANGED"; input.specification.resolvedBindings[0].factor.factorVersion = 9; input.compilerLineage.compiledAt.setUTCFullYear(2030);
  assert.equal(result.rulebook.identity.rulebookId, "BTC_CONTEXT_EXPERIMENTAL_RULEBOOK"); assert.equal(result.rulebook.factorBindings[0]!.factor.factorVersion, 1); assert.equal(result.rulebook.compilation.compiledAt.toISOString(), "2026-08-03T00:00:00.000Z");
});
test("repeated compilation is deterministic and exposes no persistence or runtime boundary", () => {
  assert.deepEqual(compile(), compile()); assert.equal("save" in compiler, false); assert.equal("execute" in compiler, false); assert.equal("register" in compiler, false);
});
