import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { StaticEvidenceSourceAuthorityRegistry } from "../../../src/registries/evidence-source-authority.registry.js";
import { factorRegistry } from "../../../src/registries/factor.registry.js";
import { EvidenceFactorCompatibilityService } from "../../../src/services/evidence-factor-compatibility.service.js";
import { EvidenceSourceResolutionService } from "../../../src/services/evidence-source-resolution.service.js";
import type { EvidenceSourceResolutionRequest } from "../../../src/types/evidence-source-resolution.types.js";

const AS_OF = new Date("2026-07-30T14:00:10.000Z");
const observed = (offsetMs: number) =>
  new Date(AS_OF.getTime() - offsetMs);

const candidate = (overrides: Record<string, unknown> = {}) => ({
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
  value: { type: "NUMBER", numberValue: 100, unit: "USDT" },
  observedAt: observed(1_000),
  confidence: 0.8,
  schemaVersion: "1.0",
  ...overrides,
});
const candidateWithoutConfidence = (overrides: Record<string, unknown> = {}) => {
  const result = candidate(overrides);
  delete (result as { confidence?: unknown }).confidence;
  return result;
};

const request = (
  observations: readonly unknown[],
  overrides: Partial<EvidenceSourceResolutionRequest> = {},
): EvidenceSourceResolutionRequest => ({
  factorKey: "MARKET.PRICE",
  subject: { type: "INSTRUMENT", key: "BTCUSDT" },
  observations,
  completeness: {
    complete: true,
    baseTruncated: false,
    relationshipTruncated: false,
  },
  asOf: AS_OF,
  ...overrides,
});

const resolverWith = (
  rules = [{
    factorKey: "MARKET.PRICE" as const,
    sourceType: "MARKET_DATA",
    provider: "BINANCE",
    priority: 100,
  }],
) => new EvidenceSourceResolutionService({
  compatibilityService: new EvidenceFactorCompatibilityService({ factorRegistry }),
  factorRegistry,
  sourceAuthorityRegistry: new StaticEvidenceSourceAuthorityRegistry(rules),
});
const unmatchedRules = [{
  factorKey: "MARKET.PRICE" as const,
  sourceType: "MARKET_DATA",
  provider: "CONFIGURED_NOT_PRESENT",
  priority: 100,
}];

test("complete empty input returns deterministic no-selection", () => {
  assert.deepEqual(resolverWith().resolve(request([])), {
    resolved: false,
    factorKey: "MARKET.PRICE",
    subject: { type: "INSTRUMENT", key: "BTCUSDT" },
    asOf: AS_OF,
    code: "NO_COMPATIBLE_EVIDENCE",
    trace: [],
  });
});

test("incomplete and oversized input fail before compatibility", () => {
  let calls = 0;
  const resolver = new EvidenceSourceResolutionService({
    factorRegistry,
    sourceAuthorityRegistry: new StaticEvidenceSourceAuthorityRegistry(unmatchedRules),
    compatibilityService: { evaluate: () => {
      calls += 1;
      throw new Error("must not run");
    } },
  });
  for (const completeness of [
    { complete: false, baseTruncated: false, relationshipTruncated: false },
    { complete: true, baseTruncated: true, relationshipTruncated: false },
    { complete: true, baseTruncated: false, relationshipTruncated: true },
  ]) {
    const result = resolver.resolve(request([candidate()], { completeness }));
    assert.equal(result.resolved, false);
    if (!result.resolved) assert.equal(result.code, "INCOMPLETE_EVIDENCE_HISTORY");
  }
  const tooMany = resolver.resolve(request(
    Array.from({ length: 101 }, (_, index) => candidate({ evidenceId: `E-${index}` })),
  ));
  assert.equal(tooMany.resolved, false);
  if (!tooMany.resolved) assert.equal(tooMany.code, "TOO_MANY_CANDIDATES");
  assert.equal(calls, 0);
});

test("accepts exactly 100 candidates and evaluates each once", () => {
  let calls = 0;
  const compatibility = new EvidenceFactorCompatibilityService({ factorRegistry });
  const resolver = new EvidenceSourceResolutionService({
    factorRegistry,
    sourceAuthorityRegistry: new StaticEvidenceSourceAuthorityRegistry(unmatchedRules),
    compatibilityService: { evaluate: (params) => {
      calls += 1;
      return compatibility.evaluate(params);
    } },
  });
  const result = resolver.resolve(request(
    Array.from({ length: 100 }, (_, index) =>
      candidate({ evidenceId: `E-${String(index).padStart(3, "0")}` })),
  ));
  assert.equal(result.resolved, true);
  assert.equal(calls, 100);
});

