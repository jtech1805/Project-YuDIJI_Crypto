import test from "node:test";
import assert from "node:assert/strict";
import { KnowledgeVectorIndexProjectionService, calculateKnowledgeVectorIndexProjectionDigest, validateKnowledgeVectorIndexProjectionInput } from "../../../src/services/knowledge/knowledge-vector-index-projection.service.js";
import type { CreateKnowledgeVectorIndexProjectionInput } from "../../../src/types/knowledge-vector-index-projection.types.js";
import { TEST_INDEX_DEFINITION, persistedEmbedding, verifiedEmbeddingFixture } from "../../fixtures/knowledge-embedding.fixture.js";

const input = (): CreateKnowledgeVectorIndexProjectionInput => {
  const embedding = persistedEmbedding();
  const fixture = verifiedEmbeddingFixture();
  const chunk = fixture.chunks[0]!;
  return {
    identity: { indexEntryId: "ETF_FLOW_ENTRY", indexEntryVersion: 1 },
    indexDefinitionIdentity: { indexId: TEST_INDEX_DEFINITION.indexId, indexVersion: 1 },
    namespace: TEST_INDEX_DEFINITION.namespace,
    metadataSchema: { metadataSchemaId: TEST_INDEX_DEFINITION.metadataSchemaId, metadataSchemaVersion: 1 },
    embeddingIdentity: embedding.identity,
    embeddingSchema: embedding.embeddingSchema,
    purpose: "RETRIEVAL_DOCUMENT",
    normalizationStrategy: embedding.normalizationStrategy,
    vectorDimension: embedding.vectorDimension,
    similarityMetric: "COSINE",
    vectorDigest: embedding.vectorDigest,
    vector: embedding.vector,
    documentIdentity: embedding.documentIdentity,
    chunkSetIdentity: embedding.chunkSetIdentity,
    chunkIdentity: embedding.chunkIdentity,
    chunkDigest: embedding.chunkContentDigest,
    corpus: "PLATFORM_KNOWLEDGE",
    trustLevel: embedding.trustLevel,
    searchableMetadata: { documentType: fixture.document.documentType, chunkType: chunk.chunkType, factors: chunk.metadata.factors, relationshipTypes: chunk.metadata.relationshipTypes, subjectTypes: chunk.metadata.subjectTypes, topics: ["Z", "A"], validationCodes: chunk.metadata.validationCodes },
  };
};

test("projection validation accepts exact document publication and rejects closed invalid cases", () => {
  assert.equal(validateKnowledgeVectorIndexProjectionInput(input()), null);
  const cases: readonly [any, string][] = [
    [{ ...input(), identity: { indexEntryId: "bad id", indexEntryVersion: 1 } }, "INVALID_ENTRY_IDENTITY"],
    [{ ...input(), purpose: "RETRIEVAL_QUERY" }, "PURPOSE_NOT_SUPPORTED"],
    [{ ...input(), vectorDimension: 3 }, "VECTOR_DIMENSION_MISMATCH"],
    [{ ...input(), similarityMetric: "DOT_PRODUCT" }, "METRIC_NOT_SUPPORTED"],
    [{ ...input(), vector: [0, 0, Number.NaN, 0] }, "VECTOR_CONTAINS_NON_FINITE_VALUE"],
    [{ ...input(), corpus: "MARKET_RESEARCH" }, "CORPUS_NOT_SUPPORTED"],
    [{ ...input(), trustLevel: "UNVERIFIED" }, "TRUST_NOT_SUPPORTED"],
    [{ ...input(), searchableMetadata: { ...input().searchableMetadata, topics: ["A", "A"] } }, "METADATA_INVALID"],
    [{ ...input(), searchableMetadata: { ...input().searchableMetadata, effectiveFrom: new Date("2027-01-01"), effectiveUntil: new Date("2026-01-01") } }, "INVALID_EFFECTIVE_INTERVAL"],
    [{ ...input(), createdAt: new Date() }, "CALLER_CONTROLLED_PERSISTENCE_FIELD"],
  ];
  for (const [value, code] of cases) assert.equal(validateKnowledgeVectorIndexProjectionInput(value), code);
});

test("projection digest is stable across metadata order and changes with publication material", () => {
  const base = input();
  const reordered = { ...base, searchableMetadata: { ...base.searchableMetadata, topics: ["A", "Z"] } };
  const digest = calculateKnowledgeVectorIndexProjectionDigest(base);
  assert.match(digest!, /^[a-f0-9]{64}$/);
  assert.equal(calculateKnowledgeVectorIndexProjectionDigest(reordered), digest);
  assert.notEqual(calculateKnowledgeVectorIndexProjectionDigest({ ...base, vectorDigest: "0".repeat(64) }), digest);
  assert.notEqual(calculateKnowledgeVectorIndexProjectionDigest({ ...base, namespace: "YUDIJI:OTHER" }), digest);
  assert.notEqual(calculateKnowledgeVectorIndexProjectionDigest({ ...base, indexDefinitionIdentity: { ...base.indexDefinitionIdentity, indexVersion: 2 } }), digest);
});

test("projection service canonicalizes, persists once and returns immutable output", async () => {
  let received: any;
  const repository = { insertExact: async (command: any) => { received = command; return { status: "CREATED", projection: { ...command, createdAt: new Date("2026-08-08") } }; } };
  const result = await new KnowledgeVectorIndexProjectionService(repository as any).create(input());
  assert.equal(result.status, "CREATED");
  assert.deepEqual(received.searchableMetadata.topics, ["A", "Z"]);
  assert.match(received.projectionDigest, /^[a-f0-9]{64}$/);
  assert.equal("createdAt" in received, false);
  assert.ok(Object.isFrozen(received.vector));
});
