import assert from "node:assert/strict";
import test from "node:test";

import {
  EvidenceDeduplicationKeyBuilder,
} from "../../../src/services/evidence-deduplication-key.service.js";
import type { EvidenceCandidate } from "../../../src/types/evidence-ingestion.types.js";

const candidate = (): EvidenceCandidate => ({
  recordType: "OBSERVATION",
  factorKey: "GLOBAL.DXY",
  subject: { type: "ECONOMY", key: "MACRO:DXY" },
  provenance: { sourceType: "MACRO_DATA", provider: "provider" },
  value: { type: "NUMBER", numberValue: 104.25, unit: "INDEX" },
  observedAt: new Date("2026-07-29T10:00:00.000Z"),
  schemaVersion: "1.0",
});

test("builds a versioned SHA-256 key deterministically", () => {
  const builder = new EvidenceDeduplicationKeyBuilder();
  const first = builder.build(candidate());
  const second = builder.build(candidate());
  assert.equal(first, second);
  assert.match(first, /^evidence:v1:[a-f0-9]{64}$/);
});

test("canonical object-key order does not change identity", () => {
  const builder = new EvidenceDeduplicationKeyBuilder();
  const first = candidate();
  if (first.recordType !== "OBSERVATION") assert.fail("expected observation candidate");
  const reordered = {
    schemaVersion: first.schemaVersion,
    observedAt: first.observedAt,
    value: first.value,
    provenance: first.provenance,
    subject: first.subject,
    factorKey: first.factorKey,
    recordType: first.recordType,
  } as EvidenceCandidate;
  assert.equal(builder.build(first), builder.build(reordered));
});

test("changes to normalized identity change the key", () => {
  const builder = new EvidenceDeduplicationKeyBuilder();
  const changed = { ...candidate(), observedAt: new Date("2026-07-29T10:00:01.000Z") };
  assert.notEqual(builder.build(candidate()), builder.build(changed));
});
