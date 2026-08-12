import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  StaticEvaluatorConfigurationRegistry,
  createDefaultEvaluatorConfigurationRegistry,
} from "../../../src/registries/evaluator-configuration.registry.js";
import { EvaluatorConfigurationRegistryError } from "../../../src/types/evaluator-configuration-registry.types.js";

const configuration = (relationshipType: "DIRECT" | "INVERSE" | "CONDITIONAL" = "DIRECT") => ({
  relationshipType,
  expectedUnit: "USD",
  thresholds: { strongNegativeMax: -300, negativeMax: -100, positiveMin: 100, strongPositiveMin: 300 },
  contributions: { strongNegative: -2, negative: -1, neutral: 0, positive: 1, strongPositive: 2 },
  minimumPoints: -2,
  maximumPoints: 2,
});

const definition = (overrides: Record<string, unknown> = {}) => ({
  configurationType: "GENERIC_RELATIONSHIP",
  configurationId: "BTC_ETF_FLOW_DIRECT",
  configurationVersion: 1,
  evaluatorId: "GENERIC_RELATIONSHIP_FACTOR_EVALUATOR",
  evaluatorVersion: 1,
  supportedFactorKeys: ["CRYPTO.ETF_NET_FLOW"],
  supportedRelationshipTypes: ["DIRECT"],
  compileEligible: true,
  configuration: configuration(),
  ...overrides,
});

const registry = (...definitions: unknown[]) =>
  new StaticEvaluatorConfigurationRegistry(definitions as never);
const rejects = (value: unknown, code: string) => assert.throws(
  () => registry(value),
  (error: unknown) => error instanceof EvaluatorConfigurationRegistryError && error.code === code,
);

test("registers valid DIRECT and INVERSE configurations", () => {
  const direct = registry(definition());
  assert.deepEqual(direct.getExact("BTC_ETF_FLOW_DIRECT", 1), definition());
  const inverseDefinition = definition({
    configurationId: "BTC_ETF_FLOW_INVERSE",
    supportedRelationshipTypes: ["INVERSE"],
    configuration: configuration("INVERSE"),
  });
  assert.deepEqual(registry(inverseDefinition).getExact("BTC_ETF_FLOW_INVERSE", 1), inverseDefinition);
});

test("retains exact historical versions and exposes deterministic latest/list convenience", () => {
  const v1 = definition();
  const v3 = definition({ configurationVersion: 3, configuration: { ...configuration(), expectedUnit: "USD" } });
  const v2 = definition({ configurationVersion: 2, configuration: { ...configuration(), thresholds: { ...configuration().thresholds, positiveMin: 110 } } });
  const authority = registry(v3, v1, v2);
  assert.deepEqual(authority.listVersions("BTC_ETF_FLOW_DIRECT").map((item) => item.configurationVersion), [1, 2, 3]);
  assert.deepEqual(authority.getExact("BTC_ETF_FLOW_DIRECT", 1), v1);
  assert.equal(authority.getLatest("BTC_ETF_FLOW_DIRECT")?.configurationVersion, 3);
  assert.equal(authority.getExact("BTC_ETF_FLOW_DIRECT", 4), null);
  assert.equal(authority.getLatest("UNKNOWN"), null);
  assert.deepEqual(authority.listVersions("UNKNOWN"), []);
  assert.deepEqual(authority.listVersions("BTC_ETF_FLOW_DIRECT"), authority.listVersions("BTC_ETF_FLOW_DIRECT"));
});

test("rejects duplicate exact versions including deep-equal duplicates", () => {
  assert.throws(() => registry(definition(), definition()), (error: unknown) =>
    error instanceof EvaluatorConfigurationRegistryError
    && error.code === "DUPLICATE_CONFIGURATION_VERSION");
});

test("validates identity and evaluator lineage", () => {
  for (const configurationId of ["", " bad", "lowercase", "A".repeat(121)]) rejects(definition({ configurationId }), "INVALID_CONFIGURATION_ID");
  for (const configurationVersion of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) rejects(definition({ configurationVersion }), "INVALID_CONFIGURATION_VERSION");
  rejects(definition({ evaluatorId: "OTHER" }), "INVALID_EVALUATOR_ID");
  rejects(definition({ evaluatorVersion: 2 }), "INVALID_EVALUATOR_VERSION");
});

test("validates closed factor and relationship support", () => {
  rejects(definition({ supportedFactorKeys: [] }), "INVALID_SUPPORTED_FACTORS");
  rejects(definition({ supportedFactorKeys: ["UNKNOWN"] }), "INVALID_SUPPORTED_FACTORS");
  rejects(definition({ supportedFactorKeys: ["CRYPTO.ETF_NET_FLOW", "CRYPTO.ETF_NET_FLOW"] }), "DUPLICATE_SUPPORTED_FACTOR");
  rejects(definition({ supportedRelationshipTypes: [] }), "INVALID_SUPPORTED_RELATIONSHIPS");
  rejects(definition({ supportedRelationshipTypes: ["UNKNOWN"] }), "INVALID_SUPPORTED_RELATIONSHIPS");
  rejects(definition({ supportedRelationshipTypes: ["DIRECT", "DIRECT"] }), "DUPLICATE_SUPPORTED_RELATIONSHIP");
});

test("compile eligibility calls existing content validation and rejects deferred semantics", () => {
  rejects(definition({ configuration: { ...configuration(), expectedUnit: "EUR" } }), "CONFIGURATION_NOT_COMPILE_ELIGIBLE");
  rejects(definition({
    supportedRelationshipTypes: ["CONDITIONAL"],
    configuration: configuration("CONDITIONAL"),
  }), "CONFIGURATION_NOT_COMPILE_ELIGIBLE");
  const historical = definition({
    configurationId: "BTC_ETF_FLOW_CONDITIONAL",
    supportedRelationshipTypes: ["CONDITIONAL"],
    compileEligible: false,
    configuration: configuration("CONDITIONAL"),
  });
  assert.equal(registry(historical).getExact("BTC_ETF_FLOW_CONDITIONAL", 1)?.compileEligible, false);
});

test("source and returned values cannot mutate historical registry content", () => {
  const source = definition();
  const authority = registry(source);
  (source.supportedFactorKeys as string[]).push("MARKET.PRICE");
  source.configuration.thresholds.positiveMin = 999;
  const found = authority.getExact("BTC_ETF_FLOW_DIRECT", 1)!;
  assert.deepEqual(found.supportedFactorKeys, ["CRYPTO.ETF_NET_FLOW"]);
  assert.equal(found.configuration.thresholds.positiveMin, 100);
  assert(Object.isFrozen(found));
  assert(Object.isFrozen(found.configuration));
  assert(Object.isFrozen(found.configuration.thresholds));
  assert.throws(() => (found.supportedFactorKeys as string[]).push("MARKET.PRICE"), TypeError);
  assert.notEqual(found, authority.getExact("BTC_ETF_FLOW_DIRECT", 1));
});

test("default registry is explicitly empty and registry has no execution, I/O, clock, or database behavior", () => {
  assert.deepEqual(createDefaultEvaluatorConfigurationRegistry().listVersions("BTC_ETF_FLOW_DIRECT"), []);
  const source = readFileSync("src/registries/evaluator-configuration.registry.ts", "utf8");
  assert(!/\.evaluate\(|Date\.now|new Date|mongoose|repository|controller|ScoreCheck/.test(source));
});
