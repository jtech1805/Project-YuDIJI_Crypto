import { Router } from "express";

import {
  archiveTradeJournal,
  finalizeTradeJournal,
  getTradeJournal,
  listTradeJournals,
  updateTradeJournal,
} from "../controllers/trade-journal.controller.js";
import {
  generateTradeJournalAiReview,
  getTradeJournalAiReview,
} from "../controllers/ai-explanation.controller.js";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const tradeJournalRouter = Router();
tradeJournalRouter.use(requireAuth);
tradeJournalRouter.get("/", asyncHandler(listTradeJournals));
tradeJournalRouter.get("/:id", asyncHandler(getTradeJournal));
tradeJournalRouter.patch("/:id", asyncHandler(updateTradeJournal));
tradeJournalRouter.post("/:id/finalize", asyncHandler(finalizeTradeJournal));
tradeJournalRouter.post("/:id/archive", asyncHandler(archiveTradeJournal));
tradeJournalRouter.post("/:id/ai-review", asyncHandler(generateTradeJournalAiReview));
tradeJournalRouter.get("/:id/ai-review", asyncHandler(getTradeJournalAiReview));

export { tradeJournalRouter };
