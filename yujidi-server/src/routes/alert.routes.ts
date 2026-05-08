import { Router, type NextFunction, type Request, type Response } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { getAlertById, getLtp, getUserAlerts } from "../controllers/alert.controller.js";
import { userRateLimiter } from "../middlewares/rateLimiter.js";

const alertRouter = Router();

// Protect all alert routes
alertRouter.use('/api', userRateLimiter);
alertRouter.get("/ltp/:symbol", getLtp);
alertRouter.use(requireAuth);
alertRouter.get("/", getUserAlerts);
alertRouter.get("/:id", getAlertById);
export { alertRouter };
