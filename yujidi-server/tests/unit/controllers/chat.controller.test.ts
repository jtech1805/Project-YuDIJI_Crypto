import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";

import type { IChatSession } from "../../../src/models/chatSession.js";
import type { CreateLlmTraceInput } from "../../../src/types/llm-trace.types.js";

process.env.JWT_ACCESS_SECRET = "chat-controller-test-access";
process.env.JWT_REFRESH_SECRET = "chat-controller-test-refresh";
process.env.JWT_ACCESS_EXPIRY = "15m";
process.env.JWT_REFRESH_EXPIRY = "7d";

const {
  COPILOT_CHAT_PROMPT_VERSION,
  createCopilotChatHandler,
} = await import("../../../src/controllers/chat.controller.js");

const userId = "69e64c5f9042aac89c8c83f8";
const sessionId = "65abc0000000000000000010";
const baseBody = {
  symbol: "BTCUSDT",
  direction: "LONG",
  walletBalance: 10_000,
  riskPercentage: 2,
  leverage: 5,
  userPrompt: "Explain this setup without exposing my values.",
  chatHistory: [{ role: "user", content: "frontend history must be ignored" }],
} as const;

type CopilotOutput = {
  intent: "TRADE" | "GENERAL";
  isApproved: boolean;
  reply: string;
};

const createHarness = (options: {
  output?: CopilotOutput;
  providerError?: Error;
  traceError?: Error;
  nowValues?: Date[];
} = {}) => {
  const traces: CreateLlmTraceInput[] = [];
  const llmCalls: Array<{
    history: Array<{ role: "user" | "assistant" | "system"; content: string }>;
    prompt: string;
    symbol: string;
  }> = [];
  const messages = Array.from({ length: 7 }, (_, index) => ({
    role: index % 2 === 0 ? "user" as const : "assistant" as const,
    content: `stored history ${index}`,
    timestamp: new Date("2026-07-28T09:00:00.000Z"),
  }));
  let saveCount = 0;
  let traceCallCount = 0;
  let nowIndex = 0;
  let idIndex = 0;
  const session = {
    _id: { toString: () => sessionId },
    messages,
    save: async () => {
      saveCount += 1;
      return session;
    },
  } as unknown as IChatSession;
  const output = options.output ?? {
    intent: "GENERAL",
    isApproved: false,
    reply: "A safe educational response.",
  };

  const handler = createCopilotChatHandler({
    getSupportResistance: () => ({
      orderBookData: {
        currentPrice: "$100",
        support: "support text",
        resistance: "resistance text",
        rawCurrentPrice: 100,
        rawSupport: 95,
        rawResistance: 115,
        debugData: {
          averageBid: "1",
          requiredBidWall: "2",
          averageAsk: "1",
          requiredAskWall: "2",
        },
      },
      currentCvd: 12,
    }),
    findChatSession: async () => session,
    createChatSession: () => session,
    llmService: {
      getProviderMetadata: () => ({
        name: "test-provider",
        modelName: "test-model",
      }),
      generateCopilotResponse: async (_systemInstruction, history, prompt, symbol) => {
        llmCalls.push({ history, prompt, symbol: symbol ?? "UNKNOWN" });
        if (options.providerError) throw options.providerError;
        return output;
      },
    },
    llmTraceService: {
      record: async (input) => {
        traceCallCount += 1;
        if (options.traceError) throw options.traceError;
        traces.push(input);
      },
    },
    getNow: () => options.nowValues?.[nowIndex++] ?? new Date("2026-07-28T10:00:00.000Z"),
    generateId: () => {
      const id = idIndex === 0 ? "trace-fixed" : "correlation-fixed";
      idIndex += 1;
      return id;
    },
  });

  const invoke = async (body: unknown = baseBody) => {
    let statusCode = 200;
    let responseBody: unknown;
    const request = { body, user: { id: userId } } as unknown as Request;
    const response = {
      status: (code: number) => {
        statusCode = code;
        return response;
      },
      json: (payload: unknown) => {
        responseBody = payload;
        return response;
      },
    } as unknown as Response;
    await handler(request, response);
    return { body: responseBody as Record<string, unknown>, statusCode };
  };

  return {
    invoke,
    llmCalls,
    messages,
    output,
    saveCount: () => saveCount,
    traceCallCount: () => traceCallCount,
    traces,
  };
};

