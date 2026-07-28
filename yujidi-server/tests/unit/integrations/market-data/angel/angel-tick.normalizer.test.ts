import assert from "node:assert/strict";
import test from "node:test";

import { normalizeAngelTick } from "../../../../../src/integrations/market-data/angel/angel-tick.normalizer.js";

test("normalizeAngelTick converts Angel MCX tick into normalized market tick", () => {
  const normalized = normalizeAngelTick({
    token: "253456",
    exchange: "MCX",
    symbol: "MCX:CRUDEOIL:26JUN2026:7200:CE",
    displaySymbol: "MCX CRUDEOIL 26JUN2026 7200 CE",
    lastTradedPrice: 7210,
    volume: 100,
    timestamp: 1781483823613,
  });

  assert.equal(normalized.provider, "ANGEL_ONE");
  assert.equal(normalized.marketType, "COMMODITY");
  assert.equal(normalized.exchange, "MCX");
  assert.equal(normalized.symbol, "MCX:CRUDEOIL:26JUN2026:7200:CE");
  assert.equal(normalized.instrumentToken, "253456");
  assert.equal(normalized.price, 7210);
  assert.equal(normalized.volume, 100);
});

test("normalizeAngelTick converts Angel NSE and NFO ticks into normalized market ticks", () => {
  const nse = normalizeAngelTick({
    token: "2885",
    exchange: "NSE",
    symbol: "NSE:RELIANCE-EQ",
    displaySymbol: "NSE RELIANCE",
    lastTradedPrice: 2880.5,
    timestamp: 1781483823613,
  });
  const nfo = normalizeAngelTick({
    token: "53217",
    exchange: "NFO",
    symbol: "NFO:NIFTY:30JUL2026:25000:CE",
    displaySymbol: "NFO NIFTY 30JUL2026 25000 CE",
    lastTradedPrice: 125.2,
    volume: 50000,
    timestamp: 1781483823613,
  });

  assert.equal(nse.marketType, "EQUITY");
  assert.equal(nse.exchange, "NSE");
  assert.equal(nse.instrumentToken, "2885");
  assert.equal(nfo.marketType, "FNO");
  assert.equal(nfo.exchange, "NFO");
  assert.equal(nfo.instrumentToken, "53217");
  assert.equal(nfo.volume, 50000);
});

test("normalizeAngelTick rejects invalid ticks", () => {
  assert.throws(() => {
    normalizeAngelTick({
      token: "253456",
      exchange: "MCX",
      symbol: "MCX:CRUDEOIL",
      lastTradedPrice: 0,
    });
  }, /invalid last traded price/);
});
