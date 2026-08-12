import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import { SymbolSearchService } from "../../../src/services/market-data/symbol-search.service.js";
import { tokenizeSymbolSearch } from "../../../src/utils/symbol-search-tokenizer.js";

const FIXED_EVALUATION_TIME = new Date("2026-07-01T00:00:00.000Z");

type FakeSymbolBase = Record<string, unknown> & {
  _id: Types.ObjectId;
  symbol: string;
  displayName: string;
  provider: string;
  exchange: string;
  marketType: string;
  instrumentType: string;
  providerSymbol: string;
  instrumentToken: string;
  status: string;
  expiry?: Date;
  underlyingSymbol?: string;
  strikePrice?: number;
  optionType?: "CE" | "PE";
  lotSize?: number;
  tickSize?: number;
  requiresBrokerLogin: boolean;
  supportedBroker: string;
};

type FakeSymbol = FakeSymbolBase & ReturnType<typeof tokenizeSymbolSearch>;

const withSearchFields = (symbol: FakeSymbolBase): FakeSymbol => ({
  ...symbol,
  ...tokenizeSymbolSearch({
    symbol: symbol.symbol,
    displayName: symbol.displayName,
    providerSymbol: symbol.providerSymbol,
    name: String(symbol.name ?? ""),
    exchange: symbol.exchange,
    marketType: symbol.marketType,
    instrumentType: symbol.instrumentType,
    expiry: symbol.expiry,
  }),
});

const btc = withSearchFields({
  _id: new Types.ObjectId("65abc0000000000000000001"),
  symbol: "BTCUSDT",
  displayName: "BTC / USDT",
  provider: "BINANCE",
  exchange: "BINANCE",
  marketType: "CRYPTO",
  instrumentType: "SPOT",
  providerSymbol: "BTCUSDT",
  instrumentToken: "BTCUSDT",
  status: "ACTIVE",
  requiresBrokerLogin: false,
  supportedBroker: "NONE",
  searchRank: 100,
});

const goldFuture = withSearchFields({
  _id: new Types.ObjectId("65abc0000000000000000002"),
  symbol: "MCX:GOLD:04DEC2026:FUTURE",
  displayName: "MCX GOLD 04DEC2026 FUTURE",
  provider: "ANGEL_ONE",
  exchange: "MCX",
  marketType: "COMMODITY",
  instrumentType: "FUTURE",
  providerSymbol: "GOLD04DEC26FUT",
  instrumentToken: "495213",
  status: "ACTIVE",
  expiry: new Date(Date.UTC(2026, 11, 4)),
  requiresBrokerLogin: true,
  supportedBroker: "ANGEL_ONE",
  name: "GOLD",
  searchRank: 80,
});

const goldOption = withSearchFields({
  _id: new Types.ObjectId("65abc0000000000000000003"),
  symbol: "MCX:GOLD:04DEC2026:75000:CE",
  displayName: "MCX GOLD 04DEC2026 75000 CE",
  provider: "ANGEL_ONE",
  exchange: "MCX",
  marketType: "COMMODITY",
  instrumentType: "OPTION",
  providerSymbol: "GOLD04DEC2675000CE",
  instrumentToken: "495214",
  status: "ACTIVE",
  expiry: new Date(Date.UTC(2026, 11, 4)),
  requiresBrokerLogin: true,
  supportedBroker: "ANGEL_ONE",
  name: "GOLD",
  searchRank: 10,
});

const crudeFuture = withSearchFields({
  _id: new Types.ObjectId("65abc0000000000000000005"),
  symbol: "MCX:CRUDEOIL:04DEC2026:FUTURE",
  displayName: "MCX CRUDEOIL 04DEC2026 FUTURE",
  provider: "ANGEL_ONE",
  exchange: "MCX",
  marketType: "COMMODITY",
  instrumentType: "FUTURE",
  providerSymbol: "CRUDEOIL04DEC26FUT",
  instrumentToken: "495215",
  status: "ACTIVE",
  expiry: new Date(Date.UTC(2026, 11, 4)),
  requiresBrokerLogin: true,
  supportedBroker: "ANGEL_ONE",
  name: "CRUDEOIL",
  searchRank: 80,
});

const expiredGoldFuture = withSearchFields({
  ...goldFuture,
  _id: new Types.ObjectId("65abc0000000000000000004"),
  symbol: "MCX:GOLD:04DEC2024:FUTURE",
  displayName: "MCX GOLD 04DEC2024 FUTURE",
  providerSymbol: "GOLD04DEC24FUT",
  instrumentToken: "400001",
  expiry: new Date(Date.UTC(2024, 11, 4)),
});

