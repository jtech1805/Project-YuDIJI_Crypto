import assert from "node:assert/strict";
import test from "node:test";

import {
  BINANCE_PUBLIC_PRICE_ADAPTER_ID,
  BinancePublicPriceEvidenceAdapter,
} from "../../../src/adapters/binance-public-price-evidence.adapter.js";
import type { BinancePublicMarketClient } from "../../../src/ports/binance-public-market-client.port.js";
import type { Clock } from "../../../src/ports/clock.port.js";
import { BinancePriceAdapterError } from "../../../src/types/binance-public-price-evidence.types.js";

const FIXED_TIME = new Date("2026-07-30T14:00:00.000Z");

const harness = (
  symbols: readonly string[],
  payloads: Readonly<Record<string, unknown>>,
) => {
  const requests: string[] = [];
  let clockCalls = 0;
  const client: BinancePublicMarketClient = {
    getTickerPrice: async (symbol) => {
      requests.push(symbol);
      return payloads[symbol];
    },
  };
  const clock: Clock = {
    now: () => {
      clockCalls += 1;
      return FIXED_TIME;
    },
  };
  const adapter = new BinancePublicPriceEvidenceAdapter({ client, clock, symbols });
  return { adapter, clockCalls: () => clockCalls, requests };
};

test("exposes the frozen versioned adapter identity", () => {
  const { adapter } = harness(["BTCUSDT"], {});
  assert.equal(adapter.adapterId, BINANCE_PUBLIC_PRICE_ADAPTER_ID);
  assert.equal(adapter.adapterId, "BINANCE_PUBLIC_MARKET_PRICE_V1");
});

test("maps one valid ticker response to the exact Evidence candidate", async () => {
  const testHarness = harness(["BTCUSDT"], {
    BTCUSDT: { symbol: "BTCUSDT", price: "67250.50", ignored: "not-persisted" },
  });
  assert.deepEqual(await testHarness.adapter.readCandidates(), [{
    recordType: "OBSERVATION",
    factorKey: "MARKET.PRICE",
    subject: {
      type: "INSTRUMENT",
      key: "CRYPTO:BINANCE:BTCUSDT",
      symbol: "BTCUSDT",
      exchange: "BINANCE",
      marketType: "CRYPTO",
    },
    provenance: {
      sourceType: "MARKET_DATA",
      provider: "BINANCE",
      sourceName: "BINANCE_PUBLIC_MARKET_PRICE_V1",
      externalReference:
        "BINANCE_PUBLIC_MARKET_PRICE_V1:BTCUSDT:2026-07-30T14:00:00.000Z",
    },
    value: { type: "NUMBER", numberValue: 67250.5, unit: "USDT" },
    observedAt: FIXED_TIME,
    schemaVersion: "1.0",
  }]);
});

test("requests multiple symbols sequentially and preserves configured order", async () => {
  const events: string[] = [];
  let active = 0;
  let overlap = false;
  let clockCalls = 0;
  const client: BinancePublicMarketClient = {
    getTickerPrice: async (symbol) => {
      events.push(`start-${symbol}`);
      active += 1;
      if (active > 1) overlap = true;
      await new Promise<void>((resolve) => setImmediate(resolve));
      active -= 1;
      events.push(`end-${symbol}`);
      return { symbol, price: "1.25" };
    },
  };
  const adapter = new BinancePublicPriceEvidenceAdapter({
    client,
    clock: { now: () => { clockCalls += 1; return FIXED_TIME; } },
    symbols: ["ETHUSDT", "BTCUSDT"],
  });
  const candidates = await adapter.readCandidates();
  assert.equal(overlap, false);
  assert.deepEqual(events, [
    "start-ETHUSDT", "end-ETHUSDT", "start-BTCUSDT", "end-BTCUSDT",
  ]);
  assert.deepEqual(candidates.map((item) => item.factorKey), [
    "MARKET.PRICE", "MARKET.PRICE",
  ]);
  assert.deepEqual(candidates.map((item) => item.subject.symbol), [
    "ETHUSDT", "BTCUSDT",
  ]);
  assert.equal(clockCalls, 1);
  assert.equal(candidates[0]?.observedAt.getTime(), FIXED_TIME.getTime());
  assert.equal(candidates[1]?.observedAt.getTime(), FIXED_TIME.getTime());
  assert.notEqual(candidates[0]?.observedAt, candidates[1]?.observedAt);
});

test("preserves the provider decimal through normal JavaScript numeric representation", async () => {
  const candidates = await harness(["BTCUSDT"], {
    BTCUSDT: { symbol: "BTCUSDT", price: "67250.50000000" },
  }).adapter.readCandidates();
  const first = candidates[0];
  assert.equal(first?.recordType, "OBSERVATION");
  if (first?.recordType !== "OBSERVATION") assert.fail("expected observation");
  assert.deepEqual(first.value, {
    type: "NUMBER",
    numberValue: 67250.5,
    unit: "USDT",
  });
});

