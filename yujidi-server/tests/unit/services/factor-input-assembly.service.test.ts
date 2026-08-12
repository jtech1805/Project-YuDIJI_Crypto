import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { FactorInputAssemblyService } from "../../../src/services/scoring/factor-input-assembly.service.js";
import type { EvidenceReadResult } from "../../../src/types/evidence-read.types.js";
import type { EvidenceReadRecord } from "../../../src/types/evidence-lifecycle.types.js";
import type { CreateEvidenceObservationInput } from "../../../src/types/evidence.types.js";
import type { EvidenceSourceResolutionResult } from "../../../src/types/evidence-source-resolution.types.js";

const AS_OF = new Date("2026-07-30T14:00:10.000Z");
const OBSERVED_AT = new Date("2026-07-30T14:00:09.000Z");

type ObservationReadRecord = CreateEvidenceObservationInput & Readonly<{ createdAt: Date }>;
const observation = (
  overrides: Partial<ObservationReadRecord> = {},
): ObservationReadRecord => ({
  evidenceId: "E-1",
  recordType: "OBSERVATION",
  factorKey: "MARKET.PRICE",
  deduplicationKey: "PRIVATE",
  subject: { type: "INSTRUMENT", key: "BTCUSDT" },
  provenance: {
    sourceType: "MARKET_DATA",
    provider: "BINANCE",
    sourceName: "BINANCE_PUBLIC_MARKET_PRICE_V1",
  },
  value: { type: "NUMBER", numberValue: 65000.123456, unit: "USDT" },
  observedAt: OBSERVED_AT,
  createdAt: new Date("2026-07-30T14:00:09.500Z"),
  confidence: 0.75,
  schemaVersion: "1.0",
  ...overrides,
});

const readResult = (
  activeObservations: ObservationReadRecord[] = [observation()],
  overrides: Partial<EvidenceReadResult> = {},
): EvidenceReadResult => ({
  query: {
    factorKey: "MARKET.PRICE",
    subjectType: "INSTRUMENT",
    subjectKey: "BTCUSDT",
    asOf: AS_OF,
    limit: 1000,
  },
  history: [...activeObservations],
  activeObservations,
  resolutions: [],
  diagnostics: [],
  historyCount: activeObservations.length,
  relationshipCount: 0,
  baseTruncated: false,
  relationshipTruncated: false,
  truncated: false,
  complete: true,
  ...overrides,
});

const selectedResult = (
  overrides: Partial<Extract<EvidenceSourceResolutionResult, { resolved: true }>> = {},
): Extract<EvidenceSourceResolutionResult, { resolved: true }> => ({
  resolved: true,
  factorKey: "MARKET.PRICE",
  subject: { type: "INSTRUMENT", key: "BTCUSDT" },
  asOf: AS_OF,
  factorDefinitionVersion: 1,
  selectedEvidenceId: "E-1",
  selectedSource: {
    sourceType: "MARKET_DATA",
    provider: "BINANCE",
    sourceId: "BINANCE_PUBLIC_MARKET_PRICE_V1",
    priority: 100,
  },
  selectedObservedAt: OBSERVED_AT,
  selectedConfidence: 0.75,
  trace: [{
    evidenceId: "E-1",
    factorKey: "MARKET.PRICE",
    subjectType: "INSTRUMENT",
    subjectKey: "BTCUSDT",
    sourceType: "MARKET_DATA",
    provider: "BINANCE",
    sourceId: "BINANCE_PUBLIC_MARKET_PRICE_V1",
    observedAt: OBSERVED_AT,
    confidence: 0.75,
    compatibility: {
      compatible: true,
      factorDefinitionVersion: 1,
      freshnessStatus: "FRESH",
    },
    sourcePriority: 100,
    disposition: "SELECTED",
  }],
  ...overrides,
});

const request = (overrides: Record<string, unknown> = {}) => ({
  factorKey: "MARKET.PRICE",
  subject: { type: "INSTRUMENT", key: "BTCUSDT" },
  asOf: AS_OF,
  ...overrides,
});

