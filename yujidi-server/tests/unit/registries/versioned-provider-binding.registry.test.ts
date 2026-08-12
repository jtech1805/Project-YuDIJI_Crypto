import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { factorRegistry } from "../../../src/registries/factor.registry.js";
import {
  StaticVersionedProviderBindingRegistry,
  createDefaultVersionedProviderBindingRegistry,
} from "../../../src/registries/versioned-provider-binding.registry.js";
import { ProviderCatalogService } from "../../../src/services/providers/provider-catalog.service.js";
import {
  MAX_PROVIDERS_PER_VERSIONED_BINDING,
  VersionedProviderBindingRegistryError,
} from "../../../src/types/versioned-provider-binding.types.js";

const provider = (overrides: Record<string, unknown> = {}) => ({
  providerKey: "MOCK_BTC_ETF_FLOW",
  displayName: "Mock BTC ETF Flow",
  providerType: "DIRECT",
  authorityLevel: "MANUAL_REVIEWED",
  costTier: "MANUAL",
  supportedFactorKeys: ["CRYPTO.ETF_NET_FLOW"],
  enabled: true,
  ...overrides,
});
const catalog = (providers: unknown[] = [provider()]) => {
  const result = new ProviderCatalogService().validate({ providers, bindings: [] });
  if (!result.valid) throw new Error(`Catalog fixture failed: ${result.code}`);
  return result.catalog;
};
const definition = (overrides: Record<string, unknown> = {}) => ({
  providerBindingId: "BTC_ETF_FLOW_PROVIDER_BINDING",
  providerBindingVersion: 1,
  factorKey: "CRYPTO.ETF_NET_FLOW",
  factorVersion: 1,
  orderedProviderKeys: ["MOCK_BTC_ETF_FLOW"],
  compileEligible: true,
  ...overrides,
});
const registry = (definitions: unknown[], providers = catalog()) =>
  new StaticVersionedProviderBindingRegistry(definitions as never, { catalog: providers, factorRegistry });
const rejects = (value: unknown, code: string, providers = catalog()) => assert.throws(
  () => registry([value], providers),
  (error: unknown) => error instanceof VersionedProviderBindingRegistryError && error.code === code,
);

test("registers a valid versioned provider binding and preserves provider order", () => {
  const secondary = provider({ providerKey: "MOCK_BTC_ETF_FLOW_FALLBACK" });
  const input = definition({ orderedProviderKeys: ["MOCK_BTC_ETF_FLOW_FALLBACK", "MOCK_BTC_ETF_FLOW"] });
  const found = registry([input], catalog([provider(), secondary])).getExact("BTC_ETF_FLOW_PROVIDER_BINDING", 1);
  assert.deepEqual(found, input);
  assert.deepEqual(found?.orderedProviderKeys, ["MOCK_BTC_ETF_FLOW_FALLBACK", "MOCK_BTC_ETF_FLOW"]);
});

test("retains historical versions with exact, latest, and ordered list lookup", () => {
  const v1 = definition();
  const v3 = definition({ providerBindingVersion: 3, compileEligible: false });
  const v2 = definition({ providerBindingVersion: 2 });
  const authority = registry([v3, v1, v2]);
  assert.deepEqual(authority.listVersions("BTC_ETF_FLOW_PROVIDER_BINDING").map((item) => item.providerBindingVersion), [1, 2, 3]);
  assert.deepEqual(authority.getExact("BTC_ETF_FLOW_PROVIDER_BINDING", 1), v1);
  assert.equal(authority.getLatest("BTC_ETF_FLOW_PROVIDER_BINDING")?.providerBindingVersion, 3);
  assert.equal(authority.getExact("BTC_ETF_FLOW_PROVIDER_BINDING", 4), null);
  assert.equal(authority.getLatest("UNKNOWN"), null);
  assert.deepEqual(authority.listVersions("UNKNOWN"), []);
  assert.deepEqual(authority.listVersions("BTC_ETF_FLOW_PROVIDER_BINDING"), authority.listVersions("BTC_ETF_FLOW_PROVIDER_BINDING"));
});

test("rejects duplicate exact binding versions", () => {
  assert.throws(() => registry([definition(), definition()]), (error: unknown) =>
    error instanceof VersionedProviderBindingRegistryError && error.code === "DUPLICATE_BINDING_VERSION");
});

test("validates binding identity, versions, factor, and compile eligibility", () => {
  for (const providerBindingId of ["", " bad", "lowercase", "A".repeat(121)]) rejects(definition({ providerBindingId }), "INVALID_BINDING_ID");
  for (const providerBindingVersion of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) rejects(definition({ providerBindingVersion }), "INVALID_BINDING_VERSION");
  rejects(definition({ factorKey: "UNKNOWN" }), "INVALID_FACTOR_KEY");
  rejects(definition({ factorVersion: 0 }), "INVALID_FACTOR_VERSION");
  rejects(definition({ factorVersion: 2 }), "INVALID_FACTOR_VERSION");
  rejects(definition({ compileEligible: "true" }), "INVALID_COMPILE_ELIGIBILITY");
});

test("validates provider order bounds and duplicates", () => {
  rejects(definition({ orderedProviderKeys: null }), "INVALID_PROVIDER_ORDER");
  rejects(definition({ orderedProviderKeys: [] }), "EMPTY_PROVIDER_ORDER");
  rejects(definition({ orderedProviderKeys: ["MOCK_BTC_ETF_FLOW", "MOCK_BTC_ETF_FLOW"] }), "DUPLICATE_PROVIDER_KEY");
  rejects(definition({ orderedProviderKeys: Array.from({ length: MAX_PROVIDERS_PER_VERSIONED_BINDING + 1 }, (_, index) => `P_${index}`) }), "TOO_MANY_PROVIDERS");
});

test("validates provider existence, enabled state, and factor support against the supplied catalog", () => {
  rejects(definition({ orderedProviderKeys: ["UNKNOWN_PROVIDER"] }), "UNKNOWN_PROVIDER_KEY");
  rejects(definition(), "DISABLED_PROVIDER", catalog([provider({ enabled: false })]));
  const priceOnly = provider({ supportedFactorKeys: ["MARKET.PRICE"] });
  rejects(definition(), "PROVIDER_FACTOR_UNSUPPORTED", catalog([priceOnly]));
});

test("source and returned values cannot mutate historical content", () => {
  const source = definition();
  const authority = registry([source]);
  source.orderedProviderKeys.push("LATE_PROVIDER");
  source.compileEligible = false;
  const found = authority.getExact("BTC_ETF_FLOW_PROVIDER_BINDING", 1)!;
  assert.deepEqual(found.orderedProviderKeys, ["MOCK_BTC_ETF_FLOW"]);
  assert.equal(found.compileEligible, true);
  assert(Object.isFrozen(found));
  assert(Object.isFrozen(found.orderedProviderKeys));
  assert.throws(() => (found.orderedProviderKeys as string[]).push("LATE_PROVIDER"), TypeError);
  assert.notEqual(found, authority.getExact("BTC_ETF_FLOW_PROVIDER_BINDING", 1));
});

test("default registry is empty and authority has no health, selection, runner, clock, or database behavior", () => {
  const empty = createDefaultVersionedProviderBindingRegistry({ catalog: catalog(), factorRegistry });
  assert.deepEqual(empty.listVersions("BTC_ETF_FLOW_PROVIDER_BINDING"), []);
  const source = readFileSync("src/registries/versioned-provider-binding.registry.ts", "utf8");
  assert(!/health|selectProvider|\.run\(|Date\.now|new Date|mongoose|repository|controller|ScoreCheck/i.test(source));
});
