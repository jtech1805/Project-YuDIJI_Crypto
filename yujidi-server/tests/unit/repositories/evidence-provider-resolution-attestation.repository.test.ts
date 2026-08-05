import assert from "node:assert/strict";
import test from "node:test";

import { evidenceProviderResolutionAttestationSchema } from "../../../src/models/evidence-provider-resolution-attestation.model.js";
import {
  EvidenceProviderResolutionAttestationRepository,
  type EvidenceProviderResolutionAttestationModelPort,
} from "../../../src/repositories/evidence-provider-resolution-attestation.repository.js";

const CREATED_AT = new Date("2026-08-04T10:00:01.000Z");
const candidate = (change: Record<string, unknown> = {}) => ({
  attestationId: "ATTESTATION_100",
  attestationVersion: 1,
  evidenceId: "evidence-100",
  providerBinding: { providerBindingId: "PB_MARKET_PRICE", providerBindingVersion: 1 },
  resolutionPolicy: { policyId: "RP_MARKET_PRICE", policyVersion: 1 },
  selectedProviderKey: "BINANCE_PUBLIC_MARKET_PRICE_V1",
  selectedProviderType: "DIRECT" as const,
  resolutionStatus: "DEGRADED_PRIMARY_USED" as const,
  confidenceAdjustment: -0.1,
  warningCodes: ["PREFERRED_PROVIDER_DEGRADED", "DEGRADED_PROVIDER_SELECTED"] as const,
  resolvedAt: new Date("2026-08-04T10:00:00.000Z"),
  ...change,
});
const persisted = (value = candidate(), createdAt = CREATED_AT) => ({ ...structuredClone(value), createdAt: new Date(createdAt) });

const harness = (initial: any[] = [], createFailure: unknown = null) => {
  const rows = initial.map((value) => structuredClone(value));
  const calls: any[] = [];
  const matches = (row: any, filter: Record<string, unknown>) => Object.entries(filter).every(([path, expected]) => path.split(".").reduce((value, key) => value?.[key], row) === expected);
  const model: EvidenceProviderResolutionAttestationModelPort = {
    create: async (value: any) => {
      calls.push(["create", structuredClone(value)]);
      if (createFailure) throw createFailure;
      const row = { ...structuredClone(value), createdAt: new Date(CREATED_AT) };
      rows.push(row);
      return structuredClone(row);
    },
    find: (filter) => ({ limit: (limit) => ({ lean: () => ({ exec: async () => structuredClone(rows.filter((row) => matches(row, filter)).slice(0, limit)) }) }) }),
  };
  return { calls, rows, repository: new EvidenceProviderResolutionAttestationRepository(model) };
};

test("inserts one persisted attestation with persistence-controlled createdAt", async () => {
  const h = harness();
  const input = candidate();
  const before = structuredClone(input);
  const result = await h.repository.insert(input);
  assert(result.inserted);
  assert.equal(result.code, "INSERTED");
  assert.deepEqual(input, before);
  assert.equal(result.attestation.createdAt.toISOString(), CREATED_AT.toISOString());
  assert.equal((h.calls[0][1] as any).createdAt, undefined);
  input.warningCodes = [] as never;
  input.resolvedAt.setUTCFullYear(2030);
  assert.equal(h.rows[0].warningCodes.length, 2);
  assert.equal(h.rows[0].resolvedAt.getUTCFullYear(), 2026);
});

test("exact duplicate is idempotent and creates no second record", async () => {
  const h = harness([persisted()]);
  const first = await h.repository.insert(candidate());
  const second = await h.repository.insert(candidate());
  assert.equal(first.code, "ALREADY_EXISTS");
  assert.deepEqual(second, first);
  assert.equal(h.rows.length, 1);
  assert.equal(h.calls.length, 0);
});

