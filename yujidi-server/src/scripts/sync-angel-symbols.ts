// Script runs with this command ANGEL_SYMBOL_SYNC_ENABLED=true npm run sync:symbols:angel:all -- --apply

import "dotenv/config";

import mongoose from "mongoose";
import pino from "pino";

import {
  getAngelSymbolSyncConfigFromEnv,
  syncAngelAllSymbols,
  syncAngelIndiaSymbols,
  syncAngelMcxSymbols,
} from "../integrations/market-data/angel/angel-symbol-sync.service.js";
import { EXCHANGES, MARKET_TYPES, type Exchange, type MarketType } from "../types/market-data.types.js";

const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
});

type CliOptions = {
  apply: boolean;
  dryRun: boolean;
  exchanges: Exchange[];
  marketTypes: MarketType[];
  supportedNames: string[];
  batchSize: number;
  includeExpired: boolean;
  maxExpiryMonths: number;
  sourceUrl?: string;
  sourceFilePath?: string;
};

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

const parseMarketTypeList = (rawValue: string): MarketType[] => {
  const allowedMarketTypes = new Set<string>(MARKET_TYPES);
  const marketTypes = rawValue
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  if (marketTypes.length === 0) {
    throw new Error("At least one market type must be provided");
  }

  for (const marketType of marketTypes) {
    if (!allowedMarketTypes.has(marketType)) {
      throw new Error(`Unsupported market type '${marketType}'. Supported market types: ${MARKET_TYPES.join(", ")}`);
    }
  }

  return marketTypes as MarketType[];
};

const parseCliOptions = (args: string[]): CliOptions => {
  let apply = false;
  let dryRun = false;
  const envConfig = getAngelSymbolSyncConfigFromEnv();
  let exchanges = envConfig.exchanges;
  let marketTypes = envConfig.marketTypes;
  let supportedNames = envConfig.supportedNames;
  let batchSize = DEFAULT_BATCH_SIZE;
  let includeExpired = false;
  let maxExpiryMonths = 3;
  let sourceUrl: string | undefined;
  let sourceFilePath: string | undefined;

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

    if (argument.startsWith("--market-types=")) {
      marketTypes = parseMarketTypeList(argument.slice("--market-types=".length));
      continue;
    }

    if (argument.startsWith("--names=")) {
      supportedNames = argument
        .slice("--names=".length)
        .split(",")
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean);
      if (supportedNames.length === 0) {
        throw new Error("--names must include at least one commodity name");
      }
      continue;
    }

    if (argument.startsWith("--batch-size=")) {
      batchSize = Number(argument.slice("--batch-size=".length));
      if (!Number.isInteger(batchSize) || batchSize <= 0) {
        throw new Error("--batch-size must be a positive integer");
      }
      continue;
    }

    if (parseBooleanFlag(argument, "--include-expired")) {
      includeExpired = true;
      continue;
    }

    if (argument.startsWith("--max-expiry-months=")) {
      maxExpiryMonths = Number(argument.slice("--max-expiry-months=".length));
      if (!Number.isInteger(maxExpiryMonths) || maxExpiryMonths <= 0) {
        throw new Error("--max-expiry-months must be a positive integer");
      }
      continue;
    }

    if (argument.startsWith("--source-url=")) {
      sourceUrl = argument.slice("--source-url=".length).trim();
      if (!sourceUrl) {
        throw new Error("--source-url must not be empty");
      }
      continue;
    }

    if (argument.startsWith("--source-file=")) {
      sourceFilePath = argument.slice("--source-file=".length).trim();
      if (!sourceFilePath) {
        throw new Error("--source-file must not be empty");
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
    marketTypes,
    supportedNames,
    batchSize,
    includeExpired,
    maxExpiryMonths,
    ...(sourceUrl ? { sourceUrl } : {}),
    ...(sourceFilePath ? { sourceFilePath } : {}),
  };
};

const main = async (): Promise<void> => {
  const options = parseCliOptions(process.argv.slice(2));

  logger.info(
    {
      mode: options.dryRun ? "dry-run" : "apply",
      exchanges: options.exchanges,
      marketTypes: options.marketTypes,
      supportedNames: options.supportedNames,
      batchSize: options.batchSize,
      includeExpired: options.includeExpired,
      maxExpiryMonths: options.maxExpiryMonths,
      source: options.sourceFilePath ? "file" : "url",
      ...(options.sourceUrl ? { sourceUrl: options.sourceUrl } : {}),
      ...(options.sourceFilePath ? { sourceFilePath: options.sourceFilePath } : {}),
    },
    "Starting Angel Scrip Master symbol sync",
  );

  if (options.apply && process.env.ANGEL_SYMBOL_SYNC_ENABLED !== "true") {
    throw new Error("Set ANGEL_SYMBOL_SYNC_ENABLED=true before running Angel symbol sync in apply mode");
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
    const syncOptions = {
      dryRun: options.dryRun,
      batchSize: options.batchSize,
      includeExpired: options.includeExpired,
      maxExpiryMonths: options.maxExpiryMonths,
      ...(options.sourceUrl ? { sourceUrl: options.sourceUrl } : {}),
      ...(options.sourceFilePath ? { sourceFilePath: options.sourceFilePath } : {}),
    };
    const includesOnlyMcx = options.exchanges.length === 1 && options.exchanges[0] === "MCX";
    const includesIndiaOnly = options.exchanges.every((exchange) => exchange === "NSE" || exchange === "NFO");
    const result = includesOnlyMcx
      ? await syncAngelMcxSymbols({
        ...syncOptions,
        supportedNames: options.supportedNames,
      })
      : includesIndiaOnly
        ? await syncAngelIndiaSymbols({
          ...syncOptions,
          exchanges: options.exchanges,
          marketTypes: options.marketTypes,
          supportedNames: ["*"],
        })
        : await syncAngelAllSymbols({
          ...syncOptions,
          exchanges: options.exchanges,
          marketTypes: options.marketTypes,
          supportedNames: options.supportedNames.includes("*") ? ["*"] : options.supportedNames,
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
