import test from "node:test";
import assert from "node:assert/strict";
import { KnowledgeEmbeddingRepository, type KnowledgeEmbeddingModelPort } from "../../../src/repositories/knowledge-embedding.repository.js";
import { embeddingCommand } from "../../fixtures/knowledge-embedding.fixture.js";
import { calculateKnowledgeEmbeddingVectorDigest } from "../../../src/services/knowledge-embedding.service.js";

const query = <T>(value: T) => ({ lean: () => ({ exec: async () => structuredClone(value) }) });

test("embedding repository appends, exact-reads, and returns immutable duplicates", async () => {
  const candidate = embeddingCommand();
  let rows: any[] = [];
  const model: KnowledgeEmbeddingModelPort = {
    create: async (value: any) => { rows = [{ ...structuredClone(value), createdAt: new Date("2026-08-06") }]; },
    find: (filter) => ({
      limit: () => query(rows.filter((row) => matches(row, filter))),
      sort: () => query(rows.filter((row) => matches(row, filter))),
    }),
  };
  const repository = new KnowledgeEmbeddingRepository(model);
  assert.equal((await repository.insert(candidate)).inserted, true);
  const exact = await repository.findExact(candidate.identity);
  assert.equal(exact.found, true);
  if (exact.found) {
    assert.ok(Object.isFrozen(exact.embedding.vector));
    assert.notEqual(exact.embedding.createdAt, rows[0]!.createdAt);
  }
  const duplicate = await repository.insert(candidate);
  assert.equal(duplicate.inserted ? null : duplicate.code, "ALREADY_EXISTS");
  const byLineage = await repository.findExactForChunkAndSchema(candidate.chunkIdentity, candidate.embeddingSchema);
  assert.equal(byLineage.found, true);
  assert.equal("getLatest" in repository || "update" in repository || "delete" in repository || "upsert" in repository, false);
});

test("embedding repository distinguishes identity, lineage, and content conflicts", async () => {
  const candidate = embeddingCommand();
  let rows = [toRow(candidate)];
  const model: KnowledgeEmbeddingModelPort = {
    create: async () => undefined,
    find: (filter) => ({ limit: () => query(rows.filter((row) => matches(row, filter))), sort: () => query(rows.filter((row) => matches(row, filter))) }),
  };
  const repository = new KnowledgeEmbeddingRepository(model);
  const content = await repository.insert({ ...candidate, vectorDigest: "3".repeat(64) });
  assert.equal(content.inserted ? null : content.code, "CONTENT_CONFLICT");
  const identity = await repository.insert({ ...candidate, embeddingSchema: { embeddingSchemaId: "OTHER_SCHEMA", embeddingSchemaVersion: 1 } });
  assert.equal(identity.inserted ? null : identity.code, "IDENTITY_CONFLICT");
  const lineage = await repository.insert({ ...candidate, identity: { embeddingId: "OTHER_EMBEDDING", embeddingVersion: 1 } });
  assert.equal(lineage.inserted ? null : lineage.code, "LINEAGE_CONFLICT");
  const purpose = await repository.insert({ ...candidate, purpose: "RETRIEVAL_QUERY" });
  assert.equal(purpose.inserted ? null : purpose.code, "IDENTITY_CONFLICT");
  const normalization = await repository.insert({ ...candidate, normalizationStrategy: { normalizationStrategyId: "TEST_OTHER_NORMALIZATION", normalizationStrategyVersion: 1 } });
  assert.equal(normalization.inserted ? null : normalization.code, "IDENTITY_CONFLICT");
  rows = [toRow(candidate), toRow(candidate)];
  assert.deepEqual(await repository.findExact(candidate.identity), { found: false, code: "INVARIANT_VIOLATION" });
});

test("canonical vector digest includes purpose and normalization lineage but excludes createdAt", () => {
  const candidate = embeddingCommand(); const { vectorDigest: _, ...material } = candidate;
  const base = calculateKnowledgeEmbeddingVectorDigest(material); assert.equal(base, candidate.vectorDigest);
  assert.notEqual(calculateKnowledgeEmbeddingVectorDigest({ ...material, purpose: "RETRIEVAL_QUERY" }), base);
  assert.notEqual(calculateKnowledgeEmbeddingVectorDigest({ ...material, normalizationStrategy: { ...material.normalizationStrategy, normalizationStrategyVersion: 2 } }), base);
  assert.notEqual(calculateKnowledgeEmbeddingVectorDigest({ ...material, vector: [0.2, ...material.vector.slice(1)] }), base);
});

test("embedding repository recovers duplicate-key race through exact reread", async () => {
  const candidate = embeddingCommand();
  let calls = 0;
  const model: KnowledgeEmbeddingModelPort = {
    create: async () => { throw { code: 11000 }; },
    find: () => ({ limit: () => query(++calls <= 2 ? [] : [toRow(candidate)]), sort: () => query([]) }),
  };
  const result = await new KnowledgeEmbeddingRepository(model).insert(candidate);
  assert.equal(result.inserted, false);
  assert.equal(result.code, "ALREADY_EXISTS");
});

const toRow = (value: ReturnType<typeof embeddingCommand>) => ({
  embeddingId: value.identity.embeddingId,
  embeddingVersion: value.identity.embeddingVersion,
  chunkSetIdentity: value.chunkSetIdentity,
  documentIdentity: value.documentIdentity,
  chunkIdentity: value.chunkIdentity,
  chunkContentDigest: value.chunkContentDigest,
  embeddingTextProjector: value.embeddingTextProjector,
  embeddingTextDigest: value.embeddingTextDigest,
  provider: value.provider,
  model: value.model,
  embeddingSchema: value.embeddingSchema,
  normalizationStrategy: value.normalizationStrategy,
  purpose: value.purpose,
  vectorDimension: value.vectorDimension,
  vector: value.vector,
  vectorDigest: value.vectorDigest,
  corpus: value.corpus,
  trustLevel: value.trustLevel,
  createdAt: new Date("2026-08-06"),
});
const matches = (row: any, filter: Record<string, unknown>) => Object.entries(filter).every(([path, expected]) => path.split(".").reduce((value, key) => value?.[key], row) === expected);
