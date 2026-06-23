import { Router } from "express";

import {
  cancelTradeSetup,
  getTradeSetup,
  listTradeSetups,
} from "../controllers/trade-setup.controller.js";
import { confirmActualTrade } from "../controllers/active-trade.controller.js";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const tradeSetupRouter = Router();

tradeSetupRouter.use(requireAuth);

tradeSetupRouter.get("/", asyncHandler(listTradeSetups));
tradeSetupRouter.get("/:id", asyncHandler(getTradeSetup));
tradeSetupRouter.post("/:id/confirm-actual-trade", asyncHandler(confirmActualTrade));
tradeSetupRouter.post("/:id/cancel", asyncHandler(cancelTradeSetup));

export { tradeSetupRouter };
