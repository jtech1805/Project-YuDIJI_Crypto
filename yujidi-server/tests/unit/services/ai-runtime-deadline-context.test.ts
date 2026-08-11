import assert from "node:assert/strict";
import test from "node:test";
import { AiRuntimeDeadlineContextService } from "../../../src/services/ai-runtime-deadline-context.service.js";
import { AiRuntimeDeadlineExceededError } from "../../../src/types/ai-runtime-deadline.types.js";

test("deadline context suppresses retrieval after embedding expiry", () => {
  let now = 100;
  let cleared = 0;
  const context = new AiRuntimeDeadlineContextService(
    10,
    { now: () => now },
    { set: () => "TIMER", clear: () => cleared++ },
  );
  const exposedStartedAt = context.startedAt;
  exposedStartedAt.setTime(9_999);
  assert.equal(context.startedAt.getTime(), 100);
  assert.equal(context.deadlineAt.getTime(), 110);
  context.enter("EMBEDDING");
  now = 111;
  context.complete("EMBEDDING");
  assert.throws(
    () => context.throwIfExpired("RETRIEVAL"),
    (error) =>
      error instanceof AiRuntimeDeadlineExceededError &&
      error.stage === "RETRIEVAL",
  );
  assert.deepEqual(context.latencies(), {
    embeddingLatencyMs: 11,
    retrievalLatencyMs: null,
    contextAssemblyLatencyMs: null,
    generationLatencyMs: null,
  });
  context.dispose();
  context.dispose();
  assert.equal(cleared, 1);
});

test("deadline context suppresses generation after retrieval expiry", () => {
  let now = 0;
  const context = new AiRuntimeDeadlineContextService(
    5,
    { now: () => now },
    { set: () => "TIMER", clear: () => {} },
  );
  context.enter("EMBEDDING");
  now = 1;
  context.complete("EMBEDDING");
  context.enter("RETRIEVAL");
  now = 6;
  context.complete("RETRIEVAL");
  assert.throws(
    () => context.throwIfExpired("GENERATION"),
    (error) =>
      error instanceof AiRuntimeDeadlineExceededError &&
      error.stage === "GENERATION",
  );
});

test("one timer aborts the shared signal observed by an in-flight stage", async () => {
  let abort: (() => void) | undefined;
  let cleared = 0;
  const context = new AiRuntimeDeadlineContextService(
    10,
    { now: () => 0 },
    {
      set: (callback) => {
        abort = callback;
        return "TIMER";
      },
      clear: () => cleared++,
    },
  );
  context.enter("GENERATION");
  const observed = new Promise<boolean>((resolve) =>
    context.signal.addEventListener(
      "abort",
      () => resolve(context.signal.aborted),
      { once: true },
    ),
  );
  abort?.();
  assert.equal(await observed, true);
  assert.equal(context.failureStage(), "GENERATION");
  context.dispose();
  assert.equal(cleared, 1);
});
