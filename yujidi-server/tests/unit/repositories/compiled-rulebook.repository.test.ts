import assert from "node:assert/strict";
import test from "node:test";
import { CompiledRulebookRepository, type CompiledRulebookModelPort } from "../../../src/repositories/compiled-rulebook.repository.js";

const rulebook = (change: any = {}) => ({ identity: { rulebookId: "BTC_RULEBOOK", rulebookVersion: 1 }, source: { templateId: "BTC_TEMPLATE", templateVersion: 1 }, compilation: { compilerId: "YUDIJI_COMPILER", compilerVersion: 1, compilationInputHash: "a".repeat(64), compiledAt: new Date("2026-08-03T00:00:00Z") }, factorBindings: [{ bindingId: "BINDING_ONE", order: 0, factor: { factorKey: "CRYPTO.ETF_NET_FLOW", factorVersion: 1 }, subjectBinding: { type: "FIXED", subject: { type: "ASSET", key: "BTC" } }, evaluator: { evaluatorId: "EVALUATOR", evaluatorVersion: 1, configurationId: "CONFIG", configurationVersion: 1 }, relationshipType: "DIRECT", requirementLevel: "MANDATORY", optionalBehavior: null, weight: 100, provider: { providerBindingId: "BINDING", providerBindingVersion: 1, resolutionPolicyId: "RESOLUTION", resolutionPolicyVersion: 1 }, executionPolicies: { aggregationPolicyId: "AGGREGATION", aggregationPolicyVersion: 1, normalizationPolicyId: "NORMALIZATION", normalizationPolicyVersion: 1, decisionBandPolicyId: "BANDS", decisionBandPolicyVersion: 1 } }], crossFactorPolicy: null, decisionPolicy: null, ...change });
const persisted = (r: any) => ({ rulebookId: r.identity.rulebookId, rulebookVersion: r.identity.rulebookVersion, sourceTemplate: structuredClone(r.source), compilation: structuredClone(r.compilation), factorBindings: structuredClone(r.factorBindings), crossFactorPolicy: structuredClone(r.crossFactorPolicy), decisionPolicy: structuredClone(r.decisionPolicy) });

const harness = (initial: any[] = [], createFailure: unknown = null) => {
  const rows: any[] = initial.map((value) => structuredClone(value)); const calls: any[] = [];
  const matches = (row: any, filter: any) => Object.entries(filter).every(([key, value]) => key.split(".").reduce((v, p) => v?.[p], row) === value);
  const model: CompiledRulebookModelPort = {
    create: async (value: any) => { calls.push(["create", structuredClone(value)]); if (createFailure) throw createFailure; rows.push(structuredClone(value)); return value; },
    findOne: (filter) => ({ lean: () => ({ exec: async () => structuredClone(rows.find((r) => matches(r, filter)) ?? null) as Record<string, unknown> | null }) }),
    find: (filter) => {
      let values = rows.filter((r) => matches(r, filter)); let skipped = 0; let sorted: any = null;
      const query: any = { sort: (s: any) => { sorted = s; return query; }, skip: (n: number) => { skipped = n; return query; }, limit: (n: number) => ({ lean: () => ({ exec: async () => { const keys = Object.entries(sorted ?? {}); values.sort((a, b) => { for (const [key, direction] of keys) { const av: any = key.split(".").reduce((v: any, p) => v?.[p], a); const bv: any = key.split(".").reduce((v: any, p) => v?.[p], b); const c = av instanceof Date ? av.getTime() - bv.getTime() : av < bv ? -1 : av > bv ? 1 : 0; if (c) return c * (direction as number); } return 0; }); return structuredClone(values.slice(skipped, skipped + n)); } }) }) };
      calls.push(["find", filter, () => sorted]); return query;
    },
  };
  return { rows, calls, repository: new CompiledRulebookRepository(model) };
};

