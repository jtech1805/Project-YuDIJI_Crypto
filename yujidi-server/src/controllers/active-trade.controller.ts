import type { Request, Response } from "express";

import { AppError } from "../errors/AppError.js";
import {
  ActiveTradeService,
  confirmActualTradeSchema,
} from "../services/active-trade.service.js";

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

const getActiveTradeService = (): ActiveTradeService => {
  return new ActiveTradeService();
};

export const confirmActualTrade = async (req: Request, res: Response): Promise<void> => {
  const parsedBody = confirmActualTradeSchema.safeParse(req.body);
  if (!parsedBody.success) {
    throw new AppError("Invalid actual trade confirmation payload", 400);
  }

  const activeTrade = await getActiveTradeService().confirmActualTrade(
    getUserId(req),
    getParamId(req, "id"),
    parsedBody.data,
  );

  res.status(201).json({
    status: "success",
    data: activeTrade,
  });
};

export const listActiveTrades = async (req: Request, res: Response): Promise<void> => {
  const activeTrades = await getActiveTradeService().listActiveTrades(getUserId(req));

  res.status(200).json({
    status: "success",
    data: activeTrades,
  });
};

export const listActiveTradesForPlan = async (req: Request, res: Response): Promise<void> => {
  const activeTrades = await getActiveTradeService().listActiveTradesForPlan(
    getUserId(req),
    getParamId(req, "id"),
  );

  res.status(200).json({
    status: "success",
    data: activeTrades,
  });
};

export const getActiveTrade = async (req: Request, res: Response): Promise<void> => {
  const activeTrade = await getActiveTradeService().getActiveTrade(
    getUserId(req),
    getParamId(req, "id"),
  );

  res.status(200).json({
    status: "success",
    data: activeTrade,
  });
};

export const cancelActiveTrade = async (req: Request, res: Response): Promise<void> => {
  const activeTrade = await getActiveTradeService().cancelActiveTrade(
    getUserId(req),
    getParamId(req, "id"),
  );

  res.status(200).json({
    status: "success",
    data: activeTrade,
  });
};

