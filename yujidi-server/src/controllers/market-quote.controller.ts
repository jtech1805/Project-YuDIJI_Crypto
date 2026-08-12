import type { Request, Response } from "express";
import { z } from "zod";

import { AppError } from "../errors/AppError.js";
import { MarketQuoteService } from "../services/market-data/market-quote.service.js";

const quoteModeSchema = z.enum(["LTP", "OHLC", "FULL"]).default("LTP");

const getUserId = (req: Request): string => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError("Authentication required", 401);
  }

  return userId;
};

export const getMarketQuoteBySymbolId = async (req: Request, res: Response): Promise<void> => {
  const { symbolId } = req.params;
  if (!symbolId || Array.isArray(symbolId)) {
    throw new AppError("Symbol id is required", 400);
  }

  const modeResult = quoteModeSchema.safeParse(req.query.mode ?? "LTP");
  if (!modeResult.success) {
    throw new AppError("Invalid quote mode", 400);
  }

  const snapshot = await new MarketQuoteService().getQuoteForSymbol(
    getUserId(req),
    symbolId,
    modeResult.data,
  );

  res.status(200).json({
    status: "success",
    data: snapshot,
  });
};