const harness = (params: {
  read?: EvidenceReadResult;
  resolution?: EvidenceSourceResolutionResult;
  readError?: Error;
  definition?: { factorKey: "MARKET.PRICE"; version: number; freshness: { kind: "MAX_AGE"; maxAgeMs: number } } | null;
} = {}) => {
  const readCalls: unknown[] = [];
  const resolveCalls: unknown[] = [];
  const registryCalls: unknown[] = [];
  const service = new FactorInputAssemblyService({
    evidenceReadService: {
      read: async (query) => {
        readCalls.push(query);
        if (params.readError) throw params.readError;
        return params.read ?? readResult();
      },
    },
    sourceResolutionService: {
      resolve: (input) => {
        resolveCalls.push(input);
        return params.resolution ?? selectedResult();
      },
    },
    factorRegistry: {
      get: (factorKey) => {
        registryCalls.push(factorKey);
        return (params.definition === undefined
          ? {
              factorKey: "MARKET.PRICE",
              version: 1,
              displayName: "Market Price",
              description: "Price",
              status: "ACTIVE",
              valueTypes: ["NUMBER"],
              subjectTypes: ["INSTRUMENT"],
              unit: { policy: "REQUIRED" },
              freshness: { kind: "MAX_AGE", maxAgeMs: 10_000 },
              scoringEligibility: "ELIGIBLE",
            }
          : params.definition) as never;
      },
    },
  });
  return { service, readCalls, resolveCalls, registryCalls };
};

test("rejects invalid requests without calling dependencies", async () => {
  for (const invalid of [
    null,
    undefined,
    {},
    { ...request(), factorKey: " MARKET.PRICE" },
    { ...request(), subject: null },
    { ...request(), subject: { type: "INSTRUMENT", key: "" } },
    { ...request(), allowDeprecatedFactor: "true" },
  ]) {
    const testHarness = harness();
    const result = await testHarness.service.assemble(invalid as never);
    assert.equal(result.assembled, false);
    if (!result.assembled) assert.equal(result.code, "INVALID_REQUEST");
    assert.deepEqual([
      testHarness.registryCalls.length,
      testHarness.readCalls.length,
      testHarness.resolveCalls.length,
    ], [0, 0, 0]);
  }
});

test("rejects invalid asOf runtime values without calling dependencies", async () => {
  for (const asOf of [new Date("invalid"), "2026-07-30", 1]) {
    const testHarness = harness();
    const result = await testHarness.service.assemble(request({ asOf }) as never);
    assert.equal(result.assembled, false);
    if (!result.assembled) {
      assert.equal(result.code, "INVALID_AS_OF");
      assert.equal(result.evaluatedAt, null);
    }
    assert.deepEqual([
      testHarness.registryCalls.length,
      testHarness.readCalls.length,
      testHarness.resolveCalls.length,
    ], [0, 0, 0]);
  }
});

test("unsupported factors fail before Evidence reads", async () => {
  const testHarness = harness({ definition: null });
  const result = await testHarness.service.assemble(request({ factorKey: "OTHER" }));
  assert.equal(result.assembled, false);
  if (!result.assembled) assert.equal(result.code, "UNSUPPORTED_FACTOR");
  assert.equal(testHarness.readCalls.length, 0);
});

test("reads once with the exact maximum-bounded Phase 1D query", async () => {
  const testHarness = harness();
  await testHarness.service.assemble(request({ allowDeprecatedFactor: true }));
  assert.deepEqual(testHarness.readCalls, [{
    factorKey: "MARKET.PRICE",
    subjectType: "INSTRUMENT",
    subjectKey: "BTCUSDT",
    asOf: AS_OF,
    limit: 1000,
  }]);
});

test("maps unexpected read failures safely without resolving", async () => {
  const testHarness = harness({ readError: new Error("database secret") });
  const result = await testHarness.service.assemble(request());
  assert.equal(result.assembled, false);
  if (!result.assembled) {
    assert.equal(result.code, "EVIDENCE_READ_FAILED");
    assert.doesNotMatch(JSON.stringify(result), /database secret/);
  }
  assert.equal(testHarness.resolveCalls.length, 0);
});

