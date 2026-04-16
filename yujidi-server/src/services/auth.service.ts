import bcrypt from "bcrypt";
import { z } from "zod";

import { AppError } from "../errors/AppError.js";
import { UserModel } from "../models/User.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  type TokenPayload,
} from "../utils/jwt.js";

const credentialSchema = z.object({
  email: z.string().email().transform((value): string => value.toLowerCase().trim()),
  password: z
    .string()
    .min(8, "Password must contain at least 8 characters")
    .max(128, "Password is too long"),
    name:z.string()
});
const logincredentialSchema = z.object({
  email: z.string().email().transform((value): string => value.toLowerCase().trim()),
  password: z
    .string()
    .min(8, "Password must contain at least 8 characters")
    .max(128, "Password is too long"),
});

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface RegisterInput {
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  email: string;
}

export interface RegisterResult {
  user: AuthUser;
}

export interface LoginResult {
  user: AuthUser;
  tokens: AuthTokens;
}

export interface RefreshResult {
  user: AuthUser;
  tokens: AuthTokens;
}

export class AuthService {
  public async registerUser(input: RegisterInput): Promise<RegisterResult> {
    const parsedInput = credentialSchema.safeParse(input);
    if (!parsedInput.success) {
      throw new AppError("Invalid registration payload", 400);
    }

    const existingUser = await UserModel.findOne({ email: parsedInput.data.email }).exec();
    if (existingUser) {
      throw new AppError("User already exists", 409);
    }

    const user = await UserModel.create({
      email: parsedInput.data.email,
      password: parsedInput.data.password,
      name:parsedInput.data.name
    });

    return {
      user: {
        id: user._id.toString(),
        email: user.email,
      },
    };
  }

  public async loginUser(input: LoginInput): Promise<LoginResult> {
    const parsedInput = logincredentialSchema.safeParse(input);
    if (!parsedInput.success) {
      throw new AppError("Invalid login payload", 400);
    }

    const user = await UserModel.findOne({ email: parsedInput.data.email }).exec();
    if (!user) {
      throw new AppError("Invalid credentials", 401);
    }

    const isPasswordValid = await bcrypt.compare(parsedInput.data.password, user.password);
    if (!isPasswordValid) {
      throw new AppError("Invalid credentials", 401);
    }

    const tokens = this.issueTokens(user._id.toString());
    user.refreshToken = tokens.refreshToken;
    await user.save();

    return {
      user: {
        id: user._id.toString(),
        email: user.email,
      },
      tokens,
    };
  }

  public async refreshSession(refreshToken: string): Promise<RefreshResult> {
    if (!refreshToken) {
      throw new AppError("Refresh token is required", 401);
    }

    const payload = verifyRefreshToken(refreshToken);
    const user = await UserModel.findById(payload.sub).exec();
    if (!user || !user.refreshToken) {
      throw new AppError("Invalid session", 401);
    }

    if (user.refreshToken !== refreshToken) {
      throw new AppError("Refresh token mismatch", 401);
    }

    const tokens = this.issueTokens(user._id.toString());
    user.refreshToken = tokens.refreshToken;
    await user.save();

    return {
      user: {
        id: user._id.toString(),
        email: user.email,
      },
      tokens,
    };
  }

  public async logoutUser(refreshToken: string): Promise<void> {
    if (!refreshToken) {
      return;
    }

    let payload: TokenPayload | null = null;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      return;
    }

    await UserModel.findByIdAndUpdate(payload.sub, { $unset: { refreshToken: 1 } }).exec();
  }

  private issueTokens(userId: string): AuthTokens {
    const accessToken = generateAccessToken(userId);
    const newRefreshToken = generateRefreshToken(userId);

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }
}
