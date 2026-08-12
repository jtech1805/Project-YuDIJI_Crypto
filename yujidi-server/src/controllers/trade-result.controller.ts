import type { Request, Response } from "express";

import { AppError } from "../errors/AppError.js";
import {
  closeActiveTradeSchema,
  TradeResultService,
} from "../services/trading/trade-result.service.js";

const getUserId = (req: Request): string => {
  const userId = req.user?.id;
  if (!userId) throw new AppError("Authentication required", 401);
  return userId;
};

const getParamId = (req: Request, name: string): string => {
  const id = req.params[name];
  if (!id || Array.isArray(id)) throw new AppError(`${name} is required`, 400);
  return id;
};

const getTradeResultService = (): TradeResultService => new TradeResultService();

export const closeActiveTrade = async (req: Request, res: Response): Promise<void> => {
  const parsedBody = closeActiveTradeSchema.safeParse(req.body);
  if (!parsedBody.success) throw new AppError("Invalid ActiveTrade close payload", 400);

  const result = await getTradeResultService().closeActiveTrade(
    getUserId(req),
    getParamId(req, "id"),
    parsedBody.data,
  );
  res.status(201).json({ status: "success", data: result });
};

export const listTradeResults = async (req: Request, res: Response): Promise<void> => {
  const results = await getTradeResultService().listTradeResults(getUserId(req));
  res.status(200).json({ status: "success", data: results });
};

export const listTradeResultsForPlan = async (req: Request, res: Response): Promise<void> => {
  const results = await getTradeResultService().listTradeResultsForPlan(
    getUserId(req),
    getParamId(req, "id"),
  );
  res.status(200).json({ status: "success", data: results });
};

export const getTradeResult = async (req: Request, res: Response): Promise<void> => {
  const result = await getTradeResultService().getTradeResult(
    getUserId(req),
    getParamId(req, "id"),
  );
  res.status(200).json({ status: "success", data: result });
};

export const getActiveTradeResult = async (req: Request, res: Response): Promise<void> => {
  const result = await getTradeResultService().getActiveTradeResult(
    getUserId(req),
    getParamId(req, "id"),
  );
  res.status(200).json({ status: "success", data: result });
};

