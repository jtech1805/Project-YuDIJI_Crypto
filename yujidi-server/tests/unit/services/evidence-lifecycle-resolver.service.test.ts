import assert from "node:assert/strict";
import test from "node:test";

import { EvidenceLifecycleResolverService } from "../../../src/services/evidence-lifecycle-resolver.service.js";
import type { EvidenceLifecycleInputRecord } from "../../../src/types/evidence-lifecycle.types.js";
import type {
  CreateEvidenceObservationInput,
  CreateEvidenceRevocationInput,
} from "../../../src/types/evidence.types.js";

const T0 = new Date("2026-07-29T10:00:00.000Z");
const T1 = new Date("2026-07-29T11:00:00.000Z");
const T2 = new Date("2026-07-29T12:00:00.000Z");
const T3 = new Date("2026-07-29T13:00:00.000Z");

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
  value: { type: "NUMBER", numberValue: 104.25 },
  observedAt: T0,
  schemaVersion: "1.0",
  ...overrides,
});

const revocation = (
  evidenceId: string,
  target: string,
  overrides: Partial<CreateEvidenceRevocationInput> = {},
): CreateEvidenceRevocationInput => ({
  evidenceId,
  recordType: "REVOCATION",
  factorKey: "GLOBAL.DXY",
  deduplicationKey: `dedup-${evidenceId}`,
  subject: { type: "ECONOMY", key: "MACRO:DXY" },
  provenance: { sourceType: "MANUAL", provider: "operator" },
  observedAt: T1,
  revokesEvidenceId: target,
  reasonCode: "SOURCE_CORRECTION",
  schemaVersion: "1.0",
  ...overrides,
});

const stateMap = (records: readonly EvidenceLifecycleInputRecord[], asOf = T3) => {
  const resolver = new EvidenceLifecycleResolverService();
  return Object.fromEntries(
    resolver.resolveAll({ evidence: records, asOf }).resolutions
      .map((resolution) => [resolution.evidenceId, resolution.state]),
  );
};

test("resolves an unrestricted observation as ACTIVE", () => {
  assert.deepEqual(stateMap([observation("A")]), { A: "ACTIVE" });
});

test("evaluates inclusive lower and upper validity boundaries", () => {
  const record = observation("A", { validFrom: T1, validUntil: T2 });
  assert.equal(stateMap([record], T0).A, "NOT_YET_VALID");
  assert.equal(stateMap([record], T1).A, "ACTIVE");
  assert.equal(stateMap([record], T2).A, "ACTIVE");
  assert.equal(stateMap([record], T3).A, "EXPIRED");
});

test("applies revocation only at or before asOf and selects the deterministic first", () => {
  const resolver = new EvidenceLifecycleResolverService();
  const target = observation("A");
  const laterId = revocation("R-Z", "A", { observedAt: T1 });
  const earlierId = revocation("R-A", "A", { observedAt: T1 });

  assert.equal(
    resolver.resolveOne({
      evidence: target,
      allEvidence: [target, laterId, earlierId],
      asOf: T0,
    }).state,
    "ACTIVE",
  );
  assert.deepEqual(
    resolver.resolveOne({
      evidence: target,
      allEvidence: [laterId, target, earlierId],
      asOf: T1,
    }),
    {
      evidenceId: "A",
      state: "REVOKED",
      revokedByEvidenceId: "R-A",
      diagnostics: [],
    },
  );
});

test("applies supersession only at or before asOf and selects the deterministic first", () => {
  const resolver = new EvidenceLifecycleResolverService();
  const target = observation("A");
  const supersederZ = observation("Z", { observedAt: T1, supersedesEvidenceId: "A" });
  const supersederB = observation("B", { observedAt: T1, supersedesEvidenceId: "A" });

  assert.equal(
    resolver.resolveOne({
      evidence: target,
      allEvidence: [target, supersederZ, supersederB],
      asOf: T0,
    }).state,
    "ACTIVE",
  );
  assert.equal(
    resolver.resolveOne({
      evidence: target,
      allEvidence: [supersederZ, target, supersederB],
      asOf: T1,
    }).supersededByEvidenceId,
    "B",
  );
});

test("enforces revocation over supersession and supersession over expiry", () => {
  const expired = observation("A", {
    validUntil: T0,
  });
  const replacement = observation("B", {
    observedAt: T1,
    supersedesEvidenceId: "A",
  });
  const revoke = revocation("R", "A", { observedAt: T2 });
  const resolver = new EvidenceLifecycleResolverService();

  assert.equal(
    resolver.resolveOne({
      evidence: expired,
      allEvidence: [expired, replacement],
      asOf: T1,
    }).state,
    "SUPERSEDED",
  );
  assert.equal(
    resolver.resolveOne({
      evidence: expired,
      allEvidence: [expired, replacement, revoke],
      asOf: T3,
    }).state,
    "REVOKED",
  );
});

test("resolves transitive supersession independently", () => {
  const records = [
    observation("A"),
    observation("B", { observedAt: T1, supersedesEvidenceId: "A" }),
    observation("C", { observedAt: T2, supersedesEvidenceId: "B" }),
  ];
  assert.deepEqual(stateMap(records), {
    A: "SUPERSEDED",
    B: "SUPERSEDED",
    C: "ACTIVE",
  });
});

test("does not reactivate an older observation when its replacement is revoked", () => {
  const records = [
    observation("A"),
    observation("B", { observedAt: T1, supersedesEvidenceId: "A" }),
    revocation("R", "B", { observedAt: T2 }),
  ];
  assert.deepEqual(stateMap(records), {
    A: "SUPERSEDED",
    B: "REVOKED",
  });
});

