import assert from "node:assert/strict";
import test from "node:test";

import {
  EvidenceCandidateNormalizer,
  EvidenceCandidateValidationError,
} from "../../../src/services/evidence/evidence-candidate-normalizer.service.js";
import type { EvidenceCandidate } from "../../../src/types/evidence-ingestion.types.js";

const normalizer = new EvidenceCandidateNormalizer();

const observation = (): EvidenceCandidate => ({
  recordType: "OBSERVATION",
  factorKey: "GLOBAL.DXY",
  subject: { type: "ECONOMY", key: "MACRO:DXY" },
  provenance: { sourceType: "MACRO_DATA", provider: "normalized-provider" },
  value: { type: "NUMBER", numberValue: 104.25, unit: "INDEX" },
  observedAt: new Date("2026-07-29T10:00:00.000Z"),
  confidence: 0,
  schemaVersion: "1.0",
});

test("normalizes by validating and cloning a valid observation", () => {
  const input = observation();
  const result = normalizer.normalize(input);
  assert.deepEqual(result, input);
  assert.notEqual(result, input);
  assert.notEqual(result.subject, input.subject);
});

test("accepts boolean false and a valid revocation", () => {
  const booleanCandidate = {
    ...observation(),
    value: { type: "BOOLEAN", booleanValue: false },
  };
  assert.deepEqual(normalizer.normalize(booleanCandidate), booleanCandidate);

  const revocation: EvidenceCandidate = {
    recordType: "REVOCATION",
    factorKey: "GLOBAL.DXY",
    subject: { type: "ECONOMY", key: "MACRO:DXY" },
    provenance: { sourceType: "MANUAL", provider: "operator" },
    observedAt: new Date("2026-07-29T11:00:00.000Z"),
    revokesEvidenceId: "evidence-001",
    reasonCode: "SOURCE_CORRECTION",
    schemaVersion: "1.0",
  };
  assert.deepEqual(normalizer.normalize(revocation), revocation);
});

test("rejects malformed values, mixed shapes, unknown fields, and invalid intervals", () => {
  const invalidCandidates: unknown[] = [
    { ...observation(), observedAt: "2026-07-29T10:00:00.000Z" },
    { ...observation(), factorKey: " GLOBAL.DXY" },
    { ...observation(), value: { type: "NUMBER", numberValue: Number.NaN } },
    { ...observation(), value: { type: "BOOLEAN", booleanValue: "false" } },
    { ...observation(), value: { type: "NUMBER", numberValue: 1, booleanValue: true } },
    { ...observation(), confidence: 1.01 },
    { ...observation(), rawPayload: { secret: true } },
    {
      ...observation(),
      validFrom: new Date("2026-07-29T12:00:00.000Z"),
      validUntil: new Date("2026-07-29T11:00:00.000Z"),
    },
    {
      recordType: "REVOCATION",
      factorKey: "GLOBAL.DXY",
      subject: { type: "ECONOMY", key: "MACRO:DXY" },
      provenance: { sourceType: "MANUAL", provider: "operator" },
      observedAt: new Date(),
      schemaVersion: "1.0",
      revokesEvidenceId: "evidence-001",
    },
  ];

  for (const candidate of invalidCandidates) {
    assert.throws(
      () => normalizer.normalize(candidate),
      EvidenceCandidateValidationError,
    );
  }
});

test("does not silently coerce strings, dates, numbers, or booleans", () => {
  assert.throws(
    () => normalizer.normalize({
      ...observation(),
      value: { type: "NUMBER", numberValue: "104.25" },
    }),
    EvidenceCandidateValidationError,
  );
  assert.throws(
    () => normalizer.normalize({
      ...observation(),
      value: { type: "BOOLEAN", booleanValue: 0 },
    }),
    EvidenceCandidateValidationError,
  );
});
