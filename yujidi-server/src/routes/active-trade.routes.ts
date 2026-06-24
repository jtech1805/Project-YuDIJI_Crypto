import { Router } from "express";

import {
  cancelActiveTrade,
  getActiveTrade,
  listActiveTrades,
} from "../controllers/active-trade.controller.js";
import { listActiveTradeEvents } from "../controllers/trade-event.controller.js";
import { evaluateActiveTrade } from "../controllers/trade-monitoring.controller.js";
import {
  closeActiveTrade,
  getActiveTradeResult,
} from "../controllers/trade-result.controller.js";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const activeTradeRouter = Router();

activeTradeRouter.use(requireAuth);

activeTradeRouter.get("/", asyncHandler(listActiveTrades));
activeTradeRouter.get("/:id", asyncHandler(getActiveTrade));
activeTradeRouter.get("/:id/events", asyncHandler(listActiveTradeEvents));
activeTradeRouter.get("/:id/result", asyncHandler(getActiveTradeResult));
activeTradeRouter.post("/:id/evaluate", asyncHandler(evaluateActiveTrade));
activeTradeRouter.post("/:id/close", asyncHandler(closeActiveTrade));
activeTradeRouter.post("/:id/cancel", asyncHandler(cancelActiveTrade));

export { activeTradeRouter };
