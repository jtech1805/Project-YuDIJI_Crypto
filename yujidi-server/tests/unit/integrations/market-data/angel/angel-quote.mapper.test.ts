import assert from "node:assert/strict";
import test from "node:test";

import { mapAngelQuoteToMarketSnapshot } from "../../../../../src/integrations/market-data/angel/angel-quote.mapper.js";

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

test("mapAngelQuoteToMarketSnapshot maps NSE equity quote without raw secrets", () => {
  const snapshot = mapAngelQuoteToMarketSnapshot({
    symbol: {
      ...symbol,
      marketType: "EQUITY",
      exchange: "NSE",
      symbol: "NSE:RELIANCE-EQ",
      displayName: "NSE RELIANCE",
      providerSymbol: "RELIANCE-EQ",
      instrumentToken: "2885",
    } as never,
    mode: "FULL",
    angelQuote: {
      exchange: "NSE",
      tradingSymbol: "RELIANCE-EQ",
      symbolToken: "2885",
      ltp: 2880.5,
      open: 2850,
      high: 2890,
      low: 2840,
      tradeVolume: 1200000,
    },
  });

  assert.equal(snapshot.marketType, "EQUITY");
  assert.equal(snapshot.exchange, "NSE");
  assert.equal(snapshot.symbol, "NSE:RELIANCE-EQ");
  assert.equal(snapshot.providerSymbol, "RELIANCE-EQ");
  assert.equal(snapshot.instrumentToken, "2885");
  assert.equal(snapshot.ltp, 2880.5);
  assert.equal(snapshot.tradeVolume, 1200000);
  assert.equal(snapshot.raw, undefined);
  assert.equal(JSON.stringify(snapshot).includes("jwtToken"), false);
});

test("mapAngelQuoteToMarketSnapshot maps NFO option quote", () => {
  const snapshot = mapAngelQuoteToMarketSnapshot({
    symbol: {
      ...symbol,
      marketType: "FNO",
      exchange: "NFO",
      symbol: "NFO:NIFTY:30JUL2026:25000:CE",
      displayName: "NFO NIFTY 30JUL2026 25000 CE",
      providerSymbol: "NIFTY30JUL2625000CE",
      instrumentToken: "53217",
    } as never,
    mode: "LTP",
    angelQuote: {
      exchange: "NFO",
      tradingSymbol: "NIFTY30JUL2625000CE",
      symbolToken: "53217",
      ltp: 125.2,
      open: 110,
      high: 140,
      low: 100,
      tradeVolume: 50000,
    },
  });

  assert.equal(snapshot.marketType, "FNO");
  assert.equal(snapshot.exchange, "NFO");
  assert.equal(snapshot.symbol, "NFO:NIFTY:30JUL2026:25000:CE");
  assert.equal(snapshot.ltp, 125.2);
  assert.equal(snapshot.tradeVolume, 50000);
});
