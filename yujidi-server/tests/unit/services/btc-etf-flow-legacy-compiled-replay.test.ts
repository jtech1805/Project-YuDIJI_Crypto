import assert from "node:assert/strict";
import test from "node:test";
import { BTC_ETF_FLOW_PARITY_POLICY, runBtcEtfLegacyCompiledReplay } from "../../fixtures/btc-etf-flow-legacy-compiled-replay.fixture.js";
import { createEtfAttestation, createEtfEvidence, ETF_RUNTIME_TIMES } from "../../fixtures/btc-etf-flow-compiled-runtime.fixture.js";

for (const scenario of [
  { name: "positive", value: 200, score: 75, permission: "TAKE_TRADE", band: "POSITIVE" },
  { name: "neutral", value: 0, score: 50, permission: "WAIT", band: "NEUTRAL" },
  { name: "negative", value: -200, score: 25, permission: "REJECT", band: "NEGATIVE" },
] as const) {
  test(`proves ${scenario.name} legacy and compiled replay with explicit parity`, async () => {
    const replay = await runBtcEtfLegacyCompiledReplay({ value: scenario.value });
    assert.equal(replay.legacy.score, scenario.score);
    assert.equal(replay.legacy.permission, scenario.permission);
    assert.equal(replay.legacy.scoreStatus, "READY");
    assert.equal(replay.compiled.status, "COMPLETED");
    if (replay.compiled.status !== "COMPLETED" || replay.parity.status !== "COMPLETED") return;
    assert.equal(replay.compiled.compiledExecution.normalizedScore, scenario.score);
    assert.equal(replay.compiled.compiledExecution.decisionBand?.label, scenario.band);
    assert.equal(replay.compiled.parity.status, "NOT_REQUESTED");
    assert.equal(replay.parity.result.numeric.status, "MATCH");
    assert(replay.parity.result.semanticDimensions.every((item) => item.status === "MATCH"));
    assert.equal(replay.parity.result.overallComparability, "FULLY_COMPARABLE");
    assert.deepEqual(replay.calls, { legacyExecution: 1, compiledExecution: 1, parity: 1, scoreCheckWrites: 0, productionWrites: 0, providerExecution: 0 });
    assert(replay.report.diagnostics.includes("CHARACTERIZATION_ONLY_LITERAL_USD_NOT_PRODUCTION_CALIBRATED"));
  });
}

test("keeps missing legacy input explicit while the compiled side completes", async () => {
  const replay = await runBtcEtfLegacyCompiledReplay({ omitLegacyInput: true });
  assert.equal(replay.legacy.score, 0);
  assert.equal(replay.legacy.scoreStatus, "UNAVAILABLE");
  assert.equal(replay.legacy.breakdown.evaluatorResults[0]!.status, "BLOCKED");
  assert.deepEqual(replay.legacy.breakdown.evaluatorResults[0]!.reasonCodes, ["MISSING_EVIDENCE"]);
  assert.equal(replay.calls.legacyExecution, 0);
  assert.equal(replay.compiled.status, "COMPLETED");
  assert.equal(replay.parity.status, "COMPLETED");
  if (replay.parity.status === "COMPLETED") assert.equal(replay.parity.result.numeric.status, "UNAVAILABLE");
});

test("keeps the legacy result authoritative when compiled Evidence or attestation is unavailable", async () => {
  for (const compiled of [{ evidence: [], attestations: [] }, { evidence: [createEtfEvidence()], attestations: [] }]) {
    const replay = await runBtcEtfLegacyCompiledReplay({ compiled });
    assert.equal(replay.legacy.score, 75);
    assert.equal(replay.legacy.permission, "TAKE_TRADE");
    assert.equal(replay.compiled.status, "SKIPPED");
    assert.deepEqual(replay.parity, { status: "UNAVAILABLE", reasonCode: "COMPILED_EXECUTION_UNAVAILABLE", overallComparability: "NOT_COMPARABLE" });
    assert.equal(replay.calls.parity, 0);
    assert(replay.report.diagnostics.includes("ASYMMETRIC_INPUT_AVAILABILITY"));
  }
});

