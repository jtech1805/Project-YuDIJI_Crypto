import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceAnalyzerCvdState,
  advanceAnalyzerPriceBuffer,
  findAnalyzerBaseTick,
  type CvdTrade,
  type PriceTick,
} from "../../../src/services/trading/analyzer-state-transition.js";
import {
  buildAnalyzerStreamKey,
  validateNormalizedAnalyzerTick,
} from "../../../src/services/trading/analyzer-tick-validation.js";
import type { NormalizedMarketTick } from "../../../src/types/market-data.types.js";

const binanceTick = (overrides: Partial<NormalizedMarketTick> = {}): NormalizedMarketTick => ({
  provider: "BINANCE",
  marketType: "CRYPTO",
  exchange: "BINANCE",
  symbol: "BTCUSDT",
  displaySymbol: "BTC/USDT",
  instrumentToken: "BTCUSDT",
  price: 50_000,
  timestamp: 1_000,
  ...overrides,
});

test("normalized tick validation and stream-key projection preserve provider scoping", () => {
  assert.equal(validateNormalizedAnalyzerTick(binanceTick()), null);
  assert.equal(validateNormalizedAnalyzerTick(binanceTick({ price: Number.NaN })), "INVALID_PRICE");
  assert.equal(validateNormalizedAnalyzerTick(binanceTick({ price: 0 })), "INVALID_PRICE");
  assert.equal(buildAnalyzerStreamKey(binanceTick()), "BINANCE:BINANCE:BTCUSDT");

  const angelTick = binanceTick({
    provider: "ANGEL_ONE",
    scope: "USER_SESSION",
    marketType: "COMMODITY",
    exchange: "MCX",
    instrumentToken: "253456",
  });
  assert.equal(validateNormalizedAnalyzerTick(angelTick), "MISSING_USER_ID");
  const scopedAngelTick = { ...angelTick, userId: "user-1" };
  assert.equal(validateNormalizedAnalyzerTick(scopedAngelTick), null);
  assert.equal(buildAnalyzerStreamKey(scopedAngelTick), "ANGEL_ONE:user-1:MCX:253456");
});

test("price transition mutates the existing buffer and preserves the inclusive one-hour boundary", () => {
  const ticks: PriceTick[] = [
    { price: 90, timestamp: 0 },
    { price: 95, timestamp: 1 },
    { price: 100, timestamp: 3_600_000 },
  ];
  const transition = advanceAnalyzerPriceBuffer(ticks, 110, 3_600_001);
  assert.equal(transition.ticks, ticks);
  assert.equal(transition.bufferSizeBeforePush, 3);
  assert.equal(transition.culledCount, 1);
  assert.deepEqual(ticks, [
    { price: 95, timestamp: 1 },
    { price: 100, timestamp: 3_600_000 },
    { price: 110, timestamp: 3_600_001 },
  ]);
});

test("CVD transition applies whale direction and removes expired deltas from the running total", () => {
  const trades: CvdTrade[] = [
    { volumeDelta: 0.25, timestamp: 0 },
    { volumeDelta: -0.5, timestamp: 1 },
  ];
  const transition = advanceAnalyzerCvdState(trades, -0.25, 60_001, false, 0.75);
  assert.equal(transition.cvdTrades, trades);
  assert.deepEqual(trades, [
    { volumeDelta: -0.5, timestamp: 1 },
    { volumeDelta: 0.75, timestamp: 60_001 },
  ]);
  assert.equal(transition.currentCvd, 0.25);

  const belowThreshold = advanceAnalyzerCvdState([], 4, 100, true, 0.09);
  assert.deepEqual(belowThreshold, { cvdTrades: [], currentCvd: 4 });
});

test("base tick selection retains reverse traversal and inclusive window semantics", () => {
  const ticks: PriceTick[] = [
    { price: 10, timestamp: 10 },
    { price: 20, timestamp: 20 },
    { price: 30, timestamp: 30 },
  ];
  assert.deepEqual(findAnalyzerBaseTick(ticks, 20), { price: 20, timestamp: 20 });
  assert.deepEqual(findAnalyzerBaseTick(ticks, 29), { price: 20, timestamp: 20 });
  assert.equal(findAnalyzerBaseTick(ticks, 9), null);
});
