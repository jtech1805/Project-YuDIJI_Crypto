import { Router } from "express";

import {
  createScoreCheck,
  getScoreCheck,
  listScoreChecks,
} from "../controllers/score-check.controller.js";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const scoreCheckRouter = Router();

scoreCheckRouter.use(requireAuth);

scoreCheckRouter.post("/", asyncHandler(createScoreCheck));
scoreCheckRouter.get("/", asyncHandler(listScoreChecks));
scoreCheckRouter.get("/:id", asyncHandler(getScoreCheck));

export { scoreCheckRouter };
