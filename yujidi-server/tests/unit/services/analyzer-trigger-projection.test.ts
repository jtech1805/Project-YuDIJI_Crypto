import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAnalyzerAlertPayload,
  buildAnalyzerLlmTraceBase,
} from "../../../src/services/trading/analyzer-trigger-projection.js";

const monitor = {
  _id: "monitor-1",
  user: "user-1",
  displayName: "Bitcoin",
  provider: "BINANCE",
  marketType: "SPOT",
  exchange: "BINANCE",
  instrumentToken: "BTCUSDT",
  providerSymbol: "BTCUSDT",
  timeWindowMinutes: 5,
};

test("buildAnalyzerLlmTraceBase produces stable lineage and redacted input hash", () => {
  const startedAt = new Date("2026-01-01T00:00:00.000Z");
  const result = buildAnalyzerLlmTraceBase({
    traceId: "trace-1",
    correlationId: "correlation-1",
    promptVersion: "ALERT_REPORT_V1",
    startedAt,
    providerName: "GEMINI",
    modelName: "gemini-test",
    symbol: "BTCUSDT",
    monitorId: "monitor-1",
    monitor,
    triggerType: "drop",
    direction: "down",
    changePercentage: -2.5,
    currentPrice: 97.5,
    currentCvd: -12,
    newsContext: "ETF flow declined",
    walls: {
      support: "$95 (10.00 coins)",
      resistance: "Unknown",
    },
  });

  assert.deepEqual(result, {
    traceId: "trace-1",
    correlationId: "correlation-1",
    taskType: "ALERT_REPORT",
    userId: "user-1",
    source: {
      entityType: "TRIPWIRE_MONITOR",
      entityId: "monitor-1",
    },
    provider: "GEMINI",
    model: "gemini-test",
    promptVersion: "ALERT_REPORT_V1",
    startedAt,
    inputReference: {
      hash: "ab14210cfc27ffae6dd56f1bd17397bce7f4a6e7994df6ac97814bd281693602",
      redactedSummary: {
        provider: "BINANCE",
        marketType: "SPOT",
        exchange: "BINANCE",
        triggerType: "drop",
        direction: "down",
        timeWindowMinutes: 5,
        newsContextLength: 17,
        supportAvailable: true,
        resistanceAvailable: false,
      },
    },
    fallbackUsed: false,
  });
});

test("buildAnalyzerAlertPayload preserves authority precedence and clones timestamp", () => {
  const result = buildAnalyzerAlertPayload({
    monitor,
    metadata: {
      displayName: "Normalized Bitcoin",
      provider: "NORMALIZED_PROVIDER",
      currentPrice: -1,
      customField: "preserved",
    },
    symbol: "BTCUSDT",
    currentPrice: 97.5,
    previousPrice: 100,
    movementMagnitude: 2.5,
    changePercentage: -2.5,
    triggerType: "drop",
    direction: "down",
    report: {
      catalyst: "Outflows",
      threatLevel: "HIGH",
      support: "$95",
      resistance: "$102",
      summary: "Downward pressure",
    },
    currentCvd: -12,
    currentTimestamp: 1_767_225_600_000,
  });

  assert.deepEqual(result, {
    user: "user-1",
    monitor: "monitor-1",
    symbol: "BTCUSDT",
    displayName: "Normalized Bitcoin",
    provider: "NORMALIZED_PROVIDER",
    marketType: "SPOT",
    exchange: "BINANCE",
    instrumentToken: "BTCUSDT",
    providerSymbol: "BTCUSDT",
    currentPrice: 97.5,
    customField: "preserved",
    triggerPrice: 97.5,
    previousPrice: 100,
    dropPercentage: 2.5,
    changePercentage: -2.5,
    triggerType: "drop",
    direction: "down",
    catalyst: "Outflows",
    threatLevel: "HIGH",
    support: "$95",
    resistance: "$102",
    summary: "Downward pressure",
    cvdAtTrigger: -12,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  });
  assert.notEqual(result.createdAt, new Date(1_767_225_600_000));
});

test("buildAnalyzerLlmTraceBase omits an unavailable model name", () => {
  const result = buildAnalyzerLlmTraceBase({
    traceId: "trace-1",
    correlationId: "correlation-1",
    promptVersion: "ALERT_REPORT_V1",
    startedAt: new Date(0),
    providerName: "DETERMINISTIC",
    symbol: "BTCUSDT",
    monitorId: "monitor-1",
    monitor,
    triggerType: "spike",
    direction: "up",
    changePercentage: 2,
    currentPrice: 102,
    currentCvd: 10,
    newsContext: "",
    walls: { support: "Unknown", resistance: "Unknown" },
  });

  assert.equal("model" in result, false);
});
