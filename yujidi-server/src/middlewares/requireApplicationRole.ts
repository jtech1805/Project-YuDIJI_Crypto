import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/AppError.js";
import { ApplicationAuthorizationService } from "../services/access/application-authorization.service.js";
import type { ApplicationRole } from "../types/application-role.types.js";

export const requireAnyApplicationRole =
  (
    allowedRoles: readonly ApplicationRole[],
    authorization = new ApplicationAuthorizationService(),
  ) =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user?.id) {
      next(new AppError("Authentication required", 401));
      return;
    }

    const decision = await authorization.authorizeAnyRole(
      req.user.id,
      allowedRoles,
    );
    if (decision.status === "IDENTITY_NOT_FOUND") {
      next(new AppError("Authentication required", 401));
      return;
    }
    if (decision.status === "UNAUTHORIZED") {
      next(new AppError("Insufficient application role", 403));
      return;
    }
    if (decision.status === "AUTHORITY_FAILED") {
      next(new AppError("Authorization authority unavailable", 503));
      return;
    }

    if (decision.status !== "AUTHORIZED") {
      next(new AppError("Authorization authority unavailable", 503));
      return;
    }
    req.applicationPrincipal = decision.principal;
    next();
  };

export const requireInternalApplicationRole = (
  authorization?: ApplicationAuthorizationService,
) =>
  requireAnyApplicationRole(
    ["INTERNAL", "ADMIN"],
    authorization ?? new ApplicationAuthorizationService(),
  );
