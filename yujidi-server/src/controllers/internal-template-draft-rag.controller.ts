import type { Request, Response } from "express";
import { createInternalTemplateDraftRagApplicationService } from "../composition/internal-template-draft-rag.composition.js";
import { AppError } from "../errors/AppError.js";
import {
  InternalTemplateDraftRagApplicationError,
  type InternalTemplateDraftRagApplicationService,
} from "../services/internal-template-draft-rag-application.service.js";
import type { InternalTemplateDraftRequest } from "../types/internal-template-draft-rag.types.js";
import { createTemplateDraftPromptApplicationService } from "../composition/internal-template-draft-rag.composition.js";
import type { TemplateDraftPromptApplicationService } from "../services/template-draft-prompt-application.service.js";
import type { TemplateDraftPromptRequest } from "../types/template-draft-intent.types.js";

export type InternalTemplateDraftRagServiceFactory = () => Pick<
  InternalTemplateDraftRagApplicationService,
  "execute"
>;

export const createInternalTemplateDraftRagController =
  (
    serviceFactory: InternalTemplateDraftRagServiceFactory = createInternalTemplateDraftRagApplicationService,
  ) =>
  async (req: Request, res: Response): Promise<void> => {
    const principal = req.applicationPrincipal;
    if (!principal) throw new AppError("Authentication required", 401);
    const cancellation = new AbortController();
    const cancel = (): void => {
      if (!res.writableEnded && !cancellation.signal.aborted)
        cancellation.abort("CALLER_CANCELLED");
    };
    req.once("aborted", cancel);
    res.once("close", cancel);
    try {
      const result = await serviceFactory().execute(
        req.body as InternalTemplateDraftRequest,
        { userId: principal.userId },
        cancellation.signal,
      );
      res.status(200).json({ status: "success", data: result });
    } catch (error) {
      if (error instanceof InternalTemplateDraftRagApplicationError)
        throw new AppError(error.code, error.httpStatus);
      throw error;
    } finally {
      req.removeListener("aborted", cancel);
      res.removeListener("close", cancel);
    }
  };

export const createInternalTemplateDraftShadow =
  createInternalTemplateDraftRagController();

export const createTemplateDraftPromptController =
  (
    serviceFactory: () => Pick<TemplateDraftPromptApplicationService, "execute"> =
      createTemplateDraftPromptApplicationService,
  ) =>
  async (req: Request, res: Response): Promise<void> => {
    const principal = req.applicationPrincipal;
    if (!principal) throw new AppError("Authentication required", 401);
    const cancellation = new AbortController();
    const cancel = (): void => {
      if (!res.writableEnded && !cancellation.signal.aborted)
        cancellation.abort("CALLER_CANCELLED");
    };
    req.once("aborted", cancel);
    res.once("close", cancel);
    try {
      const result = await serviceFactory().execute(
        req.body as TemplateDraftPromptRequest,
        { userId: principal.userId },
        cancellation.signal,
      );
      const statusCode =
        result.status === "error"
          ? result.code === "INVALID_REQUEST"
            ? 400
            : result.code === "REQUEST_TIMEOUT"
              ? 504
              : 503
          : 200;
      res.status(statusCode).json(result);
    } finally {
      req.removeListener("aborted", cancel);
      res.removeListener("close", cancel);
    }
  };

export const createInternalTemplateDraftPrompt =
  createTemplateDraftPromptController();
