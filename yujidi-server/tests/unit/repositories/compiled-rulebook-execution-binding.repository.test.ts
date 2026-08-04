import assert from "node:assert/strict";
import test from "node:test";

import {
  CompiledRulebookExecutionBindingRepository,
  type CompiledRulebookExecutionBindingModelPort,
} from "../../../src/repositories/compiled-rulebook-execution-binding.repository.js";
import { compiledRulebookExecutionBindingSchema } from "../../../src/models/compiled-rulebook-execution-binding.model.js";

const binding = (change: Record<string, unknown> = {}) => ({
  bindingId: "BTC_INTRADAY_EXECUTION",
  bindingVersion: 1,
  sourceTemplate: { templateId: "BTC_INTRADAY", templateVersion: 1, scope: "SYSTEM" as const },
  compiledRulebook: { rulebookId: "CR_BTC_001", rulebookVersion: 1 },
  createdAt: new Date("2026-08-04T00:00:00.000Z"),
  ...change,
});

const harness = (initial: any[] = [], createFailure: unknown = null) => {
  const rows = initial.map((value) => structuredClone(value));
  const calls: Array<readonly [string, unknown]> = [];
  const matches = (row: any, filter: Record<string, unknown>) => Object.entries(filter).every(([key, value]) => (
    key.split(".").reduce((current, part) => current?.[part], row) === value
  ));
  const model: CompiledRulebookExecutionBindingModelPort = {
    create: async (value) => {
      calls.push(["create", structuredClone(value)]);
      if (createFailure) throw createFailure;
      rows.push(structuredClone(value));
      return value;
    },
    find: (filter) => ({
      limit: (limit) => ({
        lean: () => ({ exec: async () => structuredClone(rows.filter((row) => matches(row, filter)).slice(0, limit)) }),
      }),
    }),
  };
  return { calls, rows, repository: new CompiledRulebookExecutionBindingRepository(model) };
};

test("inserts one detached binding without mutating the candidate", async () => {
  const h = harness();
  const input = binding();
  const before = structuredClone(input);
  const result = await h.repository.insert(input);
  assert.equal(result.code, "INSERTED");
  assert.deepEqual(input, before);
  input.sourceTemplate.templateId = "CHANGED";
  input.createdAt.setUTCFullYear(2030);
  assert.equal(h.rows[0].sourceTemplate.templateId, "BTC_INTRADAY");
  assert.equal(h.rows[0].createdAt.getUTCFullYear(), 2026);
});

test("exact duplicate is deterministic and creates no second record", async () => {
  const original = binding();
  const h = harness([original]);
  const first = await h.repository.insert(binding());
  const second = await h.repository.insert(binding());
  assert.equal(first.code, "ALREADY_EXISTS");
  assert.deepEqual(second, first);
  assert.equal(h.rows.length, 1);
  assert.equal(h.calls.filter(([name]) => name === "create").length, 0);
});

test("source and binding identity conflicts fail closed without replacement", async () => {
  const original = binding();
  const sourceConflict = binding({
    bindingId: "ANOTHER_BINDING",
    compiledRulebook: { rulebookId: "CR_BTC_002", rulebookVersion: 2 },
  });
  const identityConflict = binding({ compiledRulebook: { rulebookId: "CR_BTC_002", rulebookVersion: 2 } });
  for (const candidate of [sourceConflict, identityConflict]) {
    const h = harness([original]);
    assert.deepEqual(await h.repository.insert(candidate), { inserted: false, code: "CONFLICT" });
    assert.deepEqual(h.rows, [original]);
  }
});

test("exact source read returns detached deeply frozen values and cloned Dates", async () => {
  const stored = binding();
  const result = await harness([stored]).repository.findExactForSourceTemplate(stored.sourceTemplate);
  assert(result.found);
  assert.deepEqual(result.binding, stored);
  assert.notEqual(result.binding, stored);
  assert.notEqual(result.binding.createdAt, stored.createdAt);
  assert(Object.isFrozen(result.binding));
  assert(Object.isFrozen(result.binding.sourceTemplate));
  assert(Object.isFrozen(result.binding.compiledRulebook));
});

test("missing exact source is not found and corrupted duplicates fail closed", async () => {
  const source = binding().sourceTemplate;
  assert.deepEqual(await harness().repository.findExactForSourceTemplate(source), { found: false, code: "NOT_FOUND" });
  assert.deepEqual(await harness([binding(), binding({ bindingId: "OTHER" })]).repository.findExactForSourceTemplate(source), { found: false, code: "CONFLICT" });
});

test("persistence failures are typed and duplicate-key races are reclassified", async () => {
  const source = binding().sourceTemplate;
  const failingModel: CompiledRulebookExecutionBindingModelPort = {
    create: async () => { throw new Error("secret"); },
    find: () => ({ limit: () => ({ lean: () => ({ exec: async () => { throw new Error("secret"); } }) }) }),
  };
  const repository = new CompiledRulebookExecutionBindingRepository(failingModel);
  assert.deepEqual(await repository.findExactForSourceTemplate(source), { found: false, code: "PERSISTENCE_ERROR" });
  assert.deepEqual(await repository.insert(binding()), { inserted: false, code: "PERSISTENCE_ERROR" });

  const h = harness([binding()], { code: 11000 });
  let searches = 0;
  const originalFind = (h.repository as any).findMatches.bind(h.repository);
  (h.repository as any).findMatches = async (...args: any[]) => ++searches <= 2 ? [] : originalFind(...args);
  const result = await h.repository.insert(binding());
  assert.equal(result.code, "ALREADY_EXISTS");
});

test("repository exposes no mutable or latest-selection operations", () => {
  const repository: any = harness().repository;
  for (const method of ["update", "updateOne", "replace", "delete", "deleteOne", "upsert", "getLatest", "findLatest", "findMostRecent"]) {
    assert.equal(repository[method], undefined);
  }
});

test("persistence schema has only immutable authority fields and both exact unique indexes", () => {
  assert.deepEqual(Object.keys(compiledRulebookExecutionBindingSchema.paths).sort(), [
    "_id", "bindingId", "bindingVersion", "compiledRulebook.rulebookId", "compiledRulebook.rulebookVersion",
    "createdAt", "sourceTemplate.scope", "sourceTemplate.templateId", "sourceTemplate.templateVersion",
  ]);
  const uniqueIndexes = compiledRulebookExecutionBindingSchema.indexes()
    .filter(([, options]) => options.unique)
    .map(([fields]) => fields);
  assert.deepEqual(uniqueIndexes, [
    { bindingId: 1, bindingVersion: 1 },
    { "sourceTemplate.templateId": 1, "sourceTemplate.templateVersion": 1, "sourceTemplate.scope": 1 },
  ]);
  for (const field of ["active", "enabled", "updatedAt", "supersededAt", "isCurrent"]) {
    assert.equal(compiledRulebookExecutionBindingSchema.path(field), undefined);
  }
});
