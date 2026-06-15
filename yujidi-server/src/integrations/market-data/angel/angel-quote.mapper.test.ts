import assert from "node:assert/strict";
import test from "node:test";

import { mapAngelQuoteToMarketSnapshot } from "./angel-quote.mapper.js";

const symbol = {
  _id: "65abc0000000000000000001",
  provider: "ANGEL_ONE",
  marketType: "COMMODITY",
  exchange: "MCX",
  symbol: "MCX:CRUDEOIL:26JUN2026:7200:CE",
  displayName: "MCX CRUDEOIL 26JUN2026 7200 CE",
  providerSymbol: "CRUDEOIL26JUN7200CE",
  instrumentToken: "253456",
  requiresBrokerLogin: true,
  supportedBroker: "ANGEL_ONE",
  status: "ACTIVE",
};

test("mapAngelQuoteToMarketSnapshot maps LTP response", () => {
  const snapshot = mapAngelQuoteToMarketSnapshot({
    symbol: symbol as never,
    mode: "LTP",
    angelQuote: {
      exchange: "MCX",
      tradingSymbol: "CRUDEOIL26JUN7200CE",
      symbolToken: "253456",
      ltp: 7200,
    },
  });

  assert.equal(snapshot.provider, "ANGEL_ONE");
  assert.equal(snapshot.marketType, "COMMODITY");
  assert.equal(snapshot.exchange, "MCX");
  assert.equal(snapshot.symbolId, "65abc0000000000000000001");
  assert.equal(snapshot.symbol, "MCX:CRUDEOIL:26JUN2026:7200:CE");
  assert.equal(snapshot.displayName, "MCX CRUDEOIL 26JUN2026 7200 CE");
  assert.equal(snapshot.providerSymbol, "CRUDEOIL26JUN7200CE");
  assert.equal(snapshot.instrumentToken, "253456");
  assert.equal(snapshot.mode, "LTP");
  assert.equal(snapshot.ltp, 7200);
});

test("mapAngelQuoteToMarketSnapshot maps OHLC response", () => {
  const snapshot = mapAngelQuoteToMarketSnapshot({
    symbol: symbol as never,
    mode: "OHLC",
    angelQuote: {
      open: 7100,
      high: 7250,
      low: 7050,
      close: 7080,
      netChange: 120,
      percentChange: 1.69,
    },
  });

  assert.equal(snapshot.mode, "OHLC");
  assert.equal(snapshot.open, 7100);
  assert.equal(snapshot.high, 7250);
  assert.equal(snapshot.low, 7050);
  assert.equal(snapshot.close, 7080);
  assert.equal(snapshot.netChange, 120);
  assert.equal(snapshot.percentChange, 1.69);
});

test("mapAngelQuoteToMarketSnapshot maps FULL response with depth and open interest", () => {
  const snapshot = mapAngelQuoteToMarketSnapshot({
    symbol: symbol as never,
    mode: "FULL",
    angelQuote: {
      ltp: 7200,
      lastTradeQty: 10,
      avgPrice: 7160,
      tradeVolume: 25000,
      opnInterest: 8900,
      lowerCircuit: 6500,
      upperCircuit: 7900,
      totBuyQuan: 1200,
      totSellQuan: 1500,
      exchFeedTime: "21-Jun-2023 10:46:10",
      exchTradeTime: "21-Jun-2023 10:46:09",
      depth: {
        buy: [{ price: 7199, quantity: 5, orders: 1 }],
        sell: [{ price: 7201, quantity: 8, orders: 2 }],
      },
    },
  });

  assert.equal(snapshot.mode, "FULL");
  assert.equal(snapshot.openInterest, 8900);
  assert.equal(snapshot.tradeVolume, 25000);
  assert.equal(snapshot.totalBuyQuantity, 1200);
  assert.equal(snapshot.totalSellQuantity, 1500);
  assert.deepEqual(snapshot.depth?.buy, [{ price: 7199, quantity: 5, orders: 1 }]);
  assert.deepEqual(snapshot.depth?.sell, [{ price: 7201, quantity: 8, orders: 2 }]);
  assert.equal(snapshot.exchangeFeedTime, "21-Jun-2023 10:46:10");
  assert.equal(snapshot.exchangeTradeTime, "21-Jun-2023 10:46:09");
});
