import assert from "node:assert/strict";
import test from "node:test";

import { LlmTraceModel } from "../../../src/models/llm-trace.model.js";
import {
  LLM_TRACE_STATUSES,
  LLM_TRACE_TASK_TYPES,
} from "../../../src/types/llm-trace.types.js";

const validTrace = () => ({
  traceId: "trace-model-001",
  taskType: "ALERT_REPORT",
  status: "COMPLETED",
  provider: "groq",
  promptVersion: "alert-v1",
  startedAt: new Date("2026-07-28T10:00:00.000Z"),
  fallbackUsed: false,
});

test("exports all approved task types and statuses", () => {
  assert.deepEqual(LLM_TRACE_TASK_TYPES, [
    "ALERT_REPORT",
    "COPILOT_CHAT",
    "POST_TRADE_REVIEW",
  ]);
  assert.equal(LLM_TRACE_STATUSES.length, 8);
  assert.equal(LLM_TRACE_STATUSES.includes("PERSISTENCE_FAILED"), true);
});

test("schema accepts a valid trace and trims string fields", async () => {
  const trace = new LlmTraceModel({
    ...validTrace(),
    traceId: " trace-model-001 ",
    provider: " groq ",
  });

  await trace.validate();

  assert.equal(trace.traceId, "trace-model-001");
  assert.equal(trace.provider, "groq");
});

test("schema enforces required fields and enum constraints", async () => {
  const missing = new LlmTraceModel({});
  await assert.rejects(missing.validate(), /required/);

  const invalidEnum = new LlmTraceModel({
    ...validTrace(),
    taskType: "UNKNOWN",
    status: "UNKNOWN",
  });
  await assert.rejects(invalidEnum.validate(), /not a valid enum value/);
});

test("schema rejects negative latency and invalid token counts", async () => {
  const trace = new LlmTraceModel({
    ...validTrace(),
    latencyMs: -1,
    tokenUsage: { promptTokens: 1.5, completionTokens: -1 },
  });

  await assert.rejects(trace.validate(), /latencyMs|promptTokens|completionTokens/);
});

test("schema defines only the approved operational indexes", () => {
  const schemaIndexes = LlmTraceModel.schema.indexes() as Array<
    [Record<string, number>, Record<string, unknown>]
  >;
  const indexes = schemaIndexes.map(([fields, options]) => ({
    fields,
    unique: options.unique === true,
  }));

  assert.deepEqual(indexes, [
    { fields: { traceId: 1 }, unique: true },
    { fields: { taskType: 1, createdAt: -1 }, unique: false },
    { fields: { status: 1, createdAt: -1 }, unique: false },
    { fields: { correlationId: 1, createdAt: -1 }, unique: false },
    { fields: { userId: 1, createdAt: -1 }, unique: false },
    {
      fields: { "source.entityType": 1, "source.entityId": 1, createdAt: -1 },
      unique: false,
    },
  ]);
});

test("schema has createdAt only and no version key", () => {
  assert.equal(LlmTraceModel.schema.path("createdAt") !== undefined, true);
  assert.equal(LlmTraceModel.schema.path("updatedAt"), undefined);
  assert.equal(LlmTraceModel.schema.options.versionKey, false);
});