test("first insert succeeds, validates, detaches and never mutates input", async () => {
  const h = harness(); const input: any = rulebook(); const before = structuredClone(input); const result = await h.repository.insert(input);
  assert(result.inserted); assert.deepEqual(input, before); input.factorBindings[0].optionalBehavior = "OMIT"; assert.equal(h.rows[0]!.factorBindings[0].optionalBehavior, null); assert(Object.isFrozen(result.rulebook.factorBindings));
});
test("identical insert is duplicate while hash or content changes conflict without overwrite", async () => {
  const original: any = rulebook(); const h = harness([persisted(original)]);
  assert.deepEqual(await h.repository.insert(original), { inserted: false, code: "DUPLICATE_RULEBOOK" });
  assert.deepEqual(await h.repository.insert(rulebook({ compilation: { ...original.compilation, compilationInputHash: "b".repeat(64) } }) as any), { inserted: false, code: "RULEBOOK_VERSION_CONFLICT" });
  const content = rulebook(); content.factorBindings[0]!.weight = 50;
  assert.deepEqual(await h.repository.insert(content as any), { inserted: false, code: "RULEBOOK_VERSION_CONFLICT" }); assert.equal(h.rows[0]!.factorBindings[0].weight, 100);
});
test("duplicate-key races map to duplicate or conflict and raw E11000 never escapes", async () => {
  for (const [existing, expected] of [[rulebook(), "DUPLICATE_RULEBOOK"], [rulebook({ compilation: { ...rulebook().compilation, compilationInputHash: "b".repeat(64) } }), "RULEBOOK_VERSION_CONFLICT"]] as const) {
    const h = harness([persisted(existing)], { code: 11000 });
    // Force pre-read to miss, then race read to see the row.
    let reads = 0; const original = (h.repository as any).loadExact.bind(h.repository); (h.repository as any).loadExact = async (...args: any[]) => ++reads === 1 ? null : original(...args);
    assert.deepEqual(await h.repository.insert(rulebook() as any), { inserted: false, code: expected });
  }
});
test("invalid input and non-duplicate persistence errors fail typed", async () => {
  assert.deepEqual(await harness().repository.insert({} as any), { inserted: false, code: "INVALID_RULEBOOK" });
  assert.deepEqual(await harness([], new Error("secret")).repository.insert(rulebook() as any), { inserted: false, code: "PERSISTENCE_ERROR" });
});
test("exact versions coexist and exact reads never substitute latest", async () => {
  const v1: any = rulebook(); const v2: any = rulebook({ identity: { rulebookId: "BTC_RULEBOOK", rulebookVersion: 2 } }); const h = harness([persisted(v1), persisted(v2)]);
  const one = await h.repository.findExact("BTC_RULEBOOK", 1); assert(one.found && one.rulebook.identity.rulebookVersion === 1);
  assert.deepEqual(await h.repository.findExact("BTC_RULEBOOK", 3), { found: false, code: "NOT_FOUND" });
});
test("template listing is bounded, ordered, paginated, immutable, and supports multiple IDs", async () => {
  const a: any = rulebook({ identity: { rulebookId: "Z_RULEBOOK", rulebookVersion: 1 } }); const b: any = rulebook({ identity: { rulebookId: "A_RULEBOOK", rulebookVersion: 1 } }); const c: any = rulebook({ identity: { rulebookId: "C_RULEBOOK", rulebookVersion: 2 } });
  const result = await harness([persisted(a), persisted(c), persisted(b)]).repository.findByTemplateVersion({ templateId: "BTC_TEMPLATE", templateVersion: 1, skip: 1, limit: 1 });
  assert(result.listed); assert.deepEqual(result.items.map((r) => r.identity.rulebookId), ["Z_RULEBOOK"]); assert.equal(result.hasMore, true); assert(Object.isFrozen(result.items));
});
test("most recently compiled is deterministic convenience metadata only", async () => {
  const old: any = rulebook(); const recent: any = rulebook({ identity: { rulebookId: "RECENT", rulebookVersion: 2 }, compilation: { ...rulebook().compilation, compiledAt: new Date("2026-08-04") } });
  const result = await harness([persisted(old), persisted(recent)]).repository.findMostRecentlyCompiledForTemplateVersion("BTC_TEMPLATE", 1);
  assert(result.found && result.rulebook.identity.rulebookId === "RECENT");
});
test("repository exposes no update replace delete archive or upsert methods", () => {
  const repo: any = harness().repository; for (const method of ["update", "updateOne", "replace", "delete", "deleteOne", "archive", "upsert", "bulkWrite"]) assert.equal(repo[method], undefined);
});
