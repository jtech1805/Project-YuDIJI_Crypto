import assert from "node:assert/strict";
import test from "node:test";
import { CompiledGenericRelationshipEvaluator } from "../../../src/services/compiled-generic-relationship-evaluator.js";
import { DEFAULT_COMPILED_EVALUATOR_IMPLEMENTATIONS, StaticCompiledEvaluatorImplementationRegistry } from "../../../src/registries/compiled-evaluator-implementation.registry.js";

test("production defaults are empty and lookup is exact by implementation key and evaluator version", () => {
  assert.deepEqual(DEFAULT_COMPILED_EVALUATOR_IMPLEMENTATIONS, []);
  const implementation = new CompiledGenericRelationshipEvaluator();
  const registry = new StaticCompiledEvaluatorImplementationRegistry([implementation]);
  assert.equal(registry.getExact(implementation.implementationKey, 1), implementation);
  assert.equal(registry.getExact(implementation.implementationKey, 2), null);
  assert.equal(registry.getExact("OTHER", 1), null);
  assert.equal("getLatest" in registry, false);
});

test("registry rejects malformed and duplicate exact implementations", () => {
  assert.throws(() => new StaticCompiledEvaluatorImplementationRegistry(null as any), (error: any) => error.code === "INVALID_IMPLEMENTATION_COLLECTION");
  assert.throws(() => new StaticCompiledEvaluatorImplementationRegistry([{} as any]), (error: any) => error.code === "INVALID_IMPLEMENTATION");
  const implementation = new CompiledGenericRelationshipEvaluator();
  assert.throws(() => new StaticCompiledEvaluatorImplementationRegistry([implementation, implementation]), (error: any) => error.code === "DUPLICATE_IMPLEMENTATION");
});

