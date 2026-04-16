import type { Request, Response } from "express";

import { AppError } from "../errors/AppError.js";
import { MonitorService } from "../services/monitor.service.js";

const monitorService = new MonitorService();

export const getSymbols = async (_req: Request, res: Response): Promise<void> => {
  const symbols = await monitorService.getSymbols();

  res.status(200).json({
    status: "success",
    data: symbols,
  });
};

export const getUserMonitors = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError("Authentication required", 401);
  }

  const monitors = await monitorService.getUserMonitors(userId);

  res.status(200).json({
    status: "success",
    data: monitors,
  });
};

export const createMonitor = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError("Authentication required", 401);
  }

  const monitor = await monitorService.createMonitor(userId, {
    symbol: req.body.symbol as string,
    thresholdPercentage: req.body.thresholdPercentage as number,
    timeWindowMinutes: req.body.timeWindowMinutes as number,
  });

  res.status(201).json({
    status: "success",
    data: monitor,
  });
};

export const deleteMonitor = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError("Authentication required", 401);
  }

  const monitorId = req.params.id;
  if (!monitorId || Array.isArray(monitorId)) {
    throw new AppError("Invalid monitor id", 400);
  }

  await monitorService.deleteMonitor(userId, monitorId);

  res.status(200).json({
    status: "success",
    message: "Monitor deleted",
  });
};
