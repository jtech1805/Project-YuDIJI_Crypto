import assert from "node:assert/strict";
import test from "node:test";

import { CompiledRulebookContractValidationService } from "../../../src/services/compiled-rulebook/compiled-rulebook-contract-validation.service.js";
import { MAX_COMPILED_RULEBOOK_FACTOR_BINDINGS } from "../../../src/types/compiled-rulebook.types.js";

const HASH = "a".repeat(64);
const service = new CompiledRulebookContractValidationService();

const binding = (overrides: Record<string, unknown> = {}) => ({
  bindingId: "BTC_ETF_FLOW_CONTEXT",
  order: 0,
  factor: { factorKey: "CRYPTO.ETF_NET_FLOW", factorVersion: 1 },
  subjectBinding: { type: "FIXED", subject: { type: "ASSET", key: "BTC" } },
  evaluator: {
    evaluatorId: "GENERIC_RELATIONSHIP_FACTOR_EVALUATOR",
    evaluatorVersion: 1,
    configurationId: "BTC_ETF_FLOW_DIRECT_V1",
    configurationVersion: 1,
  },
  relationshipType: "DIRECT",
  requirementLevel: "OPTIONAL",
  optionalBehavior: "PARTIAL",
  weight: 1,
  provider: {
    providerBindingId: "BTC_ETF_FLOW_PROVIDER_BINDING",
    providerBindingVersion: 1,
    resolutionPolicyId: "BTC_ETF_FLOW_RESOLUTION_POLICY",
    resolutionPolicyVersion: 1,
  },
  executionPolicies: {
    aggregationPolicyId: "DEFAULT_FACTOR_AGGREGATION",
    aggregationPolicyVersion: 1,
    normalizationPolicyId: "DEFAULT_FACTOR_NORMALIZATION",
    normalizationPolicyVersion: 1,
    decisionBandPolicyId: "DEFAULT_FACTOR_DECISION_BANDS",
    decisionBandPolicyVersion: 1,
  },
  ...overrides,
});

const rulebook = (overrides: Record<string, unknown> = {}) => ({
  identity: { rulebookId: "BTC_CONTEXT_EXPERIMENTAL_RULEBOOK", rulebookVersion: 1 },
  source: { templateId: "BTC_CONTEXT_EXPERIMENTAL", templateVersion: 1 },
  compilation: {
    compilerId: "YUDIJI_RULEBOOK_COMPILER",
    compilerVersion: 1,
    compilationInputHash: HASH,
    compiledAt: new Date("2026-08-03T00:00:00.000Z"),
  },
  factorBindings: [binding()],
  crossFactorPolicy: null,
  decisionPolicy: null,
  ...overrides,
});

const validate = (value: unknown) => service.validate({ rulebook: value });
const expectFailure = (value: unknown, code: string, path?: string) => {
  const result = validate(value);
  assert.equal(result.valid, false);
  if (result.valid) return;
  assert.equal(result.code, code);
  if (path) assert.equal(result.path, path);
  assert.equal(Object.isFrozen(result), true);
};

test("accepts the minimal crypto ETF-flow rulebook and freezes a detached copy", () => {
  const input = rulebook();
  const result = validate(input);
  assert.equal(result.valid, true);
  if (!result.valid) return;
  assert.deepEqual(result.rulebook, input);
  assert.notEqual(result.rulebook, input);
  assert.notEqual(result.rulebook.factorBindings, input.factorBindings);
  assert.notEqual(result.rulebook.compilation.compiledAt, input.compilation.compiledAt);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.rulebook), true);
  assert.equal(Object.isFrozen(result.rulebook.factorBindings), true);
  assert.equal(Object.isFrozen(result.rulebook.factorBindings[0]?.subjectBinding), true);

  input.identity.rulebookId = "CHANGED";
  input.factorBindings[0]!.bindingId = "CHANGED";
  input.compilation.compiledAt.setUTCFullYear(2030);
  assert.equal(result.rulebook.identity.rulebookId, "BTC_CONTEXT_EXPERIMENTAL_RULEBOOK");
  assert.equal(result.rulebook.factorBindings[0]?.bindingId, "BTC_ETF_FLOW_CONTEXT");
  assert.equal(result.rulebook.compilation.compiledAt.toISOString(), "2026-08-03T00:00:00.000Z");
  assert.throws(() => { (result.rulebook.factorBindings as unknown[]).push(binding()); }, TypeError);
});

