import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_VERSIONED_FACTOR_DEFINITIONS } from "../../../src/registries/versioned-factor-definition.registry.js";
import { DEFAULT_VERSIONED_EVALUATOR_DECLARATIONS } from "../../../src/registries/versioned-evaluator-declaration.registry.js";
import { BTC_ETF_FLOW_CHARACTERIZATION_PROVIDER } from "../../../src/registries/provider-authority.registry.js";
import { BTC_ETF_FLOW_TEMPLATE_RULE_MAPPING } from "../../../src/registries/btc-etf-flow-characterization.authorities.js";
import { TemplateDraftRegistryProjectionService } from "../../../src/services/copilot/template-draft-registry-projection.service.js";
import { DEFAULT_TEMPLATE_DRAFT_VALIDATION_POLICY } from "../../../src/types/template-draft-candidate.types.js";
import { TemplateDraftProjectionError } from "../../../src/types/template-draft-registry-projection.types.js";

const request = (change: Record<string, unknown> = {}): any => ({
  projectionId: "DEFAULT_TEMPLATE_DRAFT_REGISTRY",
  projectionVersion: 1,
  factors: DEFAULT_VERSIONED_FACTOR_DEFINITIONS,
  evaluatorDeclarations: DEFAULT_VERSIONED_EVALUATOR_DECLARATIONS,
  providerAuthorities: [BTC_ETF_FLOW_CHARACTERIZATION_PROVIDER],
  compilationMappings: [BTC_ETF_FLOW_TEMPLATE_RULE_MAPPING],
  validationPolicy: DEFAULT_TEMPLATE_DRAFT_VALIDATION_POLICY,
  capabilities: { weightProposalsEnabled: false, ragEnabled: false },
  ...change,
});

test("projection is exact, compact, deterministically ordered, and preserves availability summaries", () => {
  const service = new TemplateDraftRegistryProjectionService();
  const input = request(); const before = structuredClone(input);
  const first = service.create(input); const second = service.create(request({ factors: [...DEFAULT_VERSIONED_FACTOR_DEFINITIONS].reverse() }));
  assert.deepEqual(first, second);
  assert.match(first.canonicalDigest, /^[a-f0-9]{64}$/);
  assert.deepEqual(first.factors.map((factor) => `${factor.factorKey}:${factor.factorVersion}`), ["CRYPTO.ETF_NET_FLOW:1", "MARKET.PRICE:1"]);
  const etf = first.factors[0]!;
  assert.deepEqual(etf.subjectTypes, ["ASSET"]); assert.deepEqual(etf.valueTypes, ["NUMBER"]);
  assert.deepEqual(etf.unit, { policy: "ALLOW_LIST", allowedUnits: ["USD"] });
  assert.deepEqual(etf.relationships.map((value) => value.relationship), ["DIRECT", "INVERSE"]);
  assert.equal(etf.genericEvaluatorAvailable, true);
  assert.deepEqual(etf.providers, [{ providerKey: "YUDIJI_CHARACTERIZATION_BTC_ETF_FLOW", compileEligible: true, liveExecutionEligible: false, replayFixtureEligible: true }]);
  assert.deepEqual(etf.compilationMappings, [{ mappingId: "BTC_ETF_FLOW_CHARACTERIZATION_MAPPING", mappingVersion: 1, relationship: "DIRECT" }]);
  assert.deepEqual(input, before); assert(Object.isFrozen(first) && Object.isFrozen(first.factors) && Object.isFrozen(etf.unit));
});

test("digest covers authority and policy material but ignores object insertion order", () => {
  const service = new TemplateDraftRegistryProjectionService(); const base = service.create(request());
  const changed = service.create(request({ validationPolicy: { ...DEFAULT_TEMPLATE_DRAFT_VALIDATION_POLICY, maxWarnings: 23 } }));
  assert.notEqual(base.canonicalDigest, changed.canonicalDigest);
  assert.equal(base.constraints.weightProposalsEnabled, false); assert.equal(base.constraints.ragEnabled, false);
  assert.deepEqual(base.authorityLineage.factorMembers, ["CRYPTO.ETF_NET_FLOW:1", "MARKET.PRICE:1"]);
});

test("duplicate exact authorities fail closed and inputs remain unchanged", () => {
  const service = new TemplateDraftRegistryProjectionService();
  const duplicate = request({ factors: [DEFAULT_VERSIONED_FACTOR_DEFINITIONS[0], DEFAULT_VERSIONED_FACTOR_DEFINITIONS[0]] });
  const before = structuredClone(duplicate);
  assert.throws(() => service.create(duplicate), (error: unknown) => error instanceof TemplateDraftProjectionError && error.code === "DUPLICATE_FACTOR_AUTHORITY");
  assert.deepEqual(duplicate, before);
  const conflicting = request({ factors: [DEFAULT_VERSIONED_FACTOR_DEFINITIONS[0], { ...DEFAULT_VERSIONED_FACTOR_DEFINITIONS[0], compileEligible: false }] });
  assert.throws(() => service.create(conflicting), (error: unknown) => error instanceof TemplateDraftProjectionError && error.code === "CONFLICTING_FACTOR_IDENTITY");
});

test("all six exact relationships are characterized without treating deferred semantics as executable", () => {
  const projection = new TemplateDraftRegistryProjectionService().create(request());
  assert.deepEqual(projection.relationships.map((value) => [value.relationship, value.executable]), [
    ["DIRECT", true], ["INVERSE", true], ["CONDITIONAL", false],
    ["CONFIRMATION_ONLY", false], ["RISK_ONLY", false], ["VETO", false],
  ]);
});
