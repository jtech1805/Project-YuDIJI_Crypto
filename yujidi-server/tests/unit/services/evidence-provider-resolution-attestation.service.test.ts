import assert from "node:assert/strict";
import test from "node:test";

import { EvidenceProviderResolutionAttestationService } from "../../../src/services/evidence/evidence-provider-resolution-attestation.service.js";

const CREATED_AT = new Date("2026-08-04T10:00:01.000Z");
const candidate = (change: Record<string, unknown> = {}) => ({
  attestationId: "ATTESTATION_100",
  attestationVersion: 1,
  evidenceId: "evidence-100",
  providerBinding: { providerBindingId: "PB_MARKET_PRICE", providerBindingVersion: 1 },
  resolutionPolicy: { policyId: "RP_MARKET_PRICE", policyVersion: 1 },
  selectedProviderKey: "BINANCE_PUBLIC_MARKET_PRICE_V1",
  selectedProviderType: "DIRECT",
  resolutionStatus: "DEGRADED_PRIMARY_USED",
  confidenceAdjustment: -0.1,
  warningCodes: ["PREFERRED_PROVIDER_DEGRADED", "DEGRADED_PROVIDER_SELECTED"],
  resolvedAt: new Date("2026-08-04T10:00:00.000Z"),
  ...change,
});
const persisted = (value = candidate()) => ({ ...structuredClone(value), createdAt: new Date(CREATED_AT) });

const harness = (options: { evidence?: any; insert?: any; read?: any } = {}) => {
  const calls: any[] = [];
  const repository = {
    insert: async (value: any) => { calls.push(["insert", value]); return options.insert ?? { inserted: true, code: "INSERTED", attestation: persisted(value) }; },
    findExactByEvidenceId: async (id: string) => { calls.push(["read", id]); return options.read ?? { found: false, code: "NOT_FOUND" }; },
  };
  const evidenceRepository = {
    findByEvidenceId: async (id: string) => { calls.push(["evidence", id]); if (options.evidence instanceof Error) throw options.evidence; return options.evidence === undefined ? { evidenceId: id } : options.evidence; },
  };
  return { calls, service: new EvidenceProviderResolutionAttestationService(repository, evidenceRepository) };
};

test("validates complete input in deterministic order and forbids caller createdAt", async () => {
  const invalid: Array<[unknown, string]> = [
    [{}, "INVALID_ATTESTATION_ID"],
    [candidate({ attestationId: "" }), "INVALID_ATTESTATION_ID"],
    [candidate({ attestationVersion: 0 }), "INVALID_ATTESTATION_VERSION"],
    [candidate({ evidenceId: "" }), "INVALID_EVIDENCE_ID"],
    [candidate({ providerBinding: null }), "INVALID_PROVIDER_BINDING"],
    [candidate({ providerBinding: { providerBindingId: "", providerBindingVersion: 1 } }), "INVALID_PROVIDER_BINDING_ID"],
    [candidate({ providerBinding: { providerBindingId: "PB", providerBindingVersion: 0 } }), "INVALID_PROVIDER_BINDING_VERSION"],
    [candidate({ resolutionPolicy: null }), "INVALID_RESOLUTION_POLICY"],
    [candidate({ resolutionPolicy: { policyId: "", policyVersion: 1 } }), "INVALID_RESOLUTION_POLICY_ID"],
    [candidate({ resolutionPolicy: { policyId: "RP", policyVersion: 0 } }), "INVALID_RESOLUTION_POLICY_VERSION"],
    [candidate({ selectedProviderKey: "bad provider" }), "INVALID_SELECTED_PROVIDER"],
    [candidate({ selectedProviderType: "UNKNOWN" }), "INVALID_SELECTED_PROVIDER_TYPE"],
    [candidate({ resolutionStatus: "FALLBACK" }), "UNSUPPORTED_RESOLUTION_STATUS"],
    [candidate({ confidenceAdjustment: Number.NaN }), "INVALID_CONFIDENCE_ADJUSTMENT"],
    [candidate({ warningCodes: ["UNKNOWN_WARNING"] }), "INVALID_WARNINGS"],
    [candidate({ warningCodes: ["DEGRADED_PROVIDER_SELECTED", "PREFERRED_PROVIDER_DEGRADED"] }), "INVALID_WARNINGS"],
    [candidate({ resolvedAt: new Date("invalid") }), "INVALID_RESOLVED_AT"],
    [{ ...candidate(), createdAt: CREATED_AT }, "CALLER_CREATED_AT_FORBIDDEN"],
  ];
  for (const [value, failure] of invalid) {
    const h = harness();
    assert.deepEqual(await h.service.insert(value), { inserted: false, code: "INVALID_REQUEST", failure });
    assert.deepEqual(h.calls, []);
  }
});

