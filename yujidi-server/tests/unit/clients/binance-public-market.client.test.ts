import assert from "node:assert/strict";
import test from "node:test";
import type { AxiosInstance } from "axios";

import {
  AxiosBinancePublicMarketClient,
  BINANCE_PUBLIC_API_BASE_URL,
  BINANCE_PUBLIC_REQUEST_TIMEOUT_MS,
  BinancePublicMarketClientError,
} from "../../../src/clients/binance-public-market.client.js";

test("requests the public ticker-price endpoint with timeout and no credentials", async () => {
  const calls: Array<{
    url: string;
    config: Record<string, unknown>;
  }> = [];
  const httpClient = {
    get: async (url: string, config: Record<string, unknown>) => {
      calls.push({ url, config });
      return {
        status: 200,
        data: { symbol: "BTCUSDT", price: "1" },
      };
    },
  } as unknown as AxiosInstance;
  const result = await new AxiosBinancePublicMarketClient(httpClient)
    .getTickerPrice("BTCUSDT");
  assert.deepEqual(result, { symbol: "BTCUSDT", price: "1" });
  assert.deepEqual(calls, [{
    url: `${BINANCE_PUBLIC_API_BASE_URL}/api/v3/ticker/price`,
    config: {
      params: { symbol: "BTCUSDT" },
      timeout: BINANCE_PUBLIC_REQUEST_TIMEOUT_MS,
    },
  }]);
  assert.equal(
    /authorization|cookie|api.?key|secret/i.test(JSON.stringify(calls)),
    false,
  );
});

test("maps HTTP, network, and parse-layer failures to one safe error", async () => {
  for (const behavior of [
    async () => ({ status: 500, data: "provider secret body" }),
    async () => { throw new Error("network authorization=secret"); },
    async () => { throw new SyntaxError("raw invalid JSON"); },
  ]) {
    const client = new AxiosBinancePublicMarketClient({
      get: behavior,
    } as unknown as AxiosInstance);
    await assert.rejects(
      client.getTickerPrice("BTCUSDT"),
      (error: unknown) =>
        error instanceof BinancePublicMarketClientError
        && !error.message.includes("secret")
        && !error.message.includes("JSON"),
    );
  }
});
