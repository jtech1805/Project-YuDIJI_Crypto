import test from "node:test";
import assert from "node:assert/strict";
import { KnowledgeVectorIndexProjectionRepository } from "../../../src/repositories/knowledge-vector-index-projection.repository.js";
import { calculateKnowledgeVectorIndexProjectionDigest } from "../../../src/services/knowledge/knowledge-vector-index-projection.service.js";
import { knowledgeVectorIndexProjectionSchema } from "../../../src/models/knowledge-vector-index-projection.model.js";
import type { CreateKnowledgeVectorIndexProjectionInput, KnowledgeVectorIndexProjectionCommand } from "../../../src/types/knowledge-vector-index-projection.types.js";
import { TEST_INDEX_DEFINITION, persistedEmbedding, verifiedEmbeddingFixture } from "../../fixtures/knowledge-embedding.fixture.js";

const command = (overrides: Record<string, unknown> = {}): KnowledgeVectorIndexProjectionCommand => {
  const e = persistedEmbedding(), fixture = verifiedEmbeddingFixture(), c = fixture.chunks[0]!;
  const base: CreateKnowledgeVectorIndexProjectionInput = { identity: { indexEntryId: "ENTRY", indexEntryVersion: 1 }, indexDefinitionIdentity: { indexId: TEST_INDEX_DEFINITION.indexId, indexVersion: 1 }, namespace: TEST_INDEX_DEFINITION.namespace, metadataSchema: { metadataSchemaId: TEST_INDEX_DEFINITION.metadataSchemaId, metadataSchemaVersion: 1 }, embeddingIdentity: e.identity, embeddingSchema: e.embeddingSchema, purpose: "RETRIEVAL_DOCUMENT", normalizationStrategy: e.normalizationStrategy, vectorDimension: 4, similarityMetric: "COSINE", vectorDigest: e.vectorDigest, vector: e.vector, documentIdentity: e.documentIdentity, chunkSetIdentity: e.chunkSetIdentity, chunkIdentity: e.chunkIdentity, chunkDigest: e.chunkContentDigest, corpus: "PLATFORM_KNOWLEDGE", trustLevel: e.trustLevel, searchableMetadata: { documentType: fixture.document.documentType, chunkType: c.chunkType, factors: c.metadata.factors, relationshipTypes: c.metadata.relationshipTypes, subjectTypes: c.metadata.subjectTypes, topics: c.metadata.topics, validationCodes: c.metadata.validationCodes } };
  const value = { ...base, ...overrides } as CreateKnowledgeVectorIndexProjectionInput;
  return { ...value, projectionDigest: calculateKnowledgeVectorIndexProjectionDigest(value)! };
};

class MemoryModel {
  public rows: Record<string, any>[] = [];
  public fail = false;
  async create(value: any) { if (this.fail) throw new Error("secret database failure"); this.rows.push({ ...structuredClone(value), createdAt: new Date("2026-08-08") }); }
  find(filter: Record<string, unknown>) { const values = this.rows.filter((row) => Object.entries(filter).every(([path, expected]) => path.split(".").reduce<any>((value, key) => value?.[key], row) === expected)); return { limit: (count: number) => ({ lean: () => ({ exec: async () => structuredClone(values.slice(0, count)) }) }) }; }
}

test("projection schema owns createdAt, has no updatedAt, and defines both exact unique indexes", () => {
  assert.equal(knowledgeVectorIndexProjectionSchema.path("createdAt") !== undefined, true);
  assert.equal(knowledgeVectorIndexProjectionSchema.path("updatedAt"), undefined);
  const indexes = knowledgeVectorIndexProjectionSchema.indexes();
  assert.equal(indexes.filter(([, options]) => options.unique).length, 2);
  assert.equal(knowledgeVectorIndexProjectionSchema.path("status"), undefined);
});

