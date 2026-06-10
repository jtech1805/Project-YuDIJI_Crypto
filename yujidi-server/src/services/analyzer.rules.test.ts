import assert from "node:assert/strict";
import test from "node:test";

import {
  createMonitorCacheSnapshot,
  evaluateMonitorThreshold,
  MONITOR_CACHE_TTL_MS,
  normalizeMonitorTrigger,
} from "./analyzer.rules.js";

test("drop monitor breaches when percent change is at or below negative threshold", () => {
  const result = evaluateMonitorThreshold(-2.5, 2.5, "drop");

  assert.equal(result.triggerType, "drop");
  assert.equal(result.direction, "down");
  assert.equal(result.changePercentage, -2.5);
  assert.equal(result.movementMagnitude, 2.5);
  assert.equal(result.thresholdBreached, true);
});

test("drop monitor does not breach on an upward spike", () => {
  const result = evaluateMonitorThreshold(3, 2.5, "drop");

  assert.equal(result.triggerType, "drop");
  assert.equal(result.direction, "up");
  assert.equal(result.thresholdBreached, false);
});

test("spike monitor breaches when percent change is at or above positive threshold", () => {
  const result = evaluateMonitorThreshold(2.5, 2.5, "spike");

  assert.equal(result.triggerType, "spike");
  assert.equal(result.direction, "up");
  assert.equal(result.changePercentage, 2.5);
  assert.equal(result.movementMagnitude, 2.5);
  assert.equal(result.thresholdBreached, true);
});

test("spike monitor does not breach on a downward drop", () => {
  const result = evaluateMonitorThreshold(-3, 2.5, "spike");

  assert.equal(result.triggerType, "spike");
  assert.equal(result.direction, "down");
  assert.equal(result.thresholdBreached, false);
});

test("invalid monitor trigger is normalized to null and never breaches", () => {
  assert.equal(normalizeMonitorTrigger("pattern"), null);

  const result = evaluateMonitorThreshold(10, 2.5, "pattern");

  assert.equal(result.triggerType, null);
  assert.equal(result.thresholdBreached, false);
});

test("threshold evaluation rounds display values to two decimals", () => {
  const result = evaluateMonitorThreshold(1.236, 1.23, "spike");

  assert.equal(result.changePercentage, 1.24);
  assert.equal(result.movementMagnitude, 1.24);
  assert.equal(result.thresholdBreached, true);
});

test("monitor cache snapshot marks zero-monitor entries as negative cache", () => {
  const loadedAt = Date.UTC(2026, 0, 1, 0, 0, 0);
  const snapshot = createMonitorCacheSnapshot(
    {
      monitors: [],
      loadedAt,
      expiresAt: loadedAt + MONITOR_CACHE_TTL_MS,
    },
    loadedAt + 1000,
  );

  assert.equal(snapshot.activeMonitorCount, 0);
  assert.equal(snapshot.isNegativeCache, true);
  assert.equal(snapshot.ttlRemainingMs, 4000);
});

test("monitor cache snapshot marks active entries as non-negative cache", () => {
  const loadedAt = Date.UTC(2026, 0, 1, 0, 0, 0);
  const snapshot = createMonitorCacheSnapshot(
    {
      monitors: [{ id: "monitor-1" }],
      loadedAt,
      expiresAt: loadedAt + MONITOR_CACHE_TTL_MS,
    },
    loadedAt + MONITOR_CACHE_TTL_MS + 1000,
  );

  assert.equal(snapshot.activeMonitorCount, 1);
  assert.equal(snapshot.isNegativeCache, false);
  assert.equal(snapshot.ttlRemainingMs, 0);
});
