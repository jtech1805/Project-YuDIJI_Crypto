import { Router } from "express";
import { createInternalTemplateDraftShadow } from "../controllers/internal-template-draft-rag.controller.js";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireInternalApplicationRole } from "../middlewares/requireApplicationRole.js";

const internalTemplateDraftRagRouter = Router();

internalTemplateDraftRagRouter.post(
  "/template-drafts/shadow",
  requireAuth,
  requireInternalApplicationRole(),
  asyncHandler(createInternalTemplateDraftShadow),
);

export { internalTemplateDraftRagRouter };