test("repository creates, rereads, classifies exact duplicate and material conflicts", async () => {
  const model = new MemoryModel();
  const repository = new KnowledgeVectorIndexProjectionRepository(model as any);
  assert.equal((await repository.insertExact(command())).status, "CREATED");
  assert.equal((await repository.insertExact(command())).status, "ALREADY_EXISTS");
  assert.equal((await repository.insertExact(command({ vectorDigest: "0".repeat(64) }))).status, "CONFLICT");
  assert.equal((await repository.insertExact(command({ identity: { indexEntryId: "OTHER", indexEntryVersion: 1 } }))).status, "CONFLICT");
  assert.equal((await repository.insertExact(command({ identity: { indexEntryId: "INDEX_B_ENTRY", indexEntryVersion: 1 }, indexDefinitionIdentity: { indexId: "YUDIJI_PLATFORM_KNOWLEDGE_INDEX_B", indexVersion: 1 } }))).status, "CREATED");
  assert.equal((await repository.insertExact(command({ identity: { indexEntryId: "INDEX_V2_ENTRY", indexEntryVersion: 1 }, indexDefinitionIdentity: { indexId: TEST_INDEX_DEFINITION.indexId, indexVersion: 2 } }))).status, "CREATED");
  const read = await repository.findExactByEntryIdentity("ENTRY", 1);
  assert.equal(read.found, true);
  if (read.found) { assert.ok(Object.isFrozen(read.projection)); assert.notEqual(read.projection.vector, model.rows[0]!.vector); }
  assert.equal((await repository.findExactByPublicationTarget({ indexId: TEST_INDEX_DEFINITION.indexId, indexVersion: 1, namespace: TEST_INDEX_DEFINITION.namespace, embeddingId: persistedEmbedding().identity.embeddingId, embeddingVersion: 1 })).found, true);
  assert.equal("update" in repository || "delete" in repository || "upsert" in repository || "getLatest" in repository, false);
});

test("duplicate-key race rereads and classifies exact duplicate deterministically", async () => {
  const value = command();
  const row = { ...toRow(value), createdAt: new Date("2026-08-08") };
  const model = new MemoryModel();
  model.create = async () => { model.rows.push(structuredClone(row)); throw Object.assign(new Error("duplicate"), { code: 11000 }); };
  const result = await new KnowledgeVectorIndexProjectionRepository(model as any).insertExact(value);
  assert.equal(result.status, "ALREADY_EXISTS");
});

test("repository sanitizes persistence failures and reports contradictory storage", async () => {
  const model = new MemoryModel(); model.fail = true;
  assert.equal((await new KnowledgeVectorIndexProjectionRepository(model as any).insertExact(command())).status, "PERSISTENCE_FAILED");
  model.fail = false; model.rows = [{ ...toRow(command()), createdAt: new Date() }, { ...toRow(command()), createdAt: new Date() }];
  assert.equal((await new KnowledgeVectorIndexProjectionRepository(model as any).findExactByEntryIdentity("ENTRY", 1)).found, false);
});
const toRow = (v: KnowledgeVectorIndexProjectionCommand) => ({ indexEntryId: v.identity.indexEntryId, indexEntryVersion: v.identity.indexEntryVersion, indexId: v.indexDefinitionIdentity.indexId, indexVersion: v.indexDefinitionIdentity.indexVersion, namespace: v.namespace, metadataSchema: v.metadataSchema, embeddingIdentity: v.embeddingIdentity, embeddingSchema: v.embeddingSchema, purpose: v.purpose, normalizationStrategy: v.normalizationStrategy, vectorDimension: v.vectorDimension, similarityMetric: v.similarityMetric, vectorDigest: v.vectorDigest, vector: v.vector, documentIdentity: v.documentIdentity, chunkSetIdentity: v.chunkSetIdentity, chunkIdentity: v.chunkIdentity, chunkDigest: v.chunkDigest, corpus: v.corpus, trustLevel: v.trustLevel, searchableMetadata: v.searchableMetadata, projectionDigest: v.projectionDigest });
