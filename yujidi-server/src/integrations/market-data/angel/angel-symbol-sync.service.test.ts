import assert from "node:assert/strict";
import test from "node:test";
import type { AnyBulkWriteOperation } from "mongoose";

import type { SymbolDocument } from "../../../models/Symbol.js";
import { AngelSymbolSyncService } from "./angel-symbol-sync.service.js";
import type { AngelScripMasterRow } from "./angel-scrip-master.types.js";

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

const nseCashRow: AngelScripMasterRow = {
  token: "3045",
  symbol: "SBIN-EQ",
  name: "SBIN",
  expiry: "",
  strike: "-1.000000",
  lotsize: "1",
  instrumenttype: "",
  exch_seg: "NSE",
  tick_size: "5.000000",
};

test("AngelSymbolSyncService does nothing when disabled", async () => {
  let fetchCalled = false;
  let bulkWriteCalled = false;
  const service = new AngelSymbolSyncService({
    isEnabled: () => false,
    client: {
      fetchScripMaster: async () => {
        fetchCalled = true;
        return [mcxOptionRow];
      },
    },
    bulkWrite: async () => {
      bulkWriteCalled = true;
      return { upsertedCount: 0, modifiedCount: 0 };
    },
  });

  const result = await service.syncSymbols();

  assert.equal(result.enabled, false);
  assert.equal(result.dryRun, false);
  assert.equal(fetchCalled, false);
  assert.equal(bulkWriteCalled, false);
  assert.equal(result.fetchedRows, 0);
  assert.equal(result.batchesWritten, 0);
});

test("AngelSymbolSyncService maps MCX rows and upserts universal Symbol records", async () => {
  const operations: AnyBulkWriteOperation<SymbolDocument>[] = [];
  const service = new AngelSymbolSyncService({
    isEnabled: () => true,
    client: {
      fetchScripMaster: async () => [mcxOptionRow, nseCashRow],
    },
    bulkWrite: async (receivedOperations) => {
      operations.push(...receivedOperations);
      return { upsertedCount: receivedOperations.length, modifiedCount: 0 };
    },
  });

  const result = await service.syncSymbols();

  assert.equal(result.enabled, true);
  assert.equal(result.dryRun, false);
  assert.equal(result.fetchedRows, 2);
  assert.equal(result.mappedRows, 1);
  assert.equal(result.skippedRows, 1);
  assert.equal(result.upsertedCount, 1);
  assert.equal(result.batchesWritten, 1);
  assert.equal(operations.length, 1);

  const operation = operations[0];
  assert.ok(operation && "updateOne" in operation);
  assert.deepEqual(operation.updateOne.filter, {
    provider: "ANGEL_ONE",
    exchange: "MCX",
    instrumentToken: "253456",
  });
  assert.equal(operation.updateOne.upsert, true);
  const update = operation.updateOne.update as { $set: Record<string, unknown> };
  assert.equal(update.$set.provider, "ANGEL_ONE");
  assert.equal(update.$set.symbol, "MCX:CRUDEOIL:26JUN2026:7200:CE");
  assert.equal(update.$set.requiresBrokerLogin, true);
});

test("AngelSymbolSyncService dry-run fetches and maps without writing", async () => {
  let bulkWriteCalled = false;
  const service = new AngelSymbolSyncService({
    isEnabled: () => false,
    client: {
      fetchScripMaster: async () => [mcxOptionRow, nseCashRow],
    },
    bulkWrite: async () => {
      bulkWriteCalled = true;
      return { upsertedCount: 0, modifiedCount: 0 };
    },
  });

  const result = await service.syncSymbols({ dryRun: true });

  assert.equal(result.enabled, false);
  assert.equal(result.dryRun, true);
  assert.equal(result.fetchedRows, 2);
  assert.equal(result.mappedRows, 1);
  assert.equal(result.skippedRows, 1);
  assert.equal(result.upsertedCount, 0);
  assert.equal(result.modifiedCount, 0);
  assert.equal(result.batchesWritten, 0);
  assert.equal(bulkWriteCalled, false);
});

test("AngelSymbolSyncService writes mapped symbols in batches", async () => {
  const batchSizes: number[] = [];
  const service = new AngelSymbolSyncService({
    isEnabled: () => true,
    client: {
      fetchScripMaster: async () => [mcxOptionRow, { ...mcxOptionRow, token: "253457", symbol: "CRUDEOIL26JUN7200PE" }],
    },
    bulkWrite: async (receivedOperations) => {
      batchSizes.push(receivedOperations.length);
      return { upsertedCount: receivedOperations.length, modifiedCount: 0 };
    },
  });

  const result = await service.syncSymbols({ batchSize: 1 });

  assert.equal(result.mappedRows, 2);
  assert.equal(result.upsertedCount, 2);
  assert.equal(result.batchesWritten, 2);
  assert.deepEqual(batchSizes, [1, 1]);
});
