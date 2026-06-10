import assert from "node:assert/strict";
import test from "node:test";

import { AnalyzerEngine } from "./analyzer.service.js";

const SYMBOL = "SOLUSDT";
const START_AT = Date.UTC(2026, 0, 1, 0, 0, 0);

type FakeMonitorOptions = {
  id?: string;
  userId?: string;
  trigger?: "drop" | "spike";
  thresholdPercentage?: number;
  timeWindowMinutes?: number;
};

type TestHarness = {
  engine: AnalyzerEngine;
  emittedAlerts: Array<{ userId: string; payload: unknown }>;
  createdAlerts: Record<string, unknown>[];
  calls: {
    findActiveMonitors: number;
    fetchRecentHeadlines: number;
    generateAlertReport: number;
    createAlert: number;
  };
};

const makeMonitor = (options: FakeMonitorOptions = {}) => {
  const id = options.id ?? "monitor-1";
  const userId = options.userId ?? "user-1";

  return {
    _id: { toString: () => id },
    user: { toString: () => userId },
    symbol: SYMBOL,
    thresholdPercentage: options.thresholdPercentage ?? 2.5,
    timeWindowMinutes: options.timeWindowMinutes ?? 1,
    trigger: options.trigger ?? "drop",
    isActive: true,
  } as never;
};

const createHarness = (
  monitors: unknown[],
  overrides: {
    generateAlertReport?: () => Promise<{
      catalyst: string;
      threatLevel: string;
      support: string;
      resistance: string;
      summary: string;
    }>;
  } = {},
): TestHarness => {
  const emittedAlerts: Array<{ userId: string; payload: unknown }> = [];
  const createdAlerts: Record<string, unknown>[] = [];
  const calls = {
    findActiveMonitors: 0,
    fetchRecentHeadlines: 0,
    generateAlertReport: 0,
    createAlert: 0,
  };

  const engine = new AnalyzerEngine(
    (userId, payload) => {
      emittedAlerts.push({ userId, payload });
    },
    {
      findActiveMonitors: async () => {
        calls.findActiveMonitors += 1;
        return monitors as never;
      },
      fetchRecentHeadlines: async () => {
        calls.fetchRecentHeadlines += 1;
        return "Test headline";
      },
      llmService: {
        generateAlertReport: async () => {
          calls.generateAlertReport += 1;
          if (overrides.generateAlertReport) {
            return overrides.generateAlertReport();
          }

          return {
            catalyst: "Test catalyst",
            threatLevel: "Moderate Move",
            support: "No strong support found",
            resistance: "No strong resistance found",
            summary: "Test summary",
          };
        },
      },
      createAlert: async (payload) => {
        calls.createAlert += 1;
        createdAlerts.push(payload);

        return {
          _id: { toString: () => `alert-${calls.createAlert}` },
          toObject: () => ({
            _id: `alert-${calls.createAlert}`,
            ...payload,
          }),
        } as never;
      },
    },
  );

  return {
    engine,
    emittedAlerts,
    createdAlerts,
    calls,
  };
};

test("processTick creates a drop alert when drop threshold is breached", async () => {
  const harness = createHarness([makeMonitor({ trigger: "drop" })]);

  await harness.engine.processTick(SYMBOL, 100, START_AT, false, 1);
  await harness.engine.processTick(SYMBOL, 97.5, START_AT + 60_000, true, 1);

  assert.equal(harness.calls.createAlert, 1);
  assert.equal(harness.emittedAlerts.length, 1);
  assert.equal(harness.emittedAlerts[0]?.userId, "user-1");
  assert.equal(harness.createdAlerts[0]?.symbol, SYMBOL);
  assert.equal(harness.createdAlerts[0]?.triggerType, "drop");
  assert.equal(harness.createdAlerts[0]?.direction, "down");
  assert.equal(harness.createdAlerts[0]?.changePercentage, -2.5);
  assert.equal(harness.createdAlerts[0]?.dropPercentage, 2.5);
});

test("processTick creates a spike alert when spike threshold is breached", async () => {
  const harness = createHarness([makeMonitor({ trigger: "spike" })]);

  await harness.engine.processTick(SYMBOL, 100, START_AT, false, 1);
  await harness.engine.processTick(SYMBOL, 102.5, START_AT + 60_000, false, 1);

  assert.equal(harness.calls.createAlert, 1);
  assert.equal(harness.createdAlerts[0]?.triggerType, "spike");
  assert.equal(harness.createdAlerts[0]?.direction, "up");
  assert.equal(harness.createdAlerts[0]?.changePercentage, 2.5);
});

test("processTick does not create a spike alert on a downward drop", async () => {
  const harness = createHarness([makeMonitor({ trigger: "spike" })]);

  await harness.engine.processTick(SYMBOL, 100, START_AT, false, 1);
  await harness.engine.processTick(SYMBOL, 97, START_AT + 60_000, true, 1);

  assert.equal(harness.calls.createAlert, 0);
  assert.equal(harness.emittedAlerts.length, 0);
});

test("processTick does not create alert when there is insufficient price history", async () => {
  const harness = createHarness([makeMonitor({ trigger: "drop" })]);

  await harness.engine.processTick(SYMBOL, 97.5, START_AT + 60_000, true, 1);

  assert.equal(harness.calls.createAlert, 0);
  assert.equal(harness.calls.generateAlertReport, 0);
});

test("processTick cooldown prevents duplicate alerts", async () => {
  const harness = createHarness([makeMonitor({ trigger: "drop" })]);

  await harness.engine.processTick(SYMBOL, 100, START_AT, false, 1);
  await harness.engine.processTick(SYMBOL, 97.5, START_AT + 60_000, true, 1);
  await harness.engine.processTick(SYMBOL, 96, START_AT + 61_000, true, 1);

  assert.equal(harness.calls.createAlert, 1);
  assert.equal(harness.emittedAlerts.length, 1);
});

test("processTick does not save alert when LLM report generation fails", async () => {
  const harness = createHarness([makeMonitor({ trigger: "drop" })], {
    generateAlertReport: async () => {
      throw new Error("LLM failed");
    },
  });

  await harness.engine.processTick(SYMBOL, 100, START_AT, false, 1);
  await harness.engine.processTick(SYMBOL, 97.5, START_AT + 60_000, true, 1);

  assert.equal(harness.calls.generateAlertReport, 1);
  assert.equal(harness.calls.createAlert, 0);
  assert.equal(harness.emittedAlerts.length, 0);
});

test("processTick negative cache avoids repeated monitor fetch within TTL", async () => {
  const harness = createHarness([]);

  await harness.engine.processTick(SYMBOL, 100, START_AT, false, 1);
  await harness.engine.processTick(SYMBOL, 101, START_AT + 1_000, false, 1);

  assert.equal(harness.calls.findActiveMonitors, 1);

  const snapshot = harness.engine.getEngineStateSnapshot();
  const activeMonitorCache = snapshot.activeMonitorCache as Record<
    string,
    { activeMonitorCount: number; isNegativeCache: boolean }
  >;

  assert.equal(activeMonitorCache[SYMBOL]?.activeMonitorCount, 0);
  assert.equal(activeMonitorCache[SYMBOL]?.isNegativeCache, true);
});
