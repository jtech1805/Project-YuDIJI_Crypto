import assert from "node:assert/strict";
import test from "node:test";
import { BTC_ETF_FLOW_AUTHORITY_IDS } from "../../../src/registries/btc-etf-flow-characterization.authorities.js";
import { BTC_ETF_FLOW_CHARACTERIZATION_PROVIDER } from "../../../src/registries/provider-authority.registry.js";
import { compileBtcEtfRulebook, createBtcEtfRuntimeHarness, createEtfAttestation, createEtfEvidence, ETF_RUNTIME_TIMES } from "../../fixtures/btc-etf-flow-compiled-runtime.fixture.js";

const assertNoExecution = (h: ReturnType<typeof createBtcEtfRuntimeHarness>) => {
  assert.equal(h.calls.compiled, 0);
  assert.equal(h.calls.parity, 0);
};

test("compiles the exact B2 rulebook deterministically without narrowing its authority lineage", () => {
  const first = compileBtcEtfRulebook();
  const second = compileBtcEtfRulebook();
  assert.deepEqual(first.rulebook, second.rulebook);
  assert.equal(first.rulebook.source.templateId, BTC_ETF_FLOW_AUTHORITY_IDS.templateKey);
  assert.deepEqual(first.rulebook.factorBindings[0]!.factor, { factorKey: "CRYPTO.ETF_NET_FLOW", factorVersion: 1 });
  assert.deepEqual(first.rulebook.factorBindings[0]!.subjectBinding, { type: "FIXED", subject: { type: "ASSET", key: "BTC" } });
  assert.equal(first.rulebook.factorBindings[0]!.evaluator.configurationId, BTC_ETF_FLOW_AUTHORITY_IDS.configurationId);
  assert.equal(first.rulebook.factorBindings[0]!.provider.providerBindingId, BTC_ETF_FLOW_AUTHORITY_IDS.providerBindingId);
  assert.equal(first.rulebook.factorBindings[0]!.provider.resolutionPolicyId, BTC_ETF_FLOW_AUTHORITY_IDS.resolutionPolicyId);
  assert.match(first.rulebook.compilation.compilationInputHash, /^[a-f0-9]{64}$/);
});

for (const scenario of [
  { name: "positive", value: 200, contribution: 1, score: 75, band: "POSITIVE" },
  { name: "neutral", value: 0, contribution: 0, score: 50, band: "NEUTRAL" },
  { name: "negative", value: -200, contribution: -1, score: 25, band: "NEGATIVE" },
] as const) {
  test(`executes the real A4/A5/Phase 4G3 ${scenario.name} path`, async () => {
    const h = createBtcEtfRuntimeHarness({ evidence: [createEtfEvidence({ value: { type: "NUMBER", numberValue: scenario.value, unit: "USD" } })] });
    const result = await h.execute();
    assert.equal(result.status, "COMPLETED");
    if (result.status !== "COMPLETED") return;
    assert.equal(result.parity.status, "NOT_REQUESTED");
    assert.deepEqual(h.calls, { binding: 1, rulebook: 1, evidence: 1, attestation: 1, assembly: 1, compiled: 1, parity: 0 });
    assert.equal(result.assembly.status, "COMPLETED");
    assert.equal(result.assembly.observations.length, 1);
    assert.equal(result.assembly.observations[0]!.value, scenario.value);
    const trace = result.assembly.traces[0]!;
    assert.equal(trace.evidenceId, "EVIDENCE_BTC_ETF_FLOW_20260101");
    assert.equal(trace.availabilityStatus, "ELIGIBLE");
    assert.equal(trace.compatibilityStatus, "COMPATIBLE");
    assert.equal(trace.selectedProviderKey, "YUDIJI_CHARACTERIZATION_BTC_ETF_FLOW");
    assert.equal(trace.evidenceProvenanceProvider, "yudiji-internal-btc-etf-flow-characterization");
    assert.equal(trace.attestationId, "ATTESTATION_EVIDENCE_BTC_ETF_FLOW_20260101");
    assert.equal(trace.confidenceAdjustment, 0);
    assert.deepEqual(trace.warningCodes, []);
    assert.equal(result.compiledExecution.bindingTraces[0]!.rawEvaluatorResult?.contribution.points, scenario.contribution);
    assert.equal(result.compiledExecution.aggregateScore, scenario.score);
    assert.equal(result.compiledExecution.normalizedScore, scenario.score);
    assert.equal(result.compiledExecution.decisionBand?.label, scenario.band);
  });
}

test("does not fabricate missing Evidence or infer a missing attestation", async () => {
  let h = createBtcEtfRuntimeHarness({ evidence: [], attestations: [] });
  let result = await h.execute();
  assert.equal(result.status, "SKIPPED");
  assert.equal(result.status === "SKIPPED" && result.reasonCode, "NO_RELEVANT_EVIDENCE");
  assert.equal(result.assembly?.status, "NO_USABLE_EVIDENCE");
  assertNoExecution(h);

  h = createBtcEtfRuntimeHarness({ evidence: [createEtfEvidence()], attestations: [] });
  result = await h.execute();
  assert.equal(result.status, "SKIPPED");
  assert.equal(result.assembly?.traces[0]!.reasonCodes[0], "PROVIDER_ATTESTATION_MISSING");
  assertNoExecution(h);
});

