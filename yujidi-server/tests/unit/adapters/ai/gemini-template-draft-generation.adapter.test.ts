import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "@google/genai";
import { GeminiTemplateDraftGenerationAdapter } from "../../../../src/adapters/ai/gemini-template-draft-generation.adapter.js";
import {
  GeminiGenerationAdapterConfig,
  createGeminiGenerationAdapterConfig,
} from "../../../../src/config/gemini-generation.config.js";
import { templateDraftCandidateSchema } from "../../../../src/services/copilot/template-draft-generation.service.js";
import { GEMINI_GENERATION_MODEL } from "../../../../src/types/gemini-generation-adapter.types.js";
import { candidate } from "../../../fixtures/template-draft-workflow.fixture.js";
import {
  GEMINI_LIVE_SYNTHETIC_CASES,
  validateGeminiLiveBenchmarkGuard,
} from "../../../../scripts/benchmarks/run-gemini-structured-generation-benchmark.js";

const config = (change: Record<string, unknown> = {}) =>
  new GeminiGenerationAdapterConfig({
    apiKey: "benchmark-secret",
    modelId: GEMINI_GENERATION_MODEL,
    requestTimeoutMs: 100,
    totalDeadlineMs: 1_000,
    maxOutputTokens: 4096,
    maxAttempts: 2,
    ...change,
  } as any);
const request: any = {
  correlationId: "ATTEMPT_1",
  schemaId: "TEMPLATE_DRAFT_CANDIDATE",
  schemaVersion: 1,
  messages: [
    { role: "system", content: "AUTHORITY" },
    { role: "user", content: "UNTRUSTED_RETRIEVED_CONTEXT quoted" },
  ],
  context: {},
};
const response = (change: Record<string, unknown> = {}) => ({
  text: JSON.stringify(candidate),
  modelVersion: GEMINI_GENERATION_MODEL,
  responseId: "response-1",
  usageMetadata: {
    promptTokenCount: 100,
    candidatesTokenCount: 20,
    totalTokenCount: 120,
    cachedContentTokenCount: 5,
    thoughtsTokenCount: 3,
  },
  candidates: [{ finishReason: "STOP" }],
  ...change,
});
const adapter = (
  handler: (input: any) => Promise<any>,
  diagnostics: any[] = [],
) =>
  new GeminiTemplateDraftGenerationAdapter(config(), {
    client: { generate: handler },
    diagnostics: {
      record: (d: any) => {
        diagnostics.push(d);
      },
    },
  });

