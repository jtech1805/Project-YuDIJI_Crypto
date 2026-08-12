import assert from "node:assert/strict";
import test from "node:test";

import { EvidenceObservabilityService } from "../../../src/services/evidence/evidence-observability.service.js";
import {
  EvidenceObservabilityError,
  MAX_TRACKED_EVIDENCE_ADAPTERS,
} from "../../../src/types/evidence-observability.types.js";
import type {
  EvidenceProviderCandidateRunResult,
  EvidenceProviderRunResult,
} from "../../../src/types/evidence-provider-run.types.js";

const ADAPTER = "BINANCE_PUBLIC_MARKET_PRICE_V1";
const T0 = new Date("2026-07-30T10:00:00.000Z");
const T1 = new Date("2026-07-30T10:00:01.250Z");
const T2 = new Date("2026-07-30T10:00:02.000Z");

const candidateResults = (
  statuses: readonly ("CREATED" | "DUPLICATE" | "REJECTED" | "FAILED")[],
): EvidenceProviderCandidateRunResult[] =>
  statuses.map((status, index) => ({
    index,
    result:
      status === "CREATED"
        ? { status, evidenceId: `E-${index}`, deduplicationKey: `D-${index}` }
        : status === "DUPLICATE"
          ? { status, evidenceId: `E-${index}`, deduplicationKey: `D-${index}` }
          : status === "REJECTED"
            ? { status, code: "INVALID_CANDIDATE" }
            : { status, code: "PERSISTENCE_FAILED" },
  }));

const candidateRun = (
  statuses: readonly ("CREATED" | "DUPLICATE" | "REJECTED" | "FAILED")[],
  adapterId = ADAPTER,
): EvidenceProviderRunResult => {
  const results = candidateResults(statuses);
  const count = (status: string) =>
    results.filter((entry) => entry.result.status === status).length;
  const rejectedCount = count("REJECTED");
  const failedCount = count("FAILED");
  return {
    providerKey: adapterId,
    status: rejectedCount > 0 || failedCount > 0 ? "PARTIAL" : "COMPLETED",
    candidateCount: results.length,
    createdCount: count("CREATED"),
    duplicateCount: count("DUPLICATE"),
    rejectedCount,
    failedCount,
    results,
  };
};

const failedRun = (
  adapterId = ADAPTER,
): EvidenceProviderRunResult => ({
  providerKey: adapterId,
  status: "FAILED",
  failureCode: "ADAPTER_EXECUTION_FAILED",
  candidateCount: 0,
  createdCount: 0,
  duplicateCount: 0,
  rejectedCount: 0,
  failedCount: 0,
  results: [],
});

const record = (
  service: EvidenceObservabilityService,
  result: EvidenceProviderRunResult,
  startedAt = T0,
  completedAt = T1,
) => service.recordRun({ result, startedAt, completedAt });

test("unknown adapter reads return null without creating state", () => {
  const service = new EvidenceObservabilityService({
    clock: { now: () => T2 },
  });
  assert.equal(service.getAdapterHealth(ADAPTER), null);
  assert.deepEqual(service.getPipelineHealth().adapters, []);
});

test("first completed run is healthy with success and exact duration", () => {
  const service = new EvidenceObservabilityService();
  const snapshot = record(service, candidateRun(["CREATED", "DUPLICATE"]));
  assert.equal(snapshot.health, "HEALTHY");
  assert.equal(snapshot.totalRuns, 1);
  assert.equal(snapshot.completedRuns, 1);
  assert.equal(snapshot.consecutiveFailedRuns, 0);
  assert.equal(snapshot.lastDurationMs, 1250);
  assert.equal(snapshot.lastSuccessAt?.toISOString(), T1.toISOString());
  assert.equal(snapshot.createdCandidates, 1);
  assert.equal(snapshot.duplicateCandidates, 1);
});

