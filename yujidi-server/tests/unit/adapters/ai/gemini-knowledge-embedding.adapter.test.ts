import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "@google/genai";
import { GeminiKnowledgeEmbeddingAdapter } from "../../../../src/adapters/ai/gemini-knowledge-embedding.adapter.js";
import {
  GeminiEmbeddingAdapterConfig,
  createGeminiEmbeddingAdapterConfig,
} from "../../../../src/config/gemini-embedding.config.js";
import {
  GEMINI_EMBEDDING_DIMENSION,
  GEMINI_EMBEDDING_MODEL,
  GEMINI_PLATFORM_KNOWLEDGE_EMBEDDING_SCHEMA,
} from "../../../../src/types/gemini-embedding-adapter.types.js";
import { KnowledgeEmbeddingSchemaRegistry } from "../../../../src/registries/knowledge-embedding-schema.registry.js";
import { validateGeminiEmbeddingLiveGuard } from "../../../../scripts/benchmarks/run-gemini-embedding-benchmark.js";

const config = (change: Record<string, unknown> = {}) =>
  new GeminiEmbeddingAdapterConfig({
    apiKey: "secret",
    modelId: GEMINI_EMBEDDING_MODEL,
    outputDimension: 768,
    apiVersion: "v1",
    requestTimeoutMs: 100,
    totalDeadlineMs: 1000,
    maxAttempts: 2,
    maxBatchSize: 20,
    maxCharactersPerInput: 1000,
    maxCharactersPerBatch: 5000,
    ...change,
  } as any);
const request = (
  purpose: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" = "RETRIEVAL_DOCUMENT",
  change: Record<string, unknown> = {},
) =>
  ({
    purpose,
    requestId: "REQ",
    requestVersion: 1,
    schemaIdentity: {
      embeddingSchemaId: "YUDIJI_GEMINI_PLATFORM_KNOWLEDGE_EMBEDDING",
      embeddingSchemaVersion: 1,
    },
    providerIdentity: { providerId: "GOOGLE_GEMINI", providerVersion: 1 },
    modelIdentity: {
      modelId: GEMINI_EMBEDDING_MODEL,
      modelVersion: GEMINI_EMBEDDING_MODEL,
    },
    inputs: [
      {
        inputId: "A",
        chunkId: "CHUNK",
        chunkVersion: 1,
        text: "first synthetic text",
        textDigest: "a".repeat(64),
      },
      {
        inputId: "B",
        chunkId: "CHUNK_2",
        chunkVersion: 1,
        text: "second synthetic text",
        textDigest: "b".repeat(64),
      },
    ],
    ...change,
  }) as any;
const vectors = (count = 2) => ({
  embeddings: Array.from({ length: count }, (_, i) => ({
    values: [i + 1, 2, 3],
  })),
});

