import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import { AiTradeReviewContextService } from "../../../src/services/ai-trade-review-context.service.js";
import {
  AiTradeReviewService,
  POST_TRADE_REVIEW_PROMPT_VERSION,
  POST_TRADE_REVIEW_SCHEMA_VERSION,
  validatePostTradeReviewOutput,
} from "../../../src/services/ai-trade-review.service.js";
import type { CreateLlmTraceInput } from "../../../src/types/llm-trace.types.js";

const userId = "69e64c5f9042aac89c8c83f8";
const otherUserId = "69e64c5f9042aac89c8c83f9";
const journalId = "65abc0000000000000000010";
const explanationId = "65abc0000000000000000011";
const fixedNow = new Date("2026-06-24T18:00:00.000Z");

const validOutput = {
  summary: "The finalized result shows disciplined execution with one documented timing issue.",
  processQuality: "MIXED_PROCESS",
  strengths: ["The original risk boundary remained documented."],
  keyMistakes: ["Entry timing reduced the planned reward-to-risk quality."],
  riskNotes: ["One execution rule violation was recorded."],
  improvementSuggestions: ["Use a pre-entry timing checklist."],
  nextTradeFocus: "Wait for the documented entry condition before acting.",
  confidence: "HIGH",
} as const;

const makeJournal = (overrides: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(journalId),
  userId: new Types.ObjectId(userId),
  tradePlanId: new Types.ObjectId(),
  tradeSetupId: new Types.ObjectId(),
  activeTradeId: new Types.ObjectId(),
  tradeResultId: new Types.ObjectId(),
  symbolSnapshot: {
    symbol: "MCX:GOLD:04DEC2026:FUTURE",
    displayName: "MCX GOLD 04DEC2026 FUTURE",
    provider: "ANGEL_ONE",
    exchange: "MCX",
    apiKey: "must-not-leak",
    raw: { feedToken: "must-not-leak" },
  },
  status: "FINALIZED",
  marketType: "COMMODITY",
  tradeStyle: "INTRADAY",
  instrumentType: "FUTURE",
  direction: "LONG",
  plannedEntry: 99,
  plannedStopLoss: 94,
  plannedTarget1: 109,
  plannedTarget2: 114,
  plannedRewardRiskRatio: 2,
  actualEntry: 100,
  actualQuantity: 10,
  initialStopLoss: 95,
  finalStopLoss: 100,
  exitPrice: 110,
  exitReason: "TARGET_1",
  grossPnl: 100,
  netPnl: 92,
  realizedPnlUsedForRisk: 92,
  pnlBasis: "CONFIRMED_NET",
  realizedR: 1.84,
  resultType: "WIN",
  ruleViolations: ["LATE_ENTRY_DEGRADED_RR"],
  tradeEventIds: [new Types.ObjectId()],
  openedAt: new Date("2026-06-24T14:00:00Z"),
  closedAt: fixedNow,
  entryQuality: "LATE_ENTRY",
  exitQuality: "EXITED_AT_TARGET",
  outcomeQuality: "PROFIT_WITH_GOOD_PROCESS",
  followedPlan: true,
  mistakeTags: ["CHASED_ENTRY"],
  userNotes: "I waited for confirmation.",
  nextTimeFocus: "Use the planned entry zone.",
  ...overrides,
});

const idString = (value: unknown): string => String(value);
const matches = (record: Record<string, any>, filter: Record<string, any>): boolean =>
  Object.entries(filter).every(([key, value]) => idString(record[key]) === idString(value));
const execResult = <T>(value: T) => ({ exec: async () => value });
const findOneQuery = <T>(value: T) => ({
  lean: () => execResult(value),
  sort: () => ({ lean: () => execResult(value) }),
});

