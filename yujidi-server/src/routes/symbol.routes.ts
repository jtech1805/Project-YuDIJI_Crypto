import { Router } from "express";
import rateLimit from "express-rate-limit";

import { searchSymbols } from "../controllers/symbol.controller.js";
import { asyncHandler } from "../middlewares/errorHandler.js";

const symbolRouter = Router();

const symbolSearchRateLimiter = rateLimit({
  windowMs: 10_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    code: "SEARCH_RATE_LIMITED",
    message: "Too many search requests. Please slow down.",
  },
});

symbolRouter.get("/search", symbolSearchRateLimiter, asyncHandler(searchSymbols));

export { symbolRouter };