test("configuration is exact, frozen, bounded and secret-safe", () => {
  const c = config();
  assert.ok(Object.isFrozen(c));
  assert.equal(JSON.stringify(c).includes("secret"), false);
  assert.throws(() => config({ apiKey: "" }));
  assert.throws(() => config({ modelId: "latest" }));
  assert.throws(() => config({ outputDimension: 3072 }));
  assert.throws(() => config({ apiVersion: "v1beta" }));
  assert.throws(() => config({ maxAttempts: 3 }));
  assert.throws(() => config({ requestTimeoutMs: 1 }));
  assert.throws(() => createGeminiEmbeddingAdapterConfig({}));
});
test("production-shaped schema resolves exact L2 and both purposes without runtime registration", () => {
  const registry = new KnowledgeEmbeddingSchemaRegistry([
    GEMINI_PLATFORM_KNOWLEDGE_EMBEDDING_SCHEMA,
  ]);
  const schema = registry.getExact(
    GEMINI_PLATFORM_KNOWLEDGE_EMBEDDING_SCHEMA.embeddingSchemaId,
    1,
  );
  assert.equal(schema?.vectorDimension, 768);
  assert.equal(schema?.normalizationStrategyId, "L2_UNIT_VECTOR");
  assert.deepEqual(schema?.allowedPurposes, [
    "RETRIEVAL_DOCUMENT",
    "RETRIEVAL_QUERY",
  ]);
});
test("maps document purpose, exact model/dimension and ordered text only", async () => {
  let sent: any;
  const adapter = new GeminiKnowledgeEmbeddingAdapter(config(), {
    client: { embed: async (input: any) => ((sent = input), vectors()) },
  });
  const result = await adapter.embed(request());
  assert.equal(result.status, "COMPLETED");
  assert.equal(result.providerOutcome?.completed, true);
  assert.equal(result.providerOutcome?.usage?.embeddingInputs, 2);
  assert.equal(sent.model, GEMINI_EMBEDDING_MODEL);
  assert.deepEqual(sent.contents, [
    "first synthetic text",
    "second synthetic text",
  ]);
  assert.equal(sent.config.taskType, "RETRIEVAL_DOCUMENT");
  assert.equal(sent.config.outputDimensionality, GEMINI_EMBEDDING_DIMENSION);
  assert.equal("temperature" in sent.config, false);
  assert.equal(JSON.stringify(sent).includes("CHUNK"), false);
});
test("maps query purpose independently of correlation identifiers", async () => {
  let sent: any;
  const adapter = new GeminiKnowledgeEmbeddingAdapter(config(), {
    client: { embed: async (input: any) => ((sent = input), vectors()) },
  });
  await adapter.embed(
    request("RETRIEVAL_QUERY", {
      inputs: [
        {
          ...request().inputs[0],
          inputId: "NOT_QUERY",
          chunkId: "NOT_TRANSIENT",
        },
      ],
    }),
  );
  assert.equal(sent.config.taskType, "RETRIEVAL_QUERY");
});
test("preserves raw vectors, positional input correlation and immutable output", async () => {
  const raw = [
    [3, 4],
    [9, -2],
  ];
  const result = await new GeminiKnowledgeEmbeddingAdapter(config(), {
    client: {
      embed: async () => ({ embeddings: raw.map((values) => ({ values })) }),
    },
  }).embed(request());
  assert.equal(result.status, "COMPLETED");
  if (result.status !== "COMPLETED") return;
  assert.deepEqual(result.vectors, [
    { inputId: "A", values: [3, 4] },
    { inputId: "B", values: [9, -2] },
  ]);
  assert.deepEqual(raw, [
    [3, 4],
    [9, -2],
  ]);
  assert.ok(Object.isFrozen(result.vectors));
  assert.ok(Object.isFrozen(result.vectors[0]?.values));
});
test("rejects empty, duplicate, oversized and wrong-lineage requests before provider call", async () => {
  for (const value of [
    request("RETRIEVAL_DOCUMENT", { inputs: [] }),
    request("RETRIEVAL_DOCUMENT", {
      inputs: [request().inputs[0], request().inputs[0]],
    }),
    request("RETRIEVAL_DOCUMENT", {
      inputs: [{ ...request().inputs[0], text: "x".repeat(1001) }],
    }),
    request("RETRIEVAL_DOCUMENT", {
      modelIdentity: { modelId: "other", modelVersion: "other" },
    }),
  ]) {
    let calls = 0;
    const result = await new GeminiKnowledgeEmbeddingAdapter(config(), {
      client: {
        embed: async () => {
          calls++;
          return vectors();
        },
      },
    }).embed(value);
    assert.equal(result.status, "FAILED");
    assert.equal(calls, 0);
  }
});
test("rejects missing, malformed, extra and count-mismatched embeddings without retry", async () => {
  for (const response of [
    {},
    vectors(1),
    vectors(3),
    { embeddings: [{ values: [] }, { values: [1] }] },
    { embeddings: [{ values: ["x"] }, { values: [1] }] },
  ]) {
    let calls = 0;
    const result = await new GeminiKnowledgeEmbeddingAdapter(config(), {
      client: {
        embed: async () => {
          calls++;
          return response as any;
        },
      },
    }).embed(request());
    assert.equal(result.status, "FAILED");
    assert.equal(calls, 1);
  }
});
test("accepts absent usage/model metadata and rejects conflicting reported model", async () => {
  const ok = await new GeminiKnowledgeEmbeddingAdapter(config(), {
    client: { embed: async () => vectors() },
  }).embed(request());
  assert.equal(ok.status, "COMPLETED");
  const bad = await new GeminiKnowledgeEmbeddingAdapter(config(), {
    client: { embed: async () => ({ ...vectors(), modelVersion: "other" }) },
  }).embed(request());
  assert.equal(bad.status, "FAILED");
  assert.equal(bad.failureCode, "MODEL_IDENTITY_MISMATCH");
  assert.equal(
    bad.providerOutcome?.completed === false
      ? bad.providerOutcome.failure.failureCode
      : null,
    "IDENTITY_MISMATCH",
  );
});
test("retries only transient failures once with identical request and never falls back", async () => {
  const sent: any[] = [];
  let calls = 0;
  const adapter = new GeminiKnowledgeEmbeddingAdapter(config(), {
    client: {
      embed: async (input: any) => {
        sent.push({
          ...input,
          config: { ...input.config, abortSignal: undefined },
        });
        calls++;
        if (calls === 1) throw new TypeError("network");
        return vectors();
      },
    },
  });
  assert.equal((await adapter.embed(request())).status, "COMPLETED");
  assert.equal(calls, 2);
  assert.deepEqual(sent[0], sent[1]);
  for (const error of [
    new ApiError({ status: 401, message: "auth" }),
    new ApiError({ status: 403, message: "permission" }),
    new ApiError({ status: 404, message: "model" }),
    new Error("unknown"),
  ]) {
    calls = 0;
    const result = await new GeminiKnowledgeEmbeddingAdapter(config(), {
      client: {
        embed: async () => {
          calls++;
          throw error;
        },
      },
    }).embed(request());
    assert.equal(result.status, "FAILED");
    assert.equal(calls, 1);
  }
});
test("timeout is bounded and exhausts at two attempts", async () => {
  let calls = 0;
  const adapter = new GeminiKnowledgeEmbeddingAdapter(config(), {
    client: {
      embed: (input: any) =>
        new Promise((_resolve, reject) => {
          calls++;
          input.config.abortSignal.addEventListener(
            "abort",
            () => reject(new Error("aborted")),
            { once: true },
          );
        }),
    },
  });
  const result = await adapter.embed(request());
  assert.equal(result.status, "FAILED");
  assert.equal(result.failureCode, "REQUEST_TIMEOUT");
  assert.equal(
    result.providerOutcome?.completed === false
      ? result.providerOutcome.failure.failureCode
      : null,
    "REQUEST_TIMEOUT",
  );
  assert.equal(calls, 2);
});
test("caller cancellation aborts the in-flight embedding and never retries", async () => {
  let calls = 0,
    observed = false;
  const caller = new AbortController();
  const adapter = new GeminiKnowledgeEmbeddingAdapter(config(), {
    client: {
      embed: (input: any) =>
        new Promise((_resolve, reject) => {
          calls++;
          input.config.abortSignal.addEventListener(
            "abort",
            () => {
              observed = true;
              reject(new Error("aborted"));
            },
            { once: true },
          );
        }),
    },
  });
  const pending = adapter.embed(request(), { signal: caller.signal });
  caller.abort("RUNTIME_DEADLINE_EXCEEDED");
  const result = await pending;
  assert.equal(result.status, "FAILED");
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
test("diagnostics contain metadata only and trace failure is isolated", async () => {
  const values: any[] = [];
  const adapter = new GeminiKnowledgeEmbeddingAdapter(config(), {
    client: { embed: async () => vectors() },
    diagnostics: {
      record: (value: any) => {
        values.push(value);
        throw new Error("trace");
      },
    },
  });
  assert.equal(
    (await adapter.embed(request("RETRIEVAL_QUERY"))).status,
    "COMPLETED",
  );
  const serialized = JSON.stringify(values);
  assert.equal(serialized.includes("synthetic text"), false);
  assert.equal(serialized.includes("secret"), false);
  assert.equal(serialized.includes('"values"'), false);
  assert.equal(values[0].purpose, "RETRIEVAL_QUERY");
  assert.equal(values[0].inputCount, 2);
});
test("live guard requires separate confirmation and exact bounded synthetic configuration", () => {
  assert.throws(() => validateGeminiEmbeddingLiveGuard({}));
  assert.throws(() =>
    validateGeminiEmbeddingLiveGuard({ YUDIJI_GEMINI_API_KEY: "key" }),
  );
  const base = {
    YUDIJI_GEMINI_API_KEY: "key",
    YUDIJI_GEMINI_EMBEDDING_LIVE_VALIDATION_CONFIRMED: "true",
  };
  assert.throws(() =>
    validateGeminiEmbeddingLiveGuard({ ...base, NODE_ENV: "production" }),
  );
  assert.throws(() =>
    validateGeminiEmbeddingLiveGuard({
      ...base,
      YUDIJI_GEMINI_EMBEDDING_MODEL: "latest",
    }),
  );
  assert.throws(() =>
    validateGeminiEmbeddingLiveGuard({
      ...base,
      YUDIJI_GEMINI_EMBEDDING_DIMENSION: "3072",
    }),
  );
  assert.throws(() =>
    validateGeminiEmbeddingLiveGuard({
      ...base,
      YUDIJI_GEMINI_EMBEDDING_BENCHMARK_MAX_INPUTS: "21",
    }),
  );
  assert.throws(() =>
    validateGeminiEmbeddingLiveGuard({
      ...base,
      YUDIJI_GEMINI_EMBEDDING_BENCHMARK_CONCURRENCY: "2",
    }),
  );
  assert.equal(validateGeminiEmbeddingLiveGuard(base).maxInputs, 20);
});
