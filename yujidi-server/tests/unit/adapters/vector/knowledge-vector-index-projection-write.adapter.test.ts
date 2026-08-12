import test from "node:test";
import assert from "node:assert/strict";
import { KnowledgeVectorIndexProjectionWriteAdapter } from "../../../../src/adapters/vector/knowledge-vector-index-projection-write.adapter.js";
import { KnowledgeVectorIndexingService } from "../../../../src/services/knowledge/knowledge-vector-indexing.service.js";
import { KnowledgeEmbeddingSchemaRegistry } from "../../../../src/registries/knowledge-embedding-schema.registry.js";
import { KnowledgeVectorIndexDefinitionRegistry } from "../../../../src/registries/knowledge-vector-index-definition.registry.js";
import { TEST_EMBEDDING_SCHEMA, TEST_INDEX_DEFINITION, persistedEmbedding, verifiedEmbeddingFixture } from "../../../fixtures/knowledge-embedding.fixture.js";

const harness = (outcomes: string[] = ["CREATED"]) => {
  const calls: any[] = [];
  const projection = { create: async (value: any) => { calls.push(value); const status = outcomes.shift() ?? "CREATED"; return status === "VALIDATION_FAILED" ? { status, failureCode: "TEST_INVALID" } : status === "CREATED" || status === "ALREADY_EXISTS" ? { status, projection: { ...value, projectionDigest: "d".repeat(64), createdAt: new Date() } } : { status }; } };
  return { adapter: new KnowledgeVectorIndexProjectionWriteAdapter(projection as any), calls };
};

test("projection write adapter maps created, existing, conflict and partial results in input order", async () => {
  const fixture = verifiedEmbeddingFixture(), e = persistedEmbedding(), c = fixture.chunks[0]!;
  const entry: any = { identity: { indexEntryId: "A", indexEntryVersion: 1 }, indexDefinitionIdentity: { indexId: TEST_INDEX_DEFINITION.indexId, indexVersion: 1 }, namespace: TEST_INDEX_DEFINITION.namespace, embeddingIdentity: e.identity, embeddingSchema: e.embeddingSchema, purpose: e.purpose, normalizationStrategy: e.normalizationStrategy, metadataSchema: { metadataSchemaId: TEST_INDEX_DEFINITION.metadataSchemaId, metadataSchemaVersion: 1 }, similarityMetric: "COSINE", vectorDigest: e.vectorDigest, vector: e.vector, documentIdentity: e.documentIdentity, chunkSetIdentity: e.chunkSetIdentity, chunkIdentity: e.chunkIdentity, chunkDigest: e.chunkContentDigest, corpus: e.corpus, trustLevel: e.trustLevel, documentType: fixture.document.documentType, chunkType: c.chunkType, metadata: c.metadata, searchableMetadata: { documentType: fixture.document.documentType, chunkType: c.chunkType, factors: c.metadata.factors, relationshipTypes: c.metadata.relationshipTypes, subjectTypes: c.metadata.subjectTypes, topics: c.metadata.topics, validationCodes: c.metadata.validationCodes }, sourceSpan: c.sourceSpan };
  const request: any = { requestId: "WRITE", requestVersion: 1, indexDefinitionIdentity: entry.indexDefinitionIdentity, namespace: entry.namespace, indexSchema: { indexSchemaId: TEST_INDEX_DEFINITION.indexSchemaId, indexSchemaVersion: 1 }, entries: [entry] };
  let h = harness(["CREATED"]); assert.deepEqual(await h.adapter.write(request), { status: "COMPLETED", acceptedEntryIds: ["A"], existingEntryIds: [] });
  h = harness(["ALREADY_EXISTS"]); assert.deepEqual(await h.adapter.write(request), { status: "COMPLETED", acceptedEntryIds: [], existingEntryIds: ["A"] });
  h = harness(["CONFLICT"]); assert.equal((await h.adapter.write(request)).status, "FAILED");
  h = harness(["CREATED", "CONFLICT"]); const partial = await h.adapter.write({ ...request, entries: [entry, { ...entry, identity: { indexEntryId: "B", indexEntryVersion: 1 } }] }); assert.equal(partial.status, "PARTIAL");
  assert.equal(h.calls.length, 2);
});

test("indexing service produces exact projection material without mutating canonical embedding", async () => {
  const fixture = verifiedEmbeddingFixture(), embedding = persistedEmbedding(), h = harness();
  const schemas = new KnowledgeEmbeddingSchemaRegistry([TEST_EMBEDDING_SCHEMA]);
  const indexes = new KnowledgeVectorIndexDefinitionRegistry([TEST_INDEX_DEFINITION], schemas);
  const original = structuredClone(embedding);
  const service = new KnowledgeVectorIndexingService(indexes, schemas, h.adapter, { findExact: async () => ({ found: true, embedding }) } as any, { findExact: async () => ({ found: true, manifest: fixture.manifest }) } as any, { readExactCompleteSet: async () => ({ verified: true, set: fixture.verifiedSet }) } as any, { findExact: async () => ({ found: true, document: fixture.document }) } as any);
  const result = await service.index({ requestId: "INDEX", requestVersion: 1, indexDefinitionIdentity: { indexId: TEST_INDEX_DEFINITION.indexId, indexVersion: 1 }, entries: [{ entryIdentity: { indexEntryId: "ENTRY", indexEntryVersion: 1 }, embeddingIdentity: embedding.identity }] });
  assert.equal(result.status, "COMPLETED");
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].purpose, "RETRIEVAL_DOCUMENT");
  assert.equal(h.calls[0].metadataSchema.metadataSchemaId, TEST_INDEX_DEFINITION.metadataSchemaId);
  assert.equal("content" in h.calls[0].searchableMetadata, false);
  assert.deepEqual(embedding, original);
});
