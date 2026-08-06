import test from "node:test";
import assert from "node:assert/strict";
import { KnowledgeEmbeddingSchemaRegistry } from "../../../src/registries/knowledge-embedding-schema.registry.js";
import { KnowledgeEmbeddingTextService } from "../../../src/services/knowledge-embedding-text.service.js";
import { TEST_EMBEDDING_SCHEMA, verifiedEmbeddingFixture } from "../../fixtures/knowledge-embedding.fixture.js";

test("embedding schema registry provides immutable exact-only versioned lookup", () => {
  const v2 = { ...TEST_EMBEDDING_SCHEMA, embeddingSchemaVersion: 2, modelVersion: "CHARACTERIZATION_V2" };
  const registry = new KnowledgeEmbeddingSchemaRegistry([v2, TEST_EMBEDDING_SCHEMA]);
  assert.equal(registry.getExact(TEST_EMBEDDING_SCHEMA.embeddingSchemaId, 1)?.modelVersion, "CHARACTERIZATION_V1");
  assert.equal(registry.getExact(TEST_EMBEDDING_SCHEMA.embeddingSchemaId, 3), null);
  assert.deepEqual(registry.list().map((schema) => schema.embeddingSchemaVersion), [1, 2]);
  assert.ok(Object.isFrozen(registry.getExact(TEST_EMBEDDING_SCHEMA.embeddingSchemaId, 1)?.allowedTrustLevels));
  assert.equal("getLatest" in registry, false);
  assert.throws(() => new KnowledgeEmbeddingSchemaRegistry([TEST_EMBEDDING_SCHEMA, TEST_EMBEDDING_SCHEMA]), /DUPLICATE/);
  assert.throws(() => new KnowledgeEmbeddingSchemaRegistry([{ ...TEST_EMBEDDING_SCHEMA, vectorDimension: 0 }]), /INVALID/);
  assert.throws(() => new KnowledgeEmbeddingSchemaRegistry([{ ...TEST_EMBEDDING_SCHEMA, allowedCorpora: ["MARKET_RESEARCH"] }]), /INVALID/);
});

test("embedding text is deterministic, semantic, bounded, and excludes persistence metadata", () => {
  const fixture = verifiedEmbeddingFixture();
  const service = new KnowledgeEmbeddingTextService();
  const chunk = fixture.chunks[0]!;
  const a = service.project(fixture.document, fixture.verifiedSet, chunk.identity, TEST_EMBEDDING_SCHEMA);
  const b = service.project(structuredClone(fixture.document), structuredClone(fixture.verifiedSet), chunk.identity, TEST_EMBEDDING_SCHEMA);
  assert.deepEqual(a, b);
  assert.match(a?.text ?? "", /FACTOR_DOCUMENTATION/);
  assert.match(a?.text ?? "", /CRYPTO\.ETF_NET_FLOW@1/);
  assert.match(a?.text ?? "", /IDENTITY_AND_MEANING/);
  assert.equal(a?.text.includes("createdAt"), false);
  assert.equal(a?.text.includes("sourceUri"), false);
  assert.match(a?.textDigest ?? "", /^[a-f0-9]{64}$/);
  assert.ok(Object.isFrozen(a));
});

test("projector version changes exact text digest lineage", () => {
  const fixture = verifiedEmbeddingFixture();
  const chunk = fixture.chunks[0]!;
  const service = new KnowledgeEmbeddingTextService();
  const v1 = service.project(fixture.document, fixture.verifiedSet, chunk.identity, TEST_EMBEDDING_SCHEMA);
  const v2 = service.project(fixture.document, fixture.verifiedSet, chunk.identity, { ...TEST_EMBEDDING_SCHEMA, embeddingTextProjectorVersion: 2 });
  assert.notEqual(v1?.textDigest, v2?.textDigest);
  assert.equal(service.project(fixture.document, fixture.verifiedSet, { chunkId: "ORPHAN", chunkVersion: 1 }, TEST_EMBEDDING_SCHEMA), null);
});