const createHarness = (options: {
  journals?: Record<string, any>[];
  llmResult?: unknown;
  llmError?: Error;
  traceError?: Error;
  nowValues?: Date[];
} = {}) => {
  const journals = options.journals ?? [makeJournal()];
  const explanations: Record<string, any>[] = [];
  const audits: Record<string, any>[] = [];
  const traces: CreateLlmTraceInput[] = [];
  let llmCallCount = 0;
  let nowIndex = 0;
  const tradeResult = { status: "FINALIZED", realizedR: 1.84 };
  const riskState = { totalTrades: 1, netPnl: 92 };
  const journalRepository = {
    findOne: (filter: Record<string, unknown>) =>
      findOneQuery(journals.find((journal) => matches(journal, filter)) ?? null),
    findOneAndUpdate: (filter: Record<string, unknown>, update: Record<string, any>) => {
      const journal = journals.find((item) => matches(item, filter));
      if (journal && update.$set) Object.assign(journal, update.$set);
      return { lean: () => execResult(journal ?? null) };
    },
  };
  const explanationRepository = {
    create: async (input: Record<string, unknown>) => {
      const explanation = {
        _id: new Types.ObjectId(explanationId),
        ...input,
        createdAt: fixedNow,
        updatedAt: fixedNow,
      };
      explanations.push(explanation);
      return explanation;
    },
    findOne: (filter: Record<string, unknown>) => {
      const matchesFilter = explanations.filter((item) => matches(item, filter));
      return {
        lean: () => execResult(matchesFilter[0] ?? null),
        sort: () => ({ lean: () => execResult(matchesFilter.at(-1) ?? null) }),
      };
    },
  };
  let receivedContext: Record<string, unknown> | undefined;
  const service = new AiTradeReviewService({
    journalRepository,
    explanationRepository,
    auditLogService: { record: async (event) => { audits.push(event); } },
    llmTraceService: {
      record: async (input) => {
        if (options.traceError) throw options.traceError;
        traces.push(input);
      },
    },
    llmService: {
      generatePostTradeReview: async (input) => {
        llmCallCount += 1;
        receivedContext = input.context;
        if (options.llmError) throw options.llmError;
        return options.llmResult ?? validOutput;
      },
      getProviderMetadata: () => ({ name: "test-provider", modelName: "test-model" }),
    },
    now: () => options.nowValues?.[nowIndex++] ?? fixedNow,
  });
  return {
    audits,
    explanations,
    journals,
    llmCallCount: () => llmCallCount,
    riskState,
    service,
    traces,
    tradeResult,
    receivedContext: () => receivedContext,
  };
};

test("cannot generate review for non-owned journal", async () => {
  const harness = createHarness({
    journals: [makeJournal({ userId: new Types.ObjectId(otherUserId) })],
  });
  await assert.rejects(harness.service.generateReview(userId, journalId), /TRADE_JOURNAL_NOT_FOUND/);
  assert.equal(harness.llmCallCount(), 0);
  assert.equal(harness.traces.length, 0);
});

test("cannot generate review for non-finalized journal", async () => {
  const harness = createHarness({ journals: [makeJournal({ status: "DRAFT" })] });
  await assert.rejects(harness.service.generateReview(userId, journalId), /FINALIZED/);
  assert.equal(harness.llmCallCount(), 0);
  assert.equal(harness.traces.length, 0);
});

test("context builder excludes secrets, raw payloads, and provider tokens", () => {
  const context = new AiTradeReviewContextService().build(makeJournal());
  const serialized = JSON.stringify(context);
  assert.equal(serialized.includes("must-not-leak"), false);
  assert.equal(serialized.includes("apiKey"), false);
  assert.equal(serialized.includes("feedToken"), false);
  assert.equal(serialized.includes("\"raw\""), false);
});

test("valid model output creates a COMPLETED explanation", async () => {
  const harness = createHarness();
  const explanation = await harness.service.generateReview(userId, journalId);
  assert.equal(explanation.status, "COMPLETED");
  assert.deepEqual(explanation.aiOutput, validOutput);
  assert.equal(explanation.fallbackOutput, undefined);
  assert.equal(harness.traces.length, 1);
  const trace = harness.traces[0];
  assert.equal(trace?.status, "COMPLETED");
  assert.equal(trace?.taskType, "POST_TRADE_REVIEW");
  assert.equal(trace?.fallbackUsed, false);
  assert.equal(trace?.correlationId, harness.audits[0]?.correlationId);
  assert.equal(trace?.promptVersion, POST_TRADE_REVIEW_PROMPT_VERSION);
  assert.equal(trace?.schemaVersion, POST_TRADE_REVIEW_SCHEMA_VERSION);
  assert.equal(trace?.provider, explanation.modelProvider);
  assert.equal(trace?.model, explanation.modelName);
  assert.deepEqual(trace?.validation, {
    parseSucceeded: true,
    schemaSucceeded: true,
    semanticSucceeded: true,
  });
  assert.equal(trace?.inputReference?.hash, explanation.contextHash);
  assert.deepEqual(trace?.inputReference?.redactedSummary, {
    sourceType: "TRADE_JOURNAL",
    resultType: "WIN",
    pnlBasis: "CONFIRMED_NET",
    followedPlan: true,
    ruleViolationCount: 1,
    mistakeTagCount: 1,
  });
  assert.deepEqual(trace?.outputReference?.fieldSummary, {
    processQuality: "MIXED_PROCESS",
    confidence: "HIGH",
    strengthCount: 1,
    mistakeCount: 1,
    riskNoteCount: 1,
    suggestionCount: 1,
  });
  assert.equal(trace?.tokenUsage, undefined);
});

