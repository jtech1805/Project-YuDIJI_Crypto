import assert from "node:assert/strict";
import test from "node:test";
import { CompiledSubjectResolutionService } from "../../../src/services/compiled-subject-resolution.service.js";

const service = new CompiledSubjectResolutionService();
const context = { tradedInstrument: { type: "INSTRUMENT", key: "NSE:TATASTEEL" }, underlyingAsset: { type: "ASSET", key: "BTC" } };

test("resolves FIXED and ignores irrelevant malformed context", () => {
  const result = service.resolve({ type: "FIXED", subject: { type: "MARKET", key: "NIFTY" } }, { tradedInstrument: 42 });
  assert.deepEqual(result, { resolved: true, subject: { type: "MARKET", key: "NIFTY" } });
  assert(Object.isFrozen(result)); if (result.resolved) assert(Object.isFrozen(result.subject));
});

test("resolves TRADED_INSTRUMENT from explicit canonical context", () => {
  assert.deepEqual(service.resolve({ type: "TRADED_INSTRUMENT" }, context), { resolved: true, subject: context.tradedInstrument });
  assert.equal((service.resolve({ type: "TRADED_INSTRUMENT" }, { ...context, tradedInstrument: null }) as any).code, "MISSING_TRADED_INSTRUMENT");
  assert.equal((service.resolve({ type: "TRADED_INSTRUMENT" }, { ...context, tradedInstrument: { type: "ASSET", key: "BTC" } }) as any).code, "INVALID_TRADED_INSTRUMENT");
});

test("resolves UNDERLYING_ASSET from explicit canonical context", () => {
  assert.deepEqual(service.resolve({ type: "UNDERLYING_ASSET" }, context), { resolved: true, subject: context.underlyingAsset });
  assert.equal((service.resolve({ type: "UNDERLYING_ASSET" }, { ...context, underlyingAsset: null }) as any).code, "MISSING_UNDERLYING_ASSET");
  assert.equal((service.resolve({ type: "UNDERLYING_ASSET" }, { ...context, underlyingAsset: { type: "ASSET", key: "bad key" } }) as any).code, "INVALID_UNDERLYING_ASSET");
});

test("rejects unknown and malformed compiled subject bindings", () => {
  for (const binding of [null, {}, { type: "OTHER" }, { type: "FIXED", subject: { type: "ASSET", key: " bad" } }]) {
    assert.equal((service.resolve(binding, context) as any).code, "INVALID_COMPILED_SUBJECT_BINDING");
  }
});