test("preserves historical publication safety without changing legacy output", async () => {
  const evidence = createEtfEvidence({ provenance: { sourceType: "INTERNAL_CALCULATION", provider: "yudiji-internal-btc-etf-flow-characterization", sourcePublishedAt: new Date("2026-01-01T09:11:00.000Z") } });
  const replay = await runBtcEtfLegacyCompiledReplay({ compiled: { evidence: [evidence], attestations: [createEtfAttestation(evidence.evidenceId)] } });
  assert.equal(replay.legacy.score, 75);
  assert.equal(replay.compiled.status, "SKIPPED");
  assert.equal(replay.compiled.assembly?.traces[0]!.availabilityStatus, "NOT_YET_PUBLISHED");
  assert.equal(replay.parity.status, "UNAVAILABLE");
});

test("preserves reward-risk forced rejection and reports numeric ineligibility", async () => {
  const replay = await runBtcEtfLegacyCompiledReplay({ rewardRiskRatio: 0.8 });
  assert.equal(replay.legacy.breakdown.evaluatorResults[0]!.score, 75);
  assert.equal(replay.legacy.score, 30);
  assert.equal(replay.legacy.permission, "REJECT");
  assert.equal(replay.compiled.status, "COMPLETED");
  assert.equal(replay.parity.status, "COMPLETED");
  if (replay.parity.status !== "COMPLETED") return;
  assert.equal(replay.parity.result.numeric.status, "UNAVAILABLE");
  assert.equal(replay.parity.result.numeric.reasonCode, "LEGACY_REWARD_RISK_FORCED_VALUE");
  assert.equal(replay.parity.result.semanticDimensions[0]!.status, "MISMATCH");
  assert.equal(replay.parity.result.overallComparability, "PARTIALLY_COMPARABLE");
});

test("reports an honest comparable numeric mismatch for asymmetric explicit inputs", async () => {
  const replay = await runBtcEtfLegacyCompiledReplay({ value: 200, legacyValue: 0 });
  assert.equal(replay.legacy.score, 50);
  assert.equal(replay.compiled.status, "COMPLETED");
  assert.equal(replay.parity.status, "COMPLETED");
  if (replay.parity.status !== "COMPLETED") return;
  assert.equal(replay.parity.result.numeric.status, "MISMATCH");
  assert.equal(replay.parity.result.numeric.legacyOriginal, 50);
  assert.equal(replay.parity.result.numeric.compiledOriginal, 75);
  assert.equal(replay.parity.result.overallComparability, "PARTIALLY_COMPARABLE");
});

test("reports an unmappable semantic pair without inventing a mapping", async () => {
  const policy = { ...BTC_ETF_FLOW_PARITY_POLICY, semanticDimensions: BTC_ETF_FLOW_PARITY_POLICY.semanticDimensions.map((dimension, index) => index === 0 ? { ...dimension, mappings: dimension.mappings.filter((item) => item.legacyValue !== "TAKE_TRADE") } : dimension) };
  const replay = await runBtcEtfLegacyCompiledReplay({ policy });
  assert.equal(replay.parity.status, "COMPLETED");
  if (replay.parity.status !== "COMPLETED") return;
  assert.equal(replay.parity.result.semanticDimensions[0]!.status, "UNMAPPABLE");
  assert.equal(replay.parity.result.overallComparability, "PARTIALLY_COMPARABLE");
});

test("produces deeply immutable deterministic replay reports without mutation", async () => {
  const first = await runBtcEtfLegacyCompiledReplay();
  const second = await runBtcEtfLegacyCompiledReplay();
  assert.deepEqual(first, second);
  assert(Object.isFrozen(first));
  assert(Object.isFrozen(first.report));
  assert(Object.isFrozen(first.report.parity.semanticOutcomes));
  assert.notEqual(first.report.replayIdentity.asOf, ETF_RUNTIME_TIMES.asOf);
  assert.deepEqual(BTC_ETF_FLOW_PARITY_POLICY.policyId, "BTC_ETF_FLOW_LEGACY_COMPILED_PARITY");
});
