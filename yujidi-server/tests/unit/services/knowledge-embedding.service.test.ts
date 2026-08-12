import test from "node:test";
import assert from "node:assert/strict";
import { KnowledgeEmbeddingSchemaRegistry } from "../../../src/registries/knowledge-embedding-schema.registry.js";
import { calculateKnowledgeEmbeddingVectorDigest, KnowledgeEmbeddingService } from "../../../src/services/knowledge/knowledge-embedding.service.js";
import { TEST_EMBEDDING_SCHEMA, verifiedEmbeddingFixture } from "../../fixtures/knowledge-embedding.fixture.js";
import { DeterministicKnowledgeEmbeddingPort, type DeterministicEmbeddingFailureMode } from "../../fakes/deterministic-knowledge-embedding.port.js";

test("embedding service verifies manifest first, calls provider once, and persists exact immutable lineage", async () => {
  const fixture = verifiedEmbeddingFixture();
  const provider = new DeterministicKnowledgeEmbeddingPort(4);
  const captured: any[] = [];
  const repository = {
    insert: async (command: any) => {
      captured.push(structuredClone(command));
      return { inserted: true, embedding: { ...command, createdAt: new Date("2026-08-06") } };
    },
  } as any;
  let verificationCalls = 0;
  const verifier = { readExactCompleteSet: async () => { verificationCalls += 1; return { verified: true, set: fixture.verifiedSet }; } } as any;
  const documents = { findExact: async () => ({ found: true, document: fixture.document }) } as any;
  const service = new KnowledgeEmbeddingService(new KnowledgeEmbeddingSchemaRegistry([TEST_EMBEDDING_SCHEMA]), provider, verifier, documents, repository);
  const first = await service.generate(fixture.request);
  assert.equal(first.status, "COMPLETED");
  assert.equal(provider.calls, 1);
  assert.equal(provider.lastRequest?.purpose, "RETRIEVAL_DOCUMENT");
  assert.equal(verificationCalls, 1);
  assert.equal(captured.length, fixture.chunks.length);
  assert.equal(captured[0].chunkSetIdentity.chunkSetId, fixture.manifest.identity.chunkSetId);
  assert.equal(captured[0].chunkContentDigest, fixture.chunks[0]!.contentDigest);
  assert.equal(captured[0].embeddingSchema.embeddingSchemaId, TEST_EMBEDDING_SCHEMA.embeddingSchemaId);
  assert.equal(captured[0].purpose, "RETRIEVAL_DOCUMENT");
  assert.match(captured[0].vectorDigest, /^[a-f0-9]{64}$/);
  assert.ok(Object.isFrozen(first.embeddings));
  const secondCaptured: any[] = [];
  const secondService = new KnowledgeEmbeddingService(new KnowledgeEmbeddingSchemaRegistry([TEST_EMBEDDING_SCHEMA]), new DeterministicKnowledgeEmbeddingPort(4), verifier, documents, { insert: async (command: any) => { secondCaptured.push(command); return { inserted: false, code: "ALREADY_EXISTS", embedding: { ...command, createdAt: new Date("2026-08-06") } }; } } as any);
  const second = await secondService.generate(structuredClone(fixture.request));
  assert.equal(second.status, "COMPLETED");
  assert.deepEqual(secondCaptured.map((value) => value.vectorDigest), captured.map((value) => value.vectorDigest));
  assert.deepEqual(second.embeddings.map((value) => value.outcome), fixture.chunks.map(() => "ALREADY_EXISTS"));
});

test("embedding service rejects disallowed document purpose before provider invocation", async () => {
  const fixture = verifiedEmbeddingFixture(); const provider = new DeterministicKnowledgeEmbeddingPort(4);
  const service = new KnowledgeEmbeddingService(new KnowledgeEmbeddingSchemaRegistry([{ ...TEST_EMBEDDING_SCHEMA, allowedPurposes: ["RETRIEVAL_QUERY"] }]), provider);
  const result = await service.generate(fixture.request); assert.equal(result.status, "PURPOSE_NOT_ALLOWED"); assert.equal(provider.calls, 0);
});

test("embedding service persists the canonical L2 vector and digest, never the raw provider vector", async () => {
  const fixture = verifiedEmbeddingFixture(); const raw = [3, 4, ...Array(766).fill(0)]; const captured: any[] = [];
  const schema = { ...TEST_EMBEDDING_SCHEMA, embeddingSchemaId: "L2_TEST_SCHEMA", vectorDimension: 768, normalizationStrategyId: "L2_UNIT_VECTOR", normalizationStrategyVersion: 1 };
  const service = new KnowledgeEmbeddingService(new KnowledgeEmbeddingSchemaRegistry([schema]), { embed: async (request: any) => ({ status: "COMPLETED", providerId: request.providerIdentity.providerId, providerVersion: 1, modelId: request.modelIdentity.modelId, modelVersion: request.modelIdentity.modelVersion, vectors: request.inputs.map((input: any) => ({ inputId: input.inputId, values: raw })) }) }, { readExactCompleteSet: async () => ({ verified: true, set: fixture.verifiedSet }) } as any, { findExact: async () => ({ found: true, document: fixture.document }) } as any, { insert: async (command: any) => { captured.push(command); return { inserted: true, embedding: { ...command, createdAt: new Date() } }; } } as any);
  const result = await service.generate({ ...fixture.request, schemaIdentity: { embeddingSchemaId: schema.embeddingSchemaId, embeddingSchemaVersion: 1 } });
  assert.equal(result.status, "COMPLETED"); assert.equal(captured[0].vector[0], 0.6); assert.equal(captured[0].vector[1], 0.8); assert.notDeepEqual(captured[0].vector, raw);
  const sameCanonical = { ...captured[0], vectorDigest: "" }; delete sameCanonical.vectorDigest;
  assert.equal(calculateKnowledgeEmbeddingVectorDigest(sameCanonical), captured[0].vectorDigest);
});