test("rejects invalid requests, invalid time, unsupported factor, mixed sets and duplicates", () => {
  const resolver = resolverWith();
  for (const invalid of [
    null,
    {},
    { ...request([]), factorKey: " MARKET.PRICE" },
    { ...request([]), subject: null },
    { ...request([]), observations: new Set() },
    { ...request([]), completeness: { complete: true } },
    { ...request([]), allowDeprecatedFactor: "true" },
  ]) {
    const result = resolver.resolve(invalid as EvidenceSourceResolutionRequest);
    assert.equal(result.resolved, false);
    if (!result.resolved) assert.equal(result.code, "INVALID_REQUEST");
  }
  const invalidTime = resolver.resolve(request([], { asOf: new Date("invalid") }));
  assert.equal(invalidTime.resolved, false);
  if (!invalidTime.resolved) assert.equal(invalidTime.code, "INVALID_AS_OF");
  const unsupported = resolver.resolve(request([], { factorKey: "OTHER" }));
  assert.equal(unsupported.resolved, false);
  if (!unsupported.resolved) assert.equal(unsupported.code, "UNSUPPORTED_FACTOR");
  const mixedFactor = resolver.resolve(request([
    candidate(), candidate({ evidenceId: "E-2", factorKey: "OTHER" }),
  ]));
  assert.equal(mixedFactor.resolved, false);
  if (!mixedFactor.resolved) assert.equal(mixedFactor.code, "MIXED_FACTOR_KEYS");
  const mixedSubject = resolver.resolve(request([
    candidate(), candidate({
      evidenceId: "E-2",
      subject: { type: "INSTRUMENT", key: "ETHUSDT" },
    }),
  ]));
  assert.equal(mixedSubject.resolved, false);
  if (!mixedSubject.resolved) assert.equal(mixedSubject.code, "MIXED_SUBJECTS");
  const duplicate = resolver.resolve(request([candidate(), candidate()]));
  assert.equal(duplicate.resolved, false);
  if (!duplicate.resolved) assert.equal(duplicate.code, "INVALID_REQUEST");
});

test("selects one compatible candidate and retains incompatible trace safely", () => {
  const result = resolverWith().resolve(request([
    candidate(),
    candidate({ evidenceId: "STALE", observedAt: observed(10_001) }),
  ]));
  assert.equal(result.resolved, true);
  if (!result.resolved) return;
  assert.equal(result.selectedEvidenceId, "E-1");
  assert.deepEqual(result.trace.map((item) => item.disposition), [
    "SELECTED", "INCOMPATIBLE",
  ]);
  assert.doesNotMatch(JSON.stringify(result), /numberValue|PRIVATE|deduplicationKey/);
});

test("no compatible candidates returns safe deterministic trace", () => {
  const result = resolverWith().resolve(request([
    candidate({ evidenceId: "B", observedAt: observed(20_000) }),
    candidate({ evidenceId: "A", observedAt: observed(20_000) }),
  ]));
  assert.equal(result.resolved, false);
  if (!result.resolved) {
    assert.equal(result.code, "NO_COMPATIBLE_EVIDENCE");
    assert.deepEqual(result.trace.map((item) => item.evidenceId), ["A", "B"]);
  }
});

test("configured authority outranks newer higher-confidence unknown source", () => {
  const result = resolverWith().resolve(request([
    candidate({ confidence: 0.1, observedAt: observed(9_000) }),
    candidate({
      evidenceId: "UNKNOWN",
      confidence: 1,
      observedAt: observed(0),
      provenance: { sourceType: "MARKET_DATA", provider: "UNKNOWN" },
    }),
  ]));
  assert.equal(result.resolved, true);
  if (result.resolved) {
    assert.equal(result.selectedEvidenceId, "E-1");
    assert.equal(result.trace[1]?.disposition, "LOWER_SOURCE_PRIORITY");
  }
});

