import assert from "node:assert/strict";
import test from "node:test";

import { buildMarketSubscriptionKey } from "./market-subscription-key.js";

test("buildMarketSubscriptionKey builds Binance provider key without user id", () => {
  const key = buildMarketSubscriptionKey({
    provider: "BINANCE",
    exchange: "BINANCE",
    instrumentToken: "BTCUSDT",
  });

  assert.equal(key, "BINANCE:BINANCE:BTCUSDT");
});

test("buildMarketSubscriptionKey builds Angel user-specific key", () => {
  const key = buildMarketSubscriptionKey({
    provider: "ANGEL_ONE",
    userId: "user-1",
    exchange: "MCX",
    instrumentToken: "253456",
  });

  assert.equal(key, "ANGEL_ONE:user-1:MCX:253456");
});

test("buildMarketSubscriptionKey requires user id for Angel keys", () => {
  assert.throws(
    () => buildMarketSubscriptionKey({
      provider: "ANGEL_ONE",
      exchange: "MCX",
      instrumentToken: "253456",
    }),
    /userId is required/,
  );
});