test("all incomplete or truncated reads fail before source resolution", async () => {
  for (const overrides of [
    { complete: false },
    { baseTruncated: true },
    { relationshipTruncated: true },
  ]) {
    const testHarness = harness({ read: readResult([], overrides) });
    const result = await testHarness.service.assemble(request());
    assert.equal(result.assembled, false);
    if (!result.assembled) assert.equal(result.code, "INCOMPLETE_EVIDENCE_HISTORY");
    assert.equal(testHarness.resolveCalls.length, 0);
  }
});

test("delegates complete active observations and exact metadata once", async () => {
  const active = [observation()];
  const testHarness = harness({ read: readResult(active) });
  await testHarness.service.assemble(request({ allowDeprecatedFactor: true }));
  assert.equal(testHarness.resolveCalls.length, 1);
  assert.deepEqual(testHarness.resolveCalls[0], {
    factorKey: "MARKET.PRICE",
    subject: { type: "INSTRUMENT", key: "BTCUSDT" },
    observations: active,
    completeness: {
      complete: true,
      baseTruncated: false,
      relationshipTruncated: false,
    },
    asOf: AS_OF,
    allowDeprecatedFactor: true,
  });
});

test("maps resolver no-selection codes deterministically", async () => {
  const mappings = [
    ["INCOMPLETE_EVIDENCE_HISTORY", "INCOMPLETE_EVIDENCE_HISTORY"],
    ["UNSUPPORTED_FACTOR", "UNSUPPORTED_FACTOR"],
    ["NO_COMPATIBLE_EVIDENCE", "NO_COMPATIBLE_EVIDENCE"],
    ["UNRESOLVED_CONFLICT", "SOURCE_RESOLUTION_FAILED"],
  ] as const;
  for (const [sourceCode, expected] of mappings) {
    const testHarness = harness({
      read: readResult([]),
      resolution: {
        resolved: false,
        factorKey: "MARKET.PRICE",
        subject: { type: "INSTRUMENT", key: "BTCUSDT" },
        asOf: AS_OF,
        code: sourceCode,
        trace: [],
      },
    });
    const result = await testHarness.service.assemble(request());
    assert.equal(result.assembled, false);
    if (!result.assembled) {
      assert.equal(result.code, expected);
      assert.equal(result.sourceResolutionCode, sourceCode);
    }
  }
});

test("fails closed when selected Evidence is absent or duplicated", async () => {
  const absent = harness({ read: readResult([]) });
  const absentResult = await absent.service.assemble(request());
  assert.equal(absentResult.assembled, false);
  if (!absentResult.assembled) assert.equal(absentResult.code, "SELECTED_EVIDENCE_NOT_FOUND");

  const same = observation();
  const duplicate = harness({ read: readResult([same, structuredClone(same)]) });
  const duplicateResult = await duplicate.service.assemble(request());
  assert.equal(duplicateResult.assembled, false);
  if (!duplicateResult.assembled) assert.equal(duplicateResult.code, "INVALID_SELECTED_EVIDENCE");
});

test("rejects mismatched, revoked, or malformed selected Evidence", async () => {
  const invalidSelected = [
    observation({ factorKey: "OTHER" }),
    observation({ subject: { type: "INSTRUMENT", key: "ETHUSDT" } }),
    { ...observation(), recordType: "REVOCATION", value: undefined },
    observation({ observedAt: new Date("invalid") }),
    observation({ confidence: 2 }),
    observation({ value: { type: "NUMBER", numberValue: Number.NaN, unit: "USDT" } }),
    observation({ value: { type: "NUMBER", numberValue: 1 } }),
  ];
  for (const selected of invalidSelected) {
    const testHarness = harness({
      read: readResult([selected as ObservationReadRecord]),
    });
    const result = await testHarness.service.assemble(request());
    assert.equal(result.assembled, false);
    if (!result.assembled) assert.equal(result.code, "INVALID_SELECTED_EVIDENCE");
  }
});

test("rejects a known unsupported selected value discriminator", async () => {
  const selected = observation({
    value: { type: "BOOLEAN", booleanValue: true },
  });
  const result = await harness({ read: readResult([selected]) }).service.assemble(request());
  assert.equal(result.assembled, false);
  if (!result.assembled) assert.equal(result.code, "UNSUPPORTED_VALUE_TYPE");
});

