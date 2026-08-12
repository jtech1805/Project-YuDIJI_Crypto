import { Router } from "express";

import { getAiExplanation } from "../controllers/ai-explanation.controller.js";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const aiExplanationRouter = Router();

aiExplanationRouter.use(requireAuth);
aiExplanationRouter.get("/:id", asyncHandler(getAiExplanation));

export { aiExplanationRouter };
