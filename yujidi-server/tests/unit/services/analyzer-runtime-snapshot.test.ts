import assert from "node:assert/strict";
import test from "node:test";

import { buildAnalyzerRuntimeSnapshot } from "../../../src/services/trading/analyzer-runtime-snapshot.js";

const emptyInput = {
  streamKeys: ["BTCUSDT"],
  cooldownMs: 900_000,
  priceBuffer: new Map(),
  cvdBuffer: new Map(),
  currentCVD: new Map(),
  cooldowns: new Map(),
  orderBookSnapshot: new Map(),
};

test("buildAnalyzerRuntimeSnapshot returns the unavailable projection for empty state", () => {
  assert.deepEqual(buildAnalyzerRuntimeSnapshot({ ...emptyInput, now: 1_000_000 }), {
    priceBuffer: {
      available: false,
      count: 0,
      returnedCount: 0,
    },
    cvd: {
      available: false,
      bufferCount: 0,
      returnedCount: 0,
    },
    cooldown: {
      active: false,
      activeCount: 0,
      remainingMs: 0,
    },
    orderBook: {
      available: false,
      bidLevels: 0,
      askLevels: 0,
      reasonCode: "ORDER_BOOK_UNAVAILABLE",
    },
  });
});

test("buildAnalyzerRuntimeSnapshot projects selected stream state and active cooldowns", () => {
  const result = buildAnalyzerRuntimeSnapshot({
    streamKeys: ["MISSING", "BTCUSDT"],
    includeBuffers: true,
    bufferLimit: 2,
    now: 1_000_000,
    cooldownMs: 900_000,
    priceBuffer: new Map([["BTCUSDT", [
      { price: 100, timestamp: 100 },
      { price: 95, timestamp: 200 },
      { price: 110, timestamp: 300 },
    ]]]),
    cvdBuffer: new Map([["BTCUSDT", [
      { volumeDelta: 1.23456, timestamp: 100 },
      { volumeDelta: -0.12345, timestamp: 200 },
      { volumeDelta: 2, timestamp: 300 },
    ]]]),
    currentCVD: new Map([["BTCUSDT", 3.11111]]),
    cooldowns: new Map([
      ["active-1", 900_000],
      ["active-2", 950_000],
      ["expired", 0],
    ]),
    orderBookSnapshot: new Map([["BTCUSDT", {
      bids: [["109", "2"]],
      asks: [["111", "3"]],
    }]]),
  });

  assert.deepEqual(result, {
    streamKey: "BTCUSDT",
    latestPrice: 110,
    priceBuffer: {
      available: true,
      count: 3,
      returnedCount: 2,
      firstTimestamp: 100,
      lastTimestamp: 300,
      minPrice: 95,
      maxPrice: 110,
      changePercent: 10,
      items: [
        { price: 95, timestamp: 200 },
        { price: 110, timestamp: 300 },
      ],
    },
    cvd: {
      available: true,
      currentCVD: 3.11111,
      bufferCount: 3,
      returnedCount: 2,
      netDelta: 3.1111,
      items: [
        { volumeDelta: -0.12345, timestamp: 200 },
        { volumeDelta: 2, timestamp: 300 },
      ],
    },
    cooldown: {
      active: true,
      activeCount: 2,
      remainingMs: 850_000,
    },
    orderBook: {
      available: true,
      bidLevels: 1,
      askLevels: 1,
      bestBid: 109,
      bestAsk: 111,
    },
  });
});

test("buildAnalyzerRuntimeSnapshot detaches returned buffer entries", () => {
  const tick = { price: 100, timestamp: 100 };
  const trade = { volumeDelta: 2, timestamp: 100 };
  const result = buildAnalyzerRuntimeSnapshot({
    ...emptyInput,
    includeBuffers: true,
    priceBuffer: new Map([["BTCUSDT", [tick]]]),
    cvdBuffer: new Map([["BTCUSDT", [trade]]]),
  });

  assert.notEqual(result.priceBuffer.items?.[0], tick);
  assert.notEqual(result.cvd.items?.[0], trade);
});
