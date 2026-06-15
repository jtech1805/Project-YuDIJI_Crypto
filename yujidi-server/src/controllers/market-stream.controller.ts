import type { Request, Response } from "express";

import { AppError } from "../errors/AppError.js";
import { sharedAngelUserMarketDataSessionService } from "../services/angel-user-market-data-session.service.js";

const getUserId = (req: Request): string => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError("Authentication required", 401);
  }

  return userId;
};

const getMonitorId = (req: Request): string => {
  const { monitorId } = req.params;
  if (!monitorId || Array.isArray(monitorId)) {
    throw new AppError("Invalid monitor id", 400);
  }

  return monitorId;
};

export const subscribeAngelMonitorStream = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const data = await sharedAngelUserMarketDataSessionService.subscribeUserToAngelMonitor(
    getUserId(req),
    getMonitorId(req),
  );

  res.status(200).json({
    status: "success",
    data,
  });
};

export const unsubscribeAngelMonitorStream = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const data = await sharedAngelUserMarketDataSessionService.unsubscribeUserFromAngelMonitor(
    getUserId(req),
    getMonitorId(req),
  );

  res.status(200).json({
    status: "success",
    data,
  });
};

export const getAngelMarketStreamStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const data = sharedAngelUserMarketDataSessionService.getSessionStatus(getUserId(req));

  res.status(200).json({
    status: "success",
    data,
  });
};
