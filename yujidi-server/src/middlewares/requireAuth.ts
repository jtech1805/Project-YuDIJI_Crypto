import type { NextFunction, Request, Response } from "express";

import { AppError } from "../errors/AppError.js";
import { verifyAccessToken } from "../utils/jwt.js";

const ACCESS_COOKIE_NAME = "accessToken";

export const requireAuth = (req: Request, _res: Response, next: NextFunction): void => {
  const accessToken = req.cookies?.[ACCESS_COOKIE_NAME] as string | undefined;

  if (!accessToken) {
    next(new AppError("Authentication required", 401));
    return;
  }

  const payload = verifyAccessToken(accessToken);
  req.user = { id: payload.sub };
  next();
};
