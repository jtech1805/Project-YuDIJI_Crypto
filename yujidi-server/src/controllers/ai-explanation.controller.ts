import type { Request, Response } from "express";

import { AppError } from "../errors/AppError.js";
import { AiTradeReviewService } from "../services/ai-runtime/ai-trade-review.service.js";

const userId = (req: Request): string => {
  if (!req.user?.id) throw new AppError("Authentication required", 401);
  return req.user.id;
};

const param = (req: Request, name: string): string => {
  const value = req.params[name];
  if (!value || Array.isArray(value)) throw new AppError(`${name} is required`, 400);
  return value;
};

const service = (): AiTradeReviewService => new AiTradeReviewService();

export const generateTradeJournalAiReview = async (req: Request, res: Response): Promise<void> => {
  const explanation = await service().generateReview(userId(req), param(req, "id"));
  res.status(201).json({ status: "success", data: explanation });
};

export const getAiExplanation = async (req: Request, res: Response): Promise<void> => {
  const explanation = await service().getExplanation(userId(req), param(req, "id"));
  res.status(200).json({ status: "success", data: explanation });
};

export const getTradeJournalAiReview = async (req: Request, res: Response): Promise<void> => {
  const explanation = await service().getJournalReview(userId(req), param(req, "id"));
  res.status(200).json({ status: "success", data: explanation });
};