test("Evidence and attestation identity conflicts fail closed without replacement", async () => {
  const original = persisted();
  for (const conflicting of [
    candidate({ attestationId: "ATTESTATION_OTHER", resolutionStatus: "RESOLVED", confidenceAdjustment: 0, warningCodes: [] }),
    candidate({ evidenceId: "evidence-other", resolutionStatus: "FALLBACK_USED", confidenceAdjustment: -0.2, warningCodes: ["FALLBACK_PROVIDER_SELECTED"] }),
  ]) {
    const h = harness([original]);
    assert.deepEqual(await h.repository.insert(conflicting as any), { inserted: false, code: "CONFLICT" });
    assert.deepEqual(h.rows, [original]);
  }
});

test("duplicate-key races deterministically reclassify exact and conflicting records", async () => {
  for (const [row, code] of [
    [persisted(), "ALREADY_EXISTS"],
    [persisted(candidate({ resolutionStatus: "RESOLVED", confidenceAdjustment: 0, warningCodes: [] })), "CONFLICT"],
  ] as const) {
    const h = harness([row], { code: 11000 });
    let searches = 0;
    const original = (h.repository as any).findMatches.bind(h.repository);
    (h.repository as any).findMatches = async (...args: any[]) => ++searches <= 2 ? [] : original(...args);
    assert.equal((await h.repository.insert(candidate())).code, code);
  }
});

test("exact Evidence lookup is detached, deeply frozen, deterministic, and clones Dates", async () => {
  const stored = persisted();
  const h = harness([stored]);
  const first = await h.repository.findExactByEvidenceId("evidence-100");
  const second = await h.repository.findExactByEvidenceId("evidence-100");
  assert(first.found && second.found);
  assert.deepEqual(first, second);
  assert.notEqual(first.attestation, stored);
  assert.notEqual(first.attestation.resolvedAt, stored.resolvedAt);
  assert.notEqual(first.attestation.createdAt, stored.createdAt);
  assert(Object.isFrozen(first.attestation));
  assert(Object.isFrozen(first.attestation.warningCodes));
  assert(Object.isFrozen(first.attestation.providerBinding));
});

test("missing, corrupted duplicate, malformed storage, and persistence failure fail typed", async () => {
  assert.deepEqual(await harness().repository.findExactByEvidenceId("missing"), { found: false, code: "NOT_FOUND" });
  assert.deepEqual(await harness([persisted(), persisted(candidate({ attestationId: "OTHER" }))]).repository.findExactByEvidenceId("evidence-100"), { found: false, code: "INVARIANT_VIOLATION" });
  assert.deepEqual(await harness([{ evidenceId: "evidence-100" }]).repository.findExactByEvidenceId("evidence-100"), { found: false, code: "PERSISTENCE_ERROR" });
  const failing: EvidenceProviderResolutionAttestationModelPort = {
    create: async () => { throw new Error("secret"); },
    find: () => ({ limit: () => ({ lean: () => ({ exec: async () => { throw new Error("secret"); } }) }) }),
  };
  const repository = new EvidenceProviderResolutionAttestationRepository(failing);
  assert.deepEqual(await repository.findExactByEvidenceId("evidence-100"), { found: false, code: "PERSISTENCE_ERROR" });
  assert.deepEqual(await repository.insert(candidate()), { inserted: false, code: "PERSISTENCE_ERROR" });
});

test("model enforces unique Evidence and exact attestation identities without mutable timestamps", () => {
  const unique = evidenceProviderResolutionAttestationSchema.indexes().filter(([, options]) => options.unique).map(([fields]) => fields);
  assert.deepEqual(unique, [
    { attestationId: 1, attestationVersion: 1 },
    { evidenceId: 1 },
  ]);
  assert(evidenceProviderResolutionAttestationSchema.path("createdAt"));
  assert.equal(evidenceProviderResolutionAttestationSchema.path("updatedAt"), undefined);
  for (const path of ["compiledOutcome", "active", "supersededAt", "healthAssessments", "rulebookId"]) assert.equal(evidenceProviderResolutionAttestationSchema.path(path), undefined);
});

test("repository exposes no mutation, list, recency, or latest methods", () => {
  const repository: any = harness().repository;
  for (const method of ["update", "updateOne", "delete", "deleteOne", "replace", "upsert", "list", "getLatest", "findLatest", "findMostRecent"]) assert.equal(repository[method], undefined);
});
