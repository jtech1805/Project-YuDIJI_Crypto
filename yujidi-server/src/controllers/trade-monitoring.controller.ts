import type { Request, Response } from "express";

import { AppError } from "../errors/AppError.js";
import {
  evaluateActiveTradeSchema,
  TradeMonitoringService,
} from "../services/trading/trade-monitoring.service.js";

const getUserId = (req: Request): string => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError("Authentication required", 401);
  }
  return userId;
};

const getParamId = (req: Request, name: string): string => {
  const id = req.params[name];
  if (!id || Array.isArray(id)) {
    throw new AppError(`${name} is required`, 400);
  }
  return id;
};

const getTradeMonitoringService = (): TradeMonitoringService => {
  return new TradeMonitoringService();
};

export const evaluateActiveTrade = async (req: Request, res: Response): Promise<void> => {
  const parsedBody = evaluateActiveTradeSchema.safeParse(req.body);
  if (!parsedBody.success) {
    throw new AppError("Invalid ActiveTrade evaluation payload", 400);
  }

  const evaluation = await getTradeMonitoringService().evaluateActiveTrade(
    getUserId(req),
    getParamId(req, "id"),
    parsedBody.data,
  );

  res.status(200).json({
    status: "success",
    data: evaluation,
  });
};

