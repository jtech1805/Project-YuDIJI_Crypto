import type { Request, Response } from "express";
import { createCopilotTemplateDraftApplicationService } from "../composition/internal-template-draft-rag.composition.js";
import { AppError } from "../errors/AppError.js";
import type { CopilotTemplateDraftApplicationService } from "../services/copilot-template-draft-application.service.js";
import type { CopilotTemplateDraftRequest } from "../types/copilot-template-draft.types.js";

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
