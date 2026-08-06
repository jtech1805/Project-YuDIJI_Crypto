import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryKnowledgeVectorIndexWritePort } from "../../fakes/in-memory-knowledge-vector-index-write.port.js";
import { TEST_INDEX_DEFINITION, persistedEmbedding, verifiedEmbeddingFixture } from "../../fixtures/knowledge-embedding.fixture.js";
import type { KnowledgeVectorIndexEntry, KnowledgeVectorIndexWriteRequest } from "../../../src/types/knowledge-vector-index-write.types.js";

const entry = (): KnowledgeVectorIndexEntry => {
  const fixture = verifiedEmbeddingFixture();
  const embedding = persistedEmbedding();
  const chunk = fixture.chunks[0]!;
  return {
    identity: { indexEntryId: "ETF_FLOW_INDEX_ENTRY", indexEntryVersion: 1 },
    indexDefinitionIdentity: { indexId: TEST_INDEX_DEFINITION.indexId, indexVersion: 1 },
    namespace: TEST_INDEX_DEFINITION.namespace,
    embeddingIdentity: embedding.identity,
    embeddingSchema: embedding.embeddingSchema,
    vectorDigest: embedding.vectorDigest,
    vector: embedding.vector,
    documentIdentity: embedding.documentIdentity,
    chunkSetIdentity: embedding.chunkSetIdentity,
    chunkIdentity: embedding.chunkIdentity,
    chunkDigest: embedding.chunkContentDigest,
    corpus: embedding.corpus,
    trustLevel: embedding.trustLevel,
    documentType: fixture.document.documentType,
    chunkType: chunk.chunkType,
    metadata: chunk.metadata,
    sourceSpan: chunk.sourceSpan,
  };
};
const request = (value = entry()): KnowledgeVectorIndexWriteRequest => ({
  requestId: "WRITE_TEST_INDEX",
  requestVersion: 1,
  indexDefinitionIdentity: value.indexDefinitionIdentity,
  namespace: value.namespace,
  indexSchema: { indexSchemaId: TEST_INDEX_DEFINITION.indexSchemaId, indexSchemaVersion: 1 },
  entries: [value],
});

test("test vector write port stores exact immutable entries and classifies duplicates", async () => {
  const port = new InMemoryKnowledgeVectorIndexWritePort(TEST_INDEX_DEFINITION.namespace, 4);
  const first = await port.write(request());
  assert.equal(first.status, "COMPLETED");
  const second = await port.write(request());
  assert.equal(second.status, "COMPLETED");
  if (second.status === "COMPLETED") assert.deepEqual(second.existingEntryIds, ["ETF_FLOW_INDEX_ENTRY"]);
  const inspected = port.inspectExact(TEST_INDEX_DEFINITION.indexId, 1, TEST_INDEX_DEFINITION.namespace);
  assert.equal(inspected.length, 1);
  assert.ok(Object.isFrozen(inspected[0]?.metadata));
  assert.equal("search" in port, false);
});

test("test vector write port rejects changed duplicates, namespaces, dimensions, and non-finite values", async () => {
  const port = new InMemoryKnowledgeVectorIndexWritePort(TEST_INDEX_DEFINITION.namespace, 4);
  await port.write(request());
  assert.equal((await port.write(request({ ...entry(), vectorDigest: "0".repeat(64) }))).status, "FAILED");
  assert.equal((await port.write({ ...request(), namespace: "OTHER:NAMESPACE" })).status, "FAILED");
  assert.equal((await new InMemoryKnowledgeVectorIndexWritePort(TEST_INDEX_DEFINITION.namespace, 8).write(request())).status, "FAILED");
  assert.equal((await new InMemoryKnowledgeVectorIndexWritePort(TEST_INDEX_DEFINITION.namespace, 4).write(request({ ...entry(), vector: [Number.NaN, 0, 0, 0] }))).status, "FAILED");
});