test("checks exact Evidence existence before append-only insertion and returns immutable detached output", async () => {
  const h = harness();
  const input = candidate();
  const before = structuredClone(input);
  const result = await h.service.insert(input);
  assert(result.inserted);
  assert.deepEqual(h.calls.map(([name]) => name), ["evidence", "insert"]);
  assert.deepEqual(input, before);
  assert.notEqual(result.attestation.resolvedAt, input.resolvedAt);
  assert(Object.isFrozen(result.attestation));
  assert(Object.isFrozen(result.attestation.warningCodes));
});

test("missing Evidence and Evidence read failure return typed outcomes without insertion", async () => {
  const missing = harness({ evidence: null });
  assert.deepEqual(await missing.service.insert(candidate()), { inserted: false, code: "EVIDENCE_NOT_FOUND" });
  assert.deepEqual(missing.calls.map(([name]) => name), ["evidence"]);
  const failed = harness({ evidence: new Error("secret") });
  assert.deepEqual(await failed.service.insert(candidate()), { inserted: false, code: "PERSISTENCE_ERROR" });
  assert.deepEqual(failed.calls.map(([name]) => name), ["evidence"]);
});

test("preserves every detailed selected status without compiled projection", async () => {
  for (const status of ["RESOLVED", "DEGRADED_PRIMARY_USED", "FALLBACK_USED", "PROXY_USED"] as const) {
    const confidenceAdjustment = status === "RESOLVED" ? 0 : -0.1;
    const value = candidate({ resolutionStatus: status, confidenceAdjustment, warningCodes: [] });
    const h = harness({ insert: { inserted: true, code: "INSERTED", attestation: persisted(value) } });
    const result = await h.service.insert(value);
    assert(result.inserted);
    assert.equal(result.attestation.resolutionStatus, status);
    assert.equal((result.attestation as any).compiledOutcome, undefined);
  }
});

test("exact read validates Evidence ID and returns detached immutable repository results", async () => {
  const stored = persisted();
  const h = harness({ read: { found: true, attestation: stored } });
  const result = await h.service.getExactByEvidenceId("evidence-100");
  assert(result.found);
  assert.deepEqual(h.calls, [["read", "evidence-100"]]);
  assert.notEqual(result.attestation, stored);
  assert.notEqual(result.attestation.createdAt, stored.createdAt);
  assert(Object.isFrozen(result.attestation.resolutionPolicy));
  const invalid = harness();
  assert.deepEqual(await invalid.service.getExactByEvidenceId(""), { found: false, code: "INVALID_REQUEST" });
  assert.deepEqual(invalid.calls, []);
});

test("repository duplicate, conflict, invariant, and persistence outcomes remain typed", async () => {
  for (const outcome of [
    { inserted: false, code: "ALREADY_EXISTS", attestation: persisted() },
    { inserted: false, code: "CONFLICT" },
    { inserted: false, code: "PERSISTENCE_ERROR" },
  ] as const) {
    const result = await harness({ insert: outcome }).service.insert(candidate());
    assert.equal(result.code, outcome.code);
  }
  for (const outcome of [
    { found: false, code: "NOT_FOUND" },
    { found: false, code: "INVARIANT_VIOLATION" },
    { found: false, code: "PERSISTENCE_ERROR" },
  ] as const) assert.deepEqual(await harness({ read: outcome }).service.getExactByEvidenceId("evidence-100"), outcome);
});

test("service exposes no emission, projection, mutation, recency, or latest behavior", () => {
  const service: any = harness().service;
  for (const method of ["emit", "project", "update", "delete", "replace", "upsert", "getLatest", "getMostRecent", "list"]) assert.equal(service[method], undefined);
});
