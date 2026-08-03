import assert from "node:assert/strict";
import test from "node:test";
import { CanonicalTemplateSnapshotService } from "../../../src/services/canonical-template-snapshot.service.js";

const snapshot = (config: any = { a: 1, b: 2 }): any => ({ templateId: "BTC_CONTEXT_EXPERIMENTAL", templateVersion: 1, templateKind: "USER" as const, status: "DRAFT" as const, visibility: "PRIVATE" as const, scope: { marketType: "CRYPTO", tradeStyle: "INTRADAY", instrumentType: "SPOT", allowedTradableSymbols: [] }, aggregationMode: "WEIGHTED_SUM" as const, sections: [{ sectionKey: "CRYPTO_CONTEXT", weight: 100, enabled: true, missingDataPolicy: "BLOCK" as const, evaluators: [{ evaluatorKey: "GENERIC_FACTOR:CRYPTO.ETF_NET_FLOW", label: "ETF flow", weight: 100, enabled: true, config }] }] });
const service = new CanonicalTemplateSnapshotService();

test("equal projections and reordered configuration keys produce one SHA-256 hash", () => {
  const a = service.create(snapshot({ a: 1, b: { c: 2, d: 3 } }));
  const b = service.create(snapshot({ b: { d: 3, c: 2 }, a: 1 }));
  assert.equal(a.valid && a.hash.length, 64); assert.deepEqual(a, b);
});
test("every material authoring change changes the hash", () => {
  const base = snapshot(); const original = service.create(base); assert(original.valid);
  const variants = [
    { ...base, sections: [{ ...base.sections[0]!, weight: 99 }] },
    { ...base, sections: [{ ...base.sections[0]!, evaluators: [{ ...base.sections[0]!.evaluators[0]!, weight: 99 }] }] },
    { ...base, sections: [{ ...base.sections[0]!, enabled: false }] },
    snapshot({ a: 2 }),
    { ...base, sections: [{ ...base.sections[0]!, missingDataPolicy: "IGNORE" as const }] },
  ];
  for (const variant of variants) { const result = service.create(variant as any); assert(result.valid); assert.notEqual(result.hash, original.hash); }
});
test("section and evaluator array order are hash material", () => {
  const base: any = snapshot(); base.sections.push({ ...base.sections[0], sectionKey: "SECOND" });
  const reversed = { ...base, sections: [...base.sections].reverse() };
  assert.notEqual((service.create(base) as any).hash, (service.create(reversed) as any).hash);
  const two: any = snapshot(); two.sections[0].evaluators.push({ ...two.sections[0].evaluators[0], evaluatorKey: "SECOND" });
  const reversedEvaluators = { ...two, sections: [{ ...two.sections[0], evaluators: [...two.sections[0].evaluators].reverse() }] };
  assert.notEqual((service.create(two) as any).hash, (service.create(reversedEvaluators) as any).hash);
});
test("negative zero canonicalizes to zero and inputs remain detached", () => {
  const negative: any = snapshot({ value: -0 }); const zero = snapshot({ value: 0 });
  assert.equal((service.create(negative) as any).hash, (service.create(zero) as any).hash);
  const result = service.create(negative); negative.sections[0].evaluators[0].config.value = 4;
  assert(result.valid); assert.equal((result.snapshot.sections[0]!.evaluators[0]!.config as any).value, 0);
});
test("functions symbols bigint dates undefined and cycles fail typed", () => {
  const cyclic: any = {}; cyclic.self = cyclic;
  for (const value of [() => 1, Symbol("x"), 1n, new Date(), undefined, cyclic]) {
    const result = service.create(snapshot({ value }) as any); assert.equal(result.valid, false); if (!result.valid) assert.equal(result.code, "INVALID_TEMPLATE_SNAPSHOT_VALUE");
  }
});