test("valid output updates only journal AI reference fields", async () => {
  const harness = createHarness();
  const before = JSON.stringify(harness.journals[0]);
  await harness.service.generateReview(userId, journalId);
  const after = harness.journals[0] as Record<string, any>;
  assert.equal(after.aiSummary, validOutput.summary);
  assert.equal(String(after.aiReviewId), explanationId);
  assert.equal(after.aiGeneratedAt, fixedNow);
  const withoutAiFields = { ...after };
  delete withoutAiFields.aiSummary;
  delete withoutAiFields.aiReviewId;
  delete withoutAiFields.aiGeneratedAt;
  assert.equal(JSON.stringify(withoutAiFields), before);
});

test("invalid model schema creates deterministic fallback", async () => {
  const harness = createHarness({ llmResult: { processQuality: "GOOD_PROCESS" } });
  const explanation = await harness.service.generateReview(userId, journalId);
  assert.equal(explanation.status, "FALLBACK_USED");
  assert.equal(explanation.aiOutput, undefined);
  assert.match(explanation.summary, /finalized as a WIN/);
  assert.equal(explanation.validationErrors.length > 0, true);
  assert.equal(harness.traces.length, 1);
  assert.equal(harness.traces[0]?.status, "VALIDATION_FAILED");
  assert.equal(harness.traces[0]?.failureCode, "POST_TRADE_REVIEW_SCHEMA_VALIDATION_FAILED");
  assert.equal(harness.traces[0]?.fallbackUsed, true);
  assert.deepEqual(harness.traces[0]?.validation, {
    parseSucceeded: true,
    schemaSucceeded: false,
    semanticSucceeded: false,
    errors: explanation.validationErrors,
  });
});

test("LLM failure creates deterministic fallback", async () => {
  const harness = createHarness({ llmError: new Error("provider unavailable") });
  const explanation = await harness.service.generateReview(userId, journalId);
  assert.equal(explanation.status, "FALLBACK_USED");
  assert.deepEqual(explanation.warnings, ["LLM_REQUEST_FAILED"]);
  assert.equal(harness.traces.length, 1);
  assert.equal(harness.traces[0]?.status, "PROVIDER_FAILED");
  assert.equal(harness.traces[0]?.failureCode, "POST_TRADE_REVIEW_PROVIDER_FAILED");
  assert.equal(harness.traces[0]?.fallbackUsed, true);
  assert.deepEqual(harness.traces[0]?.validation, {
    parseSucceeded: false,
    schemaSucceeded: false,
    semanticSucceeded: false,
  });
  assert.equal(JSON.stringify(harness.traces).includes("provider unavailable"), false);
});

test("validator rejects forbidden trade recommendation language", () => {
  const result = validatePostTradeReviewOutput({ ...validOutput, summary: "BUY this instrument now." });
  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.stage, "SEMANTIC");
    assert.equal(result.errors.includes("FORBIDDEN_TRADE_RECOMMENDATION"), true);
  }
});

test("validator rejects order-placement instructions", () => {
  const result = validatePostTradeReviewOutput({
    ...validOutput,
    nextTradeFocus: "Place an order at the next open.",
  });
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.errors.includes("FORBIDDEN_ORDER_INSTRUCTION"), true);
});

test("validator rejects claims that AI changed risk state", () => {
  const result = validatePostTradeReviewOutput({
    ...validOutput,
    riskNotes: ["AI updated the risk state after this review."],
  });
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.errors.includes("FORBIDDEN_RISK_MUTATION_CLAIM"), true);
});

test("validator rejects claims that AI calculated final P&L", () => {
  const result = validatePostTradeReviewOutput({
    ...validOutput,
    summary: "AI calculated the final P&L as 92.",
  });
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.errors.includes("FORBIDDEN_PNL_CALCULATION_CLAIM"), true);
});

test("validator rejects missing required summary", () => {
  const { summary: _summary, ...withoutSummary } = validOutput;
  const result = validatePostTradeReviewOutput(withoutSummary);
  assert.equal(result.success, false);
  if (!result.success) {
    assert.equal(result.stage, "SCHEMA");
    assert.equal(result.errors.some((error) => error.startsWith("summary:")), true);
  }
});