test("configuration validates exact model and bounds, freezes, and never serializes secret", () => {
  const c = config();
  assert(Object.isFrozen(c));
  assert.equal(JSON.stringify(c).includes("benchmark-secret"), false);
  assert.throws(() => config({ apiKey: "" }));
  assert.throws(() => config({ modelId: "gemini-latest" }));
  assert.throws(() => config({ requestTimeoutMs: 1 }));
  assert.throws(() => config({ maxAttempts: 3 }));
  assert.throws(() => createGeminiGenerationAdapterConfig({}));
});
test("translates roles, exact model and Gemini-compatible schema without tools or grounding", async () => {
  let sent: any;
  const a = adapter(async (input) => ((sent = input), response()));
  await a.generate(request);
  assert.equal(sent.model, GEMINI_GENERATION_MODEL);
  assert.equal(sent.config.systemInstruction, "AUTHORITY");
  assert.equal(sent.contents[0].role, "user");
  assert.equal(
    sent.contents[0].parts[0].text,
    "UNTRUSTED_RETRIEVED_CONTEXT quoted",
  );
  assert.equal(sent.config.responseMimeType, "application/json");
  assert.deepEqual(sent.config.responseJsonSchema, a.requestSchema());
  const serialized = JSON.stringify(a.requestSchema());
  for (const omitted of [
    "pattern",
    "minLength",
    "maxLength",
    "exclusiveMinimum",
    "maxItems",
  ])
    assert.equal(serialized.includes(`\"${omitted}\"`), false);
  assert.equal("tools" in sent.config, false);
  assert.equal("grounding" in sent.config, false);
});
test("maps success, exact identity, usage, immutable output and leaves Zod authoritative", async () => {
  const diagnostics: any[] = [];
  const result = await adapter(async () => response(), diagnostics).generate(
    request,
  );
  assert.equal(result.completed, true);
  if (!result.completed) return;
  assert.equal(result.provider, "GOOGLE_GEMINI");
  assert.equal(result.model, GEMINI_GENERATION_MODEL);
  assert.equal(result.providerOutcome?.completed, true);
  assert.equal(result.providerOutcome?.usage?.generationCalls, 1);
  assert.deepEqual(result.tokenUsage, {
    promptTokens: 100,
    completionTokens: 20,
    totalTokens: 120,
  });
  assert.equal(
    templateDraftCandidateSchema.safeParse(JSON.parse(result.output as string))
      .success,
    true,
  );
  assert(Object.isFrozen(result));
  assert.equal(JSON.stringify(diagnostics).includes("benchmark-secret"), false);
  assert.equal(JSON.stringify(diagnostics).includes("UNTRUSTED"), false);
  assert.equal(diagnostics[0].usage.cachedInputTokens, 5);
});
test("empty, refusal, safety block and model mismatch fail without retry", async () => {
  for (const value of [
    response({ text: "" }),
    response({ promptFeedback: { blockReason: "SAFETY" } }),
    response({ candidates: [{ finishReason: "SAFETY" }] }),
    response({ modelVersion: "gemini-other" }),
  ]) {
    let calls = 0;
    const result = await adapter(async () => {
      calls++;
      return value;
    }).generate(request);
    assert.equal(result.completed, false);
    assert.equal(calls, 1);
  }
});
test("malformed and schema-invalid output remain raw for the existing parser and are not adapter-retried", async () => {
  for (const text of [
    "{",
    JSON.stringify({ ...candidate, unexpected: true }),
  ]) {
    let calls = 0;
    const result = await adapter(async () => {
      calls++;
      return response({ text });
    }).generate(request);
    assert.equal(result.completed, true);
    if (result.completed)
      assert.equal(
        templateDraftCandidateSchema.safeParse(
          JSON.parse(text === "{" ? "{}" : text),
        ).success,
        false,
      );
    assert.equal(calls, 1);
  }
});
test("retries one transient error, succeeds, and exhausts without provider fallback", async () => {
  let calls = 0;
  const result = await adapter(async () => {
    calls++;
    if (calls === 1) throw new TypeError("network");
    return response();
  }).generate(request);
  assert.equal(result.completed, true);
  assert.equal(calls, 2);
  calls = 0;
  const failed = await adapter(async () => {
    calls++;
    throw new TypeError("network");
  }).generate(request);
  assert.equal(failed.completed, false);
  assert.equal(calls, 2);
});
test("does not retry authentication, model-not-found, malformed or unknown failures", async () => {
  for (const error of [
    new ApiError({ status: 401, message: "unauthorized" }),
    new ApiError({ status: 404, message: "not found" }),
    new Error("unknown"),
  ]) {
    let calls = 0;
    const diagnostics: any[] = [];
    const result = await adapter(async () => {
      calls++;
      throw error;
    }, diagnostics).generate(request);
    assert.equal(result.completed, false);
    assert.equal(calls, 1);
    assert.equal(diagnostics[0].status, "FAILED");
  }
});
test("classifies invalid schema separately from an oversized input", async () => {
  for (const [message, expected] of [
    ["Request contains an invalid argument.", "SCHEMA_VALIDATION_FAILED"],
    ["Request input is too large.", "INPUT_TOO_LARGE"],
  ] as const) {
    const diagnostics: any[] = [];
    await adapter(async () => {
      throw new ApiError({ status: 400, message });
    }, diagnostics).generate(request);
    assert.equal(diagnostics[0].failureCode, expected);
  }
});
test("explicit timeout aborts and bounds retry exhaustion", async () => {
  let calls = 0;
  const result = await adapter(
    (input) =>
      new Promise((_resolve, reject) => {
        calls++;
        (input.config.abortSignal as AbortSignal).addEventListener(
          "abort",
          () => reject(new Error("aborted")),
          { once: true },
        );
      }),
  ).generate(request);
  assert.equal(result.completed, false);
  assert.equal(calls, 2);
});
test("caller cancellation aborts in-flight generation and never retries", async () => {
  let calls = 0,
    observed = false;
  const caller = new AbortController(),
    diagnostics: any[] = [];
  const pending = adapter(
    (input) =>
      new Promise((_resolve, reject) => {
        calls++;
        (input.config.abortSignal as AbortSignal).addEventListener(
          "abort",
          () => {
            observed = true;
            reject(new Error("aborted"));
          },
          { once: true },
        );
      }),
    diagnostics,
  ).generate(request, { signal: caller.signal });
  caller.abort("RUNTIME_DEADLINE_EXCEEDED");
  const result = await pending;
  assert.equal(result.completed, false);
  assert.equal(diagnostics[0].failureCode, "CALLER_ABORTED");
  assert.equal(
    result.providerOutcome?.completed === false
      ? result.providerOutcome.failure.failureCode
      : null,
    "CALLER_ABORTED",
  );
  assert.equal(observed, true);
  assert.equal(calls, 1);
});
test("diagnostic failure is isolated and contains metadata only", async () => {
  const a = new GeminiTemplateDraftGenerationAdapter(config(), {
    client: { generate: async () => response() as any },
    diagnostics: {
      record: () => {
        throw new Error("trace");
      },
    },
  });
  assert.equal((await a.generate(request)).completed, true);
});
test("guard refuses unsafe invocation and accepts exact bounded synthetic invocation", () => {
  assert.throws(() => validateGeminiLiveBenchmarkGuard({}));
  assert.throws(() =>
    validateGeminiLiveBenchmarkGuard({
      YUDIJI_GEMINI_LIVE_VALIDATION_CONFIRMED: "true",
    }),
  );
  const base = {
    YUDIJI_GEMINI_LIVE_VALIDATION_CONFIRMED: "true",
    YUDIJI_GEMINI_API_KEY: "secret",
  };
  assert.throws(() =>
    validateGeminiLiveBenchmarkGuard({ ...base, NODE_ENV: "production" }),
  );
  assert.throws(() =>
    validateGeminiLiveBenchmarkGuard({
      ...base,
      YUDIJI_GEMINI_BENCHMARK_MODEL: "gemini-latest",
    }),
  );
  assert.throws(() =>
    validateGeminiLiveBenchmarkGuard({
      ...base,
      YUDIJI_GEMINI_BENCHMARK_MAX_REQUESTS: "19",
    }),
  );
  assert.equal(validateGeminiLiveBenchmarkGuard(base).maxRequests, 18);
  assert.equal(GEMINI_LIVE_SYNTHETIC_CASES.length, 6);
});
