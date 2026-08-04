import assert from "node:assert/strict";
import test from "node:test";

import { CompiledRulebookExecutionBindingService } from "../../../src/services/compiled-rulebook-execution-binding.service.js";

const candidate = (change: Record<string, unknown> = {}) => ({
  bindingId: "BTC_INTRADAY_EXECUTION",
  bindingVersion: 1,
  sourceTemplate: { templateId: "BTC_INTRADAY", templateVersion: 1, scope: "SYSTEM" as const },
  compiledRulebook: { rulebookId: "CR_BTC_001", rulebookVersion: 1 },
  createdAt: new Date("2026-08-04T00:00:00.000Z"),
  ...change,
});

const rulebook = (source = { templateId: "BTC_INTRADAY", templateVersion: 1 }) => ({
  identity: { rulebookId: "CR_BTC_001", rulebookVersion: 1 },
  source,
  compilation: { compilerId: "COMPILER", compilerVersion: 1, compilationInputHash: "a".repeat(64), compiledAt: new Date("2026-08-03T00:00:00Z") },
  factorBindings: [], crossFactorPolicy: null, decisionPolicy: null,
});

const harness = (options: { read?: any; insert?: any; exact?: any } = {}) => {
  const calls: any[] = [];
  const repository = {
    insert: async (value: any) => { calls.push(["insert", value]); return options.insert ?? { inserted: true, code: "INSERTED", binding: value }; },
    findExactForSourceTemplate: async (value: any) => { calls.push(["find", value]); return options.exact ?? { found: false, code: "NOT_FOUND" }; },
  };
  const readService = {
    getExact: async (...args: any[]) => { calls.push(["rulebook", ...args]); return options.read ?? { found: true, rulebook: rulebook() }; },
  };
  return { calls, service: new CompiledRulebookExecutionBindingService(repository, readService) };
};

test("validates every required identity field in deterministic order", async () => {
  const invalid: Array<[any, string]> = [
    [{}, "INVALID_BINDING_ID"],
    [candidate({ bindingId: "" }), "INVALID_BINDING_ID"],
    [candidate({ bindingVersion: 0 }), "INVALID_BINDING_VERSION"],
    [candidate({ sourceTemplate: null }), "INVALID_SOURCE_TEMPLATE"],
    [candidate({ sourceTemplate: { templateId: "", templateVersion: 1, scope: "SYSTEM" } }), "INVALID_SOURCE_TEMPLATE_ID"],
    [candidate({ sourceTemplate: { templateId: "BTC_INTRADAY", templateVersion: 0, scope: "SYSTEM" } }), "INVALID_SOURCE_TEMPLATE_VERSION"],
    [candidate({ sourceTemplate: { templateId: "BTC_INTRADAY", templateVersion: 1, scope: "UNKNOWN" } }), "UNSUPPORTED_TEMPLATE_SCOPE"],
    [candidate({ sourceTemplate: { templateId: "BTC_INTRADAY", templateVersion: 1, scope: "USER" } }), "USER_TEMPLATE_NOT_ELIGIBLE"],
    [candidate({ compiledRulebook: { rulebookId: "", rulebookVersion: 1 } }), "INVALID_RULEBOOK_ID"],
    [candidate({ compiledRulebook: { rulebookId: "CR_BTC_001", rulebookVersion: 0 } }), "INVALID_RULEBOOK_VERSION"],
    [candidate({ createdAt: new Date("invalid") }), "INVALID_CREATED_AT"],
  ];
  for (const [value, code] of invalid) {
    const h = harness();
    assert.deepEqual(await h.service.insert(value), { inserted: false, code: "INVALID_REQUEST", failure: code });
    assert.deepEqual(h.calls, []);
  }
});

test("loads the exact rulebook, verifies lineage, then inserts a detached immutable binding", async () => {
  const h = harness();
  const input = candidate();
  const before = structuredClone(input);
  const result = await h.service.insert(input);
  assert.equal(result.code, "INSERTED");
  assert.deepEqual(h.calls.map(([name]) => name), ["rulebook", "insert"]);
  assert.deepEqual(h.calls[0], ["rulebook", "CR_BTC_001", 1]);
  assert.deepEqual(input, before);
  assert(result.inserted);
  assert(Object.isFrozen(result.binding));
  assert.notEqual(result.binding.createdAt, input.createdAt);
});

test("missing rulebook, lineage mismatch, and read persistence failure are typed", async () => {
  assert.deepEqual(await harness({ read: { found: false, code: "NOT_FOUND" } }).service.insert(candidate()), { inserted: false, code: "RULEBOOK_NOT_FOUND" });
  assert.deepEqual(await harness({ read: { found: false, code: "PERSISTENCE_ERROR" } }).service.insert(candidate()), { inserted: false, code: "PERSISTENCE_ERROR" });
  const mismatch = harness({ read: { found: true, rulebook: rulebook({ templateId: "OTHER", templateVersion: 1 }) } });
  assert.deepEqual(await mismatch.service.insert(candidate()), { inserted: false, code: "LINEAGE_MISMATCH" });
  assert.deepEqual(mismatch.calls.map(([name]) => name), ["rulebook"]);
});

test("exact read requires complete system identity and delegates without sorting or fallback", async () => {
  const h = harness();
  const identity = candidate().sourceTemplate;
  assert.deepEqual(await h.service.getExactForSourceTemplate(identity), { found: false, code: "NOT_FOUND" });
  assert.deepEqual(h.calls, [["find", identity]]);
  for (const invalid of [null, {}, { templateId: "BTC_INTRADAY", templateVersion: 0, scope: "SYSTEM" }, { templateId: "BTC_INTRADAY", templateVersion: 1, scope: "USER" }]) {
    const invalidHarness = harness();
    assert.deepEqual(await invalidHarness.service.getExactForSourceTemplate(invalid), { found: false, code: "INVALID_REQUEST" });
    assert.deepEqual(invalidHarness.calls, []);
  }
});

test("repository outcomes are preserved as detached immutable service results", async () => {
  const existing = candidate();
  const h = harness({ insert: { inserted: false, code: "ALREADY_EXISTS", binding: existing }, exact: { found: true, binding: existing } });
  const inserted = await h.service.insert(candidate());
  const found = await h.service.getExactForSourceTemplate(candidate().sourceTemplate);
  assert.equal(inserted.code, "ALREADY_EXISTS");
  assert(found.found);
  if (inserted.code === "ALREADY_EXISTS" && found.found) {
    assert.notEqual(inserted.binding, existing);
    assert.notEqual(found.binding, existing);
    assert.notEqual(inserted.binding.createdAt, existing.createdAt);
    assert(Object.isFrozen(inserted.binding.sourceTemplate));
    assert(Object.isFrozen(found.binding.compiledRulebook));
  }
});

test("service has no latest, most-recent, update, delete, or upsert method", () => {
  const service: any = harness().service;
  for (const method of ["getLatest", "getMostRecent", "update", "replace", "delete", "upsert"]) assert.equal(service[method], undefined);
});
