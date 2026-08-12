import type { Request, Response } from "express";

import { AppError } from "../errors/AppError.js";
import { MonitorService } from "../services/trading/monitor.service.js";
import { sharedWebsocketManager } from "../services/trading/websocket.service.js";
import {
  EXCHANGES,
  MARKET_PROVIDERS,
  MARKET_TYPES,
  type Exchange,
  type MarketProvider,
  type MarketType,
} from "../types/market-data.types.js";

const monitorService = new MonitorService();
export const getSymbols = async (_req: Request, res: Response): Promise<void> => {
  const symbols = await monitorService.getSymbols();

  res.status(200).json({
    status: "success",
    data: symbols,
  });
};

const isMarketProvider = (value: unknown): value is MarketProvider => {
  return typeof value === "string" && MARKET_PROVIDERS.includes(value as MarketProvider);
};

const isMarketType = (value: unknown): value is MarketType => {
  return typeof value === "string" && MARKET_TYPES.includes(value as MarketType);
};

const isExchange = (value: unknown): value is Exchange => {
  return typeof value === "string" && EXCHANGES.includes(value as Exchange);
};

export const searchUniversalSymbols = async (req: Request, res: Response): Promise<void> => {
  const provider = typeof req.query.provider === "string" ? req.query.provider.toUpperCase() : undefined;
  const marketType = typeof req.query.marketType === "string" ? req.query.marketType.toUpperCase() : undefined;
  const exchange = typeof req.query.exchange === "string" ? req.query.exchange.toUpperCase() : undefined;
  const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
  const includeBrokerRequired = req.query.includeBrokerRequired === "true";
  let providerFilter: MarketProvider | undefined;
  let marketTypeFilter: MarketType | undefined;
  let exchangeFilter: Exchange | undefined;

  if (provider && !isMarketProvider(provider)) {
    throw new AppError("Invalid provider", 400);
  }
  if (provider && isMarketProvider(provider)) {
    providerFilter = provider;
  }

  if (marketType && !isMarketType(marketType)) {
    throw new AppError("Invalid marketType", 400);
  }
  if (marketType && isMarketType(marketType)) {
    marketTypeFilter = marketType;
  }

  if (exchange && !isExchange(exchange)) {
    throw new AppError("Invalid exchange", 400);
  }
  if (exchange && isExchange(exchange)) {
    exchangeFilter = exchange;
  }

  if (limit !== undefined && (!Number.isInteger(limit) || limit <= 0)) {
    throw new AppError("Invalid limit", 400);
  }

  const searchInput: Parameters<typeof monitorService.searchUniversalSymbols>[0] = {
    includeBrokerRequired,
  };

  if (typeof req.query.q === "string") {
    searchInput.query = req.query.q;
  }
  if (providerFilter) {
    searchInput.provider = providerFilter;
  }
  if (marketTypeFilter) {
    searchInput.marketType = marketTypeFilter;
  }
  if (exchangeFilter) {
    searchInput.exchange = exchangeFilter;
  }
  if (limit !== undefined) {
    searchInput.limit = limit;
  }

  const symbols = await monitorService.searchUniversalSymbols(searchInput);

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
    ...(typeof req.body.symbolId === "string" ? { symbolId: req.body.symbolId as string } : {}),
    ...(typeof req.body.symbol === "string" ? { symbol: req.body.symbol as string } : {}),
    thresholdPercentage: req.body.thresholdPercentage as number,
    timeWindowMinutes: req.body.timeWindowMinutes as number,
    trigger: req.body.trigger as "drop" | "spike",
    ...(typeof req.body.provider === "string" ? { provider: req.body.provider } : {}),
    ...(typeof req.body.exchange === "string" ? { exchange: req.body.exchange } : {}),
    ...(typeof req.body.instrumentToken === "string" ? { instrumentToken: req.body.instrumentToken } : {}),
  });
  await sharedWebsocketManager.refreshMonitorCache(monitor.symbol, "monitor_created");

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
    await sharedWebsocketManager.refreshMonitorCache(updatedMonitor.symbol, "monitor_updated");

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

  const deletedMonitor = await monitorService.deleteMonitor(userId, monitorId);
  await sharedWebsocketManager.refreshMonitorCache(deletedMonitor.symbol, "monitor_deleted");

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
