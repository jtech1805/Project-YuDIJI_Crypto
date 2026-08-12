import assert from "node:assert/strict";
import test from "node:test";

import { BinancePublicPriceEvidenceAdapter } from "../../../src/adapters/binance-public-price-evidence.adapter.js";
import { EvidenceProviderRunnerService } from "../../../src/services/evidence/evidence-provider-runner.service.js";
import type { EvidenceIngestionResult } from "../../../src/types/evidence-ingestion.types.js";

const FIXED_TIME = new Date("2026-07-30T14:00:00.000Z");

test("real adapter and runner produce a completed ordered shadow batch", async () => {
  const requested: string[] = [];
  const adapter = new BinancePublicPriceEvidenceAdapter({
    client: {
      getTickerPrice: async (symbol) => {
        requested.push(symbol);
        return { symbol, price: symbol === "ETHUSDT" ? "3500.5" : "67250.5" };
      },
    },
    clock: { now: () => FIXED_TIME },
    symbols: ["ETHUSDT", "BTCUSDT"],
  });
  const ingestedSymbols: string[] = [];
  let index = 0;
  const outcomes: EvidenceIngestionResult[] = [
    { status: "CREATED", evidenceId: "E-1", deduplicationKey: "D-1" },
    { status: "DUPLICATE", evidenceId: "E-2", deduplicationKey: "D-2" },
  ];
  const runner = new EvidenceProviderRunnerService({
    ingestionService: {
      ingest: async (candidate) => {
        const record = candidate as {
          subject: { symbol?: string };
        };
        ingestedSymbols.push(record.subject.symbol ?? "");
        const result = outcomes[index];
        index += 1;
        if (!result) throw new Error("missing stub result");
        return result;
      },
    },
  });
  const result = await runner.run({ adapter });
  assert.equal(result.status, "COMPLETED");
  assert.equal(result.candidateCount, 2);
  assert.equal(result.createdCount, 1);
  assert.equal(result.duplicateCount, 1);
  assert.deepEqual(requested, ["ETHUSDT", "BTCUSDT"]);
  assert.deepEqual(ingestedSymbols, ["ETHUSDT", "BTCUSDT"]);
  assert.deepEqual(result.results.map(({ index: resultIndex }) => resultIndex), [0, 1]);
});

test("malformed provider response becomes a generic failed runner result", async () => {
  let ingestionCalls = 0;
  const adapter = new BinancePublicPriceEvidenceAdapter({
    client: {
      getTickerPrice: async () => ({ symbol: "BTCUSDT", price: "invalid" }),
    },
    clock: { now: () => FIXED_TIME },
    symbols: ["BTCUSDT"],
  });
  const runner = new EvidenceProviderRunnerService({
    ingestionService: {
      ingest: async () => {
        ingestionCalls += 1;
        return { status: "FAILED", code: "PERSISTENCE_FAILED" };
      },
    },
  });
  const result = await runner.run({ adapter });
  assert.equal(result.status, "FAILED");
  if (result.status !== "FAILED") assert.fail("expected failed run");
  assert.equal(result.failureCode, "ADAPTER_EXECUTION_FAILED");
  assert.equal(result.candidateCount, 0);
  assert.equal(ingestionCalls, 0);
});

test("oversized symbol configuration fails before runner execution", () => {
  assert.throws(
    () => new BinancePublicPriceEvidenceAdapter({
      client: { getTickerPrice: async () => ({}) },
      clock: { now: () => FIXED_TIME },
      symbols: Array.from({ length: 21 }, (_, index) => `ASSET${index}USDT`),
    }),
  );
});
