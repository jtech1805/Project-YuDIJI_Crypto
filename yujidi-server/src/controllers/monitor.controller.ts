import type { Request, Response } from "express";

import { AppError } from "../errors/AppError.js";
import { MonitorService } from "../services/monitor.service.js";
import { sharedWebsocketManager } from "../services/websocket.service.js";

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
    trigger: req.body.trigger as string
  });

  res.status(201).json({
    status: "success",
    data: monitor,
  });
};
export const updateMonitor = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const monitorId = req.params.id as string;
    // Extract userId from your auth middleware (adjust 'sub' or 'id' based on your JWT setup)
    const userId = (req.user as any).sub || (req.user as any).id;
    const updateData = req.body;

    if (!updateData || Object.keys(updateData).length === 0) {
      throw new AppError("Please provide fields to update", 400);
    }

    const updatedMonitor = await monitorService.updateMonitor(userId, monitorId, updateData);

    res.status(200).json({
      status: "success",
      message: "Monitor updated successfully",
      data: updatedMonitor
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Monitor Error",
      data: error
    });
  }
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

export const debugEngineState = async (req: Request, res: Response): Promise<void> => {

  const snapshot = sharedWebsocketManager.getEngineSnapshot()

  res.status(200).json({
    status: "success",
    data: snapshot,
  });
};