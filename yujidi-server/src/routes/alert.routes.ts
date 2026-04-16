import { Router, type NextFunction, type Request, type Response } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { getAlertById, getUserAlerts } from "../controllers/alert.controller.js";

const alertRouter = Router();

// Protect all alert routes
alertRouter.use(requireAuth);

alertRouter.get("/", getUserAlerts);
alertRouter.get("/:id", getAlertById);

export { alertRouter };
