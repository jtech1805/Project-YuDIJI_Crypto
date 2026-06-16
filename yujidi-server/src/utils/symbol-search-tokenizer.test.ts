import assert from "node:assert/strict";
import test from "node:test";

import { normalizeSearchText, tokenizeSymbolSearch } from "./symbol-search-tokenizer.js";

test("normalizeSearchText lowercases and collapses separators", () => {
  assert.equal(normalizeSearchText("  MCX:GOLD / FUTURE  "), "mcx gold future");
});

test("tokenizeSymbolSearch builds Binance BTC tokens and prefixes", () => {
  const tokens = tokenizeSymbolSearch({
    symbol: "BTCUSDT",
    displayName: "BTC / USDT",
    providerSymbol: "BTCUSDT",
    name: "Bitcoin",
    baseAsset: "BTC",
    quoteAsset: "USDT",
    exchange: "BINANCE",
    marketType: "CRYPTO",
    instrumentType: "SPOT",
  });

  assert.equal(tokens.searchSymbol, "btcusdt");
  assert.ok(tokens.searchTokens.includes("btc"));
  assert.ok(tokens.searchTokens.includes("usdt"));
  assert.ok(tokens.searchTokens.includes("btcusdt"));
  assert.ok(tokens.autocompleteTokens.includes("bt"));
  assert.ok(tokens.autocompleteTokens.includes("btcusdt"));
});

test("tokenizeSymbolSearch builds MCX GOLD future tokens", () => {
  const tokens = tokenizeSymbolSearch({
    symbol: "MCX:GOLD:04DEC2026:FUTURE",
    displayName: "MCX GOLD 04DEC2026 FUTURE",
    providerSymbol: "GOLD04DEC26FUT",
    name: "GOLD",
    exchange: "MCX",
    marketType: "COMMODITY",
    instrumentType: "FUTURE",
    expiry: "04DEC2026",
  });

  assert.equal(tokens.searchName, "gold");
  assert.ok(tokens.searchTokens.includes("mcx"));
  assert.ok(tokens.searchTokens.includes("gold"));
  assert.ok(tokens.searchTokens.includes("04dec2026"));
  assert.ok(tokens.searchTokens.includes("2026"));
  assert.ok(tokens.searchTokens.includes("gold04dec26fut"));
  assert.ok(tokens.searchTokens.includes("future"));
  assert.ok(tokens.searchTokens.includes("fut"));
  assert.ok(tokens.autocompleteTokens.includes("go"));
  assert.ok(tokens.autocompleteTokens.includes("gold"));
});

test("tokenizeSymbolSearch removes duplicate tokens", () => {
  const tokens = tokenizeSymbolSearch({
    symbol: "BTCUSDT",
    displayName: "BTC BTC USDT",
    providerSymbol: "BTCUSDT",
    baseAsset: "BTC",
    quoteAsset: "USDT",
  });

  assert.equal(tokens.searchTokens.filter((token) => token === "btc").length, 1);
});