test("zero-magnitude normalization prevents all persistence and remains stage-visible", async () => {
  const fixture = verifiedEmbeddingFixture(); let persistenceCalls = 0; const schema = { ...TEST_EMBEDDING_SCHEMA, embeddingSchemaId: "L2_ZERO_SCHEMA", vectorDimension: 768, normalizationStrategyId: "L2_UNIT_VECTOR", normalizationStrategyVersion: 1 };
  const service = new KnowledgeEmbeddingService(new KnowledgeEmbeddingSchemaRegistry([schema]), { embed: async (request: any) => ({ status: "COMPLETED", providerId: request.providerIdentity.providerId, providerVersion: 1, modelId: request.modelIdentity.modelId, modelVersion: request.modelIdentity.modelVersion, vectors: request.inputs.map((input: any) => ({ inputId: input.inputId, values: Array(768).fill(0) })) }) }, { readExactCompleteSet: async () => ({ verified: true, set: fixture.verifiedSet }) } as any, { findExact: async () => ({ found: true, document: fixture.document }) } as any, { insert: async () => { persistenceCalls += 1; } } as any);
  const result = await service.generate({ ...fixture.request, schemaIdentity: { embeddingSchemaId: schema.embeddingSchemaId, embeddingSchemaVersion: 1 } }); assert.equal(result.status, "NORMALIZATION_FAILED"); assert.equal(result.embeddings.every((item) => item.code === "VECTOR_MAGNITUDE_ZERO"), true); assert.equal(persistenceCalls, 0);
});

test("manifest failure prevents provider and persistence calls", async () => {
  const fixture = verifiedEmbeddingFixture();
  const provider = new DeterministicKnowledgeEmbeddingPort(4);
  let persistenceCalls = 0;
  const service = new KnowledgeEmbeddingService(
    new KnowledgeEmbeddingSchemaRegistry([TEST_EMBEDDING_SCHEMA]),
    provider,
    { readExactCompleteSet: async () => ({ verified: false, code: "CHUNK_MISSING" }) } as any,
    {} as any,
    { insert: async () => { persistenceCalls += 1; } } as any,
  );
  const result = await service.generate(fixture.request);
  assert.equal(result.status, "CHUNK_SET_NOT_COMPLETE");
  assert.equal(provider.calls, 0);
  assert.equal(persistenceCalls, 0);
});

test("embedding service rejects provider identity, correlation, dimensions, invalid numbers, and failures", async () => {
  const expected: ReadonlyArray<readonly [DeterministicEmbeddingFailureMode, string]> = [
    ["FAILED", "PROVIDER_FAILED"],
    ["COUNT_MISMATCH", "PROVIDER_OUTPUT_INVALID"],
    ["DIMENSION_MISMATCH", "PROVIDER_OUTPUT_INVALID"],
    ["INVALID_NUMBER", "PROVIDER_OUTPUT_INVALID"],
    ["PROVIDER_MISMATCH", "PROVIDER_OUTPUT_INVALID"],
    ["MODEL_MISMATCH", "PROVIDER_OUTPUT_INVALID"],
    ["DUPLICATE_INPUT", "PROVIDER_OUTPUT_INVALID"],
  ];
  for (const [mode, status] of expected) {
    const fixture = verifiedEmbeddingFixture();
    let persistenceCalls = 0;
    const service = new KnowledgeEmbeddingService(
      new KnowledgeEmbeddingSchemaRegistry([TEST_EMBEDDING_SCHEMA]),
      new DeterministicKnowledgeEmbeddingPort(4, mode),
      { readExactCompleteSet: async () => ({ verified: true, set: fixture.verifiedSet }) } as any,
      { findExact: async () => ({ found: true, document: fixture.document }) } as any,
      { insert: async () => { persistenceCalls += 1; } } as any,
    );
    assert.equal((await service.generate(fixture.request)).status, status, mode);
    assert.equal(persistenceCalls, 0, mode);
  }
});

test("embedding service enforces schema activity, corpus, trust, and exact requested set", async () => {
  const fixture = verifiedEmbeddingFixture();
  const inactive = new KnowledgeEmbeddingService(new KnowledgeEmbeddingSchemaRegistry([{ ...TEST_EMBEDDING_SCHEMA, activeForGeneration: false }]), new DeterministicKnowledgeEmbeddingPort(4));
  assert.equal((await inactive.generate(fixture.request)).status, "SCHEMA_INACTIVE");
  const build = (document: any) => new KnowledgeEmbeddingService(
    new KnowledgeEmbeddingSchemaRegistry([TEST_EMBEDDING_SCHEMA]),
    new DeterministicKnowledgeEmbeddingPort(4),
    { readExactCompleteSet: async () => ({ verified: true, set: fixture.verifiedSet }) } as any,
    { findExact: async () => ({ found: true, document }) } as any,
    {} as any,
  );
  assert.equal((await build({ ...fixture.document, corpus: "MARKET_RESEARCH" }).generate(fixture.request)).status, "CORPUS_NOT_ALLOWED");
  assert.equal((await build({ ...fixture.document, trustLevel: "UNVERIFIED" }).generate(fixture.request)).status, "TRUST_NOT_ALLOWED");
  assert.equal((await build(fixture.document).generate({ ...fixture.request, embeddings: fixture.request.embeddings.slice(0, 1) })).status, "CHUNK_LINEAGE_MISMATCH");
});
