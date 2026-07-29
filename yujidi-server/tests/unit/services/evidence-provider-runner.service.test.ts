import assert from "node:assert/strict";
import test from "node:test";

import type { EvidenceProviderAdapter } from "../../../src/ports/evidence-provider-adapter.port.js";
import { EvidenceProviderRunnerService } from "../../../src/services/evidence-provider-runner.service.js";
import type {
  EvidenceCandidate,
  EvidenceIngestionResult,
  EvidenceObservationCandidate,
} from "../../../src/types/evidence-ingestion.types.js";

const candidate = (factorKey: string): EvidenceObservationCandidate => ({
  recordType: "OBSERVATION",
  factorKey,
  subject: { type: "ECONOMY", key: "MACRO:DXY" },
  provenance: { sourceType: "MACRO_DATA", provider: "provider" },
  value: { type: "NUMBER", numberValue: 1 },
  observedAt: new Date("2026-07-29T10:00:00.000Z"),
  schemaVersion: "1.0",
});

const adapter = (
  candidates: readonly EvidenceCandidate[],
  adapterId = "GENERIC_TEST",
): EvidenceProviderAdapter => ({
  adapterId,
  readCandidates: async () => candidates,
});

const resultFor = (
  status: EvidenceIngestionResult["status"],
  index: number,
): EvidenceIngestionResult => {
  switch (status) {
    case "CREATED":
      return {
        status,
        evidenceId: `evidence-${index}`,
        deduplicationKey: `dedup-${index}`,
      };
    case "DUPLICATE":
      return {
        status,
        evidenceId: `existing-${index}`,
        deduplicationKey: `dedup-${index}`,
      };
    case "REJECTED":
      return { status, code: "INVALID_CANDIDATE" };
    case "FAILED":
      return { status, code: "PERSISTENCE_FAILED" };
  }
};

const harness = (
  statuses: readonly EvidenceIngestionResult["status"][],
) => {
  const calls: unknown[] = [];
  let index = 0;
  const runner = new EvidenceProviderRunnerService({
    ingestionService: {
      ingest: async (input) => {
        calls.push(input);
        const status = statuses[index] ?? "CREATED";
        const result = resultFor(status, index);
        index += 1;
        return result;
      },
    },
  });
  return { calls, runner };
};

test("derives COMPLETED for created and duplicate results in candidate order", async () => {
  const candidates = [candidate("A"), candidate("B"), candidate("C")];
  const { calls, runner } = harness(["CREATED", "DUPLICATE", "CREATED"]);
  const result = await runner.run({ adapter: adapter(candidates) });
  assert.deepEqual({
    status: result.status,
    candidateCount: result.candidateCount,
    createdCount: result.createdCount,
    duplicateCount: result.duplicateCount,
    rejectedCount: result.rejectedCount,
    failedCount: result.failedCount,
  }, {
    status: "COMPLETED",
    candidateCount: 3,
    createdCount: 2,
    duplicateCount: 1,
    rejectedCount: 0,
    failedCount: 0,
  });
  assert.deepEqual(result.results.map(({ index }) => index), [0, 1, 2]);
  assert.deepEqual(calls, candidates);
});

test("accepts an empty candidate batch as COMPLETED", async () => {
  const result = await harness([]).runner.run({ adapter: adapter([]) });
  assert.deepEqual(result, {
    providerKey: "GENERIC_TEST",
    status: "COMPLETED",
    candidateCount: 0,
    createdCount: 0,
    duplicateCount: 0,
    rejectedCount: 0,
    failedCount: 0,
    results: [],
  });
});

test("derives PARTIAL for rejected and failed candidate outcomes", async () => {
  for (const statuses of [
    ["CREATED", "REJECTED", "DUPLICATE"],
    ["CREATED", "FAILED", "CREATED"],
  ] as const) {
    const candidates = statuses.map((_, index) => candidate(`F-${index}`));
    const result = await harness(statuses).runner.run({ adapter: adapter(candidates) });
    assert.equal(result.status, "PARTIAL");
    assert.equal(result.candidateCount, 3);
    assert.deepEqual(result.results.map(({ index }) => index), [0, 1, 2]);
  }
});

test("classifies a valid all-failed batch as PARTIAL", async () => {
  const result = await harness(["FAILED", "FAILED"]).runner.run({
    adapter: adapter([candidate("A"), candidate("B")]),
  });
  assert.equal(result.status, "PARTIAL");
  assert.equal(result.failedCount, 2);
});

test("adapter exception fails the run and prevents ingestion", async () => {
  const { calls, runner } = harness([]);
  const result = await runner.run({
    adapter: {
      adapterId: "GENERIC_TEST",
      readCandidates: async () => {
        throw new Error("provider payload and secret must not escape");
      },
    },
  });
  assert.deepEqual(result, {
    providerKey: "GENERIC_TEST",
    status: "FAILED",
    failureCode: "ADAPTER_EXECUTION_FAILED",
    candidateCount: 0,
    createdCount: 0,
    duplicateCount: 0,
    rejectedCount: 0,
    failedCount: 0,
    results: [],
  });
  assert.deepEqual(calls, []);
  assert.equal(JSON.stringify(result).includes("secret"), false);
});