test("ranks priority, recency, confidence, and lexical identities in order", () => {
  const rules = [
    { factorKey: "MARKET.PRICE" as const, sourceType: "MARKET_DATA", provider: "A", priority: 10 },
    { factorKey: "MARKET.PRICE" as const, sourceType: "MARKET_DATA", provider: "B", priority: 20 },
  ];
  const priority = resolverWith(rules).resolve(request([
    candidate({ evidenceId: "A", provenance: { sourceType: "MARKET_DATA", provider: "A" } }),
    candidate({ evidenceId: "B", confidence: 1, provenance: { sourceType: "MARKET_DATA", provider: "B" } }),
  ]));
  assert.equal(priority.resolved && priority.selectedEvidenceId, "A");

  const sameAuthority = resolverWith(unmatchedRules).resolve(request([
    candidate({ evidenceId: "OLD", observedAt: observed(2_000), confidence: 1, provenance: { sourceType: "MARKET_DATA", provider: "Z" } }),
    candidate({ evidenceId: "NEW", observedAt: observed(1_000), confidence: 0, provenance: { sourceType: "MARKET_DATA", provider: "Z" } }),
  ]));
  assert.equal(sameAuthority.resolved && sameAuthority.selectedEvidenceId, "NEW");
  if (sameAuthority.resolved) {
    assert.equal(sameAuthority.trace.find(({ evidenceId }) => evidenceId === "OLD")?.disposition, "OLDER_OBSERVATION");
  }

  const confidence = resolverWith(unmatchedRules).resolve(request([
    candidateWithoutConfidence({ evidenceId: "LOW", provenance: { sourceType: "MARKET_DATA", provider: "Z" } }),
    candidate({ evidenceId: "HIGH", confidence: 0.1, provenance: { sourceType: "MARKET_DATA", provider: "Z" } }),
  ]));
  assert.equal(confidence.resolved && confidence.selectedEvidenceId, "HIGH");
  if (confidence.resolved) {
    assert.equal(confidence.trace.find(({ evidenceId }) => evidenceId === "LOW")?.disposition, "LOWER_CONFIDENCE");
  }

  const providerLexical = resolverWith(unmatchedRules).resolve(request([
    candidate({ evidenceId: "Z", provenance: { sourceType: "MARKET_DATA", provider: "Z", sourceName: "A" } }),
    candidate({ evidenceId: "B", provenance: { sourceType: "MARKET_DATA", provider: "A", sourceName: "Z" } }),
  ]));
  assert.equal(providerLexical.resolved && providerLexical.selectedEvidenceId, "B");
  if (providerLexical.resolved) {
    assert.equal(providerLexical.trace.find(({ evidenceId }) => evidenceId === "Z")?.disposition, "TIE_BREAK_LOST");
  }

  const sourceIdLexical = resolverWith(unmatchedRules).resolve(request([
    candidate({ evidenceId: "B", provenance: { sourceType: "MARKET_DATA", provider: "A", sourceName: "B" } }),
    candidate({ evidenceId: "Z", provenance: { sourceType: "MARKET_DATA", provider: "A", sourceName: "A" } }),
  ]));
  assert.equal(sourceIdLexical.resolved && sourceIdLexical.selectedEvidenceId, "Z");

  const evidenceIdLexical = resolverWith(unmatchedRules).resolve(request([
    candidate({ evidenceId: "B", provenance: { sourceType: "MARKET_DATA", provider: "A", sourceName: "A" } }),
    candidate({ evidenceId: "A", provenance: { sourceType: "MARKET_DATA", provider: "A", sourceName: "A" } }),
  ]));
  assert.equal(evidenceIdLexical.resolved && evidenceIdLexical.selectedEvidenceId, "A");
});

test("forwards explicit time and deprecated allowance exactly once per candidate", () => {
  const received: unknown[] = [];
  const compatibility = new EvidenceFactorCompatibilityService({ factorRegistry });
  const resolver = new EvidenceSourceResolutionService({
    factorRegistry,
    sourceAuthorityRegistry: new StaticEvidenceSourceAuthorityRegistry(unmatchedRules),
    compatibilityService: { evaluate: (params) => {
      received.push(params);
      return compatibility.evaluate(params);
    } },
  });
  resolver.resolve(request([candidate(), candidate({ evidenceId: "E-2" })], {
    allowDeprecatedFactor: true,
  }));
  assert.equal(received.length, 2);
  for (const item of received as Array<Record<string, unknown>>) {
    assert.equal((item.asOf as Date).getTime(), AS_OF.getTime());
    assert.equal(item.allowDeprecatedFactor, true);
  }
});

test("input order does not affect selected result or trace", () => {
  const candidates = [
    candidate({ evidenceId: "C" }),
    candidate({ evidenceId: "A" }),
    candidate({ evidenceId: "B" }),
  ];
  assert.deepEqual(
    resolverWith().resolve(request(candidates)),
    resolverWith().resolve(request([...candidates].reverse())),
  );
});

test("inputs and returned dates/arrays cannot mutate future results", () => {
  const evidence = candidate();
  Object.freeze(evidence.subject);
  Object.freeze(evidence.provenance);
  Object.freeze(evidence.value);
  Object.freeze(evidence);
  const resolver = resolverWith();
  const first = resolver.resolve(request(Object.freeze([evidence])));
  assert.equal(first.resolved, true);
  if (!first.resolved) return;
  assert.throws(() => (first.trace as unknown[]).push({}));
  first.asOf.setUTCFullYear(2030);
  first.selectedObservedAt.setUTCFullYear(2030);
  const second = resolver.resolve(request([evidence]));
  assert.equal(second.resolved, true);
  if (second.resolved) assert.equal(second.asOf.toISOString(), AS_OF.toISOString());
});

test("resolver has no repository, lifecycle, provider, runtime, or scoring imports", () => {
  const source = readFileSync("src/services/evidence-source-resolution.service.ts", "utf8");
  assert.doesNotMatch(
    source,
    /evidence\.repository|evidence-read|lifecycle-resolver|provider-runner|shadow-execution|observability|scoring-engine|evaluator-registry|controllers|schedulers|analyzer|frontend/i,
  );
});
