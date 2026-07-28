import type { Request, Response } from "express";

import { AppError } from "../errors/AppError.js";
import { SymbolSearchService } from "../services/symbol-search.service.js";
import {
  EXCHANGES,
  INSTRUMENT_TYPES,
  MARKET_PROVIDERS,
  MARKET_TYPES,
} from "../types/market-data.types.js";

const symbolSearchService = new SymbolSearchService();

const upperQueryValue = (value: unknown): string | undefined => {
  return typeof value === "string" && value.trim()
    ? value.trim().toUpperCase()
    : undefined;
};

const validateEnum = <T extends readonly string[]>(
  value: string | undefined,
  allowed: T,
  name: string,
): T[number] | undefined => {
  if (!value) {
    return undefined;
  }
  if (!allowed.includes(value)) {
    throw new AppError(`Invalid ${name}`, 400);
  }
  return value;
};

export const searchSymbols = async (req: Request, res: Response): Promise<void> => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  const rawLimit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
  const rawStrikePrice = typeof req.query.strikePrice === "string" ? Number(req.query.strikePrice) : undefined;
  if (rawLimit !== undefined && (!Number.isInteger(rawLimit) || rawLimit <= 0 || rawLimit > 50)) {
    throw new AppError("Invalid limit", 400);
  }
  if (rawStrikePrice !== undefined && (!Number.isFinite(rawStrikePrice) || rawStrikePrice <= 0)) {
    throw new AppError("Invalid strikePrice", 400);
  }

  const response = await symbolSearchService.search({
    q,
    ...(validateEnum(upperQueryValue(req.query.provider), MARKET_PROVIDERS, "provider")
      ? { provider: validateEnum(upperQueryValue(req.query.provider), MARKET_PROVIDERS, "provider") }
      : {}),
    ...(validateEnum(upperQueryValue(req.query.marketType), MARKET_TYPES, "marketType")
      ? { marketType: validateEnum(upperQueryValue(req.query.marketType), MARKET_TYPES, "marketType") }
      : {}),
    ...(validateEnum(upperQueryValue(req.query.exchange), EXCHANGES, "exchange")
      ? { exchange: validateEnum(upperQueryValue(req.query.exchange), EXCHANGES, "exchange") }
      : {}),
    ...(validateEnum(upperQueryValue(req.query.instrumentType), INSTRUMENT_TYPES, "instrumentType")
      ? { instrumentType: validateEnum(upperQueryValue(req.query.instrumentType), INSTRUMENT_TYPES, "instrumentType") }
      : {}),
    ...(upperQueryValue(req.query.underlyingSymbol) ? { underlyingSymbol: upperQueryValue(req.query.underlyingSymbol) } : {}),
    ...(typeof req.query.expiry === "string" && req.query.expiry.trim() ? { expiry: req.query.expiry } : {}),
    ...(upperQueryValue(req.query.optionType) === "CE" || upperQueryValue(req.query.optionType) === "PE"
      ? { optionType: upperQueryValue(req.query.optionType) as "CE" | "PE" }
      : {}),
    ...(rawStrikePrice !== undefined ? { strikePrice: rawStrikePrice } : {}),
    includeExpired: req.query.includeExpired === "true",
    ...(rawLimit ? { limit: rawLimit } : {}),
  });

  res.status(200).json({
    status: "success",
    data: response.results,
    meta: response.meta,
  });
};
