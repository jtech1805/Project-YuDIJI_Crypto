import { Router } from "express";

import {
  getAngelMarketStreamStatus,
  subscribeAngelMonitorStream,
  unsubscribeAngelMonitorStream,
} from "../controllers/market-stream.controller.js";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const marketStreamRouter = Router();

marketStreamRouter.use(requireAuth);

marketStreamRouter.post(
  "/angel/monitors/:monitorId/subscribe",
  asyncHandler(subscribeAngelMonitorStream),
);
marketStreamRouter.post(
  "/angel/monitors/:monitorId/unsubscribe",
  asyncHandler(unsubscribeAngelMonitorStream),
);
marketStreamRouter.get("/angel/status", asyncHandler(getAngelMarketStreamStatus));

export { marketStreamRouter };
