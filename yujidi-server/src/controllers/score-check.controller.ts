import type { Request, Response } from "express";

import { AppError } from "../errors/AppError.js";
import {
  createScoreCheckSchema,
  deleteScoreCheckSchema,
  ScoreCheckService,
  updateScoreCheckSchema,
} from "../services/scoring/score-check.service.js";

const getUserId = (req: Request): string => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError("Authentication required", 401);
  }
  return userId;
};

const getScoreCheckId = (req: Request): string => {
  const scoreCheckId = req.params.id;
  if (!scoreCheckId || Array.isArray(scoreCheckId)) {
    throw new AppError("ScoreCheck id is required", 400);
  }
  return scoreCheckId;
};

const getScoreCheckService = (): ScoreCheckService => {
  return new ScoreCheckService();
};

export const createScoreCheck = async (req: Request, res: Response): Promise<void> => {
  const parsedBody = createScoreCheckSchema.safeParse(req.body);
  if (!parsedBody.success) {
    throw new AppError("Invalid ScoreCheck payload", 400);
  }

  const scoreCheck = await getScoreCheckService().createScoreCheck(getUserId(req), parsedBody.data);

  res.status(201).json({
    status: "success",
    data: scoreCheck,
  });
};

export const listScoreChecks = async (req: Request, res: Response): Promise<void> => {
  const scoreChecks = await getScoreCheckService().listScoreChecks(getUserId(req));

  res.status(200).json({
    status: "success",
    data: scoreChecks,
  });
};

export const getScoreCheck = async (req: Request, res: Response): Promise<void> => {
  const scoreCheck = await getScoreCheckService().getScoreCheck(
    getUserId(req),
    getScoreCheckId(req),
  );

  res.status(200).json({
    status: "success",
    data: scoreCheck,
  });
};

export const getScoreCheckSnapshot = async (req: Request, res: Response): Promise<void> => {
  const snapshot = await getScoreCheckService().getScoreCheckSnapshot(
    getUserId(req),
    getScoreCheckId(req),
  );

  res.status(200).json({
    status: "success",
    data: snapshot,
  });
};

export const updateScoreCheck = async (req: Request, res: Response): Promise<void> => {
  const parsedBody = updateScoreCheckSchema.safeParse(req.body);
  if (!parsedBody.success) {
    throw new AppError("Invalid ScoreCheck update payload", 400);
  }

  const scoreCheck = await getScoreCheckService().updateScoreCheck(
    getUserId(req),
    getScoreCheckId(req),
    parsedBody.data,
  );

  res.status(200).json({
    status: "success",
    data: scoreCheck,
  });
};

export const deleteScoreCheck = async (req: Request, res: Response): Promise<void> => {
  const parsedBody = deleteScoreCheckSchema.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    throw new AppError("Invalid ScoreCheck delete payload", 400);
  }

  const scoreCheck = await getScoreCheckService().deleteScoreCheck(
    getUserId(req),
    getScoreCheckId(req),
    parsedBody.data,
  );

  res.status(200).json({
    status: "success",
    data: scoreCheck,
  });
};
