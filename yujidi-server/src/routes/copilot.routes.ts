import { Router } from "express";
import { createCopilotTemplateDraft } from "../controllers/copilot-template-draft.controller.js";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const copilotRouter = Router();

copilotRouter.post(
  "/template-drafts",
  requireAuth,
  asyncHandler(createCopilotTemplateDraft),
);

export { copilotRouter };
