import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import { SymbolResolverService } from "../../../src/services/symbol-resolver.service.js";

const execResult = <T>(value: T) => ({
  exec: async () => value,
});

const leanExecResult = <T>(value: T) => ({
  lean: () => execResult(value),
});

const makeResolver = (symbols: Array<Record<string, unknown>>) => {
  const calls: Array<Record<string, unknown>> = [];
  const service = new SymbolResolverService({
    symbolRepository: {
      find: ((filter: Record<string, unknown>) => {
        calls.push(filter);
        const filtered = symbols.filter((symbol) => {
          return Object.entries(filter).every(([key, value]) => symbol[key] === value);
        });
        return leanExecResult(filtered);
      }) as never,
    },
  });

  return {
    service,
    calls,
  };
};

test("SymbolResolverService returns unresolved when no mapping exists", async () => {
  const { service } = makeResolver([]);
  const result = await service.resolveCanonicalSymbol({
    provider: "ANGEL_ONE",
    exchange: "MCX",
    instrumentToken: "570027",
    providerSymbol: "GOLD05APR27FUT",
    instrumentType: "FUTURE",
  });

  assert.deepEqual(result, {
    resolved: false,
    confidence: "LOW",
    reasonCode: "NO_MAPPING_FOUND",
  });
});

test("SymbolResolverService resolves by instrument token first", async () => {
  const symbolId = new Types.ObjectId("65abc0000000000000000001");
  const { service, calls } = makeResolver([
    {
      _id: symbolId,
      provider: "ANGEL_ONE",
      exchange: "MCX",
      instrumentToken: "570027",
      providerSymbol: "OTHER",
      instrumentType: "FUTURE",
      status: "ACTIVE",
    },
  ]);

  const result = await service.resolveCanonicalSymbol({
    provider: "ANGEL_ONE",
    exchange: "MCX",
    instrumentToken: "570027",
    providerSymbol: "GOLD05APR27FUT",
    instrumentType: "FUTURE",
  });

  assert.equal(result.resolved, true);
  assert.equal(result.symbolId, symbolId.toString());
  assert.equal(result.confidence, "HIGH");
  assert.equal(result.reasonCode, "MATCHED_BY_INSTRUMENT_TOKEN");
  assert.deepEqual(calls[0], {
    provider: "ANGEL_ONE",
    exchange: "MCX",
    instrumentToken: "570027",
  });
});

test("SymbolResolverService blocks ambiguous provider symbol mapping", async () => {
  const { service } = makeResolver([
    {
      _id: new Types.ObjectId("65abc0000000000000000001"),
      provider: "ANGEL_ONE",
      exchange: "MCX",
      providerSymbol: "GOLD05APR27FUT",
      instrumentType: "FUTURE",
      status: "ACTIVE",
    },
    {
      _id: new Types.ObjectId("65abc0000000000000000002"),
      provider: "ANGEL_ONE",
      exchange: "MCX",
      providerSymbol: "GOLD05APR27FUT",
      instrumentType: "FUTURE",
      status: "ACTIVE",
    },
  ]);

  const result = await service.resolveCanonicalSymbol({
    provider: "ANGEL_ONE",
    exchange: "MCX",
    providerSymbol: "GOLD05APR27FUT",
    instrumentType: "FUTURE",
  });

  assert.deepEqual(result, {
    resolved: false,
    confidence: "LOW",
    reasonCode: "AMBIGUOUS_MAPPING",
  });
});

test("SymbolResolverService detects instrument type mismatch", async () => {
  const { service } = makeResolver([
    {
      _id: new Types.ObjectId("65abc0000000000000000001"),
      provider: "ANGEL_ONE",
      exchange: "MCX",
      instrumentToken: "570027",
      instrumentType: "OPTION",
      status: "ACTIVE",
    },
  ]);

  const result = await service.resolveCanonicalSymbol({
    provider: "ANGEL_ONE",
    exchange: "MCX",
    instrumentToken: "570027",
    instrumentType: "FUTURE",
  });

  assert.deepEqual(result, {
    resolved: false,
    confidence: "LOW",
    reasonCode: "INSTRUMENT_TYPE_MISMATCH",
  });
});
