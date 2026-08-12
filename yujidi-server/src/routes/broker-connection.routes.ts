import { Router } from "express";

import {
  connectAngelConnection,
  deleteAngelConnection,
  getAngelConnectionStatus,
  getBrokerConnections,
  reconnectAngelConnection,
} from "../controllers/broker-connection.controller.js";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const brokerConnectionRouter = Router();

brokerConnectionRouter.use(requireAuth);

brokerConnectionRouter.post("/angel", asyncHandler(connectAngelConnection));
brokerConnectionRouter.get("/", asyncHandler(getBrokerConnections));
brokerConnectionRouter.get("/angel/status", asyncHandler(getAngelConnectionStatus));
brokerConnectionRouter.post("/angel/reconnect", asyncHandler(reconnectAngelConnection));
brokerConnectionRouter.delete("/angel", asyncHandler(deleteAngelConnection));

export { brokerConnectionRouter };
