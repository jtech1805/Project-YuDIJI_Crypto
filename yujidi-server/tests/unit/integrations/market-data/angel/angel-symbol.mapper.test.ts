import assert from "node:assert/strict";
import test from "node:test";

import type { AngelScripMasterRow } from "../../../../../src/integrations/market-data/angel/angel-scrip-master.types.js";
import {
  mapAngelScripToUniversalSymbol,
  parseAngelExpiry,
} from "../../../../../src/integrations/market-data/angel/angel-symbol.mapper.js";

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

const nseEquityRow: AngelScripMasterRow = {
  token: "2885",
  symbol: "RELIANCE-EQ",
  name: "RELIANCE",
  expiry: "",
  strike: "-1.000000",
  lotsize: "1",
  instrumenttype: "",
  exch_seg: "NSE",
  tick_size: "5.000000",
};

const nfoFutureRow: AngelScripMasterRow = {
  token: "53216",
  symbol: "NIFTY30JUL26FUT",
  name: "NIFTY",
  expiry: "30JUL2026",
  strike: "-1.000000",
  lotsize: "75",
  instrumenttype: "FUTIDX",
  exch_seg: "NFO",
  tick_size: "5.000000",
};

const nfoOptionRow: AngelScripMasterRow = {
  token: "53217",
  symbol: "NIFTY30JUL2625000CE",
  name: "NIFTY",
  expiry: "30JUL2026",
  strike: "2500000.000000",
  lotsize: "75",
  instrumenttype: "OPTIDX",
  exch_seg: "NFO",
  tick_size: "5.000000",
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

test("mapAngelScripToUniversalSymbol maps NSE equity row into CASH symbol fields", () => {
  const mapped = mapAngelScripToUniversalSymbol(nseEquityRow);

  assert.equal(mapped.provider, "ANGEL_ONE");
  assert.equal(mapped.exchange, "NSE");
  assert.equal(mapped.marketType, "EQUITY");
  assert.equal(mapped.instrumentType, "CASH");
  assert.equal(mapped.symbol, "NSE:RELIANCE-EQ");
  assert.equal(mapped.displayName, "NSE RELIANCE");
  assert.equal(mapped.providerSymbol, "RELIANCE-EQ");
  assert.equal(mapped.instrumentToken, "2885");
  assert.equal(mapped.underlyingSymbol, "RELIANCE");
  assert.equal(mapped.contractType, "CASH");
  assert.equal(mapped.requiresBrokerLogin, true);
});

test("mapAngelScripToUniversalSymbol maps NFO FUTIDX row into FUTURE symbol fields", () => {
  const mapped = mapAngelScripToUniversalSymbol(nfoFutureRow);

  assert.equal(mapped.exchange, "NFO");
  assert.equal(mapped.marketType, "FNO");
  assert.equal(mapped.instrumentType, "FUTURE");
  assert.equal(mapped.symbol, "NFO:NIFTY:30JUL2026:FUTURE");
  assert.equal(mapped.displayName, "NFO NIFTY 30JUL2026 FUTURE");
  assert.equal(mapped.underlyingSymbol, "NIFTY");
  assert.equal(mapped.lotSize, 75);
  assert.equal(mapped.tickSize, 0.05);
});

test("mapAngelScripToUniversalSymbol maps NFO OPTIDX row into OPTION symbol fields", () => {
  const mapped = mapAngelScripToUniversalSymbol(nfoOptionRow);

  assert.equal(mapped.exchange, "NFO");
  assert.equal(mapped.marketType, "FNO");
  assert.equal(mapped.instrumentType, "OPTION");
  assert.equal(mapped.optionType, "CE");
  assert.equal(mapped.strikePrice, 25000);
  assert.equal(mapped.symbol, "NFO:NIFTY:30JUL2026:25000:CE");
  assert.equal(mapped.displayName, "NFO NIFTY 30JUL2026 25000 CE");
  assert.equal(mapped.underlyingSymbol, "NIFTY");
});
