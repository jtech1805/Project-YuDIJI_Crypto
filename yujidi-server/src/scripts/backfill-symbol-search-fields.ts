import "dotenv/config";

import mongoose from "mongoose";
import pino from "pino";
import type { AnyBulkWriteOperation } from "mongoose";

import { SymbolModel, type SymbolDocument } from "../models/Symbol.js";
import { tokenizeSymbolSearch } from "../utils/symbol-search-tokenizer.js";

const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
});

const DEFAULT_BATCH_SIZE = 500;

const optionalString = (value: unknown): string | undefined => {
  return typeof value === "string" && value.trim() ? value : undefined;
};

const optionalDate = (value: unknown): Date | string | undefined => {
  if (value instanceof Date || typeof value === "string") {
    return value;
  }
  return undefined;
};

const parseBatchSize = (): number => {
  const rawValue = process.argv.find((argument) => argument.startsWith("--batch-size="));
  if (!rawValue) {
    return DEFAULT_BATCH_SIZE;
  }

  const batchSize = Number(rawValue.slice("--batch-size=".length));
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error("--batch-size must be a positive integer");
  }

  return batchSize;
};

const main = async (): Promise<void> => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error("MONGO_URI is required for symbol search backfill");
  }

  const batchSize = parseBatchSize();
  await mongoose.connect(mongoUri);
  logger.info({ batchSize }, "MongoDB connected for symbol search backfill");

  let scannedCount = 0;
  let modifiedCount = 0;
  let batchesWritten = 0;
  const cursor = SymbolModel.find({}, {
    symbol: 1,
    displayName: 1,
    providerSymbol: 1,
    name: 1,
    baseAsset: 1,
    quoteAsset: 1,
    exchange: 1,
    marketType: 1,
    instrumentType: 1,
    expiry: 1,
  }).lean().cursor();

  let operations: AnyBulkWriteOperation<SymbolDocument>[] = [];

  for await (const symbol of cursor) {
    scannedCount += 1;
    const searchFields = tokenizeSymbolSearch({
      symbol: optionalString(symbol.symbol),
      displayName: optionalString(symbol.displayName),
      providerSymbol: optionalString(symbol.providerSymbol),
      name: optionalString(symbol.name),
      baseAsset: optionalString(symbol.baseAsset),
      quoteAsset: optionalString(symbol.quoteAsset),
      exchange: optionalString(symbol.exchange),
      marketType: optionalString(symbol.marketType),
      instrumentType: optionalString(symbol.instrumentType),
      expiry: optionalDate(symbol.expiry),
    });

    operations.push({
      updateOne: {
        filter: { _id: symbol._id },
        update: {
          $set: searchFields,
        },
      },
    });

    if (operations.length >= batchSize) {
      const result = await SymbolModel.bulkWrite(operations, { ordered: false });
      modifiedCount += result.modifiedCount;
      batchesWritten += 1;
      operations = [];
    }
  }

  if (operations.length > 0) {
    const result = await SymbolModel.bulkWrite(operations, { ordered: false });
    modifiedCount += result.modifiedCount;
    batchesWritten += 1;
  }

  logger.info(
    {
      scannedCount,
      modifiedCount,
      batchesWritten,
    },
    "Symbol search backfill complete",
  );
};

main()
  .catch((error: unknown): void => {
    logger.error({ error }, "Symbol search backfill failed");
    process.exitCode = 1;
  })
  .finally(async (): Promise<void> => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      logger.info("MongoDB disconnected after symbol search backfill");
    }
  });