test("validation is deterministic and keeps no mutable output state", () => {
  const input = rulebook();
  const first = validate(input);
  const second = validate(input);
  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  if (first.valid && second.valid) {
    first.rulebook.compilation.compiledAt.setUTCFullYear(2035);
    assert.equal(second.rulebook.compilation.compiledAt.toISOString(), "2026-08-03T00:00:00.000Z");
  }
});

test("accepts ordered multiple bindings, both registered factors, and dynamic subjects", () => {
  const result = validate(rulebook({
    factorBindings: [
      binding({ bindingId: "PRICE", factor: { factorKey: "MARKET.PRICE", factorVersion: 1 }, subjectBinding: { type: "TRADED_INSTRUMENT" } }),
      binding({ bindingId: "FLOW", order: 1, subjectBinding: { type: "UNDERLYING_ASSET" } }),
    ],
  }));
  assert.equal(result.valid, true);
});

test("accepts the same factor with a different subject binding", () => {
  const result = validate(rulebook({ factorBindings: [
    binding(),
    binding({ bindingId: "BTC_ETF_FLOW_FOR_INSTRUMENT", order: 1, subjectBinding: { type: "TRADED_INSTRUMENT" } }),
  ] }));
  assert.equal(result.valid, true);
});

test("accepts nullable and valid future policy lineage", () => {
  assert.equal(validate(rulebook()).valid, true);
  assert.equal(validate(rulebook({
    crossFactorPolicy: { policyId: "CLUSTER_POLICY", policyVersion: 1 },
    decisionPolicy: { policyId: "DECISION_POLICY", policyVersion: 1 },
  })).valid, true);
});

test("rejects malformed top-level identity and compilation lineage in frozen order", () => {
  expectFailure(null, "INVALID_RULEBOOK");
  expectFailure(rulebook({ identity: { rulebookId: "", rulebookVersion: 0 } }), "INVALID_RULEBOOK_ID");
  expectFailure(rulebook({ identity: { rulebookId: " BAD", rulebookVersion: 1 } }), "INVALID_RULEBOOK_ID");
  expectFailure(rulebook({ identity: { rulebookId: "OK", rulebookVersion: 0 } }), "INVALID_RULEBOOK_VERSION");
  expectFailure(rulebook({ source: { templateId: "", templateVersion: 1 } }), "INVALID_SOURCE_TEMPLATE_ID");
  expectFailure(rulebook({ source: { templateId: "TEMPLATE", templateVersion: 1.5 } }), "INVALID_SOURCE_TEMPLATE_VERSION");
  expectFailure(rulebook({ compilation: { ...rulebook().compilation, compilerId: "" } }), "INVALID_COMPILER_ID");
  expectFailure(rulebook({ compilation: { ...rulebook().compilation, compilerVersion: 0 } }), "INVALID_COMPILER_VERSION");
  expectFailure(rulebook({ compilation: { ...rulebook().compilation, compilationInputHash: "ABC" } }), "INVALID_COMPILATION_INPUT_HASH");
  expectFailure(rulebook({ compilation: { ...rulebook().compilation, compiledAt: new Date("invalid") } }), "INVALID_COMPILED_AT");
});

