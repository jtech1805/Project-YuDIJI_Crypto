import type { Request, Response } from "express";

import { AppError } from "../errors/AppError.js";
import { TradeEventService } from "../services/trading/trade-event.service.js";

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

const getTradeEventService = (): TradeEventService => {
  return new TradeEventService();
};

export const listTradeEvents = async (req: Request, res: Response): Promise<void> => {
  const events = await getTradeEventService().listTradeEvents(getUserId(req));

  res.status(200).json({
    status: "success",
    data: events,
  });
};

export const listTradeEventsForPlan = async (req: Request, res: Response): Promise<void> => {
  const events = await getTradeEventService().listTradeEventsForPlan(
    getUserId(req),
    getParamId(req, "id"),
  );

  res.status(200).json({
    status: "success",
    data: events,
  });
};

export const listActiveTradeEvents = async (req: Request, res: Response): Promise<void> => {
  const events = await getTradeEventService().listActiveTradeEvents(
    getUserId(req),
    getParamId(req, "id"),
  );

  res.status(200).json({
    status: "success",
    data: events,
  });
};

export const getTradeEvent = async (req: Request, res: Response): Promise<void> => {
  const event = await getTradeEventService().getTradeEvent(
    getUserId(req),
    getParamId(req, "id"),
  );

  res.status(200).json({
    status: "success",
    data: event,
  });
};
