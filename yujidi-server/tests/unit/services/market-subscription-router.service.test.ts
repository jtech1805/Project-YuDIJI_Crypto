import assert from "node:assert/strict";
import test from "node:test";

import { MarketSubscriptionRouter } from "../../../src/services/market-data/market-subscription-router.service.js";
import type { ResolvedMarketSubscription } from "../../../src/services/market-data/market-subscription-resolver.service.js";

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

const angelNseSubscription: ResolvedMarketSubscription = {
  symbolId: "symbol-3",
  symbol: "NSE:RELIANCE-EQ",
  displayName: "NSE RELIANCE",
  provider: "ANGEL_ONE",
  marketType: "EQUITY",
  exchange: "NSE",
  instrumentToken: "2885",
  providerSymbol: "RELIANCE-EQ",
  requiresBrokerLogin: true,
  supportedBroker: "ANGEL_ONE",
  subscriptionKey: `ANGEL_ONE:${userId}:NSE:2885`,
};

const angelNfoSubscription: ResolvedMarketSubscription = {
  symbolId: "symbol-4",
  symbol: "NFO:NIFTY:30JUL2026:25000:CE",
  displayName: "NFO NIFTY 30JUL2026 25000 CE",
  provider: "ANGEL_ONE",
  marketType: "FNO",
  exchange: "NFO",
  instrumentToken: "53217",
  providerSymbol: "NIFTY30JUL2625000CE",
  requiresBrokerLogin: true,
  supportedBroker: "ANGEL_ONE",
  subscriptionKey: `ANGEL_ONE:${userId}:NFO:53217`,
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
  const routedExchanges: string[] = [];
  const router = new MarketSubscriptionRouter({
    angelSessionService: {
      subscribeResolvedAngelSubscription: async (input) => {
        subscribed.push(input.subscriptionKey);
        routedExchanges.push(input.exchange);
        return {
          provider: "ANGEL_ONE",
          subscriptionKey: input.subscriptionKey,
          exchange: input.exchange,
          instrumentToken: input.instrumentToken,
          mode: "LTP",
          streamStatus: "SUBSCRIBED",
        };
      },
      unsubscribeResolvedAngelSubscription: async (input) => ({
        provider: "ANGEL_ONE",
        subscriptionKey: input.subscriptionKey,
        exchange: input.exchange,
        instrumentToken: input.instrumentToken,
        mode: "LTP",
        streamStatus: "UNSUBSCRIBED",
      }),
    },
  });

  await router.subscribe(userId, angelSubscription);
  await router.subscribe(userId, angelNseSubscription);
  await router.subscribe(userId, angelNfoSubscription);

  assert.deepEqual(subscribed, [
    `ANGEL_ONE:${userId}:MCX:570027`,
    `ANGEL_ONE:${userId}:NSE:2885`,
    `ANGEL_ONE:${userId}:NFO:53217`,
  ]);
  assert.deepEqual(routedExchanges, ["MCX", "NSE", "NFO"]);
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
