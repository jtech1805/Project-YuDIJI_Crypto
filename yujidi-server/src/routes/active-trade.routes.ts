import { Router } from "express";

import {
  cancelActiveTrade,
  getActiveTrade,
  listActiveTrades,
} from "../controllers/active-trade.controller.js";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const activeTradeRouter = Router();

activeTradeRouter.use(requireAuth);

activeTradeRouter.get("/", asyncHandler(listActiveTrades));
activeTradeRouter.get("/:id", asyncHandler(getActiveTrade));
activeTradeRouter.post("/:id/cancel", asyncHandler(cancelActiveTrade));

export { activeTradeRouter };

