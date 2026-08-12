import { Router } from "express";
import { acceptCopilotDraft, createCopilotTemplateDraft } from "../controllers/copilot-template-draft.controller.js";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const copilotRouter = Router();

copilotRouter.post(
  "/template-drafts",
  requireAuth,
  asyncHandler(createCopilotTemplateDraft),
);
copilotRouter.post(
  "/template-drafts/:reviewId/accept",
  requireAuth,
  asyncHandler(acceptCopilotDraft),
);

export { copilotRouter };
