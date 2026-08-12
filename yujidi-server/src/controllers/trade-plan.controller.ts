import type { Request, Response } from "express";

import { AppError } from "../errors/AppError.js";
import {
  capitalAdjustmentSchema,
  createTradePlanSchema,
  deleteTradePlanSchema,
  resetRiskLockSchema,
  restartTradePlanSchema,
  TradePlanService,
  updateTradePlanSchema,
} from "../services/trading/trade-plan.service.js";

const getUserId = (req: Request): string => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError("Authentication required", 401);
  }
  return userId;
};

const getPlanId = (req: Request): string => {
  const planId = req.params.id;
  if (!planId || Array.isArray(planId)) {
    throw new AppError("TradePlan id is required", 400);
  }
  return planId;
};

const getTradePlanService = (): TradePlanService => {
  return new TradePlanService();
};

export const createTradePlan = async (req: Request, res: Response): Promise<void> => {
  const parsedBody = createTradePlanSchema.safeParse(req.body);
  if (!parsedBody.success) {
    throw new AppError("Invalid TradePlan payload", 400);
  }

  const tradePlan = await getTradePlanService().createTradePlan(getUserId(req), parsedBody.data);

  res.status(201).json({
    status: "success",
    data: tradePlan,
  });
};

export const listTradePlans = async (req: Request, res: Response): Promise<void> => {
  const tradePlans = await getTradePlanService().listTradePlans(getUserId(req));

  res.status(200).json({
    status: "success",
    data: tradePlans,
  });
};

export const getTradePlan = async (req: Request, res: Response): Promise<void> => {
  const tradePlan = await getTradePlanService().getTradePlan(getUserId(req), getPlanId(req));

  res.status(200).json({
    status: "success",
    data: tradePlan,
  });
};

export const getTradePlanDashboardSummary = async (req: Request, res: Response): Promise<void> => {
  const summary = await getTradePlanService().getTradePlanDashboardSummary(getUserId(req), getPlanId(req));

  res.status(200).json({
    status: "success",
    data: summary,
  });
};

export const updateTradePlan = async (req: Request, res: Response): Promise<void> => {
  const parsedBody = updateTradePlanSchema.safeParse(req.body);
  if (!parsedBody.success) {
    throw new AppError("Invalid TradePlan update payload", 400);
  }

  const tradePlan = await getTradePlanService().updateTradePlan(
    getUserId(req),
    getPlanId(req),
    parsedBody.data,
  );

  res.status(200).json({
    status: "success",
    data: tradePlan,
  });
};

export const activateTradePlan = async (req: Request, res: Response): Promise<void> => {
  const tradePlan = await getTradePlanService().activateTradePlan(getUserId(req), getPlanId(req));

  res.status(200).json({
    status: "success",
    data: tradePlan,
  });
};

export const pauseTradePlan = async (req: Request, res: Response): Promise<void> => {
  const tradePlan = await getTradePlanService().pauseTradePlan(getUserId(req), getPlanId(req));

  res.status(200).json({
    status: "success",
    data: tradePlan,
  });
};

export const stopTradePlan = async (req: Request, res: Response): Promise<void> => {
  const tradePlan = await getTradePlanService().stopTradePlan(getUserId(req), getPlanId(req));

  res.status(200).json({
    status: "success",
    data: tradePlan,
  });
};

export const completeTradePlan = async (req: Request, res: Response): Promise<void> => {
  const tradePlan = await getTradePlanService().completeTradePlan(getUserId(req), getPlanId(req));

  res.status(200).json({
    status: "success",
    data: tradePlan,
  });
};

export const archiveTradePlan = async (req: Request, res: Response): Promise<void> => {
  const tradePlan = await getTradePlanService().archiveTradePlan(getUserId(req), getPlanId(req));

  res.status(200).json({
    status: "success",
    data: tradePlan,
  });
};

export const createCapitalAdjustment = async (req: Request, res: Response): Promise<void> => {
  const parsedBody = capitalAdjustmentSchema.safeParse(req.body);
  if (!parsedBody.success) {
    throw new AppError("Invalid capital adjustment payload", 400);
  }

  const result = await getTradePlanService().createCapitalAdjustment(
    getUserId(req),
    getPlanId(req),
    parsedBody.data,
  );

  res.status(201).json({
    status: "success",
    data: result,
  });
};

export const resetTradePlanRiskLock = async (req: Request, res: Response): Promise<void> => {
  const parsedBody = resetRiskLockSchema.safeParse(req.body);
  if (!parsedBody.success) {
    throw new AppError("Invalid risk lock reset payload", 400);
  }

  const result = await getTradePlanService().resetRiskLock(
    getUserId(req),
    getPlanId(req),
    parsedBody.data,
  );

  res.status(200).json({
    status: "success",
    data: result,
  });
};

export const restartTradePlan = async (req: Request, res: Response): Promise<void> => {
  const parsedBody = restartTradePlanSchema.safeParse(req.body);
  if (!parsedBody.success) {
    throw new AppError("Invalid TradePlan restart payload", 400);
  }

  const result = await getTradePlanService().restartTradePlan(
    getUserId(req),
    getPlanId(req),
    parsedBody.data,
  );

  res.status(201).json({
    status: "success",
    data: result,
  });
};

export const deleteTradePlan = async (req: Request, res: Response): Promise<void> => {
  const parsedBody = deleteTradePlanSchema.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    throw new AppError("Invalid TradePlan delete payload", 400);
  }

  const result = await getTradePlanService().deleteTradePlan(
    getUserId(req),
    getPlanId(req),
    parsedBody.data,
  );

  res.status(200).json({
    status: "success",
    data: result,
  });
};