test("successful general chat emits one safe completed trace and preserves persistence", async () => {
  const harness = createHarness();
  const originalMessages = structuredClone(harness.messages);
  const originalOutput = structuredClone(harness.output);

  const response = await harness.invoke();

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    success: true,
    data: {
      intent: "GENERAL",
      isApproved: false,
      reply: "A safe educational response.",
      tradeMath: null,
    },
  });
  assert.equal(harness.llmCalls.length, 1);
  assert.equal(harness.llmCalls[0]?.history.length, 6);
  assert.equal(harness.saveCount(), 1);
  assert.deepEqual(harness.messages.slice(0, 7), originalMessages);
  assert.deepEqual(harness.output, originalOutput);
  assert.deepEqual(harness.messages.slice(-2).map(({ role, content }) => ({ role, content })), [
    { role: "user", content: baseBody.userPrompt },
    { role: "assistant", content: harness.output.reply },
  ]);

  assert.equal(harness.traces.length, 1);
  const trace = harness.traces[0];
  assert.equal(trace?.traceId, "trace-fixed");
  assert.equal(trace?.correlationId, "correlation-fixed");
  assert.equal(trace?.taskType, "COPILOT_CHAT");
  assert.equal(trace?.status, "COMPLETED");
  assert.equal(trace?.userId, userId);
  assert.deepEqual(trace?.source, { entityType: "CHAT_SESSION", entityId: sessionId });
  assert.equal(trace?.provider, "test-provider");
  assert.equal(trace?.model, "test-model");
  assert.equal(trace?.promptVersion, COPILOT_CHAT_PROMPT_VERSION);
  assert.equal(trace?.fallbackUsed, false);
  assert.match(trace?.inputReference?.hash ?? "", /^[a-f0-9]{64}$/);
  assert.deepEqual(trace?.inputReference?.redactedSummary, {
    messageLength: baseBody.userPrompt.length,
    historyMessageCount: 6,
    hasWalletBalance: true,
    hasEntry: true,
    hasStopLoss: true,
    hasTarget: true,
  });
  assert.deepEqual(trace?.outputReference?.fieldSummary, {
    intent: "GENERAL",
    isApproved: false,
    replyLength: harness.output.reply.length,
  });
  assert.deepEqual(trace?.validation, {
    parseSucceeded: true,
    schemaSucceeded: true,
    semanticSucceeded: true,
  });
});

test("trade chat preserves deterministic math and traces booleans without numeric values", async () => {
  const harness = createHarness({
    output: { intent: "TRADE", isApproved: true, reply: "Approved by current contract." },
  });

  const response = await harness.invoke();
  const data = response.body.data as Record<string, unknown>;
  const tradeMath = data.tradeMath as Record<string, unknown>;

  assert.equal(data.isApproved, true);
  assert.equal(tradeMath.entry, 100);
  assert.equal(tradeMath.stopLoss, 94.905);
  assert.equal(tradeMath.takeProfit, 114.885);
  assert.equal(harness.traces[0]?.outputReference?.fieldSummary?.isApproved, true);
  const summary = JSON.stringify(harness.traces[0]?.inputReference?.redactedSummary);
  for (const rawValue of ["10000", "94.905", "114.885"]) {
    assert.equal(summary.includes(rawValue), false);
  }
});

test("provider failure emits one generic failure trace and preserves existing 500 behavior", async () => {
  const harness = createHarness({
    providerError: new Error("provider error text must not leak"),
  });

  const response = await harness.invoke();

  assert.equal(response.statusCode, 500);
  assert.equal(harness.saveCount(), 0);
  assert.equal(harness.traces.length, 1);
  assert.equal(harness.traces[0]?.status, "PROVIDER_FAILED");
  assert.equal(harness.traces[0]?.failureCode, "COPILOT_CHAT_GENERATION_FAILED");
  assert.equal(JSON.stringify(harness.traces).includes("provider error text"), false);
});

test("invalid request is rejected before provider invocation and creates no trace", async () => {
  const harness = createHarness();

  const response = await harness.invoke({ ...baseBody, userPrompt: "" });

  assert.equal(response.statusCode, 400);
  assert.equal(harness.llmCalls.length, 0);
  assert.equal(harness.traceCallCount(), 0);
});

test("trace rejection cannot change a successful response or message persistence", async () => {
  const harness = createHarness({ traceError: new Error("trace unavailable") });

  const response = await harness.invoke();

  assert.equal(response.statusCode, 200);
  assert.equal(harness.traceCallCount(), 1);
  assert.equal(harness.saveCount(), 1);
  assert.equal(harness.messages.length, 9);
});

test("trace timing is deterministic and negative latency is clamped", async () => {
  const startedAt = new Date("2026-07-28T10:00:01.000Z");
  const completedAt = new Date("2026-07-28T10:00:00.000Z");
  const harness = createHarness({ nowValues: [startedAt, completedAt] });

  await harness.invoke();

  assert.equal(harness.traces[0]?.startedAt, startedAt);
  assert.equal(harness.traces[0]?.completedAt, completedAt);
  assert.equal(harness.traces[0]?.latencyMs, 0);
});

test("trace metadata excludes raw messages, reply, history, wallet, trade values, and secrets", async () => {
  const harness = createHarness();
  await harness.invoke();
  const serialized = JSON.stringify(harness.traces);

  for (const forbidden of [
    baseBody.userPrompt,
    "stored history",
    harness.output.reply,
    "10000",
    "94.905",
    "114.885",
    "Authorization",
    "cookie",
    "JWT",
    "apiKey",
  ]) {
    assert.equal(serialized.includes(forbidden), false, `trace contains ${forbidden}`);
  }
});
