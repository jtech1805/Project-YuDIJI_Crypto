import assert from "node:assert/strict";
import test from "node:test";

import { ProviderCatalogService } from "../../../src/services/providers/provider-catalog.service.js";
import { FACTOR_KEYS } from "../../../src/types/factor-registry.types.js";
import {
  PROVIDER_AUTHORITY_LEVELS,
  PROVIDER_CATALOG_FAILURE_CODES,
  PROVIDER_COST_TIERS,
  PROVIDER_TYPES,
} from "../../../src/types/provider-definition.types.js";

const service = new ProviderCatalogService();

const direct = (overrides: Record<string, unknown> = {}) => ({
  providerKey: "BINANCE_PUBLIC_MARKET",
  displayName: "Binance Public Market Data",
  providerType: "DIRECT",
  authorityLevel: "EXCHANGE",
  costTier: "FREE",
  supportedFactorKeys: ["MARKET.PRICE"],
  enabled: true,
  ...overrides,
});

const manual = (overrides: Record<string, unknown> = {}) => ({
  providerKey: "MANUAL_MARKET_PRICE",
  displayName: "Manual Market Price",
  providerType: "MANUAL",
  authorityLevel: "MANUAL_REVIEWED",
  costTier: "MANUAL",
  supportedFactorKeys: ["MARKET.PRICE"],
  enabled: true,
  ...overrides,
});

const binding = (overrides: Record<string, unknown> = {}) => ({
  factorKey: "MARKET.PRICE",
  orderedProviderKeys: ["BINANCE_PUBLIC_MARKET", "MANUAL_MARKET_PRICE"],
  ...overrides,
});

const validate = (
  providers: unknown = [direct(), manual()],
  bindings: unknown = [binding()],
) => service.validate({ providers, bindings });

const failure = (
  result: ReturnType<ProviderCatalogService["validate"]>,
  code: string,
  providerKey: string | null = null,
  factorKey: string | null = null,
) => assert.deepEqual(result, { valid: false, code, providerKey, factorKey });

test("exports the frozen bounded metadata vocabularies", () => {
  assert.deepEqual(PROVIDER_TYPES, ["DIRECT", "PROXY", "MANUAL"]);
  assert.deepEqual(PROVIDER_AUTHORITY_LEVELS, [
    "PRIMARY_SOURCE", "LICENSED_VENDOR", "PUBLIC_AGENCY", "EXCHANGE",
    "APPROVED_PROXY", "MANUAL_REVIEWED",
  ]);
  assert.deepEqual(PROVIDER_COST_TIERS, ["FREE", "PAID", "INTERNAL", "MANUAL"]);
  assert.equal(PROVIDER_CATALOG_FAILURE_CODES.length, 20);
  assert(Object.isFrozen(PROVIDER_TYPES));
});

test("validates direct and manual fallback definitions while preserving exact order", () => {
  const result = validate();
  assert.equal(result.valid, true);
  if (!result.valid) return;
  assert.deepEqual(result.catalog.providers.map((item) => item.providerKey), [
    "BINANCE_PUBLIC_MARKET", "MANUAL_MARKET_PRICE",
  ]);
  assert.deepEqual(result.catalog.bindings[0]?.orderedProviderKeys, [
    "BINANCE_PUBLIC_MARKET", "MANUAL_MARKET_PRICE",
  ]);
  assert.equal(result.catalog.bindings[0]?.orderedProviderKeys[0], "BINANCE_PUBLIC_MARKET");
});

test("preserves explicit proxy identity", () => {
  const proxy = direct({
    providerKey: "DXY_PROXY_PROVIDER",
    displayName: "DXY Proxy Provider",
    providerType: "PROXY",
    authorityLevel: "APPROVED_PROXY",
    costTier: "PAID",
  });
  const result = validate([proxy], [binding({ orderedProviderKeys: ["DXY_PROXY_PROVIDER"] })]);
  assert.equal(result.valid, true);
  if (result.valid) assert.equal(result.catalog.providers[0]?.providerType, "PROXY");
});

test("rejects invalid request objects", () => {
  for (const value of [null, undefined, [], {}, { providers: [] }, { bindings: [] }]) {
    failure(service.validate(value as never), "INVALID_REQUEST");
  }
});

test("rejects invalid provider arrays", () => {
  for (const providers of [null, {}, "providers"]) {
    failure(validate(providers), "INVALID_PROVIDER_DEFINITIONS");
  }
});

