import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { DEFAULT_FACTOR_DEFINITIONS } from "../../../src/registries/default-factor-definitions.js";
import {
  StaticFactorRegistry,
  factorRegistry,
} from "../../../src/registries/factor.registry.js";
import type {
  FactorDefinition,
  FactorFreshnessPolicy,
  FactorUnitDefinition,
} from "../../../src/types/factor-registry.types.js";
import { FactorRegistryError } from "../../../src/types/factor-registry.types.js";

const definition = (
  overrides: Partial<FactorDefinition> = {},
): FactorDefinition => ({
  factorKey: "MARKET.PRICE",
  version: 1,
  displayName: "Market Price",
  description: "Latest observed tradable market price for an instrument.",
  status: "ACTIVE",
  valueTypes: ["NUMBER"],
  subjectTypes: ["INSTRUMENT"],
  unit: { policy: "REQUIRED" },
  freshness: { kind: "MAX_AGE", maxAgeMs: 10_000 },
  scoringEligibility: "ELIGIBLE",
  ...overrides,
});

const expectConstructionError = (
  definitions: unknown,
  code: "EMPTY_REGISTRY" | "DUPLICATE_FACTOR_KEY" | "INVALID_DEFINITION",
) => {
  assert.throws(
    () => new StaticFactorRegistry(definitions as readonly FactorDefinition[]),
    (error: unknown) =>
      error instanceof FactorRegistryError && error.code === code,
  );
};

test("constructs a valid registry and rejects empty or duplicate definitions", () => {
  assert.equal(new StaticFactorRegistry([definition()]).list().length, 1);
  expectConstructionError([], "EMPTY_REGISTRY");
  expectConstructionError([definition(), definition()], "DUPLICATE_FACTOR_KEY");
});

test("rejects invalid versions, names, descriptions, enums, and keys", () => {
  for (const invalidVersion of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    expectConstructionError([definition({ version: invalidVersion })], "INVALID_DEFINITION");
  }
  for (const invalid of [
    definition({ displayName: "" }),
    definition({ displayName: " Market Price" }),
    definition({ description: "" }),
    definition({ description: "Description " }),
    definition({ factorKey: "market.price" as "MARKET.PRICE" }),
    definition({ status: "UNKNOWN" as "ACTIVE" }),
    definition({ scoringEligibility: "UNKNOWN" as "ELIGIBLE" }),
  ]) {
    expectConstructionError([invalid], "INVALID_DEFINITION");
  }
});

test("rejects empty, duplicate, or unknown value and subject compatibility", () => {
  for (const invalid of [
    definition({ valueTypes: [] }),
    definition({ valueTypes: ["NUMBER", "NUMBER"] }),
    definition({ valueTypes: ["UNKNOWN" as "NUMBER"] }),
    definition({ subjectTypes: [] }),
    definition({ subjectTypes: ["INSTRUMENT", "INSTRUMENT"] }),
    definition({ subjectTypes: ["UNKNOWN" as "INSTRUMENT"] }),
  ]) {
    expectConstructionError([invalid], "INVALID_DEFINITION");
  }
});

test("rejects invalid maximum ages and freshness shapes", () => {
  for (const maxAgeMs of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    expectConstructionError([
      definition({
        freshness: { kind: "MAX_AGE", maxAgeMs } as FactorFreshnessPolicy,
      }),
    ], "INVALID_DEFINITION");
  }
  expectConstructionError([
    definition({
      freshness: { kind: "UNKNOWN" } as unknown as FactorFreshnessPolicy,
    }),
  ], "INVALID_DEFINITION");
});

test("rejects invalid unit definitions and allow lists", () => {
  for (const unit of [
    { policy: "ALLOW_LIST", allowedUnits: [] },
    { policy: "ALLOW_LIST", allowedUnits: ["USD", "USD"] },
    { policy: "ALLOW_LIST", allowedUnits: [""] },
    { policy: "ALLOW_LIST", allowedUnits: [" USD"] },
    { policy: "UNKNOWN" },
  ] as unknown as FactorUnitDefinition[]) {
    expectConstructionError([definition({ unit })], "INVALID_DEFINITION");
  }
});

test("get, require, and list fail closed and return deterministic ordering", () => {
  const registry = new StaticFactorRegistry([definition()]);
  assert.deepEqual(registry.get("MARKET.PRICE"), definition());
  assert.equal(registry.get("market.price"), null);
  assert.equal(registry.get(" MARKET.PRICE"), null);
  assert.equal(registry.get("MARKET.PRICE "), null);
  assert.deepEqual(registry.list().map((item) => item.factorKey), ["MARKET.PRICE"]);
  assert.throws(
    () => registry.require("UNKNOWN"),
    (error: unknown) =>
      error instanceof FactorRegistryError && error.code === "UNKNOWN_FACTOR",
  );
});

