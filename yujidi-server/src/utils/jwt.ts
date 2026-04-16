import jwt, { type JwtPayload, type Secret } from "jsonwebtoken";
import { z } from "zod";

import { AppError } from "../errors/AppError.js";

const jwtEnvSchema = z.object({
  JWT_ACCESS_SECRET: z.string().min(1, "JWT_ACCESS_SECRET is required"),
  JWT_REFRESH_SECRET: z.string().min(1, "JWT_REFRESH_SECRET is required"),
});

const parsedJwtEnv = jwtEnvSchema.safeParse(process.env);
if (!parsedJwtEnv.success) {
  const reason = parsedJwtEnv.error.issues.map((issue): string => issue.message).join("; ");
  throw new Error(`JWT environment validation failed: ${reason}`);
}

const { JWT_ACCESS_SECRET, JWT_REFRESH_SECRET } = parsedJwtEnv.data;

type TokenKind = "access" | "refresh";

export interface TokenPayload extends JwtPayload {
  sub: string;
  tokenType: TokenKind;
}

const signToken = (
  userId: string,
  secret: Secret,
  expiresIn: "15m" | "7d",
  tokenType: TokenKind,
): string => {
  return jwt.sign(
    {
      tokenType,
    },
    secret,
    {
      subject: userId,
      expiresIn,
    },
  );
};

export const generateAccessToken = (userId: string): string => {
  return signToken(userId, JWT_ACCESS_SECRET, "15m", "access");
};

export const generateRefreshToken = (userId: string): string => {
  return signToken(userId, JWT_REFRESH_SECRET, "7d", "refresh");
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
