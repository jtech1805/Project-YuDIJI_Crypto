import assert from "node:assert/strict";
import test from "node:test";

import {
  EvidenceSourceAuthorityRegistryError,
  StaticEvidenceSourceAuthorityRegistry,
  evidenceSourceAuthorityRegistry,
} from "../../../src/registries/evidence-source-authority.registry.js";
import { DEFAULT_EVIDENCE_SOURCE_AUTHORITY_RULES } from "../../../src/registries/default-evidence-source-authority.js";
import type { EvidenceSourceAuthorityRule } from "../../../src/types/evidence-source-resolution.types.js";

const rule = (
  overrides: Partial<EvidenceSourceAuthorityRule> = {},
): EvidenceSourceAuthorityRule => ({
  factorKey: "MARKET.PRICE",
  sourceType: "MARKET_DATA",
  provider: "BINANCE",
  priority: 100,
  ...overrides,
});

test("constructs the exact immutable default authority rule", () => {
  assert.deepEqual(DEFAULT_EVIDENCE_SOURCE_AUTHORITY_RULES, [rule()]);
  assert.deepEqual(evidenceSourceAuthorityRegistry.list(), [rule()]);
  assert.equal(evidenceSourceAuthorityRegistry.getPriority(rule()), 100);
});

test("rejects an empty authority registry", () => {
  assert.throws(
    () => new StaticEvidenceSourceAuthorityRegistry([]),
    (error: unknown) =>
      error instanceof EvidenceSourceAuthorityRegistryError
      && error.code === "INVALID_RULE",
  );
});

test("rejects duplicate tuples and malformed rules", () => {
  assert.throws(
    () => new StaticEvidenceSourceAuthorityRegistry([rule(), rule()]),
    (error: unknown) =>
      error instanceof EvidenceSourceAuthorityRegistryError
      && error.code === "DUPLICATE_RULE",
  );
  for (const invalid of [
    rule({ factorKey: "OTHER" as "MARKET.PRICE" }),
    rule({ sourceType: "" }),
    rule({ sourceType: " MARKET_DATA" }),
    rule({ provider: "BINANCE " }),
    rule({ priority: -1 }),
    rule({ priority: 1.5 }),
    rule({ priority: Number.NaN }),
  ]) {
    assert.throws(
      () => new StaticEvidenceSourceAuthorityRegistry([invalid]),
      (error: unknown) =>
        error instanceof EvidenceSourceAuthorityRegistryError
        && error.code === "INVALID_RULE",
    );
  }
});

test("lookup is exact and list order is deterministic", () => {
  const registry = new StaticEvidenceSourceAuthorityRegistry([
    rule({ provider: "ZETA", priority: 2 }),
    rule({ provider: "ALPHA", priority: 1 }),
  ]);
  assert.deepEqual(registry.list().map((item) => item.provider), ["ALPHA", "ZETA"]);
  assert.equal(registry.getPriority(rule({ provider: "alpha" })), null);
  assert.equal(registry.getPriority(rule({ provider: " ALPHA" })), null);
});

test("source and returned rule mutation cannot affect registry state", () => {
  const source = rule();
  const registry = new StaticEvidenceSourceAuthorityRegistry([source]);
  source.priority = 1;
  const listed = registry.list();
  assert.throws(() => (listed as EvidenceSourceAuthorityRule[]).push(rule()));
  assert.throws(() => ((listed[0] as EvidenceSourceAuthorityRule).priority = 1));
  assert.equal(registry.getPriority(rule()), 100);
});