const relianceCash = withSearchFields({
  _id: new Types.ObjectId("65abc0000000000000000006"),
  symbol: "NSE:RELIANCE-EQ",
  displayName: "NSE RELIANCE",
  provider: "ANGEL_ONE",
  exchange: "NSE",
  marketType: "EQUITY",
  instrumentType: "CASH",
  providerSymbol: "RELIANCE-EQ",
  instrumentToken: "2885",
  status: "ACTIVE",
  requiresBrokerLogin: true,
  supportedBroker: "ANGEL_ONE",
  name: "RELIANCE",
  underlyingSymbol: "RELIANCE",
  searchRank: 100,
});

const niftyFuture = withSearchFields({
  _id: new Types.ObjectId("65abc0000000000000000007"),
  symbol: "NFO:NIFTY:30JUL2026:FUTURE",
  displayName: "NFO NIFTY 30JUL2026 FUTURE",
  provider: "ANGEL_ONE",
  exchange: "NFO",
  marketType: "FNO",
  instrumentType: "FUTURE",
  providerSymbol: "NIFTY30JUL26FUT",
  instrumentToken: "53216",
  status: "ACTIVE",
  expiry: new Date(Date.UTC(2026, 6, 30)),
  requiresBrokerLogin: true,
  supportedBroker: "ANGEL_ONE",
  name: "NIFTY",
  underlyingSymbol: "NIFTY",
  lotSize: 75,
  searchRank: 80,
});

const niftyOption = withSearchFields({
  _id: new Types.ObjectId("65abc0000000000000000008"),
  symbol: "NFO:NIFTY:30JUL2026:25000:CE",
  displayName: "NFO NIFTY 30JUL2026 25000 CE",
  provider: "ANGEL_ONE",
  exchange: "NFO",
  marketType: "FNO",
  instrumentType: "OPTION",
  providerSymbol: "NIFTY30JUL2625000CE",
  instrumentToken: "53217",
  status: "ACTIVE",
  expiry: new Date(Date.UTC(2026, 6, 30)),
  requiresBrokerLogin: true,
  supportedBroker: "ANGEL_ONE",
  name: "NIFTY",
  underlyingSymbol: "NIFTY",
  strikePrice: 25000,
  optionType: "CE",
  lotSize: 75,
  searchRank: 10,
});

const boundaryNiftyFuture = withSearchFields({
  ...niftyFuture,
  _id: new Types.ObjectId("65abc0000000000000000009"),
  symbol: "NFO:NIFTY:01JUL2026:FUTURE",
  displayName: "NFO NIFTY 01JUL2026 FUTURE",
  providerSymbol: "NIFTY01JUL26FUT",
  instrumentToken: "53218",
  expiry: FIXED_EVALUATION_TIME,
});

const createService = (symbols: FakeSymbol[]) => {
  const calls: Array<Record<string, unknown>> = [];
  const projections: Array<Record<string, number>> = [];
  const repository = {
    find: (filter: Record<string, unknown>, projection: Record<string, number>) => {
      calls.push(filter);
      projections.push(projection);
      const tokenFilter = filter.autocompleteTokens as { $all?: string[]; $in?: string[] } | undefined;
      const anyTokens = new Set(tokenFilter?.$in ?? []);
      const allTokens = tokenFilter?.$all ?? [];
      const expiryBranches = filter.$or as Array<{
        expiry?: { $gte?: Date };
      }> | undefined;
      const expiryCutoff = expiryBranches
        ?.map((branch) => branch.expiry?.$gte)
        .find((value): value is Date => value instanceof Date);
      const filtered = symbols.filter((symbol) => {
        if (filter.provider && symbol.provider !== filter.provider) return false;
        if (filter.exchange && symbol.exchange !== filter.exchange) return false;
        if (filter.marketType && symbol.marketType !== filter.marketType) return false;
        if (filter.instrumentType && symbol.instrumentType !== filter.instrumentType) return false;
        if (filter.underlyingSymbol && symbol.underlyingSymbol !== filter.underlyingSymbol) return false;
        if (filter.optionType && symbol.optionType !== filter.optionType) return false;
        if (filter.strikePrice && symbol.strikePrice !== filter.strikePrice) return false;
        if (expiryCutoff && symbol.expiry && symbol.expiry < expiryCutoff) return false;
        if (allTokens.length > 0) {
          return allTokens.every((token) => symbol.autocompleteTokens.includes(token));
        }
        return symbol.autocompleteTokens.some((token) => anyTokens.has(token));
      });

      return {
        sort: () => ({
          limit: (limit: number) => ({
            lean: () => ({
              exec: async () => filtered.slice(0, limit),
            }),
          }),
        }),
      };
    },
  };

  return {
    service: new SymbolSearchService(repository as never, {
      now: () => new Date(FIXED_EVALUATION_TIME),
    }),
    calls,
    projections,
  };
};

