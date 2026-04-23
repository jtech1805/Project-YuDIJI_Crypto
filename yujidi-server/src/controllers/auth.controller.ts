import type { Request, Response, NextFunction } from "express";
// Adjust the import path/extension if needed
import { AppError } from "../errors/AppError.js";
import { AuthService } from "../services/auth.service.js";
import { UserModel } from "../models/User.js";

const authService = new AuthService();

const ACCESS_COOKIE_NAME = "accessToken";
const REFRESH_COOKIE_NAME = "refreshToken";

const buildCookieOptions = (maxAgeMs: number) => {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: maxAgeMs,
    path: "/",
  };
};

const attachAuthCookies = (res: Response, accessToken: string, refreshToken: string): void => {
  res.cookie(ACCESS_COOKIE_NAME, accessToken, buildCookieOptions(15 * 60 * 1000));
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, buildCookieOptions(7 * 24 * 60 * 60 * 1000));
};

const clearAuthCookies = (res: Response): void => {
  const clearOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
  };

  res.clearCookie(ACCESS_COOKIE_NAME, clearOptions);
  res.clearCookie(REFRESH_COOKIE_NAME, clearOptions);
};

export const register = async (req: Request, res: Response): Promise<void> => {
  const result = await authService.registerUser({
    email: req.body.email as string,
    password: req.body.password as string,
    name: req.body.name as string
  });

  res.status(201).json({
    status: "success",
    user: result.user,
  });
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const result = await authService.loginUser({
    email: req.body.email as string,
    password: req.body.password as string,
  });

  attachAuthCookies(res, result.tokens.accessToken, result.tokens.refreshToken);

  res.status(200).json({
    status: "success",
    user: result.user,
  });
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  const result = await authService.refreshSession(refreshToken ?? "");

  attachAuthCookies(res, result.tokens.accessToken, result.tokens.refreshToken);

  res.status(200).json({
    status: "success",
    user: result.user,
  });
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  await authService.logoutUser(refreshToken ?? "");

  clearAuthCookies(res);

  res.status(200).json({
    status: "success",
    message: "Logged out successfully",
  });
};

export const getCurrentUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Note: Adjust `req.userId` to `req.user.id` or `req.user` depending on exactly 
    // how your requireAuth middleware attaches the ID to the request object.
    const userId = (req as any).userId || (req as any).user;

    if (!userId) {
      return next(new AppError("Not authenticated", 401));
    }    // Fetch the user but explicitly exclude the password field
    const user = await UserModel.findById(userId.id).select("-password -refreshToken");
    if (!user) {
      return next(new AppError("User not found", 404));
    }

    res.status(200).json({
      status: "success",
      user: user,
    });
  } catch (error) {
    next(error);
  }
};