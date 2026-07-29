import assert from "node:assert/strict";
import test from "node:test";

import type { EvidenceDocument } from "../../../src/models/evidence.model.js";
import {
  EvidenceRepository,
  type EvidenceModelContract,
} from "../../../src/repositories/evidence.repository.js";
import type { CreateEvidenceInput } from "../../../src/types/evidence.types.js";

const observation = (): CreateEvidenceInput => ({
  evidenceId: "evidence-001",
  recordType: "OBSERVATION",
  factorKey: "GLOBAL.DXY",
  deduplicationKey: "dedup-001",
  subject: { type: "ECONOMY", key: "MACRO:DXY" },
  provenance: { sourceType: "MACRO_DATA", provider: "test-provider" },
  value: { type: "NUMBER", numberValue: 104.25, unit: "INDEX" },
  observedAt: new Date("2026-07-29T10:00:00.000Z"),
  schemaVersion: "1.0",
});

const revocation = (): CreateEvidenceInput => ({
  evidenceId: "evidence-revoke-001",
  recordType: "REVOCATION",
  factorKey: "GLOBAL.DXY",
  deduplicationKey: "dedup-revoke-001",
  subject: { type: "ECONOMY", key: "MACRO:DXY" },
  provenance: { sourceType: "MANUAL", provider: "internal-operator" },
  observedAt: new Date("2026-07-29T11:00:00.000Z"),
  revokesEvidenceId: "evidence-001",
  reasonCode: "SOURCE_CORRECTION",
  schemaVersion: "1.0",
});

const fakeDocument = { evidenceId: "persisted" } as unknown as EvidenceDocument;

const harness = () => {
  const creates: CreateEvidenceInput[] = [];
  const filters: Record<string, unknown>[] = [];
  const model: EvidenceModelContract = {
    create: async (input) => {
      creates.push(input);
      return fakeDocument;
    },
    findOne: (filter) => {
      filters.push(filter);
      return { exec: async () => fakeDocument };
    },
  };
  return { creates, filters, repository: new EvidenceRepository(model) };
};

test("create passes observation and revocation union shapes unchanged", async () => {
  const testHarness = harness();
  const observationInput = observation();
  const revocationInput = revocation();

  assert.equal(await testHarness.repository.create(observationInput), fakeDocument);
  assert.equal(await testHarness.repository.create(revocationInput), fakeDocument);
  assert.equal(testHarness.creates[0], observationInput);
  assert.equal(testHarness.creates[1], revocationInput);
});

test("find methods query only approved identifiers", async () => {
  const testHarness = harness();
  await testHarness.repository.findByEvidenceId("evidence-001");
  await testHarness.repository.findByDeduplicationKey("dedup-001");
  assert.deepEqual(testHarness.filters, [
    { evidenceId: "evidence-001" },
    { deduplicationKey: "dedup-001" },
  ]);
});

test("repository propagates model errors unchanged", async () => {
  const duplicateError = new Error("duplicate key");
  const repository = new EvidenceRepository({
    create: async () => {
      throw duplicateError;
    },
    findOne: () => ({ exec: async () => null }),
  });
  await assert.rejects(repository.create(observation()), (error) => error === duplicateError);
});

test("repository does not mutate caller input", async () => {
  const testHarness = harness();
  const input = observation();
  const before = structuredClone(input);
  await testHarness.repository.create(input);
  assert.deepEqual(input, before);
});

test("repository exposes no update, delete, replace, or upsert API", () => {
  const repository = new EvidenceRepository({
    create: async () => fakeDocument,
    findOne: () => ({ exec: async () => null }),
  }) as unknown as Record<string, unknown>;
  for (const method of [
    "update",
    "updateOne",
    "findOneAndUpdate",
    "replace",
    "delete",
    "deleteOne",
    "remove",
    "upsert",
    "bulkWrite",
    "markRevoked",
    "markSuperseded",
  ]) {
    assert.equal(repository[method], undefined);
  }
});
