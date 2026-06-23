import { Router } from "express";

import {
  activateTradePlan,
  archiveTradePlan,
  completeTradePlan,
  createCapitalAdjustment,
  createTradePlan,
  getTradePlan,
  listTradePlans,
  pauseTradePlan,
  stopTradePlan,
  updateTradePlan,
} from "../controllers/trade-plan.controller.js";
import { listTradeSetupsForPlan } from "../controllers/trade-setup.controller.js";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const tradePlanRouter = Router();

tradePlanRouter.use(requireAuth);

tradePlanRouter.post("/", asyncHandler(createTradePlan));
tradePlanRouter.get("/", asyncHandler(listTradePlans));
tradePlanRouter.get("/:id", asyncHandler(getTradePlan));
tradePlanRouter.get("/:id/trade-setups", asyncHandler(listTradeSetupsForPlan));
tradePlanRouter.patch("/:id", asyncHandler(updateTradePlan));
tradePlanRouter.post("/:id/activate", asyncHandler(activateTradePlan));
tradePlanRouter.post("/:id/pause", asyncHandler(pauseTradePlan));
tradePlanRouter.post("/:id/stop", asyncHandler(stopTradePlan));
tradePlanRouter.post("/:id/complete", asyncHandler(completeTradePlan));
tradePlanRouter.post("/:id/archive", asyncHandler(archiveTradePlan));
tradePlanRouter.post("/:id/capital-adjustments", asyncHandler(createCapitalAdjustment));

export { tradePlanRouter };
