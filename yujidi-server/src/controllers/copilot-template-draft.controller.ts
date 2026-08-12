import type { Request, Response } from "express";
import { createCopilotTemplateDraftApplicationService } from "../composition/internal-template-draft-rag.composition.js";
import { AppError } from "../errors/AppError.js";
import type { CopilotTemplateDraftApplicationService } from "../services/copilot/copilot-template-draft-application.service.js";
import type { CopilotTemplateDraftRequest } from "../types/copilot-template-draft.types.js";
import { z } from "zod";
import { createCopilotDraftAcceptanceService } from "../composition/internal-template-draft-rag.composition.js";
import type { CopilotDraftAcceptanceService } from "../services/copilot/copilot-draft-acceptance.service.js";
import { INSTRUMENT_TYPES, MARKET_TYPES } from "../types/market-data.types.js";
import { SCORING_TEMPLATE_KEYS } from "../types/scoring.types.js";

export const createCopilotTemplateDraftController =
  (
    serviceFactory: () => Pick<
      CopilotTemplateDraftApplicationService,
      "execute"
    > = createCopilotTemplateDraftApplicationService,
  ) =>
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) throw new AppError("Authentication required", 401);
    const cancellation = new AbortController();
    const cancel = (): void => {
      if (!res.writableEnded && !cancellation.signal.aborted)
        cancellation.abort("CALLER_CANCELLED");
    };
    req.once("aborted", cancel);
    res.once("close", cancel);
    try {
      const result = await serviceFactory().execute(
        req.body as CopilotTemplateDraftRequest,
        { userId: req.user.id },
        cancellation.signal,
      );
      const httpStatus =
        result.status !== "unavailable"
          ? 200
          : result.code === "INVALID_REQUEST"
            ? 400
            : result.code === "REQUEST_TIMEOUT"
              ? 504
              : 503;
      res.status(httpStatus).json(result);
    } finally {
      req.removeListener("aborted", cancel);
      res.removeListener("close", cancel);
    }
  };

export const createCopilotTemplateDraft =
  createCopilotTemplateDraftController();

const acceptanceSchema = z.object({
  reviewVersion: z.number().int().positive(),
  template: z.object({
    baseTemplateKey: z.enum(SCORING_TEMPLATE_KEYS),
    templateName: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(1000).optional(),
    marketType: z.enum(MARKET_TYPES),
    tradeStyle: z.string().trim().min(1).max(120),
    instrumentType: z.enum(INSTRUMENT_TYPES),
  }).strict(),
  acceptedBindings: z.array(z.object({
    bindingReviewId: z.string().trim().min(1).max(160),
    weight: z.number().finite().min(0).max(100),
  }).strict()).min(1).max(24),
}).strict();

export const createAcceptCopilotDraftController = (
  serviceFactory: () => Pick<CopilotDraftAcceptanceService, "accept"> =
    createCopilotDraftAcceptanceService,
) => async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.id) throw new AppError("Authentication required", 401);
  const reviewId = req.params.reviewId;
  if (!reviewId || Array.isArray(reviewId)) throw new AppError("Review not found", 404);
  const parsed = acceptanceSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError("Invalid Copilot draft acceptance", 400);
  const result = await serviceFactory().accept(reviewId, {
    reviewVersion: parsed.data.reviewVersion,
    template: {
      baseTemplateKey: parsed.data.template.baseTemplateKey,
      templateName: parsed.data.template.templateName,
      ...(parsed.data.template.description ? { description: parsed.data.template.description } : {}),
      marketType: parsed.data.template.marketType,
      tradeStyle: parsed.data.template.tradeStyle,
      instrumentType: parsed.data.template.instrumentType,
    },
    acceptedBindings: parsed.data.acceptedBindings,
  }, { userId: req.user.id });
  if (result.status === "created") {
    res.status(201).json(result);
    return;
  }
  const status = result.code === "REVIEW_NOT_FOUND" ? 404
    : result.code === "REVIEW_OWNER_MISMATCH" ? 404
      : result.code === "REVIEW_EXPIRED" || result.code === "REVIEW_ALREADY_ACCEPTED" || result.code === "STALE_GENERATION" ? 409
        : result.code === "PERSISTENCE_FAILED" ? 503
          : 400;
  res.status(status).json(result);
};

export const acceptCopilotDraft = createAcceptCopilotDraftController();
