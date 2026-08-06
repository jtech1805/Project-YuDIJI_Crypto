import assert from "node:assert/strict";
import test from "node:test";
import { KnowledgeEmbeddingNormalizationRegistry } from "../../../src/registries/knowledge-embedding-normalization.registry.js";
import { L2_UNIT_VECTOR_V1_DEFINITION, TEST_NO_NORMALIZATION_DEFINITION } from "../../../src/types/knowledge-embedding-normalization.types.js";

test("normalization registry provides immutable exact-only ordered authority", () => {
  const registry = new KnowledgeEmbeddingNormalizationRegistry([TEST_NO_NORMALIZATION_DEFINITION, L2_UNIT_VECTOR_V1_DEFINITION]);
  const l2 = registry.getExact("L2_UNIT_VECTOR", 1);
  assert.equal(l2?.inputDimension, 768); assert.ok(Object.isFrozen(l2)); assert.ok(Object.isFrozen(l2?.numericPolicy));
  assert.equal(registry.getExact("L2_UNIT_VECTOR", 2), null); assert.equal("getLatest" in registry, false);
  assert.deepEqual(registry.list().map((item) => item.normalizationStrategyId), ["L2_UNIT_VECTOR", "TEST_NO_NORMALIZATION"]);
});

test("normalization registry rejects duplicate, conflicting and invalid definitions", () => {
  assert.throws(() => new KnowledgeEmbeddingNormalizationRegistry([TEST_NO_NORMALIZATION_DEFINITION, TEST_NO_NORMALIZATION_DEFINITION]), /DUPLICATE/);
  assert.throws(() => new KnowledgeEmbeddingNormalizationRegistry([TEST_NO_NORMALIZATION_DEFINITION, { ...TEST_NO_NORMALIZATION_DEFINITION, inputDimension: 5 }]), /CONFLICTING/);
  for (const definition of [{ ...TEST_NO_NORMALIZATION_DEFINITION, inputDimension: 0 }, { ...TEST_NO_NORMALIZATION_DEFINITION, validationPolicy: { unitMagnitudeTolerance: 0 } }, { ...TEST_NO_NORMALIZATION_DEFINITION, algorithm: "OTHER" }]) {
    assert.throws(() => new KnowledgeEmbeddingNormalizationRegistry([definition as any]), /INVALID/);
  }
});
