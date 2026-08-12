import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { DeterministicFactorEvaluator } from "../../../src/ports/deterministic-factor-evaluator.port.js";
import {
  StaticDeterministicFactorEvaluatorRegistry,
} from "../../../src/registries/deterministic-factor-evaluator.registry.js";
import {
  DEFAULT_DETERMINISTIC_FACTOR_EVALUATORS,
  createDefaultDeterministicFactorEvaluatorRegistry,
} from "../../../src/registries/default-deterministic-factor-evaluator.registry.js";
import {
  FactorEvaluatorRegistryError,
} from "../../../src/types/factor-evaluator-registry.types.js";

const evaluator = (
  evaluatorId = "TEST_EVALUATOR_A_V1",
  overrides: Record<string, unknown> = {},
): DeterministicFactorEvaluator => ({
  evaluatorId,
  evaluatorVersion: 1,
  configurationVersion: 1,
  supportedFactorKeys: ["MARKET.PRICE"],
  evaluate: () => {
    throw new Error("evaluate must never be called");
  },
  ...overrides,
}) as DeterministicFactorEvaluator;

const validContract = () => {
  const calls: unknown[] = [];
  return {
    calls,
    contractService: {
      validateEvaluator: (value: unknown) => {
        calls.push(value);
        return {
          valid: true as const,
          evaluatorId: (value as DeterministicFactorEvaluator).evaluatorId,
        };
      },
    },
  };
};

test("accepts an empty registry and returns fail-closed empty lookups", () => {
  const contract = validContract();
  const registry = new StaticDeterministicFactorEvaluatorRegistry({
    evaluators: [],
    contractService: contract.contractService,
  });
  assert.deepEqual(registry.list(), []);
  assert.equal(registry.getById("ANY"), null);
  assert.deepEqual(registry.listByFactor("MARKET.PRICE"), []);
  assert.deepEqual(registry.getImplementationsByFactor("MARKET.PRICE"), []);
  assert.equal(contract.calls.length, 0);
});

test("rejects invalid evaluator collections with a sanitized typed error", () => {
  for (const evaluators of [null, undefined, {}, "evaluators"]) {
    assert.throws(
      () => new StaticDeterministicFactorEvaluatorRegistry({
        evaluators,
        contractService: validContract().contractService,
      } as never),
      (error: unknown) =>
        error instanceof FactorEvaluatorRegistryError
        && error.code === "INVALID_EVALUATOR_COLLECTION"
        && error.evaluatorId === null
        && !error.message.includes("evaluate"),
    );
  }
  const sparse = new Array(1);
  assert.throws(
    () => new StaticDeterministicFactorEvaluatorRegistry({
      evaluators: sparse,
      contractService: validContract().contractService,
    }),
    (error: unknown) =>
      error instanceof FactorEvaluatorRegistryError
      && error.code === "INVALID_EVALUATOR_COLLECTION",
  );
});

test("validates each supplied evaluator exactly once without executing it", () => {
  const first = evaluator("TEST_EVALUATOR_A_V1");
  const second = evaluator("TEST_EVALUATOR_B_V1");
  const contract = validContract();
  const registry = new StaticDeterministicFactorEvaluatorRegistry({
    evaluators: [second, first],
    contractService: contract.contractService,
  });
  assert.deepEqual(contract.calls, [second, first]);
  registry.getById(first.evaluatorId);
  registry.list();
  registry.listByFactor("MARKET.PRICE");
  registry.getImplementationsByFactor("MARKET.PRICE");
  assert.equal(contract.calls.length, 2);
});

test("rejects an invalid evaluator and exposes only a safe extractable ID", () => {
  const invalid = evaluator("TEST_INVALID_V1", {
    parameters: { credential: "PRIVATE" },
  });
  assert.throws(
    () => new StaticDeterministicFactorEvaluatorRegistry({
      evaluators: [invalid],
      contractService: {
        validateEvaluator: () => ({
          valid: false as const,
          code: "INVALID_EVALUATOR_VERSION" as const,
        }),
      },
    }),
    (error: unknown) =>
      error instanceof FactorEvaluatorRegistryError
      && error.code === "INVALID_EVALUATOR"
      && error.evaluatorId === "TEST_INVALID_V1"
      && !error.message.includes("PRIVATE")
      && !error.message.includes("credential"),
  );
});

test("rejects duplicate evaluator IDs regardless of version metadata", () => {
  const contract = validContract();
  assert.throws(
    () => new StaticDeterministicFactorEvaluatorRegistry({
      evaluators: [
        evaluator("TEST_DUPLICATE_V1"),
        evaluator("TEST_DUPLICATE_V1", {
          evaluatorVersion: 2,
          configurationVersion: 2,
        }),
      ],
      contractService: contract.contractService,
    }),
    (error: unknown) =>
      error instanceof FactorEvaluatorRegistryError
      && error.code === "DUPLICATE_EVALUATOR_ID"
      && error.evaluatorId === "TEST_DUPLICATE_V1",
  );
  assert.equal(contract.calls.length, 2);
});

test("allows multiple IDs with the same factor and version metadata", () => {
  const contract = validContract();
  const registry = new StaticDeterministicFactorEvaluatorRegistry({
    evaluators: [evaluator("TEST_B_V1"), evaluator("TEST_A_V1")],
    contractService: contract.contractService,
  });
  assert.deepEqual(
    registry.listByFactor("MARKET.PRICE").map(({ evaluatorId }) => evaluatorId),
    ["TEST_A_V1", "TEST_B_V1"],
  );
});