test("assembles exact safe number, source, freshness and aggregate metadata", async () => {
  const result = await harness().service.assemble(request());
  assert.equal(result.assembled, true);
  if (!result.assembled) return;
  assert.deepEqual(result, {
    assembled: true,
    input: {
      factorKey: "MARKET.PRICE",
      factorDefinitionVersion: 1,
      subject: { type: "INSTRUMENT", key: "BTCUSDT" },
      evidenceId: "E-1",
      value: { type: "NUMBER", value: 65000.123456, unit: "USDT" },
      source: {
        sourceType: "MARKET_DATA",
        provider: "BINANCE",
        sourceId: "BINANCE_PUBLIC_MARKET_PRICE_V1",
        priority: 100,
      },
      observedAt: OBSERVED_AT,
      evaluatedAt: AS_OF,
      confidence: 0.75,
      freshness: { status: "FRESH", ageMs: 1000, maxAgeMs: 10_000 },
    },
    resolution: {
      selectedEvidenceId: "E-1",
      candidateCount: 1,
      compatibleCandidateCount: 1,
      incompatibleCandidateCount: 0,
    },
  });
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /PRIVATE|deduplicationKey|recordType|schemaVersion|trace/);
});

test("preserves absent confidence as null and rejects version inconsistency", async () => {
  const noConfidence = observation();
  delete noConfidence.confidence;
  const result = await harness({
    read: readResult([noConfidence]),
    resolution: selectedResult({ selectedConfidence: null }),
  }).service.assemble(request());
  assert.equal(result.assembled && result.input.confidence, null);

  const mismatch = await harness({
    resolution: selectedResult({ factorDefinitionVersion: 2 }),
  }).service.assemble(request());
  assert.equal(mismatch.assembled, false);
  if (!mismatch.assembled) assert.equal(mismatch.code, "SOURCE_RESOLUTION_FAILED");
});

test("validates resolution counts before returning success", async () => {
  const invalidTrace = selectedResult({
    trace: [{
      ...selectedResult().trace[0]!,
      compatibility: { compatible: false, code: "STALE_EVIDENCE" },
      disposition: "SELECTED",
    }],
  });
  const result = await harness({ resolution: invalidTrace }).service.assemble(request());
  assert.equal(result.assembled, false);
  if (!result.assembled) assert.equal(result.code, "SOURCE_RESOLUTION_FAILED");
});

test("does not mutate frozen inputs and returned dates cannot affect later results", async () => {
  const selected = observation();
  Object.freeze(selected.subject);
  Object.freeze(selected.provenance);
  Object.freeze(selected.value);
  Object.freeze(selected);
  const active = Object.freeze([selected]) as unknown as ObservationReadRecord[];
  const frozenRead = readResult(active);
  Object.freeze(frozenRead);
  const fixedResolution = selectedResult();
  Object.freeze(fixedResolution.trace);
  Object.freeze(fixedResolution);
  const testHarness = harness({ read: frozenRead, resolution: fixedResolution });
  const first = await testHarness.service.assemble(Object.freeze(request()) as never);
  assert.equal(first.assembled, true);
  if (!first.assembled) return;
  assert.throws(() => ((first.input.value as { value: number }).value = 1));
  first.input.observedAt.setUTCFullYear(2030);
  first.input.evaluatedAt.setUTCFullYear(2030);
  const second = await testHarness.service.assemble(request());
  assert.equal(second.assembled, true);
  if (second.assembled) {
    assert.equal(second.input.observedAt.toISOString(), OBSERVED_AT.toISOString());
    assert.equal(second.input.evaluatedAt.toISOString(), AS_OF.toISOString());
  }
});

test("fixed logical dependency results are deterministic", async () => {
  const testHarness = harness();
  assert.deepEqual(
    await testHarness.service.assemble(request()),
    await testHarness.service.assemble(request()),
  );
});

test("assembler has no repository, lifecycle, provider, clock, evaluator, scoring, or runtime imports", () => {
  const source = readFileSync(
    new URL("../../../src/services/scoring/factor-input-assembly.service.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /repositories|lifecycle-resolver|provider-runner|adapters|clock\.port|scoring|evaluator|controllers|schedulers|llm/i,
  );
  assert.doesNotMatch(source, /Date\.now|new Date\s*\(/);
});
