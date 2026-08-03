import assert from "node:assert/strict";
import test from "node:test";

import { StaticEvidenceSourceAuthorityRegistry } from "../../../src/registries/evidence-source-authority.registry.js";
import { factorRegistry } from "../../../src/registries/factor.registry.js";
import { EvidenceFactorCompatibilityService } from "../../../src/services/evidence-factor-compatibility.service.js";
import { EvidenceIngestionService } from "../../../src/services/evidence-ingestion.service.js";
import { EvidenceReadService } from "../../../src/services/evidence-read.service.js";
import { EvidenceSourceResolutionService } from "../../../src/services/evidence-source-resolution.service.js";
import { FactorInputAssemblyService } from "../../../src/services/factor-input-assembly.service.js";
import type { EvidenceCandidate } from "../../../src/types/evidence-ingestion.types.js";
import type { CreateEvidenceInput } from "../../../src/types/evidence.types.js";

const OBSERVED_AT = new Date("2026-08-01T20:00:00.000Z");
const AS_OF = new Date("2026-08-02T20:00:00.000Z");
const candidate = (numberValue = 420_000_000, overrides: Record<string, unknown> = {}): EvidenceCandidate => ({
  recordType: "OBSERVATION",
  factorKey: "CRYPTO.ETF_NET_FLOW",
  subject: { type: "ASSET", key: "BTC" },
  provenance: {
    sourceType: "MARKET_DATA",
    provider: "MOCK_BTC_ETF_FLOW",
    sourceName: "MOCK_BTC_ETF_FLOW_DAILY_V1",
    sourcePublishedAt: new Date("2026-08-01T21:00:00.000Z"),
  },
  value: { type: "NUMBER", numberValue, unit: "USD" },
  observedAt: OBSERVED_AT,
  schemaVersion: "1.0",
  ...overrides,
} as EvidenceCandidate);

const harness = () => {
  const records: CreateEvidenceInput[] = [];
  const repository = {
    create: async (input: CreateEvidenceInput) => { records.push(structuredClone(input)); return structuredClone(input) as never; },
    findByEvidenceId: async (id: string) => structuredClone(records.find((item) => item.evidenceId === id) ?? null) as never,
    findByDeduplicationKey: async (key: string) => structuredClone(records.find((item) => item.deduplicationKey === key) ?? null) as never,
    findHistory: async (params: any) => records.filter((item) => item.factorKey === params.factorKey && item.subject.type === params.subjectType && item.subject.key === params.subjectKey && item.observedAt <= params.observedAtLte).slice(0, params.limit).map((item) => structuredClone(item)) as never,
    countHistory: async (params: any) => records.filter((item) => item.factorKey === params.factorKey && item.subject.type === params.subjectType && item.subject.key === params.subjectKey && item.observedAt <= params.observedAtLte).length,
    findRelationshipsTargeting: async () => [],
    countRelationshipsTargeting: async () => 0,
  };
  const ingestion = new EvidenceIngestionService({ repository: repository as never, createEvidenceId: () => `ev_etf_${records.length + 1}` });
  const read = new EvidenceReadService({ repository: repository as never });
  const compatibility = new EvidenceFactorCompatibilityService({ factorRegistry });
  const authority = new StaticEvidenceSourceAuthorityRegistry([{ factorKey: "CRYPTO.ETF_NET_FLOW", sourceType: "MARKET_DATA", provider: "MOCK_BTC_ETF_FLOW", priority: 100 }]);
  const sourceResolution = new EvidenceSourceResolutionService({ compatibilityService: compatibility, factorRegistry, sourceAuthorityRegistry: authority });
  const assembly = new FactorInputAssemblyService({ evidenceReadService: read, sourceResolutionService: sourceResolution, factorRegistry });
  return { records, ingestion, read, compatibility, sourceResolution, assembly };
};

test("canonical ASSET/BTC ETF flow accepts positive, negative, and zero mocked Evidence", async () => {
  for (const value of [420_000_000, -180_000_000, 0]) {
    const env = harness();
    const result = await env.ingestion.ingest(candidate(value));
    assert.equal(result.status, "CREATED");
    assert.equal(env.records[0]?.subject.type, "ASSET");
    assert.equal((env.records[0] as any).value.numberValue, value);
  }
});

