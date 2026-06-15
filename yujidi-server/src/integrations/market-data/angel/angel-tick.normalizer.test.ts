import assert from "node:assert/strict";
import test from "node:test";

import { normalizeAngelTick } from "./angel-tick.normalizer.js";

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