test("rejects invalid provider objects", () => {
  for (const provider of [null, [], "provider", 4]) {
    failure(validate([provider]), "INVALID_PROVIDER_DEFINITION");
  }
});

test("rejects invalid provider keys", () => {
  const invalid = ["", "lowercase", "HAS SPACE", "HAS-HYPHEN", " LEADING", "TRAILING ", "A".repeat(121), 4];
  for (const providerKey of invalid) {
    failure(validate([direct({ providerKey })], []), "INVALID_PROVIDER_KEY",
      typeof providerKey === "string" ? providerKey : null);
  }
});

test("rejects duplicate provider keys before a later invalid display name", () => {
  failure(validate([direct(), direct(), manual({ displayName: "" })], []),
    "DUPLICATE_PROVIDER_KEY", "BINANCE_PUBLIC_MARKET");
});

test("rejects invalid display names", () => {
  for (const displayName of ["", " leading", "trailing ", "A".repeat(161), 1]) {
    failure(validate([direct({ displayName })], []), "INVALID_DISPLAY_NAME", "BINANCE_PUBLIC_MARKET");
  }
});

test("rejects invalid provider types, authority levels, and cost tiers", () => {
  failure(validate([direct({ providerType: "direct" })], []), "INVALID_PROVIDER_TYPE", "BINANCE_PUBLIC_MARKET");
  failure(validate([direct({ authorityLevel: "TRUSTED" })], []), "INVALID_AUTHORITY_LEVEL", "BINANCE_PUBLIC_MARKET");
  failure(validate([direct({ costTier: "CHEAP" })], []), "INVALID_COST_TIER", "BINANCE_PUBLIC_MARKET");
});

test("rejects invalid and duplicate supported factors", () => {
  for (const supportedFactorKeys of [null, "MARKET.PRICE", [], ["UNKNOWN"], [4]]) {
    failure(validate([direct({ supportedFactorKeys })], []), "INVALID_SUPPORTED_FACTORS", "BINANCE_PUBLIC_MARKET");
  }
  failure(validate([direct({ supportedFactorKeys: ["MARKET.PRICE", "MARKET.PRICE"] })], []),
    "DUPLICATE_SUPPORTED_FACTOR", "BINANCE_PUBLIC_MARKET", "MARKET.PRICE");
});

test("rejects invalid enabled flags", () => {
  for (const enabled of [null, 1, "true"]) {
    failure(validate([direct({ enabled })], []), "INVALID_ENABLED_FLAG", "BINANCE_PUBLIC_MARKET");
  }
});

test("rejects invalid binding arrays and objects", () => {
  for (const bindings of [null, {}, "bindings"]) {
    failure(validate([direct()], bindings), "INVALID_FACTOR_BINDINGS");
  }
  for (const item of [null, [], "binding", 4, { factorKey: "UNKNOWN", orderedProviderKeys: [] }]) {
    failure(validate([direct()], [item]), "INVALID_FACTOR_BINDING", null,
      typeof item === "object" && item !== null && !Array.isArray(item) && "factorKey" in item
        ? String(item.factorKey) : null);
  }
});

test("rejects duplicate factor bindings", () => {
  failure(validate(undefined, [binding(), binding({ orderedProviderKeys: ["BINANCE_PUBLIC_MARKET"] })]),
    "DUPLICATE_FACTOR_BINDING", null, "MARKET.PRICE");
});

test("rejects empty and malformed provider order", () => {
  failure(validate(undefined, [binding({ orderedProviderKeys: [] })]), "EMPTY_PROVIDER_ORDER", null, "MARKET.PRICE");
  failure(validate(undefined, [binding({ orderedProviderKeys: "BINANCE_PUBLIC_MARKET" })]), "INVALID_FACTOR_BINDING", null, "MARKET.PRICE");
  failure(validate(undefined, [binding({ orderedProviderKeys: [4] })]), "INVALID_FACTOR_BINDING", null, "MARKET.PRICE");
});

test("rejects duplicate, unknown, and disabled bound providers", () => {
  failure(validate(undefined, [binding({ orderedProviderKeys: ["BINANCE_PUBLIC_MARKET", "BINANCE_PUBLIC_MARKET"] })]),
    "DUPLICATE_BOUND_PROVIDER", "BINANCE_PUBLIC_MARKET", "MARKET.PRICE");
  failure(validate(undefined, [binding({ orderedProviderKeys: ["UNKNOWN_PROVIDER"] })]),
    "UNKNOWN_BOUND_PROVIDER", "UNKNOWN_PROVIDER", "MARKET.PRICE");
  failure(validate([direct({ enabled: false })], [binding({ orderedProviderKeys: ["BINANCE_PUBLIC_MARKET"] })]),
    "DISABLED_BOUND_PROVIDER", "BINANCE_PUBLIC_MARKET", "MARKET.PRICE");
});

