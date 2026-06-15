import type { AnyBulkWriteOperation } from "mongoose";

import { SymbolModel, type SymbolDocument } from "../../../models/Symbol.js";
import type { Exchange } from "../../../types/market-data.types.js";
import { AngelScripMasterClient } from "./angel-scrip-master.client.js";
import type { AngelScripMasterRow } from "./angel-scrip-master.types.js";
import {
  mapAngelScripToUniversalSymbol,
  type UniversalSymbolSet,
} from "./angel-symbol.mapper.js";

export type AngelSymbolSyncResult = {
  enabled: boolean;
  dryRun: boolean;
  exchanges: Exchange[];
  fetchedRows: number;
  mappedRows: number;
  skippedRows: number;
  upsertedCount: number;
  modifiedCount: number;
  batchesWritten: number;
};

type AngelSymbolSyncDependencies = {
  client: Pick<AngelScripMasterClient, "fetchScripMaster">;
  bulkWrite: (operations: AnyBulkWriteOperation<SymbolDocument>[]) => Promise<{
    upsertedCount?: number;
    modifiedCount?: number;
  }>;
  isEnabled: () => boolean;
};

export type AngelSymbolSyncOptions = {
  exchanges?: Exchange[];
  dryRun?: boolean;
  batchSize?: number;
};

const defaultDependencies: AngelSymbolSyncDependencies = {
  client: new AngelScripMasterClient(),
  bulkWrite: async (operations) => SymbolModel.bulkWrite(operations, { ordered: false }),
  isEnabled: () => process.env.ANGEL_SCRIP_MASTER_SYNC_ENABLED === "true",
};

const DEFAULT_EXCHANGES: Exchange[] = ["MCX"];
const DEFAULT_BATCH_SIZE = 1_000;

export class AngelSymbolSyncService {
  public constructor(private readonly dependencies: Partial<AngelSymbolSyncDependencies> = {}) {}

  public async syncSymbols(options: AngelSymbolSyncOptions = {}): Promise<AngelSymbolSyncResult> {
    const deps = { ...defaultDependencies, ...this.dependencies };
    const dryRun = options.dryRun ?? false;
    const exchanges = options.exchanges ?? DEFAULT_EXCHANGES;
    const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
    if (!Number.isInteger(batchSize) || batchSize <= 0) {
      throw new Error("Angel symbol sync batchSize must be a positive integer");
    }

    if (!deps.isEnabled() && !dryRun) {
      return {
        enabled: false,
        dryRun,
        exchanges,
        fetchedRows: 0,
        mappedRows: 0,
        skippedRows: 0,
        upsertedCount: 0,
        modifiedCount: 0,
        batchesWritten: 0,
      };
    }

    const rows = await deps.client.fetchScripMaster();
    const targetExchanges = new Set(exchanges);
    const mappedSymbols = this.mapRowsForExchanges(rows, targetExchanges);

    if (mappedSymbols.length === 0 || dryRun) {
      return {
        enabled: deps.isEnabled(),
        dryRun,
        exchanges,
        fetchedRows: rows.length,
        mappedRows: mappedSymbols.length,
        skippedRows: rows.length - mappedSymbols.length,
        upsertedCount: 0,
        modifiedCount: 0,
        batchesWritten: 0,
      };
    }

    let upsertedCount = 0;
    let modifiedCount = 0;
    let batchesWritten = 0;

    for (let start = 0; start < mappedSymbols.length; start += batchSize) {
      const batch = mappedSymbols.slice(start, start + batchSize);
      const result = await deps.bulkWrite(batch.map((symbol) => this.createUpsertOperation(symbol)));
      upsertedCount += result.upsertedCount ?? 0;
      modifiedCount += result.modifiedCount ?? 0;
      batchesWritten += 1;
    }

    return {
      enabled: true,
      dryRun,
      exchanges,
      fetchedRows: rows.length,
      mappedRows: mappedSymbols.length,
      skippedRows: rows.length - mappedSymbols.length,
      upsertedCount,
      modifiedCount,
      batchesWritten,
    };
  }

  private mapRowsForExchanges(
    rows: AngelScripMasterRow[],
    targetExchanges: Set<Exchange>,
  ): UniversalSymbolSet[] {
    const mappedSymbols: UniversalSymbolSet[] = [];

    for (const row of rows) {
      const mapped = mapAngelScripToUniversalSymbol(row);
      if (!targetExchanges.has(mapped.exchange)) {
        continue;
      }

      mappedSymbols.push(mapped);
    }

    return mappedSymbols;
  }

  private createUpsertOperation(symbol: UniversalSymbolSet): AnyBulkWriteOperation<SymbolDocument> {
    return {
      updateOne: {
        filter: {
          provider: symbol.provider,
          exchange: symbol.exchange,
          instrumentToken: symbol.instrumentToken,
        },
        update: {
          $set: symbol,
        },
        upsert: true,
      },
    };
  }
}
