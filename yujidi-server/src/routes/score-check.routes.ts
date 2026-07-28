import { Router } from "express";

import {
  convertScoreCheckToTradeSetup,
} from "../controllers/trade-setup.controller.js";
import {
  createScoreCheck,
  deleteScoreCheck,
  getScoreCheck,
  getScoreCheckSnapshot,
  listScoreChecks,
  updateScoreCheck,
} from "../controllers/score-check.controller.js";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const scoreCheckRouter = Router();

scoreCheckRouter.use(requireAuth);

scoreCheckRouter.post("/", asyncHandler(createScoreCheck));
scoreCheckRouter.get("/", asyncHandler(listScoreChecks));
scoreCheckRouter.get("/:id/snapshot", asyncHandler(getScoreCheckSnapshot));
scoreCheckRouter.get("/:id", asyncHandler(getScoreCheck));
scoreCheckRouter.patch("/:id", asyncHandler(updateScoreCheck));
scoreCheckRouter.delete("/:id", asyncHandler(deleteScoreCheck));
scoreCheckRouter.post("/:id/convert-to-trade-setup", asyncHandler(convertScoreCheckToTradeSetup));

export { scoreCheckRouter };
