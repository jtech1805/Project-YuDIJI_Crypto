import type { NextFunction, Request, Response } from "express";

import { ZodError } from "zod";

import { AppError } from "../errors/AppError.js";

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void>;

interface ErrorPayload {
  status: "error";
  message: string;
  details?: unknown;
}

export const asyncHandler = (
  handler: AsyncRequestHandler,
): ((req: Request, res: Response, next: NextFunction) => void) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res, next).catch(next);
  };
};

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (err instanceof ZodError) {
    const zodPayload: ErrorPayload = {
      status: "error",
      message: "Validation failed",
      details: err.issues,
    };
    res.status(400).json(zodPayload);
    return;
  }

  if (err instanceof AppError) {
    const appErrorPayload: ErrorPayload = {
      status: "error",
      message: err.message,
    };
    res.status(err.statusCode).json(appErrorPayload);
    return;
  }

  const unknownPayload: ErrorPayload = {
    status: "error",
    message: "Internal server error",
  };
  res.status(500).json(unknownPayload);
};
