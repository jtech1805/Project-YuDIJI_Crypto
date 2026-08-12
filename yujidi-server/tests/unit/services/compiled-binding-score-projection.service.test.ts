import assert from "node:assert/strict";
import test from "node:test";
import { CompiledBindingScoreProjectionService } from "../../../src/services/compiled-rulebook/compiled-binding-score-projection.service.js";

const service = new CompiledBindingScoreProjectionService();
const result = (points: number, minimumPoints = -2, maximumPoints = 2) => ({ contribution: { points, minimumPoints, maximumPoints } });
test("projects exact minimum zero and maximum contribution endpoints", () => {
  assert.deepEqual(service.project(result(-2)), { projected: true, score: 0 });
  assert.deepEqual(service.project(result(0)), { projected: true, score: 50 });
  assert.deepEqual(service.project(result(2)), { projected: true, score: 100 });
});
test("preserves native precision without clamping rounding weighting or confidence", () => {
  assert.deepEqual(service.project(result(-1)), { projected: true, score: 25 });
  assert.deepEqual(service.project(result(0.5)), { projected: true, score: 62.5 });
});
test("fails closed for invalid bounds and out-of-range points", () => {
  for (const value of [result(-3), result(3), result(0, 0, 2), result(0, -2, 0), result(Number.NaN)]) assert.equal((service.project(value) as any).code, "INVALID_CONTRIBUTION_BOUNDS");
});