test("enforces factor-binding collection bounds and deterministic order", () => {
  expectFailure(rulebook({ factorBindings: [] }), "EMPTY_FACTOR_BINDINGS");
  expectFailure(rulebook({ factorBindings: Array.from({ length: MAX_COMPILED_RULEBOOK_FACTOR_BINDINGS + 1 }, (_, order) => binding({ bindingId: `B_${order}`, order })) }), "TOO_MANY_FACTOR_BINDINGS");
  expectFailure(rulebook({ factorBindings: [binding(), binding({ order: 1 })] }), "DUPLICATE_BINDING_ID");
  expectFailure(rulebook({ factorBindings: [binding(), binding({ bindingId: "SECOND" })] }), "DUPLICATE_BINDING_ORDER");
  expectFailure(rulebook({ factorBindings: [binding(), binding({ bindingId: "SECOND", order: 2 })] }), "NON_CONTIGUOUS_BINDING_ORDER");
});

test("rejects invalid factor and subject lineage", () => {
  expectFailure(rulebook({ factorBindings: [binding({ bindingId: "" })] }), "INVALID_BINDING_ID");
  expectFailure(rulebook({ factorBindings: [binding({ factor: { factorKey: "UNKNOWN", factorVersion: 1 } })] }), "UNKNOWN_FACTOR");
  expectFailure(rulebook({ factorBindings: [binding({ factor: { factorKey: "MARKET.PRICE", factorVersion: 0 } })] }), "INVALID_FACTOR_VERSION");
  expectFailure(rulebook({ factorBindings: [binding({ subjectBinding: { type: "FIXED", subject: { type: "ASSET", key: " BTC" } } })] }), "INVALID_FIXED_SUBJECT");
  expectFailure(rulebook({ factorBindings: [binding({ subjectBinding: { type: "BENCHMARK" } })] }), "UNKNOWN_SUBJECT_BINDING_TYPE");
});

test("rejects invalid evaluator, relationship, requirement, and weight", () => {
  const base = binding().evaluator;
  expectFailure(rulebook({ factorBindings: [binding({ evaluator: { ...base, evaluatorId: "" } })] }), "INVALID_EVALUATOR_ID");
  expectFailure(rulebook({ factorBindings: [binding({ evaluator: { ...base, evaluatorVersion: 0 } })] }), "INVALID_EVALUATOR_VERSION");
  expectFailure(rulebook({ factorBindings: [binding({ evaluator: { ...base, configurationId: "" } })] }), "INVALID_CONFIGURATION_ID");
  expectFailure(rulebook({ factorBindings: [binding({ evaluator: { ...base, configurationVersion: 0 } })] }), "INVALID_CONFIGURATION_VERSION");
  expectFailure(rulebook({ factorBindings: [binding({ relationshipType: "CORRELATED" })] }), "UNKNOWN_RELATIONSHIP_TYPE");
  expectFailure(rulebook({ factorBindings: [binding({ requirementLevel: "REQUIRED" })] }), "UNKNOWN_REQUIREMENT_LEVEL");
  expectFailure(rulebook({ factorBindings: [binding({ optionalBehavior: "UNKNOWN" })] }), "INVALID_OPTIONAL_BEHAVIOR");
  expectFailure(rulebook({ factorBindings: [binding({ optionalBehavior: "" })] }), "INVALID_OPTIONAL_BEHAVIOR");
  expectFailure(rulebook({ factorBindings: [binding({ optionalBehavior: "partial" })] }), "INVALID_OPTIONAL_BEHAVIOR");
  expectFailure(rulebook({ factorBindings: [binding({ optionalBehavior: "omit" })] }), "INVALID_OPTIONAL_BEHAVIOR");
  expectFailure(rulebook({ factorBindings: [binding({ requirementLevel: "MANDATORY", optionalBehavior: "PARTIAL" })] }), "MANDATORY_BINDING_HAS_OPTIONAL_BEHAVIOR");
  expectFailure(rulebook({ factorBindings: [binding({ requirementLevel: "MANDATORY", optionalBehavior: "OMIT" })] }), "MANDATORY_BINDING_HAS_OPTIONAL_BEHAVIOR");
  expectFailure(rulebook({ factorBindings: [binding({ requirementLevel: "OPTIONAL", optionalBehavior: null })] }), "OPTIONAL_BINDING_MISSING_BEHAVIOR");
  const absent = binding(); delete (absent as Record<string, unknown>).optionalBehavior;
  expectFailure(rulebook({ factorBindings: [absent] }), "INVALID_OPTIONAL_BEHAVIOR");
  for (const weight of [0, -1, 101, Number.NaN, Infinity]) {
    expectFailure(rulebook({ factorBindings: [binding({ weight })] }), "INVALID_WEIGHT");
  }
});

