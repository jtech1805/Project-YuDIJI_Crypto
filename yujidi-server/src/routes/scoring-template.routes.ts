import { Router } from "express";

import {
  archiveUserScoringTemplate,
  duplicateSystemScoringTemplate,
  getSystemScoringTemplate,
  getUserScoringTemplate,
  listScoringTemplates,
  updateUserScoringTemplate,
} from "../controllers/scoring-template.controller.js";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const scoringTemplateRouter = Router();

scoringTemplateRouter.use(requireAuth);

scoringTemplateRouter.get("/", asyncHandler(listScoringTemplates));
scoringTemplateRouter.get("/system/:templateKey", asyncHandler(getSystemScoringTemplate));
scoringTemplateRouter.post("/system/:templateKey/duplicate", asyncHandler(duplicateSystemScoringTemplate));
scoringTemplateRouter.get("/:id", asyncHandler(getUserScoringTemplate));
scoringTemplateRouter.patch("/:id", asyncHandler(updateUserScoringTemplate));
scoringTemplateRouter.post("/:id/archive", asyncHandler(archiveUserScoringTemplate));

export { scoringTemplateRouter };
