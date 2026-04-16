import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";

import { login, logout, refresh, register, getCurrentUser } from "../controllers/auth.controller.js";
import { AppError } from "../errors/AppError.js";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const authRouter = Router();

const authBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
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

authRouter.post("/register", validateBody(authBodySchema), asyncHandler(register));
authRouter.post("/login", validateBody(authBodySchema), asyncHandler(login));
authRouter.post("/refresh", asyncHandler(refresh));
authRouter.post("/logout", asyncHandler(logout));
authRouter.get("/me", requireAuth, getCurrentUser);

export { authRouter };
