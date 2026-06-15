import { Router } from "express";

import { getMarketQuoteBySymbolId } from "../controllers/market-quote.controller.js";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const marketQuoteRouter = Router();

marketQuoteRouter.use(requireAuth);
marketQuoteRouter.get("/:symbolId", asyncHandler(getMarketQuoteBySymbolId));

export { marketQuoteRouter };