test("construction and returned values are deeply immutable", () => {
  const source = definition();
  const registry = new StaticFactorRegistry([source]);
  (source.valueTypes as string[]).push("BOOLEAN");
  (source.subjectTypes as string[]).push("MARKET");
  (source.freshness as { maxAgeMs: number }).maxAgeMs = 1;
  (source.unit as { policy: string }).policy = "FORBIDDEN";

  const fromGet = registry.get("MARKET.PRICE")!;
  assert.throws(() => (fromGet.valueTypes as string[]).push("BOOLEAN"));
  assert.throws(() => (fromGet.subjectTypes as string[]).push("MARKET"));
  assert.throws(() => ((fromGet.freshness as { maxAgeMs: number }).maxAgeMs = 1));
  assert.throws(() => ((fromGet.unit as { policy: string }).policy = "FORBIDDEN"));
  const listed = registry.list();
  assert.throws(() => (listed as FactorDefinition[]).push(definition()));
  assert.deepEqual(registry.require("MARKET.PRICE"), definition());
});

test("allowed unit arrays are protected from source and result mutation", () => {
  const allowedUnits = ["USD", "USDT"];
  const source = definition({
    unit: { policy: "ALLOW_LIST", allowedUnits },
  });
  const registry = new StaticFactorRegistry([source]);
  allowedUnits.push("EUR");
  const returned = registry.require("MARKET.PRICE");
  assert.equal(returned.unit.policy, "ALLOW_LIST");
  if (returned.unit.policy !== "ALLOW_LIST") {
    assert.fail("Expected allow-list unit definition");
  }
  const returnedAllowedUnits = returned.unit.allowedUnits;
  assert.deepEqual(returnedAllowedUnits, ["USD", "USDT"]);
  assert.throws(() => (returnedAllowedUnits as string[]).push("EUR"));
});

test("validates active, deprecated, and disabled lifecycle behavior", () => {
  const active = new StaticFactorRegistry([definition()]);
  assert.equal(active.validateCompatibility({
    factorKey: "MARKET.PRICE",
    valueType: "NUMBER",
    subjectType: "INSTRUMENT",
    unit: "USDT",
  }).valid, true);

  const deprecated = new StaticFactorRegistry([
    definition({ status: "DEPRECATED" }),
  ]);
  assert.deepEqual(deprecated.validateCompatibility({
    factorKey: "MARKET.PRICE",
    valueType: "NUMBER",
    subjectType: "INSTRUMENT",
    unit: "USD",
  }), { valid: false, code: "INACTIVE_FACTOR", factorKey: "MARKET.PRICE" });
  assert.equal(deprecated.validateCompatibility({
    factorKey: "MARKET.PRICE",
    valueType: "NUMBER",
    subjectType: "INSTRUMENT",
    unit: "USD",
    allowDeprecated: true,
  }).valid, true);

  const disabled = new StaticFactorRegistry([
    definition({ status: "DISABLED" }),
  ]);
  assert.equal(disabled.validateCompatibility({
    factorKey: "MARKET.PRICE",
    valueType: "NUMBER",
    subjectType: "INSTRUMENT",
    unit: "USD",
    allowDeprecated: true,
  }).valid, false);
});

test("returns ordered compatibility failure codes", () => {
  const registry = new StaticFactorRegistry([definition()]);
  const validate = (overrides: Record<string, unknown>) =>
    registry.validateCompatibility({
      factorKey: "MARKET.PRICE",
      valueType: "NUMBER",
      subjectType: "INSTRUMENT",
      unit: "USDT",
      ...overrides,
    } as Parameters<typeof registry.validateCompatibility>[0]);
  const codeFor = (overrides: Record<string, unknown>) => {
    const result = validate(overrides);
    assert.equal(result.valid, false);
    return result.valid ? null : result.code;
  };
  assert.equal(codeFor({ factorKey: "UNKNOWN" }), "UNKNOWN_FACTOR");
  assert.equal(codeFor({ valueType: "BOOLEAN" }), "VALUE_TYPE_NOT_ALLOWED");
  assert.equal(codeFor({ subjectType: "MARKET" }), "SUBJECT_TYPE_NOT_ALLOWED");
  assert.equal(codeFor({ unit: null }), "UNIT_REQUIRED");
  assert.equal(codeFor({ unit: " USDT" }), "UNIT_REQUIRED");
});

