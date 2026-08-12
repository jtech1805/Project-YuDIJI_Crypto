import assert from "node:assert/strict";
import test from "node:test";
import { MongoAtlasVectorAdapterConfig } from "../../../../src/config/mongo-atlas-vector.config.js";
import { MONGO_ATLAS_PLATFORM_KNOWLEDGE_VECTOR_INDEX_DEFINITION as definition } from "../../../../src/registries/knowledge-vector-index-definition.registry.js";
import {
  buildMongoAtlasVectorSearchPipeline,
  MongoAtlasKnowledgeVectorSearchAdapter,
} from "../../../../src/adapters/vector/mongo-atlas-knowledge-vector-search.adapter.js";
const config = new MongoAtlasVectorAdapterConfig({
  databaseName: "dev",
  collectionName: "knowledgevectorindexprojections",
  vectorIndexName: "index",
  vectorPath: "vector",
  dimension: 768,
  similarityMetric: "COSINE",
  requestTimeoutMs: 100,
  totalDeadlineMs: 200,
  maxWriteBatchSize: 2,
  maxSearchLimit: 5,
  maxNumCandidates: 25,
  developmentValidationOnly: true,
});
const vector = Object.freeze([1, ...Array(767).fill(0)]);
const request: any = {
  index: { indexId: definition.indexId, indexVersion: 1 },
  namespace: definition.namespace,
  indexSchema: {
    indexSchemaId: definition.indexSchemaId,
    indexSchemaVersion: 1,
  },
  asOf: new Date("2026-01-01T00:00:00Z"),
  queryVector: vector,
  vectorDimension: 768,
  metric: "COSINE",
  candidateLimit: 5,
  corpus: "PLATFORM_KNOWLEDGE",
  trustLevels: ["AUTHORITATIVE"],
  eligibleDocuments: [{ documentId: "DOC", documentVersion: 1 }],
  filters: { factorKeys: ["CRYPTO.ETF_NET_FLOW"] },
};
const row: any = {
  indexEntryId: "ENTRY",
  indexEntryVersion: 1,
  indexId: definition.indexId,
  indexVersion: 1,
  namespace: definition.namespace,
  embeddingIdentity: { embeddingId: "EMBED", embeddingVersion: 1 },
  documentIdentity: { documentId: "DOC", documentVersion: 1 },
  chunkSetIdentity: { chunkSetId: "SET", chunkSetVersion: 1 },
  chunkIdentity: { chunkId: "CHUNK", chunkVersion: 1 },
  chunkDigest: "a".repeat(64),
  vectorDigest: "b".repeat(64),
  providerScore: 0.9,
};
test("ANN pipeline is bounded, exact-filtered and never projects vectors or fusion", () => {
  const pipeline: any = buildMongoAtlasVectorSearchPipeline(
    request,
    config,
    "ANN",
    25,
    definition,
  );
  assert.equal(pipeline[0].$vectorSearch.numCandidates, 25);
  assert.equal(pipeline[0].$vectorSearch.limit, 5);
  assert.equal(pipeline[0].$vectorSearch.index, "index");
  assert.equal(pipeline[1].$project.vector, undefined);
  assert.equal(JSON.stringify(pipeline).includes("rankFusion"), false);
  assert.equal(
    JSON.stringify(pipeline).includes(request.asOf.toISOString()),
    true,
  );
  assert.ok(Object.isFrozen(pipeline));
});
test("ENN pipeline is explicit and omits ANN-only numCandidates", () => {
  const pipeline: any = buildMongoAtlasVectorSearchPipeline(
    request,
    config,
    "ENN_VALIDATION",
    25,
    definition,
  );
  assert.equal(pipeline[0].$vectorSearch.exact, true);
  assert.equal("numCandidates" in pipeline[0].$vectorSearch, false);
});
test("search returns exact immutable lineage, raw score and dense provider ordinal", async () => {
  let pipeline: any;
  const adapter = new MongoAtlasKnowledgeVectorSearchAdapter(
    {
      aggregate: (value: any) => {
        pipeline = value;
        return { toArray: async () => [row] };
      },
    } as any,
    config,
    definition,
    "ANN",
    25,
  );
  const out = await adapter.search(request);
  assert.equal(out.status, "COMPLETED");
  assert.equal(out.candidates[0]?.providerOrdinal, 0);
  assert.equal(out.candidates[0]?.providerScore, 0.9);
  assert.deepEqual(out.candidates[0]?.chunkSetIdentity, row.chunkSetIdentity);
  assert.ok(Object.isFrozen(out));
  assert.equal(out.providerOutcome?.completed, true);
  assert.equal(out.providerOutcome?.usage?.providerCalls, 1);
  assert.equal(pipeline[1].$project.vector, undefined);
});
test("search rejects malformed, duplicate, unnormalized and out-of-bound results", async () => {
  const port = (rows: any[]) =>
    new MongoAtlasKnowledgeVectorSearchAdapter(
      { aggregate: () => ({ toArray: async () => rows }) } as any,
      config,
      definition,
    );
  assert.equal(
    (await port([{ ...row, providerScore: NaN }]).search(request)).failureCode,
    "INVALID_SCORE",
  );
  assert.equal(
    (await port([row, row]).search(request)).failureCode,
    "DUPLICATE_CANDIDATE",
  );
  assert.equal(
    (await port([row]).search({ ...request, queryVector: Array(768).fill(1) }))
      .failureCode,
    "INVALID_VECTOR",
  );
});
test("caller cancellation reaches Mongo aggregation and never retries", async () => {
  let calls = 0,
    observed = false;
  const caller = new AbortController();
  const adapter = new MongoAtlasKnowledgeVectorSearchAdapter(
    {
      aggregate: (_pipeline: any, options: any) => ({
        toArray: () =>
          new Promise((_resolve, reject) => {
            calls++;
            options.signal.addEventListener(
              "abort",
              () => {
                observed = true;
                const error = new Error("aborted");
                error.name = "AbortError";
                reject(error);
              },
              { once: true },
            );
          }),
      }),
    } as any,
    config,
    definition,
  );
  const pending = adapter.search(request, { signal: caller.signal });
  caller.abort("RUNTIME_DEADLINE_EXCEEDED");
  const result = await pending;
  assert.equal(result.status, "SEARCH_FAILED");
  assert.equal(result.failureCode, "CALLER_ABORTED");
  assert.equal(
    result.providerOutcome?.completed === false
      ? result.providerOutcome.failure.failureCode
      : null,
    "CALLER_ABORTED",
  );
  assert.equal(observed, true);
  assert.equal(calls, 1);
});