test("rejects invalid provider and execution-policy lineage", () => {
  const provider = binding().provider;
  expectFailure(rulebook({ factorBindings: [binding({ provider: { ...provider, providerBindingId: "" } })] }), "INVALID_PROVIDER_BINDING_ID");
  expectFailure(rulebook({ factorBindings: [binding({ provider: { ...provider, providerBindingVersion: 0 } })] }), "INVALID_PROVIDER_BINDING_VERSION");
  expectFailure(rulebook({ factorBindings: [binding({ provider: { ...provider, resolutionPolicyId: "" } })] }), "INVALID_RESOLUTION_POLICY_ID");
  expectFailure(rulebook({ factorBindings: [binding({ provider: { ...provider, resolutionPolicyVersion: 0 } })] }), "INVALID_RESOLUTION_POLICY_VERSION");

  const policies = binding().executionPolicies;
  const cases = [
    ["aggregationPolicyId", "", "INVALID_AGGREGATION_POLICY_ID"],
    ["aggregationPolicyVersion", 0, "INVALID_AGGREGATION_POLICY_VERSION"],
    ["normalizationPolicyId", "", "INVALID_NORMALIZATION_POLICY_ID"],
    ["normalizationPolicyVersion", 0, "INVALID_NORMALIZATION_POLICY_VERSION"],
    ["decisionBandPolicyId", "", "INVALID_DECISION_BAND_POLICY_ID"],
    ["decisionBandPolicyVersion", 0, "INVALID_DECISION_BAND_POLICY_VERSION"],
  ] as const;
  for (const [key, value, code] of cases) {
    expectFailure(rulebook({ factorBindings: [binding({ executionPolicies: { ...policies, [key]: value } })] }), code);
  }
});

test("rejects exact semantic duplicates but not merely repeated factors", () => {
  expectFailure(rulebook({ factorBindings: [
    binding(),
    binding({ bindingId: "SECOND", order: 1 }),
  ] }), "DUPLICATE_SEMANTIC_BINDING");
});

test("accepts every valid requirement/behavior pair and preserves immutable behavior", () => {
  for (const [requirementLevel, optionalBehavior] of [["MANDATORY", null], ["OPTIONAL", "PARTIAL"], ["OPTIONAL", "OMIT"]] as const) {
    const input = rulebook({ factorBindings: [binding({ requirementLevel, optionalBehavior })] });
    const result = validate(input); assert.equal(result.valid, true);
    if (result.valid) {
      assert.equal(result.rulebook.factorBindings[0]!.optionalBehavior, optionalBehavior);
      assert.equal(Object.isFrozen(result.rulebook.factorBindings[0]), true);
    }
  }
});

test("optional behavior participates in semantic duplicate identity", () => {
  const result = validate(rulebook({ factorBindings: [
    binding({ optionalBehavior: "PARTIAL" }),
    binding({ bindingId: "SECOND", order: 1, optionalBehavior: "OMIT" }),
  ] }));
  assert.equal(result.valid, true);
});

test("rejects malformed optional future policy lineage", () => {
  expectFailure(rulebook({ crossFactorPolicy: { policyId: "", policyVersion: 1 } }), "INVALID_CROSS_FACTOR_POLICY");
  expectFailure(rulebook({ decisionPolicy: { policyId: "DECISION", policyVersion: 0 } }), "INVALID_DECISION_POLICY");
});

test("the contract has no compiler, clock, database, runtime registration, or feature-flag behavior", () => {
  assert.equal("compile" in service, false);
  assert.equal("save" in service, false);
  assert.equal("register" in service, false);
  assert.deepEqual(validate(rulebook()), validate(rulebook()));
});
