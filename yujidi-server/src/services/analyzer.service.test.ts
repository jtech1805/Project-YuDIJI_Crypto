import assert from "node:assert/strict";
import test from "node:test";

import { AnalyzerEngine } from "./analyzer.service.js";

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