test("duplicate-only completed run remains healthy", () => {
  const service = new EvidenceObservabilityService();
  const snapshot = record(service, candidateRun(["DUPLICATE", "DUPLICATE"]));
  assert.equal(snapshot.health, "HEALTHY");
  assert.equal(snapshot.duplicateCandidates, 2);
  assert.equal(snapshot.createdCandidates, 0);
});

test("partial run is degraded, accumulates candidate counters, and is not success", () => {
  const service = new EvidenceObservabilityService();
  const initial = record(service, candidateRun(["CREATED"]), T0, T1);
  const snapshot = record(
    service,
    candidateRun(["CREATED", "DUPLICATE", "REJECTED", "FAILED"]),
    T1,
    T2,
  );
  assert.equal(snapshot.health, "DEGRADED");
  assert.equal(snapshot.partialRuns, 1);
  assert.equal(snapshot.consecutiveFailedRuns, 0);
  assert.equal(snapshot.lastSuccessAt?.toISOString(), initial.lastSuccessAt?.toISOString());
  assert.deepEqual({
    total: snapshot.totalCandidates,
    created: snapshot.createdCandidates,
    duplicate: snapshot.duplicateCandidates,
    rejected: snapshot.rejectedCandidates,
    failed: snapshot.failedCandidates,
  }, { total: 5, created: 2, duplicate: 1, rejected: 1, failed: 1 });
});

test("one batch failure is degraded and two are unhealthy", () => {
  const service = new EvidenceObservabilityService();
  const first = record(service, failedRun());
  assert.equal(first.health, "DEGRADED");
  assert.equal(first.failedRuns, 1);
  assert.equal(first.consecutiveFailedRuns, 1);
  assert.equal(first.lastFailureCode, "ADAPTER_EXECUTION_FAILED");
  const second = record(service, failedRun(), T1, T2);
  assert.equal(second.health, "UNHEALTHY");
  assert.equal(second.consecutiveFailedRuns, 2);
});

test("completed and partial runs reset consecutive batch failures", () => {
  const completedService = new EvidenceObservabilityService();
  record(completedService, failedRun());
  record(completedService, failedRun());
  const completed = record(completedService, candidateRun(["CREATED"]), T1, T2);
  assert.equal(completed.health, "HEALTHY");
  assert.equal(completed.consecutiveFailedRuns, 0);
  assert.equal(completed.lastSuccessAt?.toISOString(), T2.toISOString());

  const partialService = new EvidenceObservabilityService();
  record(partialService, failedRun());
  const partial = record(partialService, candidateRun(["REJECTED"]), T1, T2);
  assert.equal(partial.health, "DEGRADED");
  assert.equal(partial.consecutiveFailedRuns, 0);
  assert.equal(partial.lastSuccessAt, null);
});

test("accepts zero duration and rejects negative or invalid dates", () => {
  assert.equal(
    record(new EvidenceObservabilityService(), candidateRun([]), T0, T0)
      .lastDurationMs,
    0,
  );
  for (const [startedAt, completedAt] of [
    [T1, T0],
    [new Date("invalid"), T1],
    [T0, new Date("invalid")],
    ["2026-07-30", T1],
  ] as const) {
    assert.throws(
      () => record(
        new EvidenceObservabilityService(),
        candidateRun([]),
        startedAt as Date,
        completedAt,
      ),
      (error: unknown) =>
        error instanceof EvidenceObservabilityError
        && error.code === "INVALID_TIME_RANGE",
    );
  }
});

test("rejects invalid adapter IDs", () => {
  const service = new EvidenceObservabilityService();
  for (const adapterId of ["", " ADAPTER", "ADAPTER ", 42]) {
    const result = candidateRun([], adapterId as string);
    assert.throws(
      () => record(service, result),
      (error: unknown) =>
        error instanceof EvidenceObservabilityError
        && error.code === "INVALID_ADAPTER_ID",
    );
  }
});

