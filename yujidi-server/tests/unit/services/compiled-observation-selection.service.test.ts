import assert from "node:assert/strict";
import test from "node:test";
import { CompiledObservationSelectionService } from "../../../src/services/compiled-rulebook/compiled-observation-selection.service.js";

const service = new CompiledObservationSelectionService();
const subject = { type: "ASSET", key: "BTC" };
const binding = { factor: { factorKey: "CRYPTO.ETF_NET_FLOW", factorVersion: 1 }, provider: { providerBindingId: "ETF_PROVIDERS", providerBindingVersion: 1, resolutionPolicyId: "ETF_RESOLUTION", resolutionPolicyVersion: 1 } };
const observation = (change: any = {}) => ({
  factor: { factorKey: "CRYPTO.ETF_NET_FLOW", factorVersion: 1 }, subject: { ...subject }, value: 25, unit: "USD",
  observedAt: new Date("2026-01-01T00:00:00.000Z"), confidence: 1,
  providerAttestation: { providerBindingId: "ETF_PROVIDERS", providerBindingVersion: 1, resolutionPolicyId: "ETF_RESOLUTION", resolutionPolicyVersion: 1, selectedProviderKey: "PRIMARY", resolutionOutcome: "RESOLVED" },
  ...change,
});
const select = (observations: any[]) => service.select({ observations, binding, resolvedSubject: subject });

test("selects exactly one observation by the complete compiled match tuple", () => {
  const selected = observation(); const extra = observation({ subject: { type: "ASSET", key: "ETH" } });
  const result = select([extra, selected]); assert.equal(result.selected, true); if (!result.selected) return;
  assert.deepEqual(result.observation, selected); assert.notEqual(result.observation, selected);
  assert.notEqual(result.observation.observedAt, selected.observedAt); assert(Object.isFrozen(result.observation.providerAttestation));
});

test("returns not found for every exact tuple mismatch", () => {
  const variants = [
    { factor: { factorKey: "MARKET.PRICE", factorVersion: 1 } }, { factor: { factorKey: "CRYPTO.ETF_NET_FLOW", factorVersion: 2 } },
    { subject: { type: "ASSET", key: "ETH" } },
    { providerAttestation: { ...observation().providerAttestation, providerBindingId: "OTHER" } },
    { providerAttestation: { ...observation().providerAttestation, providerBindingVersion: 2 } },
    { providerAttestation: { ...observation().providerAttestation, resolutionPolicyId: "OTHER" } },
    { providerAttestation: { ...observation().providerAttestation, resolutionPolicyVersion: 2 } },
  ];
  for (const change of variants) assert.equal((select([observation(change)]) as any).code, "OBSERVATION_NOT_FOUND");
});

test("rejects identical duplicates and differing ambiguity without ordering selection", () => {
  assert.equal((select([observation(), observation()]) as any).code, "DUPLICATE_OBSERVATION");
  assert.equal((select([observation(), observation({ value: 50 })]) as any).code, "AMBIGUOUS_OBSERVATION");
  assert.equal((select([observation({ value: 50 }), observation()]) as any).code, "AMBIGUOUS_OBSERVATION");
});

test("rejects malformed, sparse, empty, and oversized collections", () => {
  assert.equal((select([]) as any).code, "INVALID_OBSERVATION_COLLECTION");
  const sparse = [observation(), observation()]; delete sparse[0]; assert.equal((select(sparse) as any).code, "INVALID_OBSERVATION_COLLECTION");
  assert.equal((select([{} as any]) as any).code, "INVALID_SHADOW_OBSERVATION");
  assert.equal((select(Array.from({ length: 101 }, () => observation({ subject: { type: "ASSET", key: "ETH" } }))) as any).code, "INVALID_OBSERVATION_COLLECTION");
});