test("rejects a bound provider that does not support the canonical binding factor", () => {
  const mutableFactorKeys = FACTOR_KEYS as unknown as string[];
  mutableFactorKeys.push("MARKET.VOLUME");
  try {
    failure(validate([direct()], [{
      factorKey: "MARKET.VOLUME",
      orderedProviderKeys: ["BINANCE_PUBLIC_MARKET"],
    }]), "PROVIDER_FACTOR_UNSUPPORTED", "BINANCE_PUBLIC_MARKET", "MARKET.VOLUME");
  } finally {
    mutableFactorKeys.pop();
  }
});

test("does not reorder providers based on cost or authority", () => {
  const paidPrimary = direct({ providerKey: "PAID_PRIMARY", authorityLevel: "PRIMARY_SOURCE", costTier: "PAID" });
  const freeProxy = direct({ providerKey: "FREE_PROXY", providerType: "PROXY", authorityLevel: "APPROVED_PROXY" });
  const result = validate([paidPrimary, freeProxy], [binding({ orderedProviderKeys: ["FREE_PROXY", "PAID_PRIMARY"] })]);
  assert.equal(result.valid, true);
  if (result.valid) assert.deepEqual(result.catalog.bindings[0]?.orderedProviderKeys, ["FREE_PROXY", "PAID_PRIMARY"]);
});

test("returns a detached deeply frozen snapshot without health or selection metadata", () => {
  const providers = [direct(), manual()];
  const bindings = [binding()];
  const result = validate(providers, bindings);
  assert.equal(result.valid, true);
  if (!result.valid) return;
  providers[0]!.displayName = "Changed";
  (providers[0]!.supportedFactorKeys as string[]).push("UNKNOWN");
  providers.push(direct({ providerKey: "LATE_PROVIDER" }));
  bindings[0]!.factorKey = "CHANGED";
  (bindings[0]!.orderedProviderKeys as string[]).reverse();
  bindings.push(binding());
  assert.equal(result.catalog.providers[0]?.displayName, "Binance Public Market Data");
  assert.deepEqual(result.catalog.providers[0]?.supportedFactorKeys, ["MARKET.PRICE"]);
  assert.equal(result.catalog.bindings[0]?.factorKey, "MARKET.PRICE");
  assert.deepEqual(result.catalog.bindings[0]?.orderedProviderKeys, ["BINANCE_PUBLIC_MARKET", "MANUAL_MARKET_PRICE"]);
  assert(Object.isFrozen(result.catalog));
  assert(Object.isFrozen(result.catalog.providers));
  assert(Object.isFrozen(result.catalog.providers[0]));
  assert(Object.isFrozen(result.catalog.providers[0]?.supportedFactorKeys));
  assert(Object.isFrozen(result.catalog.bindings));
  assert(Object.isFrozen(result.catalog.bindings[0]));
  assert(Object.isFrozen(result.catalog.bindings[0]?.orderedProviderKeys));
  assert.throws(() => (result.catalog.providers as unknown[]).push({}), TypeError);
  const serialized = JSON.stringify(result);
  for (const field of ["healthStatus", "errorRate", "latency", "selectedProviderKey", "resolutionStatus", "confidenceAdjustment", "warnings", "catalogId", "validatedAt", "createdAt"]) {
    assert(!serialized.includes(field));
  }
});

test("is deterministic and output mutation cannot affect later validation", () => {
  const first = validate();
  assert.equal(first.valid, true);
  if (first.valid) assert.throws(() => (first.catalog.bindings[0]!.orderedProviderKeys as string[]).reverse(), TypeError);
  assert.deepEqual(validate(), validate());
});

test("returns provider failures before binding failures and unknown provider before later duplicate binding", () => {
  failure(validate([direct({ providerKey: "bad" })], [binding({ orderedProviderKeys: [] })]),
    "INVALID_PROVIDER_KEY", "bad");
  failure(validate(undefined, [binding({ orderedProviderKeys: ["UNKNOWN"] }), binding()]),
    "UNKNOWN_BOUND_PROVIDER", "UNKNOWN", "MARKET.PRICE");
});
