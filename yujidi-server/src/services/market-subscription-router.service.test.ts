import assert from "node:assert/strict";
import test from "node:test";

import { MarketSubscriptionRouter } from "./market-subscription-router.service.js";
import type { ResolvedMarketSubscription } from "./market-subscription-resolver.service.js";

const userId = "69e64c5f9042aac89c8c83f8";

const binanceSubscription: ResolvedMarketSubscription = {
  symbolId: "symbol-1",
  symbol: "BTCUSDT",
  displayName: "BTC / USDT",
  provider: "BINANCE",
  marketType: "CRYPTO",
  exchange: "BINANCE",
  instrumentToken: "BTCUSDT",
  providerSymbol: "BTCUSDT",
  requiresBrokerLogin: false,
  supportedBroker: "NONE",
  subscriptionKey: "BINANCE:BINANCE:BTCUSDT",
};

const angelSubscription: ResolvedMarketSubscription = {
  symbolId: "symbol-2",
  symbol: "MCX:GOLD:05APR2027:FUTURE",
  displayName: "MCX GOLD 05APR2027 FUTURE",
  provider: "ANGEL_ONE",
  marketType: "COMMODITY",
  exchange: "MCX",
  instrumentToken: "570027",
  providerSymbol: "GOLD05APR27FUT",
  requiresBrokerLogin: true,
  supportedBroker: "ANGEL_ONE",
  subscriptionKey: `ANGEL_ONE:${userId}:MCX:570027`,
};

test("MarketSubscriptionRouter routes Binance subscription to Binance handler", async () => {
  const routed: string[] = [];
  const router = new MarketSubscriptionRouter({
    binanceSubscribe: (subscription) => routed.push(subscription.subscriptionKey),
  });

  await router.subscribe(userId, binanceSubscription);

  assert.deepEqual(routed, ["BINANCE:BINANCE:BTCUSDT"]);
});

test("MarketSubscriptionRouter routes Angel subscription to Angel session service", async () => {
  const subscribed: string[] = [];
  const router = new MarketSubscriptionRouter({
    angelSessionService: {
      subscribeResolvedAngelSubscription: async (input) => {
        subscribed.push(input.subscriptionKey);
        return {
          provider: "ANGEL_ONE",
          subscriptionKey: input.subscriptionKey,
          exchange: "MCX",
          instrumentToken: input.instrumentToken,
          mode: "LTP",
          streamStatus: "SUBSCRIBED",
        };
      },
      unsubscribeResolvedAngelSubscription: async (input) => ({
        provider: "ANGEL_ONE",
        subscriptionKey: input.subscriptionKey,
        exchange: "MCX",
        instrumentToken: input.instrumentToken,
        mode: "LTP",
        streamStatus: "UNSUBSCRIBED",
      }),
    },
  });

  await router.subscribe(userId, angelSubscription);

  assert.deepEqual(subscribed, [`ANGEL_ONE:${userId}:MCX:570027`]);
});

test("MarketSubscriptionRouter rejects unsupported provider", async () => {
  const router = new MarketSubscriptionRouter();

  await assert.rejects(
    router.subscribe(userId, {
      ...binanceSubscription,
      provider: "KITE",
      subscriptionKey: "KITE:NSE:123",
    }),
    /PROVIDER_NOT_SUPPORTED/,
  );
});
