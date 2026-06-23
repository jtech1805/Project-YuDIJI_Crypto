import { Router } from "express";

import {
  convertScoreCheckToTradeSetup,
} from "../controllers/trade-setup.controller.js";
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
scoreCheckRouter.post("/:id/convert-to-trade-setup", asyncHandler(convertScoreCheckToTradeSetup));

export { scoreCheckRouter };
