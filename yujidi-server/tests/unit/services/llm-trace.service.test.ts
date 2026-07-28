import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import { LlmTraceService } from "../../../src/services/llm-trace.service.js";
import type { CreateLlmTraceInput } from "../../../src/types/llm-trace.types.js";

const baseInput = (): CreateLlmTraceInput => ({
  traceId: "trace-001",
  taskType: "COPILOT_CHAT",
  status: "COMPLETED",
  provider: "groq",
  promptVersion: "copilot-v1",
  startedAt: new Date("2026-07-28T10:00:00.000Z"),
  fallbackUsed: false,
});

test("record persists only approved fields and converts a valid userId", async () => {
  let persisted: Record<string, unknown> | undefined;
  const service = new LlmTraceService({
    repository: {
      create: async (input) => {
        persisted = input;
        return input;
      },
    },
  });

  const userId = new Types.ObjectId().toHexString();
  await service.record({
    ...baseInput(),
    userId,
    completedAt: new Date("2026-07-28T10:00:01.250Z"),
    latencyMs: 1250,
    tokenUsage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
  });

  assert.equal(String(persisted?.userId), userId);
  assert.equal(persisted?.latencyMs, 1250);
  assert.deepEqual(persisted?.tokenUsage, {
    promptTokens: 10,
    completionTokens: 5,
    totalTokens: 15,
  });
  assert.equal("rawPrompt" in (persisted ?? {}), false);
  assert.equal("rawOutput" in (persisted ?? {}), false);
});

test("record omits an invalid optional userId without throwing", async () => {
  let persisted: Record<string, unknown> | undefined;
  const service = new LlmTraceService({
    repository: {
      create: async (input) => {
        persisted = input;
        return input;
      },
    },
  });

  await service.record({ ...baseInput(), userId: "not-an-object-id" });

  assert.equal("userId" in (persisted ?? {}), false);
});

test("record recursively redacts sensitive summary keys", async () => {
  let persisted: Record<string, any> | undefined;
  const service = new LlmTraceService({
    repository: {
      create: async (input) => {
        persisted = input;
        return input;
      },
    },
  });

  await service.record({
    ...baseInput(),
    inputReference: {
      hash: "input-hash",
      redactedSummary: {
        symbol: "NIFTY",
        apiKey: "must-not-leak",
        nested: { private_key: "must-not-leak", safe: true },
      },
    },
    outputReference: {
      fieldSummary: {
        fields: [{ name: "summary", accessToken: "must-not-leak" }],
      },
    },
  });

  assert.deepEqual(persisted?.inputReference.redactedSummary, {
    symbol: "NIFTY",
    apiKey: "[REDACTED]",
    nested: { private_key: "[REDACTED]", safe: true },
  });
  assert.deepEqual(persisted?.outputReference.fieldSummary, {
    fields: [{ name: "summary", accessToken: "[REDACTED]" }],
  });
});

test("record trims, caps, bounds, and redacts validation errors", async () => {
  let persisted: Record<string, any> | undefined;
  const service = new LlmTraceService({
    repository: {
      create: async (input) => {
        persisted = input;
        return input;
      },
    },
  });
  const errors = [
    "  apiKey=must-not-leak invalid  ",
    "x".repeat(600),
    ...Array.from({ length: 25 }, (_, index) => `error ${index}`),
  ];

  await service.record({ ...baseInput(), validation: { errors } });

  assert.equal(persisted?.validation.errors.length, 20);
  assert.equal(persisted?.validation.errors[0], "apiKey=[REDACTED] invalid");
  assert.equal(persisted?.validation.errors[1].length, 500);
});

test("record resolves on repository failure and logs only sanitized safe metadata", async () => {
  const logCalls: Array<{ metadata: Record<string, unknown>; message: string }> = [];
  const service = new LlmTraceService({
    repository: {
      create: async () => {
        throw new Error("write failed authorization=must-not-leak");
      },
    },
    logger: {
      error: (metadata, message) => {
        logCalls.push({ metadata, message });
      },
    },
  });

  await assert.doesNotReject(
    service.record({
      ...baseInput(),
      correlationId: "correlation-1",
      userId: new Types.ObjectId().toHexString(),
      inputReference: { redactedSummary: { password: "must-not-log" } },
      validation: { errors: ["secret=must-not-log"] },
    }),
  );

  assert.equal(logCalls.length, 1);
  assert.deepEqual(logCalls[0]?.metadata, {
    error: {
      name: "Error",
      message: "write failed authorization=[REDACTED]",
    },
    traceId: "trace-001",
    correlationId: "correlation-1",
    taskType: "COPILOT_CHAT",
    status: "COMPLETED",
    provider: "groq",
  });
  assert.equal(JSON.stringify(logCalls).includes("must-not"), false);
});
