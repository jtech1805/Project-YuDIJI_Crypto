import assert from "node:assert/strict";
import test from "node:test";

import { ScoringContextService } from "./scoring-context.service.js";

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
  assert.equal(evaluators.find((item: any) => item.evaluatorKey === "PRICE_BUFFER_CONTEXT").dataAvailable, true);
  assert.equal(evaluators.find((item: any) => item.evaluatorKey === "ORDER_BOOK_CONTEXT").dataAvailable, false);
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

test("missing symbol returns a safe validation error", async () => {
  const { service } = createHarness();
  await assert.rejects(
    service.getRealtimeContext({ userId: "69e64c5f9042aac89c8c83f8" }),
    /symbolId, symbol, or instrumentToken is required/,
  );
});
