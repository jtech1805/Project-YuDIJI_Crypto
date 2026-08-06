import test from "node:test";
import assert from "node:assert/strict";
import { KnowledgeEmbeddingSchemaRegistry } from "../../../src/registries/knowledge-embedding-schema.registry.js";
import { KnowledgeVectorIndexDefinitionRegistry } from "../../../src/registries/knowledge-vector-index-definition.registry.js";
import { KnowledgeVectorIndexingService } from "../../../src/services/knowledge-vector-indexing.service.js";
import { InMemoryKnowledgeVectorIndexWritePort } from "../../fakes/in-memory-knowledge-vector-index-write.port.js";
import { TEST_EMBEDDING_SCHEMA, TEST_INDEX_DEFINITION, persistedEmbedding, verifiedEmbeddingFixture } from "../../fixtures/knowledge-embedding.fixture.js";

const request = {
  requestId: "INDEX_ETF_FLOW",
  requestVersion: 1,
  indexDefinitionIdentity: { indexId: TEST_INDEX_DEFINITION.indexId, indexVersion: 1 },
  entries: [{ entryIdentity: { indexEntryId: "ETF_FLOW_ENTRY", indexEntryVersion: 1 }, embeddingIdentity: persistedEmbedding().identity }],
};

const dependencies = (overrides: Record<string, any> = {}) => {
  const fixture = verifiedEmbeddingFixture();
  const embedding = overrides.embedding ?? persistedEmbedding();
  const schemas = new KnowledgeEmbeddingSchemaRegistry([TEST_EMBEDDING_SCHEMA]);
  const indexes = new KnowledgeVectorIndexDefinitionRegistry([TEST_INDEX_DEFINITION, { ...TEST_INDEX_DEFINITION, indexVersion: 2 }], schemas);
  const writer = overrides.writer ?? new InMemoryKnowledgeVectorIndexWritePort(TEST_INDEX_DEFINITION.namespace, 4);
  const service = new KnowledgeVectorIndexingService(
    indexes,
    schemas,
    writer,
    overrides.embeddings ?? { findExact: async () => ({ found: true, embedding }) } as any,
    overrides.manifests ?? { findExact: async () => ({ found: true, manifest: fixture.manifest }) } as any,
    overrides.verifier ?? { readExactCompleteSet: async () => ({ verified: true, set: fixture.verifiedSet }) } as any,
    overrides.documents ?? { findExact: async () => ({ found: true, document: fixture.document }) } as any,
  );
  return { service, writer, fixture, embedding };
};

test("indexing service validates exact lineage and writes once through the exact namespace", async () => {
  const { service, writer } = dependencies();
  const result = await service.index(request);
  assert.equal(result.status, "COMPLETED");
  assert.equal(writer.calls, 1);
  assert.deepEqual(result.acceptedEntryIds, ["ETF_FLOW_ENTRY"]);
  assert.equal(writer.inspectExact(TEST_INDEX_DEFINITION.indexId, 1, TEST_INDEX_DEFINITION.namespace).length, 1);
  assert.ok(Object.isFrozen(result.acceptedEntryIds));
});

test("same embedding can enter independently versioned exact indexes without mutation", async () => {
  const original = structuredClone(persistedEmbedding());
  const first = dependencies();
  assert.equal((await first.service.index(request)).status, "COMPLETED");
  const secondWriter = new InMemoryKnowledgeVectorIndexWritePort(TEST_INDEX_DEFINITION.namespace, 4);
  const second = dependencies({ writer: secondWriter });
  const v2 = { ...request, indexDefinitionIdentity: { indexId: TEST_INDEX_DEFINITION.indexId, indexVersion: 2 }, entries: [{ ...request.entries[0]!, entryIdentity: { indexEntryId: "ETF_FLOW_ENTRY_V2", indexEntryVersion: 1 } }] };
  assert.equal((await second.service.index(v2)).status, "COMPLETED");
  assert.deepEqual(persistedEmbedding(), original);
});

test("indexing rejects missing embeddings, schema mismatch, incomplete manifests, and stale lineage before write", async () => {
  const cases: ReadonlyArray<readonly [Record<string, any>, string]> = [
    [{ embeddings: { findExact: async () => ({ found: false, code: "NOT_FOUND" }) } }, "EMBEDDING_NOT_FOUND"],
    [{ embedding: { ...persistedEmbedding(), embeddingSchema: { embeddingSchemaId: "OTHER_SCHEMA", embeddingSchemaVersion: 1 } } }, "EMBEDDING_SCHEMA_MISMATCH"],
    [{ verifier: { readExactCompleteSet: async () => ({ verified: false, code: "CHUNK_MISSING" }) } }, "CHUNK_SET_NOT_COMPLETE"],
    [{ embedding: { ...persistedEmbedding(), chunkContentDigest: "0".repeat(64) } }, "LINEAGE_MISMATCH"],
    [{ embedding: { ...persistedEmbedding(), trustLevel: "UNVERIFIED" } }, "TRUST_NOT_ALLOWED"],
  ];
  for (const [override, expected] of cases) {
    const writer = new InMemoryKnowledgeVectorIndexWritePort(TEST_INDEX_DEFINITION.namespace, 4);
    const { service } = dependencies({ ...override, writer });
    assert.equal((await service.index(request)).status, expected);
    assert.equal(writer.calls, 0);
  }
});

test("indexing write failure is typed and never retries", async () => {
  const writer = new InMemoryKnowledgeVectorIndexWritePort(TEST_INDEX_DEFINITION.namespace, 4, true);
  const { service } = dependencies({ writer });
  assert.equal((await service.index(request)).status, "VECTOR_WRITE_FAILED");
  assert.equal(writer.calls, 1);
});
