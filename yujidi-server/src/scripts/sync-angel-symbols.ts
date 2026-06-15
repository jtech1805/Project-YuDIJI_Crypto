import "dotenv/config";

import mongoose from "mongoose";
import pino from "pino";

import { AngelSymbolSyncService } from "../integrations/market-data/angel/angel-symbol-sync.service.js";
import { EXCHANGES, type Exchange } from "../types/market-data.types.js";

const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
});

type CliOptions = {
  apply: boolean;
  dryRun: boolean;
  exchanges: Exchange[];
  batchSize: number;
};

const DEFAULT_EXCHANGES: Exchange[] = ["MCX"];
const DEFAULT_BATCH_SIZE = 1_000;

const parseBooleanFlag = (argument: string, flagName: string): boolean => {
  return argument === flagName || argument === `${flagName}=true`;
};

const parseExchangeList = (rawValue: string): Exchange[] => {
  const allowedExchanges = new Set<string>(EXCHANGES);
  const exchanges = rawValue
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  if (exchanges.length === 0) {
    throw new Error("At least one exchange must be provided");
  }

  for (const exchange of exchanges) {
    if (!allowedExchanges.has(exchange)) {
      throw new Error(`Unsupported exchange '${exchange}'. Supported exchanges: ${EXCHANGES.join(", ")}`);
    }
  }

  return exchanges as Exchange[];
};

const parseCliOptions = (args: string[]): CliOptions => {
  let apply = false;
  let dryRun = false;
  let exchanges = DEFAULT_EXCHANGES;
  let batchSize = DEFAULT_BATCH_SIZE;

  for (const argument of args) {
    if (parseBooleanFlag(argument, "--apply")) {
      apply = true;
      continue;
    }

    if (parseBooleanFlag(argument, "--dry-run")) {
      dryRun = true;
      continue;
    }

    if (argument.startsWith("--exchanges=")) {
      exchanges = parseExchangeList(argument.slice("--exchanges=".length));
      continue;
    }

    if (argument.startsWith("--batch-size=")) {
      batchSize = Number(argument.slice("--batch-size=".length));
      if (!Number.isInteger(batchSize) || batchSize <= 0) {
        throw new Error("--batch-size must be a positive integer");
      }
      continue;
    }

    throw new Error(`Unknown argument '${argument}'`);
  }

  if (apply && dryRun) {
    throw new Error("Use either --apply or --dry-run, not both");
  }

  if (!apply && !dryRun) {
    dryRun = true;
  }

  return {
    apply,
    dryRun,
    exchanges,
    batchSize,
  };
};

const main = async (): Promise<void> => {
  const options = parseCliOptions(process.argv.slice(2));

  logger.info(
    {
      mode: options.dryRun ? "dry-run" : "apply",
      exchanges: options.exchanges,
      batchSize: options.batchSize,
    },
    "Starting Angel Scrip Master symbol sync",
  );

  if (options.apply && process.env.ANGEL_SCRIP_MASTER_SYNC_ENABLED !== "true") {
    throw new Error("Set ANGEL_SCRIP_MASTER_SYNC_ENABLED=true before running Angel symbol sync in apply mode");
  }

  if (options.apply) {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("MONGO_URI is required for Angel symbol sync apply mode");
    }

    await mongoose.connect(mongoUri);
    logger.info("MongoDB connection established for Angel symbol sync");
  }

  try {
    const service = new AngelSymbolSyncService({
      isEnabled: () => options.apply && process.env.ANGEL_SCRIP_MASTER_SYNC_ENABLED === "true",
    });

    const result = await service.syncSymbols({
      exchanges: options.exchanges,
      dryRun: options.dryRun,
      batchSize: options.batchSize,
    });

    logger.info({ result }, "Angel Scrip Master symbol sync finished");
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      logger.info("MongoDB disconnected after Angel symbol sync");
    }
  }
};

main().catch((error: unknown): void => {
  logger.error({ error }, "Angel Scrip Master symbol sync failed");
  process.exitCode = 1;
});