test("getById is exact and returns the retained implementation", () => {
  const implementation = evaluator();
  const registry = new StaticDeterministicFactorEvaluatorRegistry({
    evaluators: [implementation],
    contractService: validContract().contractService,
  });
  assert.equal(registry.getById(implementation.evaluatorId), implementation);
  for (const id of [
    "test_evaluator_a_v1", " TEST_EVALUATOR_A_V1", "TEST_EVALUATOR_A_V1 ",
    "UNKNOWN", null, 1,
  ]) {
    assert.equal(registry.getById(id as never), null);
  }
});

test("list and factor lookup expose exact sorted safe summaries", () => {
  const registry = new StaticDeterministicFactorEvaluatorRegistry({
    evaluators: [
      evaluator("TEST_Z_V1", { evaluatorVersion: 3, configurationVersion: 4 }),
      evaluator("TEST_A_V1"),
    ],
    contractService: validContract().contractService,
  });
  assert.deepEqual(registry.list(), [
    {
      evaluatorId: "TEST_A_V1",
      evaluatorVersion: 1,
      configurationVersion: 1,
      supportedFactorKeys: ["MARKET.PRICE"],
    },
    {
      evaluatorId: "TEST_Z_V1",
      evaluatorVersion: 3,
      configurationVersion: 4,
      supportedFactorKeys: ["MARKET.PRICE"],
    },
  ]);
  assert.deepEqual(registry.listByFactor("MARKET.PRICE"), registry.list());
  assert.equal("evaluate" in registry.list()[0]!, false);
  for (const factor of ["OTHER", "market.price", " MARKET.PRICE", null]) {
    assert.deepEqual(registry.listByFactor(factor as never), []);
    assert.deepEqual(registry.getImplementationsByFactor(factor as never), []);
  }
});

test("input order cannot affect summaries or implementation-list ordering", () => {
  const first = evaluator("TEST_A_V1");
  const second = evaluator("TEST_B_V1");
  const make = (evaluators: DeterministicFactorEvaluator[]) =>
    new StaticDeterministicFactorEvaluatorRegistry({
      evaluators,
      contractService: validContract().contractService,
    });
  const forward = make([first, second]);
  const reverse = make([second, first]);
  assert.deepEqual(forward.list(), reverse.list());
  assert.deepEqual(
    forward.getImplementationsByFactor("MARKET.PRICE").map(({ evaluatorId }) => evaluatorId),
    reverse.getImplementationsByFactor("MARKET.PRICE").map(({ evaluatorId }) => evaluatorId),
  );
});

test("source collection and supported-factor mutation cannot change registry structure", () => {
  const supportedFactorKeys: Array<"MARKET.PRICE"> = ["MARKET.PRICE"];
  const implementation = evaluator("TEST_STABLE_V1", { supportedFactorKeys });
  const source = [implementation];
  const registry = new StaticDeterministicFactorEvaluatorRegistry({
    evaluators: source,
    contractService: validContract().contractService,
  });
  source.length = 0;
  supportedFactorKeys.length = 0;
  (implementation as { evaluatorVersion: number }).evaluatorVersion = 99;
  assert.deepEqual(registry.list(), [{
    evaluatorId: "TEST_STABLE_V1",
    evaluatorVersion: 1,
    configurationVersion: 1,
    supportedFactorKeys: ["MARKET.PRICE"],
  }]);
  assert.equal(registry.getImplementationsByFactor("MARKET.PRICE")[0], implementation);
});

test("returned summaries and arrays cannot mutate future registry state", () => {
  const registry = new StaticDeterministicFactorEvaluatorRegistry({
    evaluators: [evaluator()],
    contractService: validContract().contractService,
  });
  const listed = registry.list();
  assert.throws(() => (listed as unknown[]).push({}));
  assert.throws(() => ((listed[0] as { evaluatorVersion: number }).evaluatorVersion = 2));
  assert.throws(() =>
    (listed[0]!.supportedFactorKeys as unknown[]).push("OTHER"));
  const byFactor = registry.listByFactor("MARKET.PRICE");
  assert.throws(() => (byFactor as unknown[]).pop());
  const implementations = registry.getImplementationsByFactor("MARKET.PRICE");
  assert.throws(() => (implementations as unknown[]).pop());
  assert.equal(registry.list()[0]?.evaluatorVersion, 1);
});

test("the default collection and registry are valid and empty", () => {
  assert.deepEqual(DEFAULT_DETERMINISTIC_FACTOR_EVALUATORS, []);
  assert.throws(() =>
    (DEFAULT_DETERMINISTIC_FACTOR_EVALUATORS as DeterministicFactorEvaluator[])
      .push(evaluator()));
  const registry = createDefaultDeterministicFactorEvaluatorRegistry(
    validContract().contractService,
  );
  assert.deepEqual(registry.list(), []);
});

test("new registry files have no I/O, execution, or legacy registry imports", () => {
  const sources = [
    "../../../src/registries/deterministic-factor-evaluator.registry.ts",
    "../../../src/registries/default-deterministic-factor-evaluator.registry.ts",
  ].map((path) => readFileSync(new URL(path, import.meta.url), "utf8")).join("\n");
  assert.doesNotMatch(
    sources,
    /from\s+["'][^"']*(?:scoring-rule-evaluator|india-equity|repositories|evidence-read|factor-input-assembly\.service|clients|mongoose|axios|controllers|schedulers|llm|frontend)/i,
  );
  assert.doesNotMatch(sources, /\.evaluate\s*\(/);
});
