import assert from "node:assert/strict";
import test from "node:test";
import { KnowledgeEmbeddingNormalizationRegistry } from "../../../src/registries/knowledge-embedding-normalization.registry.js";
import { KnowledgeEmbeddingNormalizationService } from "../../../src/services/knowledge/knowledge-embedding-normalization.service.js";
import { L2_UNIT_VECTOR_V1_DEFINITION, TEST_NO_NORMALIZATION_DEFINITION } from "../../../src/types/knowledge-embedding-normalization.types.js";

const service = new KnowledgeEmbeddingNormalizationService(new KnowledgeEmbeddingNormalizationRegistry([TEST_NO_NORMALIZATION_DEFINITION, L2_UNIT_VECTOR_V1_DEFINITION]));
test("NONE validates and returns a detached immutable vector without transformation", () => {
  const input = [1, -2, 3, -4]; const result = service.normalize({ normalizationStrategyId: "TEST_NO_NORMALIZATION", normalizationStrategyVersion: 1 }, input);
  assert.equal(result.status, "COMPLETED"); if (result.status !== "COMPLETED") return;
  assert.deepEqual(result.vector, input); assert.notEqual(result.vector, input); assert.ok(Object.isFrozen(result.vector)); assert.deepEqual(input, [1, -2, 3, -4]);
});
test("NONE rejects dimension and non-finite input", () => {
  assert.deepEqual(service.normalize({ normalizationStrategyId: "TEST_NO_NORMALIZATION", normalizationStrategyVersion: 1 }, [1]), { status: "FAILED", failureCode: "VECTOR_DIMENSION_MISMATCH" });
  for (const value of [NaN, Infinity, -Infinity]) assert.equal(service.normalize({ normalizationStrategyId: "TEST_NO_NORMALIZATION", normalizationStrategyVersion: 1 }, [1, 2, 3, value]).status, "FAILED");
});
test("L2 v1 normalizes exact 768-dimensional mixed vectors within explicit tolerance", () => {
  const input = Array.from({ length: 768 }, (_, index) => index % 2 ? -(index + 1) : index + 1); const original = [...input];
  const result = service.normalize({ normalizationStrategyId: "L2_UNIT_VECTOR", normalizationStrategyVersion: 1 }, input);
  assert.equal(result.status, "COMPLETED"); if (result.status !== "COMPLETED") return;
  assert.equal(result.vector.length, 768); assert.ok(Math.abs(result.outputMagnitude - 1) <= L2_UNIT_VECTOR_V1_DEFINITION.validationPolicy.unitMagnitudeTolerance);
  assert.equal(result.vector.every(Number.isFinite), true); assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.vector)); assert.deepEqual(input, original);
});
test("L2 handles unit vectors exactly and rejects zero, wrong dimensions, overflow and missing strategy", () => {
  const unit = [1, ...Array(767).fill(0)]; const completed = service.normalize({ normalizationStrategyId: "L2_UNIT_VECTOR", normalizationStrategyVersion: 1 }, unit);
  assert.equal(completed.status, "COMPLETED");
  assert.deepEqual(service.normalize({ normalizationStrategyId: "L2_UNIT_VECTOR", normalizationStrategyVersion: 1 }, Array(768).fill(0)), { status: "FAILED", failureCode: "VECTOR_MAGNITUDE_ZERO" });
  assert.equal(service.normalize({ normalizationStrategyId: "L2_UNIT_VECTOR", normalizationStrategyVersion: 1 }, [1]).status, "FAILED");
  assert.deepEqual(service.normalize({ normalizationStrategyId: "L2_UNIT_VECTOR", normalizationStrategyVersion: 1 }, Array(768).fill(Number.MAX_VALUE)), { status: "FAILED", failureCode: "VECTOR_MAGNITUDE_NON_FINITE" });
  assert.deepEqual(service.normalize({ normalizationStrategyId: "MISSING", normalizationStrategyVersion: 1 }, unit), { status: "FAILED", failureCode: "NORMALIZATION_STRATEGY_NOT_FOUND" });
});
test("L2 uses exact approved arithmetic without rounding, clamping or epsilon", () => {
  const input = [3, 4, ...Array(766).fill(0)]; const result = service.normalize({ normalizationStrategyId: "L2_UNIT_VECTOR", normalizationStrategyVersion: 1 }, input);
  assert.equal(result.status, "COMPLETED"); if (result.status !== "COMPLETED") return;
  assert.equal(result.vector[0], 3 / 5); assert.equal(result.vector[1], 4 / 5); assert.equal(result.inputMagnitude, 5);
});
