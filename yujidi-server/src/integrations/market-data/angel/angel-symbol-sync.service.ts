import type { AnyBulkWriteOperation } from "mongoose";
import pino from "pino";

import { SymbolModel, type SymbolDocument } from "../../../models/Symbol.js";
import type { Exchange, MarketType } from "../../../types/market-data.types.js";
import { AngelScripMasterClient } from "./angel-scrip-master.client.js";
import type { AngelScripMasterRow } from "./angel-scrip-master.types.js";
import {
  mapAngelScripToUniversalSymbol,
  type UniversalSymbolSet,
} from "./angel-symbol.mapper.js";

const logger = pino({ name: "angel-symbol-sync" });

export type AngelSymbolSyncResult = {
  enabled: boolean;
  dryRun: boolean;
  exchanges: Exchange[];
  marketTypes: MarketType[];
  supportedNames: string[];
  fetchedCount: number;
  filteredCount: number;
  mappedCount: number;
  skippedCount: number;
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
  marketTypes?: MarketType[];
  supportedNames?: string[];
  dryRun?: boolean;
  batchSize?: number;
};

const defaultDependencies: AngelSymbolSyncDependencies = {
  client: new AngelScripMasterClient(),
  bulkWrite: async (operations) => SymbolModel.bulkWrite(operations, { ordered: false }),
  isEnabled: () => process.env.ANGEL_SYMBOL_SYNC_ENABLED === "true",
};

const DEFAULT_EXCHANGES: Exchange[] = ["MCX"];
const DEFAULT_MARKET_TYPES: MarketType[] = ["COMMODITY"];
const DEFAULT_SUPPORTED_NAMES = ["CRUDEOIL", "GOLD", "SILVER", "NATURALGAS"];
const DEFAULT_BATCH_SIZE = 1_000;

const normalizeName = (value: string): string => {
  return value.trim().toUpperCase();
};

export const parseAngelSymbolSyncList = (rawValue: string | undefined, defaults: string[]): string[] => {
  if (!rawValue?.trim()) {
    return defaults;
  }

  const values = rawValue
    .split(",")
    .map((value) => normalizeName(value))
    .filter(Boolean);

  return values.length > 0 ? values : defaults;
};

export const getAngelSymbolSyncConfigFromEnv = (): Required<Pick<AngelSymbolSyncOptions, "exchanges" | "marketTypes" | "supportedNames">> => {
  return {
    exchanges: parseAngelSymbolSyncList(
      process.env.ANGEL_SYMBOL_SYNC_EXCHANGES,
      DEFAULT_EXCHANGES,
    ) as Exchange[],
    marketTypes: parseAngelSymbolSyncList(
      process.env.ANGEL_SYMBOL_SYNC_MARKET_TYPES,
      DEFAULT_MARKET_TYPES,
    ) as MarketType[],
    supportedNames: parseAngelSymbolSyncList(
      process.env.ANGEL_SYMBOL_SYNC_NAMES,
      DEFAULT_SUPPORTED_NAMES,
    ),
  };
};

export class AngelSymbolSyncService {
  public constructor(private readonly dependencies: Partial<AngelSymbolSyncDependencies> = {}) {}

  public async syncSymbols(options: AngelSymbolSyncOptions = {}): Promise<AngelSymbolSyncResult> {
    const deps = { ...defaultDependencies, ...this.dependencies };
    const dryRun = options.dryRun ?? false;
    const envConfig = getAngelSymbolSyncConfigFromEnv();
    const exchanges = options.exchanges ?? envConfig.exchanges;
    const marketTypes = options.marketTypes ?? envConfig.marketTypes;
    const supportedNames = options.supportedNames ?? envConfig.supportedNames;
    const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
    if (!Number.isInteger(batchSize) || batchSize <= 0) {
      throw new Error("Angel symbol sync batchSize must be a positive integer");
    }

    if (!deps.isEnabled() && !dryRun) {
      return {
        enabled: false,
        dryRun,
        exchanges,
        marketTypes,
        supportedNames,
        fetchedCount: 0,
        filteredCount: 0,
        mappedCount: 0,
        skippedCount: 0,
        upsertedCount: 0,
        modifiedCount: 0,
        batchesWritten: 0,
      };
    }

    const rows = await deps.client.fetchScripMaster();
    if (!Array.isArray(rows)) {
      throw new Error("Angel Scrip Master response must be an array");
    }

    const targetExchanges = new Set(exchanges);
    const targetMarketTypes = new Set(marketTypes);
    const targetNames = new Set(supportedNames.map((name) => normalizeName(name)));
    const filteredRows = this.filterRows(rows, targetExchanges, targetMarketTypes, targetNames);
    const mappedSymbols = filteredRows.map((row) => mapAngelScripToUniversalSymbol(row));

    if (mappedSymbols.length === 0 || dryRun) {
      logger.info(
        {
          enabled: deps.isEnabled(),
          dryRun,
          exchanges,
          marketTypes,
          supportedNames,
          fetchedCount: rows.length,
          filteredCount: filteredRows.length,
          mappedCount: mappedSymbols.length,
          skippedCount: rows.length - filteredRows.length,
        },
        "Angel MCX symbol sync completed without writes",
      );

      return {
        enabled: deps.isEnabled(),
        dryRun,
        exchanges,
        marketTypes,
        supportedNames,
        fetchedCount: rows.length,
        filteredCount: filteredRows.length,
        mappedCount: mappedSymbols.length,
        skippedCount: rows.length - filteredRows.length,
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
      marketTypes,
      supportedNames,
      fetchedCount: rows.length,
      filteredCount: filteredRows.length,
      mappedCount: mappedSymbols.length,
      skippedCount: rows.length - filteredRows.length,
      upsertedCount,
      modifiedCount,
      batchesWritten,
    };
  }

  private filterRows(
    rows: AngelScripMasterRow[],
    targetExchanges: Set<Exchange>,
    targetMarketTypes: Set<MarketType>,
    targetNames: Set<string>,
  ): AngelScripMasterRow[] {
    const filteredRows: AngelScripMasterRow[] = [];

    for (const row of rows) {
      const mapped = mapAngelScripToUniversalSymbol(row);
      if (!targetExchanges.has(mapped.exchange)) {
        continue;
      }
      if (!targetMarketTypes.has(mapped.marketType)) {
        continue;
      }
      if (!targetNames.has(mapped.name)) {
        continue;
      }

      filteredRows.push(row);
    }

    return filteredRows;
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

export const syncAngelMcxSymbols = async (
  options: AngelSymbolSyncOptions = {},
): Promise<AngelSymbolSyncResult> => {
  const service = new AngelSymbolSyncService();
  const result = await service.syncSymbols({
    exchanges: ["MCX"],
    ...options,
  });

  logger.info(
    {
      enabled: result.enabled,
      dryRun: result.dryRun,
      exchanges: result.exchanges,
      supportedNames: result.supportedNames,
      fetchedCount: result.fetchedCount,
      filteredCount: result.filteredCount,
      mappedCount: result.mappedCount,
      skippedCount: result.skippedCount,
      upsertedCount: result.upsertedCount,
      modifiedCount: result.modifiedCount,
      batchesWritten: result.batchesWritten,
    },
    "Angel MCX symbol sync finished",
  );

  return result;
};
