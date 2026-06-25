import assert from "node:assert/strict";
import test from "node:test";

import { MarketSnapshotService } from "./market-snapshot.service.js";
import { ScoringContextService } from "./scoring-context.service.js";
import { TemplateMonitoringOrchestratorService } from "./template-monitoring-orchestrator.service.js";

const symbol = {
  _id: "65abc0000000000000000001",
  symbol: "BTCUSDT",
  displayName: "BTC / USDT",
  provider: "BINANCE",
  marketType: "CRYPTO",
  exchange: "BINANCE",
  instrumentType: "SPOT",
  providerSymbol: "BTCUSDT",
  instrumentToken: "BTCUSDT",
  requiresBrokerLogin: false,
  status: "ACTIVE",
};

const createHarness = () => {
  const runtimeInputs: Array<Record<string, unknown>> = [];
  const marketSnapshotService = new MarketSnapshotService();
  const templateOrchestrator = new TemplateMonitoringOrchestratorService();
  const now = new Date();
  marketSnapshotService.recordTick({
    provider: "BINANCE",
    exchange: "BINANCE",
    marketType: "CRYPTO",
    symbol: "BTCUSDT",
    providerSymbol: "BTCUSDT",
    instrumentToken: "BTCUSDT",
    price: 100,
    volume: 10,
    occurredAt: now,
    receivedAt: now,
    source: "BINANCE_WS",
  });
  marketSnapshotService.recordTick({
    provider: "BINANCE",
    exchange: "BINANCE",
    marketType: "CRYPTO",
    symbol: "BTCUSDT",
    providerSymbol: "BTCUSDT",
    instrumentToken: "BTCUSDT",
    price: 101,
    volume: 20,
    occurredAt: new Date(now.getTime() + 1_000),
    receivedAt: new Date(now.getTime() + 1_000),
    source: "BINANCE_WS",
  });
  const service = new ScoringContextService({
    symbolRepository: {
      findOne: () => ({
        lean: () => ({
          exec: async () => symbol,
        }),
      }),
    } as never,
    runtimeProvider: {
      getAnalyzerRuntimeSnapshot: (input) => {
        runtimeInputs.push(input);
        const includeBuffers = input.includeBuffers;
        const limit = input.bufferLimit;
        return {
          streamKey: "BTCUSDT",
          latestPrice: 100,
          priceBuffer: {
            available: true,
            count: 300,
            returnedCount: includeBuffers ? limit : 0,
            firstTimestamp: 1,
            lastTimestamp: 2,
            minPrice: 99,
            maxPrice: 101,
            changePercent: 1,
            ...(includeBuffers ? {
              items: Array.from({ length: limit }, (_, index) => ({ price: 100 + index, timestamp: index })),
            } : {}),
          },
          cvd: {
            available: true,
            currentCVD: 3.97,
            bufferCount: 80,
            returnedCount: includeBuffers ? limit : 0,
            netDelta: 3.97,
            ...(includeBuffers ? {
              items: Array.from({ length: limit }, (_, index) => ({ volumeDelta: 1, timestamp: index })),
            } : {}),
          },
          cooldown: { active: false, activeCount: 0, remainingMs: 0 },
          orderBook: { available: false, bidLevels: 0, askLevels: 0, reasonCode: "ORDER_BOOK_UNAVAILABLE" },
        };
      },
      getTradeMonitoringHealthSnapshot: () => [{
        subscriptionKey: "BINANCE:BINANCE:BTCUSDT",
        evaluatedCount: 10,
        skippedCount: 2,
      }],
      getActiveTradeSubscriptionSnapshot: () => [{
        subscriptionKey: "BINANCE:BINANCE:BTCUSDT",
        tradeCount: 1,
      }],
    },
    marketSnapshotService,
    templateOrchestrator,
  });
  return { runtimeInputs, service };
};

test("context service returns summarized price buffer and CVD", async () => {
  const { service } = createHarness();
  const context = await service.getRealtimeContext({
    userId: "69e64c5f9042aac89c8c83f8",
    symbol: "BTCUSDT",
  }) as any;
  assert.equal(context.runtime.priceBuffer.count, 300);
  assert.equal(context.runtime.cvd.currentCVD, 3.97);
  assert.equal("items" in context.runtime.priceBuffer, false);
  assert.equal("items" in context.runtime.cvd, false);
});

test("includeBuffers returns bounded items and caps limit at 100", async () => {
  const { runtimeInputs, service } = createHarness();
  const context = await service.getRealtimeContext({
    userId: "69e64c5f9042aac89c8c83f8",
    symbol: "BTCUSDT",
    includeBuffers: true,
    bufferLimit: 500,
  }) as any;
  assert.equal(runtimeInputs[0]?.bufferLimit, 100);
  assert.equal(context.runtime.priceBuffer.items.length, 100);
  assert.equal(context.runtime.cvd.items.length, 100);
});

