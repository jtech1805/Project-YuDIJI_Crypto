import assert from "node:assert/strict";
import test from "node:test";

import type { AngelScripMasterRow } from "./angel-scrip-master.types.js";
import {
  mapAngelScripToUniversalSymbol,
  parseAngelExpiry,
} from "./angel-symbol.mapper.js";

const mcxOptionRow: AngelScripMasterRow = {
  token: "253456",
  symbol: "CRUDEOIL26JUN7200CE",
  name: "CRUDEOIL",
  expiry: "26JUN2026",
  strike: "720000.000000",
  lotsize: "100",
  instrumenttype: "OPTFUT",
  exch_seg: "MCX",
  tick_size: "100.000000",
};

test("parseAngelExpiry parses Angel DDMMMYYYY expiry values as UTC dates", () => {
  const expiry = parseAngelExpiry("26JUN2026");

  assert.ok(expiry);
  assert.equal(expiry.toISOString(), "2026-06-26T00:00:00.000Z");
});

test("mapAngelScripToUniversalSymbol maps MCX option row into universal symbol fields", () => {
  const mapped = mapAngelScripToUniversalSymbol(mcxOptionRow);

  assert.equal(mapped.provider, "ANGEL_ONE");
  assert.equal(mapped.exchange, "MCX");
  assert.equal(mapped.marketType, "COMMODITY");
  assert.equal(mapped.instrumentToken, "253456");
  assert.equal(mapped.providerSymbol, "CRUDEOIL26JUN7200CE");
  assert.equal(mapped.name, "CRUDEOIL");
  assert.equal(mapped.instrumentType, "OPTION");
  assert.equal(mapped.optionType, "CE");
  assert.equal(mapped.strikePrice, 7200);
  assert.equal(mapped.lotSize, 100);
  assert.equal(mapped.tickSize, 1);
  assert.equal(mapped.requiresBrokerLogin, true);
  assert.equal(mapped.supportedBroker, "ANGEL_ONE");
  assert.equal(mapped.symbol, "MCX:CRUDEOIL:26JUN2026:7200:CE");
  assert.equal(mapped.displayName, "MCX CRUDEOIL 26JUN2026 7200 CE");
  assert.equal(mapped.status, "ACTIVE");
  assert.deepEqual(mapped.raw, mcxOptionRow);
});
