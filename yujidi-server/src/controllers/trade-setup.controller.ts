import type { Request, Response } from "express";

import { AppError } from "../errors/AppError.js";
import {
  convertScoreCheckToTradeSetupSchema,
  TradeSetupService,
} from "../services/trade-setup.service.js";

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

const getTradeSetupService = (): TradeSetupService => {
  return new TradeSetupService();
};

export const convertScoreCheckToTradeSetup = async (req: Request, res: Response): Promise<void> => {
  const parsedBody = convertScoreCheckToTradeSetupSchema.safeParse(req.body);
  if (!parsedBody.success) {
    throw new AppError("Invalid TradeSetup conversion payload", 400);
  }

  const tradeSetup = await getTradeSetupService().convertScoreCheckToTradeSetup(
    getUserId(req),
    getParamId(req, "id"),
    parsedBody.data,
  );

  res.status(201).json({
    status: "success",
    data: tradeSetup,
  });
};

export const listTradeSetups = async (req: Request, res: Response): Promise<void> => {
  const tradeSetups = await getTradeSetupService().listTradeSetups(getUserId(req));

  res.status(200).json({
    status: "success",
    data: tradeSetups,
  });
};

export const listTradeSetupsForPlan = async (req: Request, res: Response): Promise<void> => {
  const tradeSetups = await getTradeSetupService().listTradeSetupsForPlan(
    getUserId(req),
    getParamId(req, "id"),
  );

  res.status(200).json({
    status: "success",
    data: tradeSetups,
  });
};

export const getTradeSetup = async (req: Request, res: Response): Promise<void> => {
  const tradeSetup = await getTradeSetupService().getTradeSetup(
    getUserId(req),
    getParamId(req, "id"),
  );

  res.status(200).json({
    status: "success",
    data: tradeSetup,
  });
};

export const cancelTradeSetup = async (req: Request, res: Response): Promise<void> => {
  const tradeSetup = await getTradeSetupService().cancelTradeSetup(
    getUserId(req),
    getParamId(req, "id"),
  );

  res.status(200).json({
    status: "success",
    data: tradeSetup,
  });
};
