import { Router } from "express";

import {
  getTradeResult,
  listTradeResults,
} from "../controllers/trade-result.controller.js";
import {
  createTradeJournal,
  getTradeResultJournal,
} from "../controllers/trade-journal.controller.js";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const tradeResultRouter = Router();

tradeResultRouter.use(requireAuth);
tradeResultRouter.get("/", asyncHandler(listTradeResults));
tradeResultRouter.get("/:id", asyncHandler(getTradeResult));
tradeResultRouter.get("/:id/journal", asyncHandler(getTradeResultJournal));
tradeResultRouter.post("/:id/journal", asyncHandler(createTradeJournal));

export { tradeResultRouter };
