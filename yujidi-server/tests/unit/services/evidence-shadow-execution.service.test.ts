import assert from "node:assert/strict";
import test from "node:test";

import type { EvidenceProviderAdapter } from "../../../src/ports/evidence-provider-adapter.port.js";
import { EvidenceShadowExecutionService } from "../../../src/services/evidence/evidence-shadow-execution.service.js";
import type { EvidenceAdapterHealthSnapshot } from "../../../src/types/evidence-observability.types.js";
import type { EvidenceProviderRunResult } from "../../../src/types/evidence-provider-run.types.js";
import { EvidenceShadowExecutionError } from "../../../src/types/evidence-shadow-execution.types.js";

const ADAPTER_ID = "TEST_ADAPTER_V1";
const START = new Date("2026-07-30T10:00:00.000Z");
const COMPLETE = new Date("2026-07-30T10:00:00.450Z");

const adapter: EvidenceProviderAdapter = Object.freeze({
  adapterId: ADAPTER_ID,
  readCandidates: async () => Object.freeze([]),
});

const runResult = (
  status: "COMPLETED" | "PARTIAL" = "COMPLETED",
): EvidenceProviderRunResult => ({
  providerKey: ADAPTER_ID,
  status,
  candidateCount: status === "COMPLETED" ? 2 : 3,
  createdCount: 1,
  duplicateCount: 1,
  rejectedCount: status === "PARTIAL" ? 1 : 0,
  failedCount: 0,
  results: [],
});

const failedRun: EvidenceProviderRunResult = {
  providerKey: ADAPTER_ID,
  status: "FAILED",
  failureCode: "ADAPTER_EXECUTION_FAILED",
  candidateCount: 0,
  createdCount: 0,
  duplicateCount: 0,
  rejectedCount: 0,
  failedCount: 0,
  results: [],
};

const health = (
  state: "HEALTHY" | "DEGRADED" = "HEALTHY",
): EvidenceAdapterHealthSnapshot => ({
  adapterId: ADAPTER_ID,
  health: state,
  totalRuns: 1,
  completedRuns: state === "HEALTHY" ? 1 : 0,
  partialRuns: state === "DEGRADED" ? 1 : 0,
  failedRuns: 0,
  totalCandidates: 2,
  createdCandidates: 1,
  duplicateCandidates: 1,
  rejectedCandidates: 0,
  failedCandidates: 0,
  consecutiveFailedRuns: 0,
  lastRunAt: COMPLETE,
  lastSuccessAt: state === "HEALTHY" ? COMPLETE : null,
  lastStatus: state === "HEALTHY" ? "COMPLETED" : "PARTIAL",
  lastFailureCode: null,
  lastDurationMs: 450,
});

const harness = (options: {
  result?: EvidenceProviderRunResult;
  dates?: readonly unknown[];
  runnerError?: unknown;
  observabilityError?: unknown;
} = {}) => {
  const events: string[] = [];
  const dates = [...(options.dates ?? [START, COMPLETE])];
  let clockCalls = 0;
  let runnerCalls = 0;
  let observabilityCalls = 0;
  let recordedResult: EvidenceProviderRunResult | undefined;
  const service = new EvidenceShadowExecutionService({
    clock: {
      now: () => {
        events.push(`clock-${++clockCalls}`);
        return dates.shift() as Date;
      },
    },
    runner: {
      run: async ({ adapter: suppliedAdapter }) => {
        events.push("runner");
        runnerCalls += 1;
        assert.equal(suppliedAdapter, adapter);
        if (options.runnerError) throw options.runnerError;
        return options.result ?? runResult();
      },
    },
    observability: {
      recordRun: (input) => {
        events.push("observability");
        observabilityCalls += 1;
        recordedResult = input.result;
        if (options.observabilityError) throw options.observabilityError;
        return health(input.result.status === "COMPLETED" ? "HEALTHY" : "DEGRADED");
      },
    },
  });
  return {
    service,
    events,
    calls: () => ({ clockCalls, runnerCalls, observabilityCalls }),
    recordedResult: () => recordedResult,
  };
};

test("records a completed run with exact timing and cloned health dates", async () => {
  const sourceHealthDate = COMPLETE;
  const setup = harness();
  const result = await setup.service.execute({ adapter });
  assert.equal(result.executionStatus, "RECORDED");
  assert.deepEqual(setup.events, ["clock-1", "runner", "clock-2", "observability"]);
  assert.deepEqual(setup.calls(), { clockCalls: 2, runnerCalls: 1, observabilityCalls: 1 });
  assert.equal(result.durationMs, 450);
  assert.equal(result.health.health, "HEALTHY");
  assert.notEqual(result.startedAt, START);
  assert.notEqual(result.completedAt, COMPLETE);
  assert.notEqual(result.health.lastRunAt, sourceHealthDate);
  result.startedAt.setUTCFullYear(2030);
  result.completedAt.setUTCFullYear(2030);
  result.health.lastRunAt?.setUTCFullYear(2030);
  assert.equal(START.toISOString(), "2026-07-30T10:00:00.000Z");
  assert.equal(COMPLETE.toISOString(), "2026-07-30T10:00:00.450Z");
});

