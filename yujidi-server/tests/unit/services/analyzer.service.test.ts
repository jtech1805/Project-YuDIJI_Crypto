import assert from "node:assert/strict";
import test from "node:test";

import {
  ALERT_REPORT_PROMPT_VERSION,
  AnalyzerEngine,
} from "../../../src/services/trading/analyzer.service.js";
import type { CreateLlmTraceInput } from "../../../src/types/llm-trace.types.js";

const SYMBOL = "SOLUSDT";
const START_AT = Date.UTC(2026, 0, 1, 0, 0, 0);

type FakeMonitorOptions = {
  id?: string;
  userId?: string;
  symbol?: string;
  provider?: "BINANCE" | "ANGEL_ONE";
  marketType?: "CRYPTO" | "COMMODITY";
  exchange?: "BINANCE" | "MCX";
  instrumentToken?: string;
  providerSymbol?: string;
  displayName?: string;
  trigger?: "drop" | "spike";
  thresholdPercentage?: number;
  timeWindowMinutes?: number;
};

type TestHarness = {
  engine: AnalyzerEngine;
  emittedAlerts: Array<{ userId: string; payload: unknown }>;
  createdAlerts: Record<string, unknown>[];
  traces: CreateLlmTraceInput[];
  calls: {
    findActiveMonitors: number;
    fetchRecentHeadlines: number;
    generateAlertReport: number;
    recordTrace: number;
    createAlert: number;
  };
};

