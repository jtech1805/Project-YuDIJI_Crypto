import assert from "node:assert/strict";
import test from "node:test";

import { MarketQuoteService } from "../../../src/services/market-quote.service.js";

const userId = "69e64c5f9042aac89c8c83f8";
const symbolId = "65abc0000000000000000001";

const execResult = <T>(value: T) => ({
  exec: async () => value,
});

const makeSymbol = (overrides: Record<string, unknown> = {}) => ({
  _id: symbolId,
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
  ...overrides,
});

const makeService = ({
  symbol = makeSymbol(),
  brokerSession = {
    clientCode: "AB1234",
    apiKey: "api-key",
    jwtToken: "jwt-token",
  },
  quoteResponse = {
    fetched: [
      {
        exchange: "MCX",
        tradingSymbol: "CRUDEOIL26JUN7200CE",
        symbolToken: "253456",
        ltp: 7200,
        opnInterest: 8900,
      },
    ],
    unfetched: [],
  },
  brokerError,
}: {
  symbol?: unknown;
  brokerSession?: unknown;
  quoteResponse?: unknown;
  brokerError?: Error;
} = {}) => {
  return new MarketQuoteService({
    symbolRepository: {
      findById: (() => execResult(symbol)) as never,
    },
    brokerConnectionService: {
      getActiveAngelSessionForUser: async () => {
        if (brokerError) {
          throw brokerError;
        }

        return brokerSession as never;
      },
    },
    angelQuoteService: {
      fetchAngelQuote: async () => quoteResponse as never,
    },
  });
};

test("MarketQuoteService rejects missing symbol", async () => {
  const service = makeService({ symbol: null });

  await assert.rejects(
    service.getQuoteForSymbol(userId, symbolId, "LTP"),
    /SYMBOL_NOT_FOUND/,
  );
});

test("MarketQuoteService rejects non-Angel provider", async () => {
  const service = makeService({
    symbol: makeSymbol({
      provider: "BINANCE",
      exchange: "BINANCE",
      requiresBrokerLogin: false,
      symbol: "BTCUSDT",
    }),
  });

  await assert.rejects(
    service.getQuoteForSymbol(userId, symbolId, "LTP"),
    /PROVIDER_NOT_SUPPORTED_BY_QUOTE_API_YET/,
  );
});

test("MarketQuoteService rejects missing broker connection", async () => {
  const service = makeService({
    brokerError: new Error("BROKER_CONNECTION_NOT_FOUND"),
  });

  await assert.rejects(
    service.getQuoteForSymbol(userId, symbolId, "LTP"),
    /BROKER_CONNECTION_NOT_FOUND/,
  );
});

test("MarketQuoteService returns normalized safe snapshot", async () => {
  const service = makeService();
  const snapshot = await service.getQuoteForSymbol(userId, symbolId, "FULL");
  const serialized = JSON.stringify(snapshot);

  assert.equal(snapshot.provider, "ANGEL_ONE");
  assert.equal(snapshot.exchange, "MCX");
  assert.equal(snapshot.symbolId, symbolId);
  assert.equal(snapshot.instrumentToken, "253456");
  assert.equal(snapshot.mode, "FULL");
  assert.equal(snapshot.ltp, 7200);
  assert.equal(snapshot.openInterest, 8900);
  assert.equal(serialized.includes("api-key"), false);
  assert.equal(serialized.includes("jwt-token"), false);
  assert.equal(serialized.includes("encrypted"), false);
});

test("MarketQuoteService handles Angel unfetched symbol safely", async () => {
  const service = makeService({
    quoteResponse: {
      fetched: [],
      unfetched: [
        {
          exchange: "MCX",
          symbolToken: "253456",
          message: "Symbol token cannot be empty",
          errorCode: "AB4018",
        },
      ],
    },
  });

  await assert.rejects(
    service.getQuoteForSymbol(userId, symbolId, "LTP"),
    /ANGEL_QUOTE_UNFETCHED/,
  );
});
