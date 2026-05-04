import jwt, { type JwtPayload, type Secret, type SignOptions } from "jsonwebtoken";
import { z } from "zod";

import { AppError } from "../errors/AppError.js";

const jwtEnvSchema = z.object({
  JWT_ACCESS_SECRET: z.string().min(1, "JWT_ACCESS_SECRET is required"),
  JWT_REFRESH_SECRET: z.string().min(1, "JWT_REFRESH_SECRET is required"),
  JWT_ACCESS_EXPIRY: z.string().min(1, "JWT_ACCESS_EXPIRY is required"),
  JWT_REFRESH_EXPIRY: z.string().min(1, "JWT_REFRESH_EXPIRY is required")
});

const parsedJwtEnv = jwtEnvSchema.safeParse(process.env);
if (!parsedJwtEnv.success) {
  const reason = parsedJwtEnv.error.issues.map((issue): string => issue.message).join("; ");
  throw new Error(`JWT environment validation failed: ${reason}`);
}

const { JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, JWT_ACCESS_EXPIRY, JWT_REFRESH_EXPIRY } = parsedJwtEnv.data;

type TokenKind = "access" | "refresh";

export interface TokenPayload extends JwtPayload {
  sub: string;
  tokenType: TokenKind;
}

const signToken = (
  userId: string,
  secret: Secret,
  expiresIn: string, // REMOVED the hardcoded "15m" | "7d" restriction
  tokenType: TokenKind,
): string => {
  // 1. Build the base options
  const options: jwt.SignOptions = {
    subject: userId,
  };

  // 2. Safely attach expiresIn to bypass the exactOptionalPropertyTypes strictness
  // and the branded StringValue conflict.
  options.expiresIn = expiresIn as any;
  return jwt.sign(
    {
      tokenType,
    },
    secret,
    options
  );
};

export const generateAccessToken = (userId: string): string => {
  return signToken(userId, JWT_ACCESS_SECRET, JWT_ACCESS_EXPIRY, "access");
};

export const generateRefreshToken = (userId: string): string => {
  return signToken(userId, JWT_REFRESH_SECRET, JWT_REFRESH_EXPIRY, "refresh");
};

const verifyTypedToken = (token: string, secret: Secret, expectedType: TokenKind): TokenPayload => {
  try {
    const decoded = jwt.verify(token, secret);
    if (typeof decoded === "string") {
      throw new AppError("Invalid token payload", 401);
    }

    const tokenPayload = decoded as TokenPayload;
    if (tokenPayload.tokenType !== expectedType || !tokenPayload.sub) {
      throw new AppError("Invalid token type or subject", 401);
    }

    return tokenPayload;
  } catch {
    throw new AppError("Invalid or expired token", 401);
  }
};

export const verifyAccessToken = (token: string): TokenPayload => {
  return verifyTypedToken(token, JWT_ACCESS_SECRET, "access");
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  return verifyTypedToken(token, JWT_REFRESH_SECRET, "refresh");
};
