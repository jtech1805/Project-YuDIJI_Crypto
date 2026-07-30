import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalizeCycle,
  compareCycles,
  exitCodeForComparison,
  validateBaseline,
} from "../../../scripts/check-circular-dependencies.mjs";

const entry = (paths: string[], id = "LEGACY-CYCLE-001") => ({
  id,
  paths,
  reason: "Verified legacy coupling",
  owner: "architecture",
  introducedBefore: "Phase 1H",
  remediation: "Extract a neutral port",
  targetPhase: "Deferred",
});

const baseline = (cycles: ReturnType<typeof entry>[]) => ({
  version: 1,
  cycles,
});

test("normalizes cycle rotation and reverse orientation", () => {
  const expected = canonicalizeCycle(["src/a.ts", "src/b.ts", "src/c.ts"]);
  assert.deepEqual(
    canonicalizeCycle(["src/b.ts", "src/c.ts", "src/a.ts", "src/b.ts"]),
    expected,
  );
  assert.deepEqual(
    canonicalizeCycle(["src/c.ts", "src/b.ts", "src/a.ts"]),
    expected,
  );
});

test("approved cycles pass", () => {
  const approved = baseline([entry(["src/a.ts", "src/b.ts", "src/a.ts"])]);
  const result = compareCycles(approved, [["src/b.ts", "src/a.ts"]]);
  assert.deepEqual(result.newCycles, []);
  assert.deepEqual(result.resolvedCycles, []);
});

test("new and changed cycles fail comparison", () => {
  const approved = baseline([entry(["src/a.ts", "src/b.ts"])]);
  const added = compareCycles(approved, [
    ["src/a.ts", "src/b.ts"],
    ["src/x.ts", "src/y.ts"],
  ]);
  assert.equal(added.newCycles.length, 1);
  assert.equal(exitCodeForComparison(added), 1);

  const changed = compareCycles(approved, [["src/a.ts", "src/c.ts"]]);
  assert.equal(changed.newCycles.length, 1);
  assert.equal(changed.resolvedCycles.length, 1);
  assert.equal(exitCodeForComparison(changed), 1);
});

test("resolved baseline entries are reported", () => {
  const approved = baseline([entry(["src/a.ts", "src/b.ts"])]);
  const result = compareCycles(approved, []);
  assert.equal(result.resolvedCycles[0]?.id, "LEGACY-CYCLE-001");
});

test("malformed baseline data is rejected", () => {
  for (const malformed of [
    null,
    {},
    { version: 2, cycles: [] },
    baseline([{ ...entry(["src/a.ts", "src/b.ts"]), reason: "" }]),
    baseline([entry(["../a.ts", "src/b.ts"])]),
  ]) {
    assert.throws(() => validateBaseline(malformed));
  }
});

test("duplicate baseline IDs and normalized cycles are rejected", () => {
  assert.throws(() =>
    validateBaseline(baseline([
      entry(["src/a.ts", "src/b.ts"], "ONE"),
      entry(["src/c.ts", "src/d.ts"], "ONE"),
    ])));
  assert.throws(() =>
    validateBaseline(baseline([
      entry(["src/a.ts", "src/b.ts"], "ONE"),
      entry(["src/b.ts", "src/a.ts"], "TWO"),
    ])));
});