test("context output excludes secrets raw payloads and provider tokens", async () => {
  const { service } = createHarness();
  const context = await service.getRealtimeContext({
    userId: "69e64c5f9042aac89c8c83f8",
    symbol: "BTCUSDT",
  });
  const serialized = JSON.stringify(context);
  assert.equal(serialized.includes("apiKey"), false);
  assert.equal(serialized.includes("accessToken"), false);
  assert.equal(serialized.includes("\"raw\""), false);
});

test("template context reports evaluator data availability", async () => {
  const { service } = createHarness();
  const context = await service.getRealtimeContext({
    userId: "69e64c5f9042aac89c8c83f8",
    symbol: "BTCUSDT",
    templateKey: "CRYPTO_SPOT_INTRADAY_V1",
  }) as any;
  const evaluators = context.templateContext.sections.flatMap((section: any) => section.evaluators);
  assert.equal(evaluators.find((item: any) => item.evaluatorKey === "PRICE_VS_VWAP_CONTEXT").dataAvailable, true);
  assert.equal(evaluators.find((item: any) => item.evaluatorKey === "ORDER_BOOK_CONTEXT").dataAvailable, false);
});

test("realtime context includes safe candle VWAP volume and freshness summaries", async () => {
  const { service } = createHarness();
  const context = await service.getRealtimeContext({
    userId: "69e64c5f9042aac89c8c83f8",
    symbol: "BTCUSDT",
    templateKey: "CRYPTO_SPOT_INTRADAY_V1",
  }) as any;

  assert.equal(context.marketSnapshot.resourceKey, "BINANCE:BINANCE:BTCUSDT");
  assert.equal(context.marketSnapshot.latestPrice, 101);
  assert.equal(context.marketSnapshot.vwap.status, "READY");
  assert.equal(context.marketSnapshot.volume.status, "PARTIAL");
  assert.equal(context.marketSnapshot.candleSummary["1m"].count, 1);
  assert.equal(context.marketSnapshot.freshness.status, "FRESH");
  assert.equal(context.templateContext.resources[0].readiness, "FRESH");
});

test("active trade monitoring health is included when available", async () => {
  const { service } = createHarness();
  const context = await service.getRealtimeContext({
    userId: "69e64c5f9042aac89c8c83f8",
    symbol: "BTCUSDT",
  }) as any;
  assert.equal(context.runtime.activeTradeMonitoring.available, true);
  assert.equal(context.runtime.activeTradeMonitoring.evaluatedCount, 10);
  assert.equal(context.runtime.activeTradeMonitoring.tradeCount, 1);
});

test("Angel snapshot lookup uses the user-scoped provider resource key", async () => {
  const requestedKeys: string[] = [];
  const angelSymbol = {
    ...symbol,
    symbol: "MCX:GOLD:04DEC2026:FUTURE",
    displayName: "MCX GOLD 04DEC2026 FUTURE",
    provider: "ANGEL_ONE",
    marketType: "COMMODITY",
    exchange: "MCX",
    instrumentType: "FUTURE",
    providerSymbol: "GOLD04DEC26FUT",
    instrumentToken: "495213",
    requiresBrokerLogin: true,
  };
  const service = new ScoringContextService({
    symbolRepository: {
      findOne: () => ({
        lean: () => ({
          exec: async () => angelSymbol,
        }),
      }),
    } as never,
    runtimeProvider: {
      getAnalyzerRuntimeSnapshot: () => ({
        streamKey: angelSymbol.symbol,
        priceBuffer: { available: false, count: 0, returnedCount: 0 },
        cvd: { available: false, currentCVD: 0, bufferCount: 0, returnedCount: 0, netDelta: 0 },
        cooldown: { active: false, activeCount: 0, remainingMs: 0 },
        orderBook: { available: false, bidLevels: 0, askLevels: 0 },
      }),
      getTradeMonitoringHealthSnapshot: () => [],
      getActiveTradeSubscriptionSnapshot: () => [],
    },
    marketSnapshotService: {
      getSnapshot: (resourceKey) => {
        requestedKeys.push(resourceKey);
        return null;
      },
      getDebugSnapshot: (resourceKey) => {
        requestedKeys.push(resourceKey);
        return null;
      },
    },
    templateOrchestrator: new TemplateMonitoringOrchestratorService(),
  });

  const context = await service.getRealtimeContext({
    userId: "user-a",
    symbol: angelSymbol.symbol,
  }) as any;

  assert.equal(context.marketSnapshot.resourceKey, "ANGEL_ONE:user-a:MCX:495213");
  assert.deepEqual(requestedKeys, [
    "ANGEL_ONE:user-a:MCX:495213",
    "ANGEL_ONE:user-a:MCX:495213",
  ]);
});

test("missing symbol returns a safe validation error", async () => {
  const { service } = createHarness();
  await assert.rejects(
    service.getRealtimeContext({ userId: "69e64c5f9042aac89c8c83f8" }),
    /symbolId, symbol, or instrumentToken is required/,
  );
});
