import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import { MarketSubscriptionResolver } from "../../../src/services/market-subscription-resolver.service.js";

const userId = "69e64c5f9042aac89c8c83f8";
const symbolId = new Types.ObjectId("65abc0000000000000000001");

const execResult = <T>(value: T) => ({
  exec: async () => value,
});

const leanExecResult = <T>(value: T) => ({
  lean: () => execResult(value),
});

const makeSymbol = (overrides: Record<string, unknown> = {}) => ({
  _id: symbolId,
  symbol: "BTCUSDT",
  displayName: "BTC / USDT",
  provider: "BINANCE",
  marketType: "CRYPTO",
  exchange: "BINANCE",
  instrumentToken: "BTCUSDT",
  providerSymbol: "BTCUSDT",
  requiresBrokerLogin: false,
  supportedBroker: "NONE",
  status: "ACTIVE",
  ...overrides,
});

const makeResolver = ({
  symbol = makeSymbol(),
  hasBrokerConnection = false,
}: {
  symbol?: unknown;
  hasBrokerConnection?: boolean;
} = {}) => {
  return new MarketSubscriptionResolver({
    symbolRepository: {
      findOne: (() => leanExecResult(symbol)) as never,
    },
    brokerConnectionService: {
      hasActiveBrokerConnection: async () => hasBrokerConnection,
    },
  });
};

test("MarketSubscriptionResolver resolves Binance symbol with provider-aware key", async () => {
  const resolver = makeResolver();
  const resolved = await resolver.resolveSubscription(userId, "btcusdt");

  assert.equal(resolved.symbolId, symbolId.toString());
  assert.equal(resolved.symbol, "BTCUSDT");
  assert.equal(resolved.provider, "BINANCE");
  assert.equal(resolved.subscriptionKey, "BINANCE:BINANCE:BTCUSDT");
});

test("MarketSubscriptionResolver resolves Angel symbol with user-specific key", async () => {
  const resolver = makeResolver({
    hasBrokerConnection: true,
    symbol: makeSymbol({
      symbol: "MCX:GOLD:05APR2027:FUTURE",
      displayName: "MCX GOLD 05APR2027 FUTURE",
      provider: "ANGEL_ONE",
      marketType: "COMMODITY",
      exchange: "MCX",
      instrumentToken: "570027",
      providerSymbol: "GOLD05APR27FUT",
      requiresBrokerLogin: true,
      supportedBroker: "ANGEL_ONE",
    }),
  });
  const resolved = await resolver.resolveSubscription(userId, "MCX:GOLD:05APR2027:FUTURE");

  assert.equal(resolved.provider, "ANGEL_ONE");
  assert.equal(resolved.exchange, "MCX");
  assert.equal(resolved.instrumentToken, "570027");
  assert.equal(resolved.subscriptionKey, `ANGEL_ONE:${userId}:MCX:570027`);
});

test("MarketSubscriptionResolver rejects unknown symbol", async () => {
  const resolver = makeResolver({ symbol: null });

  await assert.rejects(
    resolver.resolveSubscription(userId, "UNKNOWN"),
    /SYMBOL_NOT_FOUND/,
  );
});

test("MarketSubscriptionResolver rejects Angel symbol without active BrokerConnection", async () => {
  const resolver = makeResolver({
    hasBrokerConnection: false,
    symbol: makeSymbol({
      symbol: "MCX:GOLD:05APR2027:FUTURE",
      provider: "ANGEL_ONE",
      marketType: "COMMODITY",
      exchange: "MCX",
      instrumentToken: "570027",
      requiresBrokerLogin: true,
      supportedBroker: "ANGEL_ONE",
    }),
  });

  await assert.rejects(
    resolver.resolveSubscription(userId, "MCX:GOLD:05APR2027:FUTURE"),
    /BROKER_LOGIN_REQUIRED/,
  );
});
