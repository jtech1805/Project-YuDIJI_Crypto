import type { Request, Response } from "express";

import { AppError } from "../errors/AppError.js";
import {
  duplicateScoringTemplateSchema,
  ScoringTemplateCrudService,
  updateScoringTemplateSchema,
} from "../services/scoring-template-crud.service.js";
import {
  SCORING_TEMPLATE_KEYS,
  type ScoringTemplateKey,
} from "../types/scoring.types.js";

const getUserId = (req: Request): string => {
  const userId = req.user?.id;
  if (!userId) throw new AppError("Authentication required", 401);
  return userId;
};

const getTemplateId = (req: Request): string => {
  const id = req.params.id;
  if (!id || Array.isArray(id)) throw new AppError("Template id is required", 400);
  return id;
};

const getSystemTemplateKey = (req: Request): ScoringTemplateKey => {
  const key = req.params.templateKey;
  if (!key || Array.isArray(key) || !SCORING_TEMPLATE_KEYS.includes(key as ScoringTemplateKey)) {
    throw new AppError("Unsupported system scoring template", 400);
  }
  return key as ScoringTemplateKey;
};

const getService = (): ScoringTemplateCrudService => new ScoringTemplateCrudService();

export const listScoringTemplates = async (req: Request, res: Response): Promise<void> => {
  const templates = await getService().listAvailableTemplates(getUserId(req));
  res.status(200).json({ status: "success", data: templates });
};

export const getSystemScoringTemplate = async (req: Request, res: Response): Promise<void> => {
  const template = getService().getSystemTemplate(getSystemTemplateKey(req));
  res.status(200).json({ status: "success", data: template });
};

export const getUserScoringTemplate = async (req: Request, res: Response): Promise<void> => {
  const template = await getService().getUserTemplate(getUserId(req), getTemplateId(req));
  res.status(200).json({ status: "success", data: template });
};

export const duplicateSystemScoringTemplate = async (req: Request, res: Response): Promise<void> => {
  const parsedBody = duplicateScoringTemplateSchema.safeParse(req.body ?? {});
  if (!parsedBody.success) throw new AppError("Invalid scoring template duplicate payload", 400);
  const template = await getService().duplicateSystemTemplate(
    getUserId(req),
    getSystemTemplateKey(req),
    parsedBody.data,
  );
  res.status(201).json({ status: "success", data: template });
};

export const updateUserScoringTemplate = async (req: Request, res: Response): Promise<void> => {
  const parsedBody = updateScoringTemplateSchema.safeParse(req.body ?? {});
  if (!parsedBody.success) throw new AppError("Invalid scoring template update payload", 400);
  const template = await getService().updateUserTemplate(
    getUserId(req),
    getTemplateId(req),
    parsedBody.data,
  );
  res.status(200).json({ status: "success", data: template });
};

export const archiveUserScoringTemplate = async (req: Request, res: Response): Promise<void> => {
  const template = await getService().archiveUserTemplate(getUserId(req), getTemplateId(req));
  res.status(200).json({ status: "success", data: template });
};