test("tolerates and diagnoses missing relationship targets", () => {
  const resolver = new EvidenceLifecycleResolverService();
  const result = resolver.resolveAll({
    evidence: [
      observation("A", { supersedesEvidenceId: "MISSING-A" }),
      revocation("R", "MISSING-R"),
    ],
    asOf: T3,
  });
  assert.deepEqual(result.diagnostics, [
    {
      code: "MISSING_REVOCATION_TARGET",
      evidenceId: "R",
      relatedEvidenceId: "MISSING-R",
    },
    {
      code: "MISSING_SUPERSEDES_TARGET",
      evidenceId: "A",
      relatedEvidenceId: "MISSING-A",
    },
  ]);
  assert.deepEqual(stateMap([
    observation("A", { supersedesEvidenceId: "MISSING-A" }),
    revocation("R", "MISSING-R"),
  ]), { A: "ACTIVE" });
});

test("diagnoses and ignores self-supersession and self-revocation", () => {
  const resolver = new EvidenceLifecycleResolverService();
  const result = resolver.resolveAll({
    evidence: [
      observation("A", { supersedesEvidenceId: "A" }),
      revocation("R", "R"),
    ],
    asOf: T3,
  });
  assert.deepEqual(result.resolutions.map(({ evidenceId, state }) => ({ evidenceId, state })), [
    { evidenceId: "A", state: "ACTIVE" },
  ]);
  assert.deepEqual(result.diagnostics.map(({ code }) => code), [
    "SELF_REVOCATION",
    "SELF_SUPERSESSION",
  ]);
});

test("diagnoses every record in a two-record cycle and ignores cycle edges", () => {
  const records = [
    observation("A", { supersedesEvidenceId: "B" }),
    observation("B", { supersedesEvidenceId: "A" }),
  ];
  const result = new EvidenceLifecycleResolverService()
    .resolveAll({ evidence: records, asOf: T3 });
  assert.deepEqual(stateMap(records), { A: "ACTIVE", B: "ACTIVE" });
  assert.deepEqual(
    result.diagnostics.map(({ code, evidenceId }) => ({ code, evidenceId })),
    [
      { code: "SUPERSESSION_CYCLE", evidenceId: "A" },
      { code: "SUPERSESSION_CYCLE", evidenceId: "B" },
    ],
  );
});

test("diagnoses every record in a three-record cycle without recursion", () => {
  const records = [
    observation("A", { supersedesEvidenceId: "B" }),
    observation("B", { supersedesEvidenceId: "C" }),
    observation("C", { supersedesEvidenceId: "A" }),
  ];
  const result = new EvidenceLifecycleResolverService()
    .resolveAll({ evidence: records, asOf: T3 });
  assert.deepEqual(stateMap(records), { A: "ACTIVE", B: "ACTIVE", C: "ACTIVE" });
  assert.deepEqual(
    result.diagnostics.map(({ evidenceId }) => evidenceId),
    ["A", "B", "C"],
  );
});

test("diagnoses duplicate IDs, uses the first record, and does not throw", () => {
  const resolver = new EvidenceLifecycleResolverService();
  const result = resolver.resolveAll({
    evidence: [
      observation("A", { validUntil: T3 }),
      observation("A", { validFrom: new Date("2030-01-01T00:00:00.000Z") }),
    ],
    asOf: T3,
  });
  assert.deepEqual(result.resolutions.map(({ evidenceId, state }) => ({ evidenceId, state })), [
    { evidenceId: "A", state: "ACTIVE" },
  ]);
  assert.deepEqual(result.diagnostics, [
    { code: "DUPLICATE_EVIDENCE_ID", evidenceId: "A" },
  ]);
});

test("excludes revocations from resolutions and active observations", () => {
  const target = observation("A");
  const revoke = revocation("R", "A");
  const result = new EvidenceLifecycleResolverService()
    .resolveAll({ evidence: [target, revoke], asOf: T3 });
  assert.deepEqual(result.resolutions.map(({ evidenceId }) => evidenceId), ["A"]);
  assert.deepEqual(result.activeObservations, []);
});

test("returns deterministic ordering for permuted logical input", () => {
  const records = [
    observation("C", { observedAt: T2 }),
    observation("A", { observedAt: T0 }),
    observation("B", { observedAt: T1 }),
    revocation("R-Z", "MISSING"),
  ];
  const resolver = new EvidenceLifecycleResolverService();
  const first = resolver.resolveAll({ evidence: records, asOf: T3 });
  const second = resolver.resolveAll({ evidence: [...records].reverse(), asOf: T3 });
  assert.deepEqual(first, second);
  assert.deepEqual(first.resolutions.map(({ evidenceId }) => evidenceId), ["A", "B", "C"]);
  assert.deepEqual(first.activeObservations.map(({ evidenceId }) => evidenceId), ["A", "B", "C"]);
});

test("does not mutate arrays, records, or nested Evidence values", () => {
  const records: EvidenceLifecycleInputRecord[] = [
    observation("B", { observedAt: T1 }),
    observation("A", { observedAt: T0 }),
  ];
  const before = structuredClone(records);
  new EvidenceLifecycleResolverService().resolveAll({ evidence: records, asOf: T3 });
  assert.deepEqual(records, before);
});

test("rejects invalid asOf and structurally invalid records", () => {
  const resolver = new EvidenceLifecycleResolverService();
  assert.throws(
    () => resolver.resolveAll({ evidence: [observation("A")], asOf: new Date("invalid") }),
    TypeError,
  );
  assert.throws(
    () => resolver.resolveAll({
      evidence: [{ ...observation("A"), observedAt: "invalid" } as never],
      asOf: T3,
    }),
    TypeError,
  );
});