test("canonical ingestion preserves deterministic deduplication for mocked ETF flow", async () => {
  const env = harness();
  const first = await env.ingestion.ingest(candidate());
  const second = await env.ingestion.ingest(candidate());
  assert.equal(first.status, "CREATED");
  assert.equal(second.status, "DUPLICATE");
  if (first.status === "CREATED" && second.status === "DUPLICATE") {
    assert.equal(second.evidenceId, first.evidenceId);
    assert.equal(second.deduplicationKey, first.deduplicationKey);
  }
  assert.equal(env.records.length, 1);
});

test("ETF flow compatibility enforces factor, ASSET subject, USD, and inclusive freshness", async () => {
  const env = harness();
  await env.ingestion.ingest(candidate());
  const evidence = env.records[0]!;
  assert.equal(env.compatibility.evaluate({ evidence, asOf: AS_OF }).compatible, true);
  const stale = env.compatibility.evaluate({ evidence, asOf: new Date(AS_OF.getTime() + 1) });
  assert.equal(stale.compatible, false);
  if (!stale.compatible) assert.equal(stale.code, "STALE_EVIDENCE");
  for (const invalid of [
    candidate(1, { factorKey: "MARKET.PRICE" }),
    candidate(1, { subject: { type: "INSTRUMENT", key: "BTC" } }),
    candidate(1, { value: { type: "NUMBER", numberValue: 1, unit: "USDT" } }),
    candidate(1, { value: { type: "BOOLEAN", booleanValue: true } }),
  ]) {
    const normalized = { ...invalid, evidenceId: "invalid", deduplicationKey: "invalid" };
    assert.equal(env.compatibility.evaluate({ evidence: normalized, asOf: AS_OF }).compatible, false);
  }
});

test("lifecycle read, deterministic source resolution, and generic factor assembly succeed", async () => {
  const env = harness();
  const created = await env.ingestion.ingest(candidate());
  assert.equal(created.status, "CREATED");
  const read = await env.read.read({ factorKey: "CRYPTO.ETF_NET_FLOW", subjectType: "ASSET", subjectKey: "BTC", asOf: AS_OF });
  assert.equal(read.complete, true);
  assert.equal(read.activeObservations.length, 1);
  const resolution = env.sourceResolution.resolve({ factorKey: "CRYPTO.ETF_NET_FLOW", subject: { type: "ASSET", key: "BTC" }, observations: read.activeObservations, completeness: { complete: true, baseTruncated: false, relationshipTruncated: false }, asOf: AS_OF });
  assert.equal(resolution.resolved, true);
  const assembled = await env.assembly.assemble({ factorKey: "CRYPTO.ETF_NET_FLOW", subject: { type: "ASSET", key: "BTC" }, asOf: AS_OF });
  assert.equal(assembled.assembled, true);
  if (assembled.assembled) {
    assert.deepEqual(assembled.input, {
      factorKey: "CRYPTO.ETF_NET_FLOW", factorDefinitionVersion: 1,
      subject: { type: "ASSET", key: "BTC" }, evidenceId: "ev_etf_1",
      value: { type: "NUMBER", value: 420_000_000, unit: "USD" },
      source: { sourceType: "MARKET_DATA", provider: "MOCK_BTC_ETF_FLOW", sourceId: "MOCK_BTC_ETF_FLOW_DAILY_V1", priority: 100 },
      observedAt: OBSERVED_AT, evaluatedAt: AS_OF, confidence: null,
      freshness: { status: "FRESH", ageMs: 86_400_000, maxAgeMs: 86_400_000 },
    });
    assert(Object.isFrozen(assembled)); assert(Object.isFrozen(assembled.input)); assert(Object.isFrozen(assembled.input.subject));
  }
});

test("MARKET.PRICE remains registered and INSTRUMENT/BTCUSDT remains valid", () => {
  assert.equal(factorRegistry.validateCompatibility({ factorKey: "MARKET.PRICE", valueType: "NUMBER", subjectType: "INSTRUMENT", unit: "USDT" }).valid, true);
});
