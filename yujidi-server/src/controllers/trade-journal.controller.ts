import type { Request, Response } from "express";

import { AppError } from "../errors/AppError.js";
import {
  TradeJournalService,
  updateTradeJournalSchema,
} from "../services/trading/trade-journal.service.js";

const userId = (req: Request): string => {
  if (!req.user?.id) throw new AppError("Authentication required", 401);
  return req.user.id;
};
const param = (req: Request, name: string): string => {
  const value = req.params[name];
  if (!value || Array.isArray(value)) throw new AppError(`${name} is required`, 400);
  return value;
};
const service = (): TradeJournalService => new TradeJournalService();

export const createTradeJournal = async (req: Request, res: Response): Promise<void> => {
  const journal = await service().createFromTradeResult(userId(req), param(req, "id"));
  res.status(201).json({ status: "success", data: journal });
};
export const listTradeJournals = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ status: "success", data: await service().listJournals(userId(req)) });
};
export const listTradeJournalsForPlan = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({
    status: "success",
    data: await service().listJournalsForPlan(userId(req), param(req, "id")),
  });
};
export const getTradeJournal = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ status: "success", data: await service().getJournal(userId(req), param(req, "id")) });
};
export const getTradeResultJournal = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({
    status: "success",
    data: await service().getJournalByTradeResult(userId(req), param(req, "id")),
  });
};
export const getActiveTradeJournal = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({
    status: "success",
    data: await service().getJournalByActiveTrade(userId(req), param(req, "id")),
  });
};
export const updateTradeJournal = async (req: Request, res: Response): Promise<void> => {
  const parsed = updateTradeJournalSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError("Invalid TradeJournal update payload", 400);
  res.status(200).json({
    status: "success",
    data: await service().updateJournal(userId(req), param(req, "id"), parsed.data),
  });
};
export const finalizeTradeJournal = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({
    status: "success",
    data: await service().finalizeJournal(userId(req), param(req, "id")),
  });
};
export const archiveTradeJournal = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({
    status: "success",
    data: await service().archiveJournal(userId(req), param(req, "id")),
  });
};