const makeMonitor = (options: FakeMonitorOptions = {}) => {
  const id = options.id ?? "monitor-1";
  const userId = options.userId ?? "user-1";

  return {
    _id: { toString: () => id },
    user: { toString: () => userId },
    symbol: options.symbol ?? SYMBOL,
    provider: options.provider ?? "BINANCE",
    marketType: options.marketType ?? "CRYPTO",
    exchange: options.exchange ?? "BINANCE",
    instrumentToken: options.instrumentToken ?? options.symbol ?? SYMBOL,
    providerSymbol: options.providerSymbol ?? options.symbol ?? SYMBOL,
    displayName: options.displayName ?? options.symbol ?? SYMBOL,
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
    createAlertError?: Error;
    traceError?: Error;
    nowValues?: Date[];
    ids?: string[];
  } = {},
): TestHarness => {
  const emittedAlerts: Array<{ userId: string; payload: unknown }> = [];
  const createdAlerts: Record<string, unknown>[] = [];
  const traces: CreateLlmTraceInput[] = [];
  let nowIndex = 0;
  let idIndex = 0;
  const calls = {
    findActiveMonitors: 0,
    fetchRecentHeadlines: 0,
    generateAlertReport: 0,
    recordTrace: 0,
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
      findActiveMonitorsForNormalizedTick: async (tick) => {
        calls.findActiveMonitors += 1;
        return monitors.filter((monitor) => {
          const candidate = monitor as {
            user?: { toString(): string };
            provider?: string;
            exchange?: string;
            instrumentToken?: string;
            isActive?: boolean;
          };

          if (tick.provider === "ANGEL_ONE") {
            return (
              candidate.user?.toString() === tick.userId &&
              candidate.provider === tick.provider &&
              candidate.exchange === tick.exchange &&
              candidate.instrumentToken === tick.instrumentToken &&
              candidate.isActive === true
            );
          }

          return (
            candidate.provider === tick.provider &&
            candidate.exchange === tick.exchange &&
            candidate.instrumentToken === tick.instrumentToken &&
            candidate.isActive === true
          );
        }) as never;
      },
      fetchRecentHeadlines: async () => {
        calls.fetchRecentHeadlines += 1;
        return "Test headline";
      },
      llmService: {
        getProviderMetadata: () => ({
          name: "test-llm-provider",
          modelName: "test-llm-model",
        }),
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
      llmTraceService: {
        record: async (input) => {
          calls.recordTrace += 1;
          if (overrides.traceError) throw overrides.traceError;
          traces.push(input);
        },
      },
      getNow: () => overrides.nowValues?.[nowIndex++] ?? new Date(START_AT),
      generateId: () => {
        const generatedId = overrides.ids?.[idIndex] ?? `generated-id-${idIndex + 1}`;
        idIndex += 1;
        return generatedId;
      },
      createAlert: async (payload) => {
        calls.createAlert += 1;
        if (overrides.createAlertError) throw overrides.createAlertError;
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
    traces,
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
  assert.equal(harness.calls.generateAlertReport, 1);
  assert.equal(harness.traces.length, 1);
  const trace = harness.traces[0];
  assert.equal(trace?.traceId, "generated-id-1");
  assert.equal(trace?.correlationId, "generated-id-2");
  assert.equal(trace?.status, "COMPLETED");
  assert.equal(trace?.taskType, "ALERT_REPORT");
  assert.equal(trace?.userId, "user-1");
  assert.deepEqual(trace?.source, {
    entityType: "TRIPWIRE_MONITOR",
    entityId: "monitor-1",
  });
  assert.equal(trace?.provider, "test-llm-provider");
  assert.equal(trace?.model, "test-llm-model");
  assert.equal(trace?.promptVersion, ALERT_REPORT_PROMPT_VERSION);
  assert.equal(trace?.fallbackUsed, false);
  assert.deepEqual(trace?.validation, {
    parseSucceeded: true,
    schemaSucceeded: true,
    semanticSucceeded: true,
  });
  assert.match(trace?.inputReference?.hash ?? "", /^[a-f0-9]{64}$/);
  assert.deepEqual(trace?.inputReference?.redactedSummary, {
    provider: "BINANCE",
    marketType: "CRYPTO",
    exchange: "BINANCE",
    triggerType: "drop",
    direction: "down",
    timeWindowMinutes: 1,
    newsContextLength: 13,
    supportAvailable: false,
    resistanceAvailable: false,
  });
  assert.deepEqual(trace?.outputReference?.fieldSummary, {
    catalystLength: 13,
    threatLevelLength: 13,
    supportLength: 23,
    resistanceLength: 26,
    summaryLength: 12,
  });
});

test("processTick creates a spike alert when spike threshold is breached", async () => {
  const harness = createHarness([makeMonitor({ trigger: "spike" })]);

  await harness.engine.processTick(SYMBOL, 100, START_AT, false, 1);
  await harness.engine.processTick(SYMBOL, 102.5, START_AT + 60_000, false, 1);

  assert.equal(harness.calls.createAlert, 1);
  assert.equal(harness.createdAlerts[0]?.triggerType, "spike");
  assert.equal(harness.createdAlerts[0]?.direction, "up");
  assert.equal(harness.createdAlerts[0]?.changePercentage, 2.5);
  assert.equal(harness.traces.length, 1);
  assert.equal(
    harness.traces[0]?.inputReference?.redactedSummary?.triggerType,
    "spike",
  );
});

test("processTick does not create a spike alert on a downward drop", async () => {
  const harness = createHarness([makeMonitor({ trigger: "spike" })]);

  await harness.engine.processTick(SYMBOL, 100, START_AT, false, 1);
  await harness.engine.processTick(SYMBOL, 97, START_AT + 60_000, true, 1);

  assert.equal(harness.calls.createAlert, 0);
  assert.equal(harness.emittedAlerts.length, 0);
  assert.equal(harness.traces.length, 0);
});

test("processTick does not create alert when there is insufficient price history", async () => {
  const harness = createHarness([makeMonitor({ trigger: "drop" })]);

  await harness.engine.processTick(SYMBOL, 97.5, START_AT + 60_000, true, 1);

  assert.equal(harness.calls.createAlert, 0);
  assert.equal(harness.calls.generateAlertReport, 0);
  assert.equal(harness.traces.length, 0);
});

test("processTick cooldown prevents duplicate alerts", async () => {
  const harness = createHarness([makeMonitor({ trigger: "drop" })]);

  await harness.engine.processTick(SYMBOL, 100, START_AT, false, 1);
  await harness.engine.processTick(SYMBOL, 97.5, START_AT + 60_000, true, 1);
  await harness.engine.processTick(SYMBOL, 96, START_AT + 61_000, true, 1);

  assert.equal(harness.calls.createAlert, 1);
  assert.equal(harness.emittedAlerts.length, 1);
  assert.equal(harness.traces.length, 1);
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
  assert.equal(harness.traces.length, 1);
  assert.equal(harness.traces[0]?.status, "PROVIDER_FAILED");
  assert.equal(harness.traces[0]?.failureCode, "ALERT_REPORT_GENERATION_FAILED");
  assert.equal(harness.traces[0]?.fallbackUsed, false);
  assert.deepEqual(harness.traces[0]?.validation, {
    parseSucceeded: false,
    schemaSucceeded: false,
    semanticSucceeded: false,
  });
  assert.equal(JSON.stringify(harness.traces).includes("LLM failed"), false);
  assert.equal(harness.engine.cooldowns.get("monitor-1"), START_AT + 60_000);
});

test("analyzer trace timing is deterministic and negative latency is clamped", async () => {
  const startedAt = new Date("2026-07-28T10:00:01.000Z");
  const completedAt = new Date("2026-07-28T10:00:00.000Z");
  const harness = createHarness([makeMonitor()], {
    nowValues: [startedAt, completedAt],
    ids: ["trace-fixed", "correlation-fixed"],
  });

  await harness.engine.processTick(SYMBOL, 100, START_AT, false, 1);
  await harness.engine.processTick(SYMBOL, 97.5, START_AT + 60_000, true, 1);

  assert.equal(harness.traces[0]?.traceId, "trace-fixed");
  assert.equal(harness.traces[0]?.correlationId, "correlation-fixed");
  assert.equal(harness.traces[0]?.startedAt, startedAt);
  assert.equal(harness.traces[0]?.completedAt, completedAt);
  assert.equal(harness.traces[0]?.latencyMs, 0);
});

test("safe analyzer trace hash is deterministic and trace metadata excludes raw content", async () => {
  const first = createHarness([makeMonitor()]);
  const second = createHarness([makeMonitor()]);

  for (const harness of [first, second]) {
    await harness.engine.processTick(SYMBOL, 100, START_AT, false, 1);
    await harness.engine.processTick(SYMBOL, 97.5, START_AT + 60_000, true, 1);
  }

  assert.equal(first.traces[0]?.inputReference?.hash, second.traces[0]?.inputReference?.hash);
  const serialized = JSON.stringify(first.traces);
  for (const forbidden of [
    "Test headline",
    "Test catalyst",
    "Test summary",
    "No strong support found",
    "No strong resistance found",
    "LLM failed",
    "apiKey",
    "feedToken",
    "authorization",
    "cookie",
    "bids",
    "asks",
  ]) {
    assert.equal(serialized.includes(forbidden), false, `trace contains ${forbidden}`);
  }
});

test("trace rejection cannot prevent successful alert persistence and emission", async () => {
  const harness = createHarness([makeMonitor()], {
    traceError: new Error("trace unavailable"),
  });

  await harness.engine.processTick(SYMBOL, 100, START_AT, false, 1);
  await harness.engine.processTick(SYMBOL, 97.5, START_AT + 60_000, true, 1);

  assert.equal(harness.calls.recordTrace, 1);
  assert.equal(harness.calls.createAlert, 1);
  assert.equal(harness.emittedAlerts.length, 1);
});

test("LLM failure behavior is preserved when failure trace also rejects", async () => {
  const harness = createHarness([makeMonitor()], {
    generateAlertReport: async () => {
      throw new Error("provider unavailable");
    },
    traceError: new Error("trace unavailable"),
  });

  await harness.engine.processTick(SYMBOL, 100, START_AT, false, 1);
  await harness.engine.processTick(SYMBOL, 97.5, START_AT + 60_000, true, 1);

  assert.equal(harness.calls.recordTrace, 1);
  assert.equal(harness.calls.createAlert, 0);
  assert.equal(harness.emittedAlerts.length, 0);
});

test("alert persistence failure does not change the completed LLM trace", async () => {
  const harness = createHarness([makeMonitor()], {
    createAlertError: new Error("alert persistence failed"),
  });

  await harness.engine.processTick(SYMBOL, 100, START_AT, false, 1);
  await harness.engine.processTick(SYMBOL, 97.5, START_AT + 60_000, true, 1);

  assert.equal(harness.calls.createAlert, 1);
  assert.equal(harness.emittedAlerts.length, 0);
  assert.equal(harness.traces.length, 1);
  assert.equal(harness.traces[0]?.status, "COMPLETED");
});

test("processTick negative cache avoids repeated monitor fetch within TTL", async () => {
  const harness = createHarness([]);

  await harness.engine.processTick(SYMBOL, 100, START_AT, false, 1);
  await harness.engine.processTick(SYMBOL, 101, START_AT + 1_000, false, 1);

  assert.equal(harness.calls.findActiveMonitors, 1);
  assert.equal(harness.traces.length, 0);

  const snapshot = harness.engine.getEngineStateSnapshot();
  const activeMonitorCache = snapshot.activeMonitorCache as Record<
    string,
    { activeMonitorCount: number; isNegativeCache: boolean }
  >;

  assert.equal(activeMonitorCache[SYMBOL]?.activeMonitorCount, 0);
  assert.equal(activeMonitorCache[SYMBOL]?.isNegativeCache, true);
});

test("processNormalizedTick creates Angel spike alert with provider metadata", async () => {
  const universalSymbol = "MCX:CRUDEOIL:26JUN2026:7200:CE";
  const harness = createHarness([
    makeMonitor({
      id: "monitor-1",
      userId: "user-1",
      symbol: universalSymbol,
      displayName: "MCX CRUDEOIL 26JUN2026 7200 CE",
      provider: "ANGEL_ONE",
      marketType: "COMMODITY",
      exchange: "MCX",
      instrumentToken: "253456",
      providerSymbol: "CRUDEOIL26JUN7200CE",
      thresholdPercentage: 2.5,
      trigger: "spike",
    }),
  ]);

  await harness.engine.processNormalizedTick({
    provider: "ANGEL_ONE",
    scope: "USER_SESSION",
    userId: "user-1",
    marketType: "COMMODITY",
    exchange: "MCX",
    symbol: universalSymbol,
    displayName: "MCX CRUDEOIL 26JUN2026 7200 CE",
    displaySymbol: "MCX CRUDEOIL 26JUN2026 7200 CE",
    providerSymbol: "CRUDEOIL26JUN7200CE",
    instrumentToken: "253456",
    price: 7200,
    volume: 100,
    timestamp: START_AT,
  });

  await harness.engine.processNormalizedTick({
    provider: "ANGEL_ONE",
    scope: "USER_SESSION",
    userId: "user-1",
    marketType: "COMMODITY",
    exchange: "MCX",
    symbol: universalSymbol,
    displayName: "MCX CRUDEOIL 26JUN2026 7200 CE",
    displaySymbol: "MCX CRUDEOIL 26JUN2026 7200 CE",
    providerSymbol: "CRUDEOIL26JUN7200CE",
    instrumentToken: "253456",
    price: 7380,
    volume: 100,
    timestamp: START_AT + 60_000,
  });

  assert.equal(harness.calls.createAlert, 1);
  assert.equal(harness.createdAlerts[0]?.symbol, universalSymbol);
  assert.equal(harness.createdAlerts[0]?.provider, "ANGEL_ONE");
  assert.equal(harness.createdAlerts[0]?.exchange, "MCX");
  assert.equal(harness.createdAlerts[0]?.instrumentToken, "253456");
  assert.equal(harness.createdAlerts[0]?.previousPrice, 7200);
  assert.equal(harness.createdAlerts[0]?.currentPrice, 7380);
  assert.equal(harness.createdAlerts[0]?.triggerType, "spike");
  assert.equal(harness.traces.length, 1);
  assert.equal(harness.traces[0]?.provider, "test-llm-provider");
  assert.equal(harness.traces[0]?.model, "test-llm-model");
  assert.equal(
    harness.traces[0]?.inputReference?.redactedSummary?.provider,
    "ANGEL_ONE",
  );
});

test("processNormalizedTick creates Angel drop alert", async () => {
  const universalSymbol = "MCX:GOLD:04DEC2026:FUTURE";
  const harness = createHarness([
    makeMonitor({
      id: "monitor-1",
      userId: "user-1",
      symbol: universalSymbol,
      provider: "ANGEL_ONE",
      marketType: "COMMODITY",
      exchange: "MCX",
      instrumentToken: "495213",
      providerSymbol: "GOLD04DEC26FUT",
      displayName: "MCX GOLD 04DEC2026 FUTURE",
      thresholdPercentage: 1,
      trigger: "drop",
    }),
  ]);

  await harness.engine.processNormalizedTick({
    provider: "ANGEL_ONE",
    scope: "USER_SESSION",
    userId: "user-1",
    marketType: "COMMODITY",
    exchange: "MCX",
    symbol: universalSymbol,
    displayName: "MCX GOLD 04DEC2026 FUTURE",
    displaySymbol: "MCX GOLD 04DEC2026 FUTURE",
    providerSymbol: "GOLD04DEC26FUT",
    instrumentToken: "495213",
    price: 160000,
    timestamp: START_AT,
  });
  await harness.engine.processNormalizedTick({
    provider: "ANGEL_ONE",
    scope: "USER_SESSION",
    userId: "user-1",
    marketType: "COMMODITY",
    exchange: "MCX",
    symbol: universalSymbol,
    displayName: "MCX GOLD 04DEC2026 FUTURE",
    displaySymbol: "MCX GOLD 04DEC2026 FUTURE",
    providerSymbol: "GOLD04DEC26FUT",
    instrumentToken: "495213",
    price: 158400,
    timestamp: START_AT + 60_000,
  });

  assert.equal(harness.calls.createAlert, 1);
  assert.equal(harness.createdAlerts[0]?.triggerType, "drop");
  assert.equal(harness.createdAlerts[0]?.direction, "down");
  assert.equal(harness.createdAlerts[0]?.changePercentage, -1);
});

test("processNormalizedTick isolates Angel monitors by user id", async () => {
  const universalSymbol = "MCX:GOLD:04DEC2026:FUTURE";
  const harness = createHarness([
    makeMonitor({
      id: "monitor-1",
      userId: "user-2",
      symbol: universalSymbol,
      provider: "ANGEL_ONE",
      marketType: "COMMODITY",
      exchange: "MCX",
      instrumentToken: "495213",
      thresholdPercentage: 1,
      trigger: "spike",
    }),
  ]);

  await harness.engine.processNormalizedTick({
    provider: "ANGEL_ONE",
    scope: "USER_SESSION",
    userId: "user-1",
    marketType: "COMMODITY",
    exchange: "MCX",
    symbol: universalSymbol,
    displaySymbol: "MCX GOLD 04DEC2026 FUTURE",
    instrumentToken: "495213",
    price: 160000,
    timestamp: START_AT,
  });
  await harness.engine.processNormalizedTick({
    provider: "ANGEL_ONE",
    scope: "USER_SESSION",
    userId: "user-1",
    marketType: "COMMODITY",
    exchange: "MCX",
    symbol: universalSymbol,
    displaySymbol: "MCX GOLD 04DEC2026 FUTURE",
    instrumentToken: "495213",
    price: 162000,
    timestamp: START_AT + 60_000,
  });

  assert.equal(harness.calls.createAlert, 0);
  assert.equal(harness.emittedAlerts.length, 0);
});

test("processNormalizedTick cache key includes Angel user id", async () => {
  const universalSymbol = "MCX:GOLD:04DEC2026:FUTURE";
  const harness = createHarness([]);

  await harness.engine.processNormalizedTick({
    provider: "ANGEL_ONE",
    scope: "USER_SESSION",
    userId: "user-1",
    marketType: "COMMODITY",
    exchange: "MCX",
    symbol: universalSymbol,
    displaySymbol: "MCX GOLD 04DEC2026 FUTURE",
    instrumentToken: "495213",
    price: 160000,
    timestamp: START_AT,
  });

  const snapshot = harness.engine.getEngineStateSnapshot();
  const activeMonitorCache = snapshot.activeMonitorCache as Record<string, unknown>;
  const priceBuffer = snapshot.priceBuffer as Record<string, unknown>;
  const cacheKey = "ANGEL_ONE:user-1:MCX:495213";

  assert.ok(activeMonitorCache[cacheKey]);
  assert.ok(priceBuffer[cacheKey]);
});

test("getRuntimeSnapshot summarizes and bounds analyzer buffers safely", () => {
  const harness = createHarness([]);
  harness.engine.priceBuffer.set(
    SYMBOL,
    Array.from({ length: 150 }, (_, index) => ({ price: 100 + index, timestamp: index })),
  );
  harness.engine.cvdBuffer.set(
    SYMBOL,
    Array.from({ length: 120 }, (_, index) => ({ volumeDelta: 1, timestamp: index })),
  );
  harness.engine.currentCVD.set(SYMBOL, 120);
  harness.engine.updateOrderBook(SYMBOL, [["249", "2"]], [["250", "3"]]);

  const summary = harness.engine.getRuntimeSnapshot({
    streamKeys: [SYMBOL],
    includeBuffers: true,
    bufferLimit: 500,
  });

  assert.equal(summary.priceBuffer.count, 150);
  assert.equal(summary.priceBuffer.items?.length, 100);
  assert.equal(summary.cvd.currentCVD, 120);
  assert.equal(summary.cvd.items?.length, 100);
  assert.equal(summary.orderBook.bestBid, 249);
  assert.equal(summary.orderBook.bestAsk, 250);

  summary.priceBuffer.items?.push({ price: 1, timestamp: 1 });
  assert.equal(harness.engine.priceBuffer.get(SYMBOL)?.length, 150);
});