test("semantic-invalid output creates fallback and a semantic failure trace", async () => {
  const harness = createHarness({
    llmResult: { ...validOutput, summary: "BUY this instrument now." },
  });

  const explanation = await harness.service.generateReview(userId, journalId);

  assert.equal(explanation.status, "FALLBACK_USED");
  assert.match(explanation.summary, /finalized as a WIN/);
  assert.equal(harness.traces[0]?.status, "VALIDATION_FAILED");
  assert.equal(
    harness.traces[0]?.failureCode,
    "POST_TRADE_REVIEW_SEMANTIC_VALIDATION_FAILED",
  );
  assert.deepEqual(harness.traces[0]?.validation, {
    parseSucceeded: true,
    schemaSucceeded: true,
    semanticSucceeded: false,
    errors: ["FORBIDDEN_TRADE_RECOMMENDATION"],
  });
});

test("trace metadata excludes context, output text, prices, P&L, notes, and secrets", async () => {
  const harness = createHarness();
  await harness.service.generateReview(userId, journalId);
  const serialized = JSON.stringify(harness.traces[0]);

  for (const forbidden of [
    "userNotes",
    "nextTimeFocus",
    validOutput.summary,
    "plannedEntry",
    "actualEntry",
    "exitPrice",
    "grossPnl",
    "netPnl",
    "apiKey",
    "feedToken",
    "authorization",
    "must-not-leak",
  ]) {
    assert.equal(serialized.includes(forbidden), false, `trace contains ${forbidden}`);
  }
});

test("trace timestamps and latency use the injected clock and cannot be negative", async () => {
  const startedAt = new Date("2026-07-28T10:00:01.000Z");
  const completedAt = new Date("2026-07-28T10:00:00.500Z");
  const generatedAt = new Date("2026-07-28T10:00:02.000Z");
  const harness = createHarness({ nowValues: [startedAt, completedAt, generatedAt] });

  const explanation = await harness.service.generateReview(userId, journalId);

  assert.equal(harness.traces[0]?.startedAt, startedAt);
  assert.equal(harness.traces[0]?.completedAt, completedAt);
  assert.equal(harness.traces[0]?.latencyMs, 0);
  assert.equal(explanation.generatedAt, generatedAt);
});

test("trace persistence rejection cannot change successful review behavior", async () => {
  const harness = createHarness({ traceError: new Error("trace unavailable") });

  const explanation = await harness.service.generateReview(userId, journalId);

  assert.equal(explanation.status, "COMPLETED");
  assert.equal(harness.explanations.length, 1);
  assert.equal(String((harness.journals[0] as Record<string, any>).aiReviewId), explanationId);
  assert.deepEqual(harness.audits.map((event) => event.action), [
    "AI_EXPLANATION_REQUESTED",
    "AI_OUTPUT_VALIDATED",
    "AI_EXPLANATION_STORED",
  ]);
});

test("AI review does not mutate TradeResult or risk state", async () => {
  const harness = createHarness();
  const beforeResult = structuredClone(harness.tradeResult);
  const beforeRisk = structuredClone(harness.riskState);
  await harness.service.generateReview(userId, journalId);
  assert.deepEqual(harness.tradeResult, beforeResult);
  assert.deepEqual(harness.riskState, beforeRisk);
});

test("AI lifecycle is audited for valid and fallback paths", async () => {
  const valid = createHarness();
  await valid.service.generateReview(userId, journalId);
  assert.deepEqual(valid.audits.map((event) => event.action), [
    "AI_EXPLANATION_REQUESTED",
    "AI_OUTPUT_VALIDATED",
    "AI_EXPLANATION_STORED",
  ]);

  const fallback = createHarness({ llmResult: { summary: "" } });
  await fallback.service.generateReview(userId, journalId);
  assert.deepEqual(fallback.audits.map((event) => event.action), [
    "AI_EXPLANATION_REQUESTED",
    "AI_OUTPUT_REJECTED",
    "AI_FALLBACK_USED",
    "AI_EXPLANATION_STORED",
  ]);
});

test("get explanation and journal review enforce ownership", async () => {
  const harness = createHarness();
  await harness.service.generateReview(userId, journalId);
  const explanation = await harness.service.getExplanation(userId, explanationId);
  assert.equal(String(explanation._id), explanationId);
  const journalReview = await harness.service.getJournalReview(userId, journalId);
  assert.equal(String(journalReview._id), explanationId);
  await assert.rejects(harness.service.getExplanation(otherUserId, explanationId), /NOT_FOUND/);
  await assert.rejects(harness.service.getJournalReview(otherUserId, journalId), /NOT_FOUND/);
});

test("review provider receives only the backend-built context", async () => {
  const harness = createHarness();
  await harness.service.generateReview(userId, journalId);
  const context = harness.receivedContext();
  assert.deepEqual(Object.keys(context ?? {}).sort(), [
    "actualTrade",
    "finalizedResult",
    "instrument",
    "plannedTrade",
    "processEvidence",
    "source",
  ]);
});