test("rejects invalid symbol configuration before requests", () => {
  const invalidConfigurations: unknown[] = [
    [],
    Array.from({ length: 21 }, (_, index) => `ASSET${index}USDT`),
    ["BTCUSDT", "BTCUSDT"],
    [" btcusdt"],
    ["BTCUSDT "],
    ["btcusdt"],
    ["BTC-USDT"],
    [42],
  ];
  for (const symbols of invalidConfigurations) {
    let requests = 0;
    assert.throws(
      () => new BinancePublicPriceEvidenceAdapter({
        client: { getTickerPrice: async () => { requests += 1; return {}; } },
        clock: { now: () => FIXED_TIME },
        symbols: symbols as readonly string[],
      }),
      (error: unknown) =>
        error instanceof BinancePriceAdapterError
        && error.code === "INVALID_CONFIGURATION",
    );
    assert.equal(requests, 0);
  }
});

test("maps client failure to a safe provider-request error", async () => {
  const adapter = new BinancePublicPriceEvidenceAdapter({
    client: {
      getTickerPrice: async () => {
        throw new Error("apiKey=secret response body");
      },
    },
    clock: { now: () => FIXED_TIME },
    symbols: ["BTCUSDT"],
  });
  await assert.rejects(
    adapter.readCandidates(),
    (error: unknown) =>
      error instanceof BinancePriceAdapterError
      && error.code === "PROVIDER_REQUEST_FAILED"
      && !error.message.includes("secret"),
  );
});

test("rejects invalid provider response shapes and missing required fields", async () => {
  for (const payload of [
    null, undefined, [], "ticker", 1,
    { price: "1" },
    { symbol: "BTCUSDT" },
  ]) {
    await assert.rejects(
      harness(["BTCUSDT"], { BTCUSDT: payload }).adapter.readCandidates(),
      (error: unknown) =>
        error instanceof BinancePriceAdapterError
        && error.code === "INVALID_PROVIDER_RESPONSE",
    );
  }
});

test("rejects a mismatched provider symbol", async () => {
  await assert.rejects(
    harness(["BTCUSDT"], {
      BTCUSDT: { symbol: "ETHUSDT", price: "1" },
    }).adapter.readCandidates(),
    (error: unknown) =>
      error instanceof BinancePriceAdapterError
      && error.code === "SYMBOL_MISMATCH",
  );
});

test("strictly rejects invalid provider prices without coercion", async () => {
  for (const price of [
    "", " 67250.5", "67250.5 ", "67250abc", "NaN", "Infinity",
    "-1", "0", "1e3", "1.", 0, null,
  ]) {
    await assert.rejects(
      harness(["BTCUSDT"], {
        BTCUSDT: { symbol: "BTCUSDT", price },
      }).adapter.readCandidates(),
      (error: unknown) =>
        error instanceof BinancePriceAdapterError
        && (error.code === "INVALID_PRICE"
          || error.code === "INVALID_PROVIDER_RESPONSE"),
    );
  }
});

test("rejects an invalid clock and calls it exactly once", async () => {
  for (const clockValue of [new Date("invalid"), "2026-07-30"] as const) {
    let calls = 0;
    const adapter = new BinancePublicPriceEvidenceAdapter({
      client: { getTickerPrice: async () => ({ symbol: "BTCUSDT", price: "1" }) },
      clock: { now: () => { calls += 1; return clockValue as Date; } },
      symbols: ["BTCUSDT"],
    });
    await assert.rejects(
      adapter.readCandidates(),
      (error: unknown) =>
        error instanceof BinancePriceAdapterError
        && error.code === "INVALID_CLOCK",
    );
    assert.equal(calls, 1);
  }
});

test("does not mutate symbols, payloads, or the clock Date", async () => {
  const symbols = Object.freeze(["BTCUSDT"]);
  const payload = Object.freeze({ symbol: "BTCUSDT", price: "1.25", extra: true });
  const clockDate = new Date(FIXED_TIME);
  const adapter = new BinancePublicPriceEvidenceAdapter({
    client: { getTickerPrice: async () => payload },
    clock: { now: () => clockDate },
    symbols,
  });
  const candidates = await adapter.readCandidates();
  const firstObservedAt = candidates[0]?.observedAt;
  firstObservedAt?.setUTCFullYear(2030);
  assert.equal(clockDate.toISOString(), FIXED_TIME.toISOString());
  assert.deepEqual(symbols, ["BTCUSDT"]);
  assert.deepEqual(payload, { symbol: "BTCUSDT", price: "1.25", extra: true });
});

test("produces deterministic candidates for fixed inputs", async () => {
  const create = () => harness(["BTCUSDT", "ETHUSDT"], {
    BTCUSDT: { symbol: "BTCUSDT", price: "2" },
    ETHUSDT: { symbol: "ETHUSDT", price: "1" },
  }).adapter.readCandidates();
  assert.deepEqual(await create(), await create());
});