test("rejects null, undefined, object, and string adapter results", async () => {
  for (const invalidResult of [null, undefined, {}, "candidate"]) {
    const { calls, runner } = harness([]);
    const result = await runner.run({
      adapter: {
        adapterId: "GENERIC_TEST",
        readCandidates: async () => invalidResult as never,
      },
    });
    assert.equal(result.status, "FAILED");
    if (result.status !== "FAILED") assert.fail("expected FAILED");
    assert.equal(result.failureCode, "INVALID_ADAPTER_RESULT");
    assert.deepEqual(calls, []);
  }
});

test("accepts exactly 500 candidates and rejects 501 before ingestion", async () => {
  const maximum = Array.from({ length: 500 }, (_, index) => candidate(`F-${index}`));
  const accepted = harness([]);
  assert.equal((await accepted.runner.run({ adapter: adapter(maximum) })).candidateCount, 500);
  assert.equal(accepted.calls.length, 500);

  const oversized = harness([]);
  const result = await oversized.runner.run({
    adapter: adapter([...maximum, candidate("F-500")]),
  });
  assert.equal(result.status, "FAILED");
  if (result.status !== "FAILED") assert.fail("expected FAILED");
  assert.equal(result.failureCode, "BATCH_SIZE_EXCEEDED");
  assert.deepEqual(oversized.calls, []);
});

test("invalid adapter IDs fail before readCandidates is called", async () => {
  for (const adapterId of ["", " GENERIC", "GENERIC ", 42]) {
    let adapterCalls = 0;
    const result = await harness([]).runner.run({
      adapter: {
        adapterId: adapterId as string,
        readCandidates: async () => {
          adapterCalls += 1;
          return [];
        },
      },
    });
    assert.equal(result.status, "FAILED");
    if (result.status !== "FAILED") assert.fail("expected FAILED");
    assert.equal(result.failureCode, "INVALID_PROVIDER_KEY");
    assert.equal(adapterCalls, 0);
  }
});

test("calls the adapter exactly once and ingestion once per candidate", async () => {
  let adapterCalls = 0;
  const candidates = [candidate("A"), candidate("B")];
  const testHarness = harness([]);
  await testHarness.runner.run({
    adapter: {
      adapterId: "GENERIC_TEST",
      readCandidates: async () => {
        adapterCalls += 1;
        return candidates;
      },
    },
  });
  assert.equal(adapterCalls, 1);
  assert.equal(testHarness.calls.length, 2);
});

test("processes ingestion sequentially without overlap", async () => {
  const events: string[] = [];
  let active = 0;
  let overlapped = false;
  const runner = new EvidenceProviderRunnerService({
    ingestionService: {
      ingest: async (input) => {
        const key = (input as EvidenceCandidate).factorKey;
        events.push(`start-${key}`);
        active += 1;
        if (active > 1) overlapped = true;
        await new Promise<void>((resolve) => setImmediate(resolve));
        active -= 1;
        events.push(`end-${key}`);
        return resultFor("CREATED", events.length);
      },
    },
  });
  await runner.run({ adapter: adapter([candidate("A"), candidate("B")]) });
  assert.equal(overlapped, false);
  assert.deepEqual(events, ["start-A", "end-A", "start-B", "end-B"]);
});

test("isolates an unexpected candidate exception and continues", async () => {
  let index = 0;
  const runner = new EvidenceProviderRunnerService({
    ingestionService: {
      ingest: async () => {
        const current = index;
        index += 1;
        if (current === 1) throw new Error("authorization=secret");
        return resultFor("CREATED", current);
      },
    },
  });
  const result = await runner.run({
    adapter: adapter([candidate("A"), candidate("B"), candidate("C")]),
  });
  assert.equal(result.status, "PARTIAL");
  assert.equal(result.failedCount, 1);
  assert.equal(result.candidateCount, 3);
  assert.equal(result.results[1]?.result.status, "FAILED");
  assert.equal(JSON.stringify(result).includes("secret"), false);
});

test("does not mutate frozen candidates or their array", async () => {
  const first = candidate("A");
  Object.freeze(first.subject);
  Object.freeze(first.provenance);
  Object.freeze(first.value);
  Object.freeze(first);
  const candidates = Object.freeze([first]);
  const before = structuredClone(candidates);
  await harness([]).runner.run({ adapter: adapter(candidates) });
  assert.deepEqual(candidates, before);
});

test("identical adapter and ingestion outcomes are deterministic", async () => {
  const candidates = [candidate("A"), candidate("B")];
  const first = await harness(["CREATED", "REJECTED"]).runner.run({
    adapter: adapter(candidates),
  });
  const second = await harness(["CREATED", "REJECTED"]).runner.run({
    adapter: adapter(candidates),
  });
  assert.deepEqual(first, second);
});
