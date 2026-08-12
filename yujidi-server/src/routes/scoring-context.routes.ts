import { Router } from "express";

import { getRealtimeScoringContext } from "../controllers/scoring-context.controller.js";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const scoringContextRouter = Router();
scoringContextRouter.use(requireAuth);
scoringContextRouter.get("/realtime-context", asyncHandler(getRealtimeScoringContext));

export { scoringContextRouter };
