import { Router } from "express";

import {
  activateTradePlan,
  archiveTradePlan,
  completeTradePlan,
  createCapitalAdjustment,
  createTradePlan,
  deleteTradePlan,
  getTradePlan,
  getTradePlanDashboardSummary,
  listTradePlans,
  pauseTradePlan,
  resetTradePlanRiskLock,
  restartTradePlan,
  stopTradePlan,
  updateTradePlan,
} from "../controllers/trade-plan.controller.js";
import { listTradeSetupsForPlan } from "../controllers/trade-setup.controller.js";
import { listActiveTradesForPlan } from "../controllers/active-trade.controller.js";
import { listTradeResultsForPlan } from "../controllers/trade-result.controller.js";
import { listTradeJournalsForPlan } from "../controllers/trade-journal.controller.js";
import { listTradeEventsForPlan } from "../controllers/trade-event.controller.js";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const tradePlanRouter = Router();

tradePlanRouter.use(requireAuth);

tradePlanRouter.post("/", asyncHandler(createTradePlan));
tradePlanRouter.get("/", asyncHandler(listTradePlans));
tradePlanRouter.get("/:id/dashboard-summary", asyncHandler(getTradePlanDashboardSummary));
tradePlanRouter.get("/:id", asyncHandler(getTradePlan));
tradePlanRouter.get("/:id/trade-setups", asyncHandler(listTradeSetupsForPlan));
tradePlanRouter.get("/:id/active-trades", asyncHandler(listActiveTradesForPlan));
tradePlanRouter.get("/:id/trade-results", asyncHandler(listTradeResultsForPlan));
tradePlanRouter.get("/:id/trade-journals", asyncHandler(listTradeJournalsForPlan));
tradePlanRouter.get("/:id/trade-events", asyncHandler(listTradeEventsForPlan));
tradePlanRouter.patch("/:id", asyncHandler(updateTradePlan));
tradePlanRouter.delete("/:id", asyncHandler(deleteTradePlan));
tradePlanRouter.post("/:id/activate", asyncHandler(activateTradePlan));
tradePlanRouter.post("/:id/pause", asyncHandler(pauseTradePlan));
tradePlanRouter.post("/:id/stop", asyncHandler(stopTradePlan));
tradePlanRouter.post("/:id/complete", asyncHandler(completeTradePlan));
tradePlanRouter.post("/:id/archive", asyncHandler(archiveTradePlan));
tradePlanRouter.post("/:id/reset-risk-lock", asyncHandler(resetTradePlanRiskLock));
tradePlanRouter.post("/:id/restart", asyncHandler(restartTradePlan));
tradePlanRouter.post("/:id/capital-adjustments", asyncHandler(createCapitalAdjustment));

export { tradePlanRouter };