test("enforces optional, forbidden, and allow-list unit policies", () => {
  const resultFor = (unitDefinition: FactorUnitDefinition, unit: string | null) =>
    new StaticFactorRegistry([definition({ unit: unitDefinition })])
      .validateCompatibility({
        factorKey: "MARKET.PRICE",
        valueType: "NUMBER",
        subjectType: "INSTRUMENT",
        unit,
      });
  assert.equal(resultFor({ policy: "OPTIONAL" }, null).valid, true);
  assert.equal(resultFor({ policy: "OPTIONAL" }, "USD").valid, true);
  const failureCode = (
    unitDefinition: FactorUnitDefinition,
    unit: string | null,
  ) => {
    const result = resultFor(unitDefinition, unit);
    assert.equal(result.valid, false);
    return result.valid ? null : result.code;
  };
  assert.equal(
    failureCode({ policy: "OPTIONAL" }, ""),
    "UNIT_NOT_ALLOWED",
  );
  assert.equal(resultFor({ policy: "FORBIDDEN" }, null).valid, true);
  assert.equal(
    failureCode({ policy: "FORBIDDEN" }, "USD"),
    "UNIT_FORBIDDEN",
  );
  assert.equal(resultFor({
    policy: "ALLOW_LIST",
    allowedUnits: ["USD", "USDT"],
  }, "EUR").valid, false);
  assert.equal(failureCode({
    policy: "ALLOW_LIST",
    allowedUnits: ["USD", "USDT"],
  }, "EUR"), "UNIT_NOT_ALLOWED");
  assert.equal(resultFor({
    policy: "ALLOW_LIST",
    allowedUnits: ["USD", "USDT"],
  }, "USDT").valid, true);
});

test("default registry freezes MARKET.PRICE and CRYPTO.ETF_NET_FLOW definitions", () => {
  const etfFlow: FactorDefinition = {
    factorKey: "CRYPTO.ETF_NET_FLOW",
    version: 1,
    displayName: "Crypto ETF Net Flow",
    description: "Net daily flow into exchange-traded funds for a crypto asset.",
    status: "ACTIVE",
    valueTypes: ["NUMBER"],
    subjectTypes: ["ASSET"],
    unit: { policy: "ALLOW_LIST", allowedUnits: ["USD"] },
    freshness: { kind: "MAX_AGE", maxAgeMs: 86_400_000 },
    scoringEligibility: "ELIGIBLE",
  };
  assert.deepEqual(DEFAULT_FACTOR_DEFINITIONS, [definition(), etfFlow]);
  assert.deepEqual(factorRegistry.list(), [etfFlow, definition()]);
  assert.equal(factorRegistry.validateCompatibility({ factorKey: "CRYPTO.ETF_NET_FLOW", valueType: "NUMBER", subjectType: "ASSET", unit: "USD" }).valid, true);
  for (const input of [
    { valueType: "BOOLEAN", subjectType: "ASSET", unit: "USD" },
    { valueType: "NUMBER", subjectType: "INSTRUMENT", unit: "USD" },
    { valueType: "NUMBER", subjectType: "ASSET", unit: "USDT" },
  ] as const) assert.equal(factorRegistry.validateCompatibility({ factorKey: "CRYPTO.ETF_NET_FLOW", ...input }).valid, false);
  assert.equal(Object.isFrozen(DEFAULT_FACTOR_DEFINITIONS), true);
  assert.equal(Object.isFrozen(DEFAULT_FACTOR_DEFINITIONS[0]?.valueTypes), true);
  assert.equal(Object.isFrozen(DEFAULT_FACTOR_DEFINITIONS[1]?.unit), true);
});

test("fixed definition sets produce deterministic results", () => {
  const first = new StaticFactorRegistry([definition()]);
  const second = new StaticFactorRegistry([definition()]);
  assert.deepEqual(first.list(), second.list());
  assert.deepEqual(
    first.validateCompatibility({
      factorKey: "MARKET.PRICE",
      valueType: "NUMBER",
      subjectType: "INSTRUMENT",
      unit: "USDT",
    }),
    second.validateCompatibility({
      factorKey: "MARKET.PRICE",
      valueType: "NUMBER",
      subjectType: "INSTRUMENT",
      unit: "USDT",
    }),
  );
});

test("registry files have no runtime integration imports", () => {
  const source = [
    readFileSync("src/registries/factor.registry.ts", "utf8"),
    readFileSync("src/registries/default-factor-definitions.ts", "utf8"),
  ].join("\n");
  assert.doesNotMatch(
    source,
    /scoring-engine|evaluator-registry|provider-runner|evidence\.repository|controllers|schedulers|analyzer|frontend/i,
  );
});
