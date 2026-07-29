import assert from "node:assert/strict";
import test from "node:test";

import type { EvidenceRepositoryContract } from "../../../src/repositories/evidence.repository.js";
import { EvidenceReadService } from "../../../src/services/evidence-read.service.js";
import type { EvidenceLifecycleResolverService } from "../../../src/services/evidence-lifecycle-resolver.service.js";
import type { EvidenceReadRecord } from "../../../src/types/evidence-lifecycle.types.js";
import {
  EvidenceReadQueryError,
  MAX_EVIDENCE_RELATIONSHIP_LIMIT,
  type EvidenceHistoryQuery,
} from "../../../src/types/evidence-read.types.js";
import type { CreateEvidenceObservationInput } from "../../../src/types/evidence.types.js";

const AS_OF = new Date("2026-07-29T12:00:00.000Z");
const query = (overrides: Partial<EvidenceHistoryQuery> = {}): EvidenceHistoryQuery => ({
  factorKey: "GLOBAL.DXY",
  subjectType: "ECONOMY",
  subjectKey: "MACRO:DXY",
  asOf: AS_OF,
  ...overrides,
});

const observation = (
  evidenceId: string,
  overrides: Partial<CreateEvidenceObservationInput> = {},
): CreateEvidenceObservationInput => ({
  evidenceId,
  recordType: "OBSERVATION",
  factorKey: "GLOBAL.DXY",
  deduplicationKey: `dedup-${evidenceId}`,
  subject: { type: "ECONOMY", key: "MACRO:DXY" },
  provenance: { sourceType: "MACRO_DATA", provider: "provider" },
  value: { type: "NUMBER", numberValue: 1 },
  observedAt: new Date("2026-07-29T10:00:00.000Z"),
  schemaVersion: "1.0",
  ...overrides,
});

const harness = (params: {
  base?: EvidenceReadRecord[];
  relationships?: EvidenceReadRecord[];
  historyCount?: number;
  relationshipCount?: number;
  resolver?: Pick<EvidenceLifecycleResolverService, "resolveAll">;
  repositoryError?: Error;
} = {}) => {
  const calls: Record<string, unknown>[] = [];
  const base = params.base ?? [];
  const relationships = params.relationships ?? [];
  const repository = {
    findHistory: async (input: Record<string, unknown>) => {
      if (params.repositoryError) throw params.repositoryError;
      calls.push({ method: "findHistory", input });
      return base;
    },
    countHistory: async (input: Record<string, unknown>) => {
      calls.push({ method: "countHistory", input });
      return params.historyCount ?? base.length;
    },
    findRelationshipsTargeting: async (input: Record<string, unknown>) => {
      calls.push({ method: "findRelationshipsTargeting", input });
      return relationships;
    },
    countRelationshipsTargeting: async (input: Record<string, unknown>) => {
      calls.push({ method: "countRelationshipsTargeting", input });
      return params.relationshipCount ?? relationships.length;
    },
  } as Required<Pick<
    EvidenceRepositoryContract,
    "findHistory" | "countHistory" | "findRelationshipsTargeting"
    | "countRelationshipsTargeting"
  >>;
  return {
    calls,
    service: new EvidenceReadService({
      repository,
      ...(params.resolver ? { resolver: params.resolver } : {}),
    }),
  };
};

test("empty history returns a complete deterministic empty result", async () => {
  const result = await harness().service.read(query());
  assert.deepEqual(result, {
    query: { ...query(), limit: 200 },
    history: [],
    activeObservations: [],
    resolutions: [],
    diagnostics: [],
    historyCount: 0,
    relationshipCount: 0,
    baseTruncated: false,
    relationshipTruncated: false,
    truncated: false,
    complete: true,
  });
});

test("returns one active base observation and passes both bounded limits", async () => {
  const A = observation("A");
  const { calls, service } = harness({ base: [A] });
  const result = await service.read(query());
  assert.deepEqual(result.activeObservations.map((record) => record.evidenceId), ["A"]);
  assert.equal(result.resolutions[0]?.state, "ACTIVE");
  assert.equal(result.historyCount, 1);
  assert.equal(result.complete, true);
  const baseInput = calls[0]?.input as Record<string, unknown>;
  const relationshipInput = calls[2]?.input as Record<string, unknown>;
  assert.equal(baseInput.limit, 200);
  assert.equal(relationshipInput.limit, MAX_EVIDENCE_RELATIONSHIP_LIMIT);
  assert.equal(relationshipInput.observedAtLte, AS_OF);
});

