import assert from "node:assert/strict";
import test from "node:test";
import { CanonicalCompilationInputService } from "../../../src/services/canonical-compilation-input.service.js";

const service = new CanonicalCompilationInputService();
test("canonical compilation hashing is stable, sorted, lowercase SHA-256", () => {
  const a = service.hash({ z: [{ b: 2, a: 1 }], n: -0 });
  const b = service.hash({ n: 0, z: [{ a: 1, b: 2 }] });
  assert.deepEqual(a, b); assert(a.hashed); assert.match(a.hash, /^[a-f0-9]{64}$/);
});
test("array order is material", () => {
  const a = service.hash({ bindings: [1, 2] }); const b = service.hash({ bindings: [2, 1] });
  assert(a.hashed && b.hashed); assert.notEqual(a.hash, b.hash);
});
test("unsupported canonical values fail typed", () => {
  const cycle: any = {}; cycle.self = cycle;
  for (const value of [undefined, () => 1, Symbol("x"), 1n, new Date(), Number.NaN, Infinity, cycle]) {
    const result = service.hash({ value }); assert.equal(result.hashed, false);
    if (!result.hashed) assert.equal(result.code, "COMPILATION_INPUT_CANONICALIZATION_FAILED");
  }
});
