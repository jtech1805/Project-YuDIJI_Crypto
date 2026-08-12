import { Router } from "express";

import {
  cancelTradeSetup,
  deleteTradeSetup,
  getTradeSetup,
  listTradeSetups,
  retryTradeSetupRiskCheck,
  updateTradeSetup,
} from "../controllers/trade-setup.controller.js";
import { confirmActualTrade } from "../controllers/active-trade.controller.js";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const tradeSetupRouter = Router();

tradeSetupRouter.use(requireAuth);

tradeSetupRouter.get("/", asyncHandler(listTradeSetups));
tradeSetupRouter.get("/:id", asyncHandler(getTradeSetup));
tradeSetupRouter.patch("/:id", asyncHandler(updateTradeSetup));
tradeSetupRouter.delete("/:id", asyncHandler(deleteTradeSetup));
tradeSetupRouter.post("/:id/confirm-actual-trade", asyncHandler(confirmActualTrade));
tradeSetupRouter.post("/:id/cancel", asyncHandler(cancelTradeSetup));
tradeSetupRouter.post("/:id/retry-risk-check", asyncHandler(retryTradeSetupRiskCheck));

export { tradeSetupRouter };