test("resolves base supersession and external revocation relationships", async () => {
  const A = observation("A");
  const B = observation("B", {
    observedAt: new Date("2026-07-29T11:00:00.000Z"),
    supersedesEvidenceId: "A",
  });
  const superseded = await harness({ base: [B, A] }).service.read(query());
  assert.deepEqual(
    superseded.resolutions.map(({ evidenceId, state }) => ({ evidenceId, state })),
    [{ evidenceId: "A", state: "SUPERSEDED" }, { evidenceId: "B", state: "ACTIVE" }],
  );

  const R: EvidenceReadRecord = {
    evidenceId: "R",
    recordType: "REVOCATION",
    factorKey: "MANUAL",
    deduplicationKey: "dedup-R",
    subject: { type: "ECONOMY", key: "OTHER" },
    provenance: { sourceType: "MANUAL", provider: "operator" },
    observedAt: new Date("2026-07-29T11:00:00.000Z"),
    revokesEvidenceId: "A",
    reasonCode: "CORRECTION",
    schemaVersion: "1.0",
  };
  const revoked = await harness({ base: [A], relationships: [R] }).service.read(query());
  assert.equal(revoked.resolutions[0]?.state, "REVOKED");
  assert.deepEqual(revoked.activeObservations, []);
});

test("external superseder participates in resolution but cannot escape query scope", async () => {
  const A = observation("A");
  const X = observation("X", {
    factorKey: "OTHER.FACTOR",
    subject: { type: "MARKET", key: "OTHER" },
    observedAt: new Date("2026-07-29T11:00:00.000Z"),
    supersedesEvidenceId: "A",
  });
  const result = await harness({ base: [A], relationships: [X] }).service.read(query());
  assert.deepEqual(result.history.map((record) => record.evidenceId), ["A", "X"]);
  assert.equal(result.resolutions[0]?.state, "SUPERSEDED");
  assert.deepEqual(result.activeObservations, []);
  assert.equal(result.resolutions.some(({ evidenceId }) => evidenceId === "X"), false);
});

test("base or relationship truncation fails closed", async () => {
  const A = observation("A");
  for (const config of [
    { base: [A], historyCount: 2 },
    { base: [A], relationships: [], relationshipCount: 1 },
  ]) {
    const result = await harness(config).service.read(query());
    assert.equal(result.complete, false);
    assert.equal(result.truncated, true);
    assert.deepEqual(result.activeObservations, []);
    assert.deepEqual(result.resolutions, []);
  }
});

test("exact limits are complete when counts equal returned lengths", async () => {
  const base = Array.from({ length: 200 }, (_, index) =>
    observation(`E-${String(index).padStart(3, "0")}`));
  const result = await harness({ base, historyCount: 200 }).service.read(query());
  assert.equal(result.baseTruncated, false);
  assert.equal(result.complete, true);
});

test("accepts maximum limit and rejects invalid limits without coercion", async () => {
  const maximum = harness();
  await maximum.service.read(query({ limit: 1000 }));
  const maximumInput = maximum.calls[0]?.input as Record<string, unknown>;
  assert.equal(maximumInput.limit, 1000);

  for (const limit of [0, -1, 1001, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    await assert.rejects(
      harness().service.read(query({ limit })),
      (error: unknown) =>
        error instanceof EvidenceReadQueryError && error.code === "INVALID_LIMIT",
    );
  }
});

test("strictly rejects invalid strings, subject types, and dates", async () => {
  const invalidQueries: EvidenceHistoryQuery[] = [
    query({ factorKey: " GLOBAL.DXY" }),
    query({ factorKey: "GLOBAL.DXY " }),
    query({ factorKey: "" }),
    query({ subjectKey: " MACRO:DXY" }),
    query({ subjectType: "UNKNOWN" as never }),
    query({ asOf: new Date("invalid") }),
    query({ asOf: "2026-07-29" as never }),
  ];
  for (const invalidQuery of invalidQueries) {
    await assert.rejects(harness().service.read(invalidQuery), EvidenceReadQueryError);
  }
});

test("propagates repository and resolver failures unchanged", async () => {
  const repositoryError = new Error("database failed");
  const base = harness({ repositoryError });
  await assert.rejects(base.service.read(query()), (error) => error === repositoryError);

  const resolverError = new Error("resolver contract failed");
  const withResolver = harness({
    base: [observation("A")],
    resolver: { resolveAll: () => { throw resolverError; } },
  });
  await assert.rejects(withResolver.service.read(query()), (error) => error === resolverError);
});

test("deduplicates deterministically without mutating repository arrays", async () => {
  const A = observation("A");
  const B = observation("B", { observedAt: new Date("2026-07-29T09:00:00.000Z") });
  const base = [A, B];
  const relationships = [structuredClone(A)];
  const beforeBase = structuredClone(base);
  const beforeRelationships = structuredClone(relationships);
  const result = await harness({ base, relationships }).service.read(query());
  assert.deepEqual(result.history.map((record) => record.evidenceId), ["B", "A"]);
  assert.deepEqual(base, beforeBase);
  assert.deepEqual(relationships, beforeRelationships);
});