test("rejects future publication, Evidence persistence, and attestation persistence independently", async () => {
  const cases = [
    { evidence: createEtfEvidence({ provenance: { sourceType: "INTERNAL_CALCULATION", provider: BTC_ETF_FLOW_CHARACTERIZATION_PROVIDER.evidenceProvenanceProvider, sourcePublishedAt: new Date("2026-01-01T09:11:00.000Z") } }), reason: "NOT_YET_PUBLISHED" },
    { evidence: createEtfEvidence({ createdAt: new Date("2026-01-01T09:11:00.000Z") }), reason: "NOT_YET_INGESTED" },
  ] as const;
  for (const item of cases) {
    const h = createBtcEtfRuntimeHarness({ evidence: [item.evidence] });
    const result = await h.execute();
    assert.equal(result.status, "SKIPPED");
    assert.equal(result.assembly?.traces[0]!.availabilityStatus, item.reason);
    assertNoExecution(h);
  }
  const evidence = createEtfEvidence();
  const h = createBtcEtfRuntimeHarness({ evidence: [evidence], attestations: [createEtfAttestation(evidence.evidenceId, { createdAt: new Date("2026-01-01T09:11:00.000Z") })] });
  const result = await h.execute();
  assert.equal(result.status, "SKIPPED");
  assert.equal(result.assembly?.traces[0]!.availabilityStatus, "ATTESTATION_NOT_YET_PERSISTED");
  assertNoExecution(h);
});

test("fails closed on provider binding, resolution policy, provenance, and replay eligibility", async () => {
  const cases = [
    { attestations: [createEtfAttestation(undefined, { providerBinding: { providerBindingId: "OTHER_BINDING", providerBindingVersion: 1 } })], reason: "PROVIDER_BINDING_MISMATCH" },
    { attestations: [createEtfAttestation(undefined, { resolutionPolicy: { policyId: "OTHER_POLICY", policyVersion: 1 } })], reason: "RESOLUTION_POLICY_MISMATCH" },
  ];
  for (const item of cases) {
    const h = createBtcEtfRuntimeHarness({ attestations: item.attestations });
    const result = await h.execute();
    assert.equal(result.status, "SKIPPED");
    assert.equal(result.assembly?.traces[0]!.reasonCodes[0], item.reason);
    assertNoExecution(h);
  }
  let h = createBtcEtfRuntimeHarness({ evidence: [createEtfEvidence({ provenance: { sourceType: "INTERNAL_CALCULATION", provider: "wrong-provenance", sourcePublishedAt: ETF_RUNTIME_TIMES.publishedAt } })] });
  let result = await h.execute();
  assert.equal(result.status, "SKIPPED");
  assert.equal(result.assembly?.traces[0]!.reasonCodes[0], "PROVIDER_PROVENANCE_MISMATCH");
  assertNoExecution(h);
  h = createBtcEtfRuntimeHarness({ providerAuthorityOverride: { ...BTC_ETF_FLOW_CHARACTERIZATION_PROVIDER, capabilities: { ...BTC_ETF_FLOW_CHARACTERIZATION_PROVIDER.capabilities, replayFixtureEligible: false } } });
  result = await h.execute();
  assert.equal(result.status, "SKIPPED");
  assert.equal(result.assembly?.traces[0]!.reasonCodes[0], "PROVIDER_AUTHORITY_INELIGIBLE");
  assertNoExecution(h);
});

test("rejects duplicate eligible Evidence without recency selection", async () => {
  const first = createEtfEvidence();
  const second = createEtfEvidence({ evidenceId: "EVIDENCE_BTC_ETF_FLOW_20260101_SECOND", deduplicationKey: "BTC_ETF_FLOW_SECOND", observedAt: new Date("2026-01-01T09:01:00.000Z") });
  const h = createBtcEtfRuntimeHarness({ evidence: [first, second] });
  const result = await h.execute();
  assert.equal(result.status, "FAILED");
  assert.equal(result.status === "FAILED" && result.reasonCode, "INVALID_EVIDENCE_SET");
  assert.equal(result.assembly?.traces[0]!.reasonCodes[0], "AMBIGUOUS_CANDIDATES");
  assertNoExecution(h);
});

test("is repeatable, detached, immutable, and leaves all test-owned inputs unchanged", async () => {
  const h = createBtcEtfRuntimeHarness();
  const before = structuredClone({ rulebook: h.rulebook, binding: h.executionBinding, evidence: h.evidence, attestations: h.attestations, request: h.request });
  const first = await h.execute();
  const secondHarness = createBtcEtfRuntimeHarness();
  const second = await secondHarness.execute();
  assert.deepEqual(first, second);
  assert.deepEqual({ rulebook: h.rulebook, binding: h.executionBinding, evidence: h.evidence, attestations: h.attestations, request: h.request }, before);
  assert(Object.isFrozen(first));
  assert(Object.isFrozen(first.assembly));
  assert.notEqual(first.identity.asOf, h.request.asOf);
  assert.equal(h.calls.parity, 0);
});