test("records partial and typed failed runner results through observability", async () => {
  for (const typedResult of [runResult("PARTIAL"), failedRun]) {
    const setup = harness({ result: typedResult });
    const result = await setup.service.execute({ adapter });
    assert.equal(result.executionStatus, "RECORDED");
    assert.equal(setup.recordedResult(), typedResult);
    assert.equal(result.run.status, typedResult.status);
    assert.equal(
      result.run.failureCode,
      typedResult.status === "FAILED" ? "ADAPTER_EXECUTION_FAILED" : null,
    );
  }
});

test("unexpected runner throw returns a safe execution failure", async () => {
  const setup = harness({ runnerError: new Error("secret runner detail") });
  const result = await setup.service.execute({ adapter });
  assert.deepEqual(setup.calls(), { clockCalls: 2, runnerCalls: 1, observabilityCalls: 0 });
  assert.deepEqual(result, {
    executionStatus: "EXECUTION_FAILED",
    startedAt: START,
    completedAt: COMPLETE,
    durationMs: 450,
    adapterId: ADAPTER_ID,
    failureCode: "RUNNER_EXECUTION_FAILED",
  });
  assert.doesNotMatch(JSON.stringify(result), /secret|stack|message/i);
});

test("observability throw retains only the safe run summary", async () => {
  const setup = harness({ observabilityError: new Error("secret health detail") });
  const result = await setup.service.execute({ adapter });
  assert.equal(result.executionStatus, "OBSERVABILITY_FAILED");
  assert.deepEqual(setup.calls(), { clockCalls: 2, runnerCalls: 1, observabilityCalls: 1 });
  assert.equal("health" in result, false);
  assert.equal("results" in result.run, false);
  assert.doesNotMatch(JSON.stringify(result), /secret|deduplicationKey|evidenceId/i);
});

test("zero duration is valid", async () => {
  const setup = harness({ dates: [START, START] });
  const result = await setup.service.execute({ adapter });
  assert.equal(result.executionStatus, "RECORDED");
  assert.equal(result.durationMs, 0);
});

test("invalid initial clock throws typed error before runner execution", async () => {
  for (const invalid of [new Date("invalid"), "2026-07-30"]) {
    const setup = harness({ dates: [invalid] });
    await assert.rejects(
      setup.service.execute({ adapter }),
      (error: unknown) =>
        error instanceof EvidenceShadowExecutionError
        && error.code === "INVALID_CLOCK",
    );
    assert.deepEqual(setup.calls(), { clockCalls: 1, runnerCalls: 0, observabilityCalls: 0 });
  }
});

test("invalid or backwards completion returns INVALID_CLOCK without recording", async () => {
  for (const invalid of [new Date("invalid"), "2026-07-30", new Date(START.getTime() - 1)]) {
    const setup = harness({ dates: [START, invalid] });
    const result = await setup.service.execute({ adapter });
    assert.equal(result.executionStatus, "EXECUTION_FAILED");
    assert.equal(result.failureCode, "INVALID_CLOCK");
    assert.equal(result.durationMs, 0);
    assert.equal(result.completedAt.getTime(), START.getTime());
    assert.deepEqual(setup.calls(), { clockCalls: 2, runnerCalls: 1, observabilityCalls: 0 });
  }
});

test("invalid completion takes precedence after an unexpected runner throw", async () => {
  const setup = harness({
    dates: [START, new Date("invalid")],
    runnerError: new Error("hidden"),
  });
  const result = await setup.service.execute({ adapter });
  assert.equal(result.executionStatus, "EXECUTION_FAILED");
  assert.equal(result.failureCode, "INVALID_CLOCK");
  assert.deepEqual(setup.calls(), { clockCalls: 2, runnerCalls: 1, observabilityCalls: 0 });
});

test("safe output omits candidate-level runner data", async () => {
  const detailed = Object.freeze({
    ...runResult(),
    results: Object.freeze([
      Object.freeze({
        index: 0,
        result: Object.freeze({
          status: "CREATED" as const,
          evidenceId: "PRIVATE-EVIDENCE-ID",
          deduplicationKey: "PRIVATE-DEDUP-KEY",
        }),
      }),
    ]),
  }) as EvidenceProviderRunResult;
  const setup = harness({ result: detailed });
  const result = await setup.service.execute({ adapter });
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /results|PRIVATE|deduplicationKey|evidenceId|index/);
  assert.equal(setup.recordedResult(), detailed);
});

test("repeated identical executions are deterministic and do not mutate inputs", async () => {
  const frozenResult = Object.freeze({
    ...runResult(),
    results: Object.freeze([]),
  }) as EvidenceProviderRunResult;
  const first = await harness({ result: frozenResult }).service.execute({ adapter });
  const second = await harness({ result: frozenResult }).service.execute({ adapter });
  assert.deepEqual(first, second);
  assert.equal(Object.isFrozen(adapter), true);
  assert.equal(Object.isFrozen(frozenResult), true);
});
