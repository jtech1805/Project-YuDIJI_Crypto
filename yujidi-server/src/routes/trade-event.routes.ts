import { Router } from "express";

import {
  getTradeEvent,
  listTradeEvents,
} from "../controllers/trade-event.controller.js";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const tradeEventRouter = Router();

tradeEventRouter.use(requireAuth);

tradeEventRouter.get("/", asyncHandler(listTradeEvents));
tradeEventRouter.get("/:id", asyncHandler(getTradeEvent));

export { tradeEventRouter };

