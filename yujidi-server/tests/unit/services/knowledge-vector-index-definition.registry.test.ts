import test from "node:test";
import assert from "node:assert/strict";
import { KnowledgeEmbeddingSchemaRegistry } from "../../../src/registries/knowledge-embedding-schema.registry.js";
import { KnowledgeVectorIndexDefinitionRegistry } from "../../../src/registries/knowledge-vector-index-definition.registry.js";
import { TEST_EMBEDDING_SCHEMA, TEST_INDEX_DEFINITION } from "../../fixtures/knowledge-embedding.fixture.js";

test("vector index definition registry enforces exact schema compatibility", () => {
  const schemas = new KnowledgeEmbeddingSchemaRegistry([TEST_EMBEDDING_SCHEMA]);
  const v2 = { ...TEST_INDEX_DEFINITION, indexVersion: 2, retrievalEligible: true };
  const registry = new KnowledgeVectorIndexDefinitionRegistry([v2, TEST_INDEX_DEFINITION], schemas);
  assert.equal(registry.getExact(TEST_INDEX_DEFINITION.indexId, 1)?.retrievalEligible, false);
  assert.equal(registry.getExact(TEST_INDEX_DEFINITION.indexId, 3), null);
  assert.deepEqual(registry.list().map((definition) => definition.indexVersion), [1, 2]);
  assert.ok(Object.isFrozen(registry.getExact(TEST_INDEX_DEFINITION.indexId, 1)?.allowedTrustLevels));
  assert.equal("getLatest" in registry, false);
  assert.throws(() => new KnowledgeVectorIndexDefinitionRegistry([TEST_INDEX_DEFINITION, TEST_INDEX_DEFINITION], schemas), /DUPLICATE/);
  assert.throws(() => new KnowledgeVectorIndexDefinitionRegistry([{ ...TEST_INDEX_DEFINITION, vectorDimension: 8 }], schemas), /INVALID/);
  assert.throws(() => new KnowledgeVectorIndexDefinitionRegistry([{ ...TEST_INDEX_DEFINITION, similarityMetric: "DOT_PRODUCT" }], schemas), /INVALID/);
  assert.throws(() => new KnowledgeVectorIndexDefinitionRegistry([{ ...TEST_INDEX_DEFINITION, namespace: "bad namespace" }], schemas), /INVALID/);
});