test("SymbolSearchService returns empty results for short queries", async () => {
  const { service, calls } = createService([btc]);
  const response = await service.search({ q: "b" });

  assert.equal(response.results.length, 0);
  assert.equal(calls.length, 0);
});

test("SymbolSearchService finds BTCUSDT", async () => {
  const { service, projections } = createService([btc, goldFuture]);
  const response = await service.search({ q: "btc" });

  assert.equal(response.results[0]?.symbol, "BTCUSDT");
  assert.equal(response.results[0]?.provider, "BINANCE");
  assert.equal(Object.hasOwn(projections[0] ?? {}, "raw"), false);
});

test("SymbolSearchService ranks GOLD future above option for generic gold query", async () => {
  const { service } = createService([goldOption, goldFuture]);
  const response = await service.search({ q: "gold", exchange: "MCX", limit: 20 });

  assert.equal(response.results[0]?.symbol, "MCX:GOLD:04DEC2026:FUTURE");
  assert.equal(response.results[1]?.instrumentType, "OPTION");
});

test("SymbolSearchService requires all tokens for multi-word searches", async () => {
  const { service, calls } = createService([crudeFuture, goldOption, goldFuture]);
  const response = await service.search({ q: "MCX GOLD 04DEC2026 FUTURE", limit: 20 });

  assert.equal(response.results.length, 1);
  assert.equal(response.results[0]?.symbol, "MCX:GOLD:04DEC2026:FUTURE");
  assert.deepEqual(calls[0]?.autocompleteTokens, {
    $all: ["mcx", "gold", "04dec2026", "future"],
  });
});

test("SymbolSearchService supports provider and exchange filters", async () => {
  const { service } = createService([btc, goldFuture]);
  const response = await service.search({ q: "gold", provider: "ANGEL_ONE", exchange: "MCX" });

  assert.equal(response.results.length, 1);
  assert.equal(response.results[0]?.provider, "ANGEL_ONE");
});

test("SymbolSearchService excludes expired symbols by default", async () => {
  const { service } = createService([expiredGoldFuture, goldFuture]);
  const response = await service.search({ q: "gold", exchange: "MCX" });

  assert.equal(response.results.some((result) => result.symbol === "MCX:GOLD:04DEC2024:FUTURE"), false);
});

test("SymbolSearchService includes an instrument expiring at the evaluation boundary", async () => {
  const { service } = createService([boundaryNiftyFuture]);
  const response = await service.search({
    q: "nifty fut",
    exchange: "NFO",
    instrumentType: "FUTURE",
  });

  assert.equal(response.results.length, 1);
  assert.equal(response.results[0]?.symbol, "NFO:NIFTY:01JUL2026:FUTURE");
});

test("SymbolSearchService caps invalid large limit through validation", async () => {
  const { service } = createService([btc]);

  await assert.rejects(service.search({ q: "btc", limit: 500 }), /Too big/);
});

test("SymbolSearchService caches repeated query results", async () => {
  const { service, calls } = createService([btc]);

  await service.search({ q: "btc" });
  await service.search({ q: "btc" });

  assert.equal(calls.length, 1);
});

test("SymbolSearchService finds NSE equity cash symbols", async () => {
  const { service } = createService([relianceCash, niftyFuture]);
  const response = await service.search({ q: "reliance", exchange: "NSE", instrumentType: "CASH" });

  assert.equal(response.results.length, 1);
  assert.equal(response.results[0]?.symbol, "NSE:RELIANCE-EQ");
  assert.equal(response.results[0]?.underlyingSymbol, "RELIANCE");
});

test("SymbolSearchService finds NFO futures", async () => {
  const { service } = createService([niftyOption, niftyFuture, relianceCash]);
  const response = await service.search({ q: "nifty fut", exchange: "NFO", instrumentType: "FUTURE" });

  assert.equal(response.results.length, 1);
  assert.equal(response.results[0]?.symbol, "NFO:NIFTY:30JUL2026:FUTURE");
  assert.equal(response.results[0]?.lotSize, 75);
});

test("SymbolSearchService finds NFO options by CE and strike filters", async () => {
  const { service } = createService([niftyOption, niftyFuture]);
  const response = await service.search({
    q: "nifty ce",
    exchange: "NFO",
    instrumentType: "OPTION",
    optionType: "CE",
    strikePrice: 25000,
  });

  assert.equal(response.results.length, 1);
  assert.equal(response.results[0]?.symbol, "NFO:NIFTY:30JUL2026:25000:CE");
  assert.equal(response.results[0]?.optionType, "CE");
  assert.equal(response.results[0]?.strikePrice, 25000);
});
