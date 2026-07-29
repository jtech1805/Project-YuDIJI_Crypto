import assert from "node:assert/strict";
import test from "node:test";

import type { EvidenceDocument } from "../../../src/models/evidence.model.js";
import type { EvidenceProviderAdapter } from "../../../src/ports/evidence-provider-adapter.port.js";
import type { EvidenceRepositoryContract } from "../../../src/repositories/evidence.repository.js";
import { EvidenceIngestionService } from "../../../src/services/evidence-ingestion.service.js";
import type { EvidenceCandidate } from "../../../src/types/evidence-ingestion.types.js";
import type { CreateEvidenceInput } from "../../../src/types/evidence.types.js";

const candidate = (): EvidenceCandidate => ({
  recordType: "OBSERVATION",
  factorKey: "GLOBAL.DXY",
  subject: { type: "ECONOMY", key: "MACRO:DXY" },
  provenance: { sourceType: "MACRO_DATA", provider: "provider" },
  value: { type: "NUMBER", numberValue: 104.25 },
  observedAt: new Date("2026-07-29T10:00:00.000Z"),
  schemaVersion: "1.0",
});

const document = (evidenceId: string): EvidenceDocument =>
  ({ evidenceId }) as unknown as EvidenceDocument;

const harness = (overrides: Partial<EvidenceRepositoryContract> = {}) => {
  const creates: CreateEvidenceInput[] = [];
  const repository: EvidenceRepositoryContract = {
    create: async (input) => {
      creates.push(input);
      return document(input.evidenceId);
    },
    findByEvidenceId: async () => null,
    findByDeduplicationKey: async () => null,
    ...overrides,
  };
  const service = new EvidenceIngestionService({
    repository,
    createEvidenceId: () => "generated-evidence-id",
  });
  return { creates, repository, service };
};

test("normalizes, hashes, and creates one append-only Evidence record", async () => {
  const input = candidate();
  const before = structuredClone(input);
  const { creates, service } = harness();
  const result = await service.ingest(input);

  assert.equal(result.status, "CREATED");
  if (result.status !== "CREATED") assert.fail("expected CREATED result");
  assert.equal(result.evidenceId, "generated-evidence-id");
  assert.match(result.deduplicationKey, /^evidence:v1:[a-f0-9]{64}$/);
  assert.equal(creates.length, 1);
  assert.deepEqual(creates[0], {
    ...input,
    evidenceId: "generated-evidence-id",
    deduplicationKey: result.deduplicationKey,
  });
  assert.deepEqual(input, before);
});

test("returns DUPLICATE without creating when canonical identity exists", async () => {
  let createCalled = false;
  const { service } = harness({
    findByDeduplicationKey: async () => document("existing-evidence-id"),
    create: async () => {
      createCalled = true;
      return document("unexpected");
    },
  });
  const result = await service.ingest(candidate());
  if (result.status !== "DUPLICATE") assert.fail("expected DUPLICATE result");
  assert.deepEqual(result, {
    status: "DUPLICATE",
    evidenceId: "existing-evidence-id",
    deduplicationKey: result.deduplicationKey,
  });
  assert.equal(createCalled, false);
});

test("maps only a relevant deduplication unique-index race to DUPLICATE", async () => {
  let finds = 0;
  const { service } = harness({
    findByDeduplicationKey: async () => {
      finds += 1;
      return finds === 1 ? null : document("race-winner");
    },
    create: async () => {
      throw Object.assign(new Error("duplicate"), {
        code: 11000,
        keyPattern: { deduplicationKey: 1 },
      });
    },
  });
  assert.equal((await service.ingest(candidate())).status, "DUPLICATE");
});

test("does not misclassify evidenceId or unstructured duplicate errors", async () => {
  for (const error of [
    Object.assign(new Error("duplicate"), {
      code: 11000,
      keyPattern: { evidenceId: 1 },
    }),
    Object.assign(new Error("deduplicationKey duplicate"), { code: 11000 }),
  ]) {
    const { service } = harness({
      create: async () => {
        throw error;
      },
    });
    const result = await service.ingest(candidate());
    if (result.status !== "FAILED") assert.fail("expected FAILED result");
    assert.deepEqual(result, {
      status: "FAILED",
      code: "PERSISTENCE_FAILED",
      deduplicationKey: result.deduplicationKey,
    });
  }
});

test("rejects malformed candidates before repository access", async () => {
  let repositoryCalled = false;
  const { service } = harness({
    findByDeduplicationKey: async () => {
      repositoryCalled = true;
      return null;
    },
  });
  assert.deepEqual(
    await service.ingest({ ...candidate(), observedAt: "not-a-date" }),
    { status: "REJECTED", code: "INVALID_CANDIDATE" },
  );
  assert.equal(repositoryCalled, false);
});

test("ingests generic adapter candidates and isolates adapter failure", async () => {
  const { service } = harness();
  const adapter: EvidenceProviderAdapter = {
    adapterId: "generic-test",
    readCandidates: async () => [candidate(), candidate()],
  };
  const results = await service.ingestFrom(adapter);
  assert.deepEqual(results.map((result) => result.status), ["CREATED", "CREATED"]);

  const failedAdapter: EvidenceProviderAdapter = {
    adapterId: "failed-test",
    readCandidates: async () => {
      throw new Error("provider secret must not escape");
    },
  };
  assert.deepEqual(await service.ingestFrom(failedAdapter), [
    { status: "FAILED", code: "ADAPTER_FAILED" },
  ]);
});