test("rejects inconsistent completed, partial, and failed result shapes", () => {
  const invalidResults: unknown[] = [
    { ...candidateRun(["CREATED"]), candidateCount: 2 },
    { ...candidateRun(["CREATED"]), status: "PARTIAL" },
    {
      ...failedRun(),
      candidateCount: 1,
      failedCount: 1,
    },
    {
      ...failedRun(),
      failureCode: undefined,
    },
  ];
  for (const result of invalidResults) {
    assert.throws(
      () => record(
        new EvidenceObservabilityService(),
        result as EvidenceProviderRunResult,
      ),
      (error: unknown) =>
        error instanceof EvidenceObservabilityError
        && error.code === "INVALID_RUN_RESULT",
    );
  }
});

test("bounds state at 100 adapters without evicting existing state", () => {
  const service = new EvidenceObservabilityService();
  for (let index = 0; index < MAX_TRACKED_EVIDENCE_ADAPTERS; index += 1) {
    record(service, candidateRun([], `ADAPTER-${String(index).padStart(3, "0")}`));
  }
  assert.equal(service.getPipelineHealth().adapters.length, 100);
  assert.throws(
    () => record(service, candidateRun([], "ADAPTER-100")),
    (error: unknown) =>
      error instanceof EvidenceObservabilityError
      && error.code === "ADAPTER_LIMIT_EXCEEDED",
  );
  const updated = record(service, candidateRun(["DUPLICATE"], "ADAPTER-000"));
  assert.equal(updated.totalRuns, 2);
  assert.equal(service.getPipelineHealth().adapters.length, 100);
});

test("pipeline snapshots are sorted and call the injected clock once", () => {
  let clockCalls = 0;
  const service = new EvidenceObservabilityService({
    clock: {
      now: () => {
        clockCalls += 1;
        return T2;
      },
    },
  });
  record(service, candidateRun([], "Z-ADAPTER"));
  record(service, candidateRun([], "A-ADAPTER"));
  const pipeline = service.getPipelineHealth();
  assert.equal(clockCalls, 1);
  assert.equal(pipeline.generatedAt.toISOString(), T2.toISOString());
  assert.deepEqual(
    pipeline.adapters.map(({ adapterId }) => adapterId),
    ["A-ADAPTER", "Z-ADAPTER"],
  );
});

test("returned snapshots and dates cannot mutate internal state", () => {
  const service = new EvidenceObservabilityService({
    clock: { now: () => T2 },
  });
  const returned = record(service, candidateRun(["CREATED"]));
  returned.totalRuns = 999;
  returned.lastRunAt?.setUTCFullYear(2030);
  returned.lastSuccessAt?.setUTCFullYear(2030);
  const stored = service.getAdapterHealth(ADAPTER);
  assert.equal(stored?.totalRuns, 1);
  assert.equal(stored?.lastRunAt?.toISOString(), T1.toISOString());
  assert.equal(stored?.lastSuccessAt?.toISOString(), T1.toISOString());

  const pipeline = service.getPipelineHealth();
  pipeline.generatedAt.setUTCFullYear(2030);
  pipeline.adapters.splice(0);
  assert.equal(service.getPipelineHealth().adapters.length, 1);
});

test("public snapshots retain no payload, candidate, exception, stack, or credential fields", () => {
  const service = new EvidenceObservabilityService();
  const snapshot = record(service, candidateRun(["CREATED", "FAILED"]));
  const serialized = JSON.stringify(snapshot).toLowerCase();
  for (const prohibited of [
    "payload", "candidatevalue", "exception", "stack", "credential",
    "apikey", "accesstoken", "evidencedocument", "results",
  ]) {
    assert.equal(serialized.includes(prohibited), false);
  }
});

test("fixed ordered run sequences produce deterministic snapshots", () => {
  const execute = () => {
    const service = new EvidenceObservabilityService({
      clock: { now: () => T2 },
    });
    record(service, candidateRun(["CREATED"]), T0, T1);
    record(service, failedRun(), T1, T2);
    return service.getPipelineHealth();
  };
  assert.deepEqual(execute(), execute());
});
