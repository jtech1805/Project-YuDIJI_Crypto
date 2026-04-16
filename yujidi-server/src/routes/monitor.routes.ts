import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";

import {
  createMonitor,
  deleteMonitor,
  getSymbols,
  getUserMonitors,
} from "../controllers/monitor.controller.js";
import { AppError } from "../errors/AppError.js";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const monitorRouter = Router();

const createMonitorSchema = z.object({
  symbol: z.string().min(1),
  thresholdPercentage: z.number().positive().max(100),
  timeWindowMinutes: z.number().int().positive().max(24 * 60),
});

const validateBody =
  <T extends z.ZodType>(schema: T) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const parsedBody = schema.safeParse(req.body);
    if (!parsedBody.success) {
      next(new AppError("Invalid request body", 400));
      return;
    }

    req.body = parsedBody.data;
    next();
  };

monitorRouter.get("/symbols", asyncHandler(getSymbols));
monitorRouter.get("/", requireAuth, asyncHandler(getUserMonitors));
monitorRouter.post("/", requireAuth, validateBody(createMonitorSchema), asyncHandler(createMonitor));
monitorRouter.delete("/:id", requireAuth, asyncHandler(deleteMonitor));

export { monitorRouter };
