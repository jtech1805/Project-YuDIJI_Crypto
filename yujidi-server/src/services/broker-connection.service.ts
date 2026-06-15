import pino from "pino";
import { Types, isValidObjectId } from "mongoose";

import { AppError } from "../errors/AppError.js";
import {
  AngelAuthService,
  type AngelLoginRequest,
  type AngelSessionTokens,
} from "../integrations/market-data/angel/angel-auth.service.js";
import { BrokerConnectionModel, type BrokerConnection } from "../models/BrokerConnection.js";
import { CredentialEncryptionService } from "./security/credential-encryption.service.js";

const logger = pino({ name: "broker-connection-service" });

export type ConnectAngelConnectionDTO = {
  clientCode: string;
  apiKey: string;
  pin: string;
  totp: string;
  totpSecret?: string;
};

export type ReconnectAngelConnectionDTO = Partial<ConnectAngelConnectionDTO>;

export type BrokerConnectionSafeResponse = {
  broker: "ANGEL_ONE" | "KITE";
  status: "ACTIVE" | "EXPIRED" | "REAUTH_REQUIRED" | "DISABLED" | "FAILED";
  clientCode: string;
  permissions: {
    marketData: boolean;
    orderPlacement: boolean;
    portfolioRead: boolean;
  };
  lastVerifiedAt?: Date;
  sessionExpiresAt?: Date;
  lastError?: string;
};

export type ActiveAngelSession = {
  clientCode: string;
  apiKey: string;
  jwtToken: string;
  refreshToken?: string;
  feedToken?: string;
};

type BrokerConnectionRepository = {
  find: typeof BrokerConnectionModel.find;
  findOne: typeof BrokerConnectionModel.findOne;
  findOneAndUpdate: typeof BrokerConnectionModel.findOneAndUpdate;
};

type BrokerConnectionServiceDependencies = {
  encryptionService: Pick<CredentialEncryptionService, "encryptSecret" | "decryptSecret">;
  angelAuthService: Pick<AngelAuthService, "loginByPassword" | "generateTokens" | "getProfile" | "logout">;
  repository: BrokerConnectionRepository;
};

const getNextMidnightIst = (from = new Date()): Date => {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(from.getTime() + istOffsetMs);
  const nextMidnightUtcMs = Date.UTC(
    istDate.getUTCFullYear(),
    istDate.getUTCMonth(),
    istDate.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  );

  return new Date(nextMidnightUtcMs - istOffsetMs);
};

const maskClientCode = (clientCode: string): string => {
  if (clientCode.length <= 4) {
    return "*".repeat(clientCode.length);
  }

  return `${"*".repeat(clientCode.length - 4)}${clientCode.slice(-4)}`;
};

export const toBrokerConnectionSafeResponse = (
  connection: BrokerConnection,
): BrokerConnectionSafeResponse => {
  const permissions = connection.permissions ?? {
    marketData: false,
    orderPlacement: false,
    portfolioRead: false,
  };

  const response: BrokerConnectionSafeResponse = {
    broker: connection.broker,
    status: connection.status,
    clientCode: maskClientCode(connection.clientCode),
    permissions: {
      marketData: permissions.marketData,
      orderPlacement: false,
      portfolioRead: permissions.portfolioRead,
    },
  };

  if (connection.lastVerifiedAt) {
    response.lastVerifiedAt = connection.lastVerifiedAt;
  }
  if (connection.session?.expiresAt) {
    response.sessionExpiresAt = connection.session.expiresAt;
  }
  if (connection.lastError) {
    response.lastError = connection.lastError;
  }

  return response;
};

export class BrokerConnectionService {
  private readonly encryptionService: Pick<CredentialEncryptionService, "encryptSecret" | "decryptSecret">;
  private readonly angelAuthService: Pick<AngelAuthService, "loginByPassword" | "generateTokens" | "getProfile" | "logout">;
  private readonly repository: BrokerConnectionRepository;

  public constructor(dependencies: Partial<BrokerConnectionServiceDependencies> = {}) {
    this.encryptionService = dependencies.encryptionService ?? new CredentialEncryptionService();
    this.angelAuthService = dependencies.angelAuthService ?? new AngelAuthService();
    this.repository = dependencies.repository ?? BrokerConnectionModel;
  }

  public async connectAngelConnection(
    userId: string,
    dto: ConnectAngelConnectionDTO,
  ): Promise<BrokerConnectionSafeResponse> {
    this.assertValidUserId(userId);
    const loginRequest: AngelLoginRequest = {
      clientCode: dto.clientCode,
      pin: dto.pin,
      totp: dto.totp,
      apiKey: dto.apiKey,
      state: "live",
    };

    try {
      const tokens = await this.angelAuthService.loginByPassword(loginRequest);
      await this.angelAuthService.getProfile(dto.apiKey, tokens.jwtToken);
      const connection = await this.upsertActiveAngelConnection(userId, dto, tokens, new Date());
      logger.info({ userId, broker: "ANGEL_ONE" }, "Broker connection created");
      return toBrokerConnectionSafeResponse(connection);
    } catch (error: unknown) {
      logger.warn({ userId, broker: "ANGEL_ONE" }, "Angel login failed");
      throw new AppError(error instanceof Error ? error.message : "Angel login failed", 400);
    }
  }

  public async getConnections(userId: string): Promise<BrokerConnectionSafeResponse[]> {
    this.assertValidUserId(userId);
    const connections = await this.repository.find({
      user: new Types.ObjectId(userId),
    }).exec();

    return connections.map((connection) => toBrokerConnectionSafeResponse(connection as BrokerConnection));
  }

  public async getAngelStatus(userId: string): Promise<BrokerConnectionSafeResponse | null> {
    this.assertValidUserId(userId);
    const connection = await this.repository.findOne({
      user: new Types.ObjectId(userId),
      broker: "ANGEL_ONE",
    }).exec();

    return connection ? toBrokerConnectionSafeResponse(connection as BrokerConnection) : null;
  }

  public async getActiveAngelSessionForUser(userId: string): Promise<ActiveAngelSession> {
    this.assertValidUserId(userId);
    const connection = await this.repository.findOne({
      user: new Types.ObjectId(userId),
      broker: "ANGEL_ONE",
    }).select("+encryptedApiKey +session.encryptedJwtToken +session.encryptedRefreshToken +session.encryptedFeedToken").exec();

    if (!connection) {
      throw new AppError("BROKER_CONNECTION_NOT_FOUND", 404);
    }

    if (connection.status !== "ACTIVE" || !connection.permissions?.marketData) {
      throw new AppError("BROKER_LOGIN_REQUIRED", 401);
    }

    if (!connection.encryptedApiKey || !connection.session?.encryptedJwtToken) {
      throw new AppError("BROKER_LOGIN_REQUIRED", 401);
    }

    if (connection.session.expiresAt && connection.session.expiresAt.getTime() <= Date.now()) {
      throw new AppError("BROKER_SESSION_EXPIRED", 401);
    }

    const session: ActiveAngelSession = {
      clientCode: connection.clientCode,
      apiKey: this.encryptionService.decryptSecret(connection.encryptedApiKey),
      jwtToken: this.encryptionService.decryptSecret(connection.session.encryptedJwtToken),
    };

    if (connection.session.encryptedRefreshToken) {
      session.refreshToken = this.encryptionService.decryptSecret(connection.session.encryptedRefreshToken);
    }
    if (connection.session.encryptedFeedToken) {
      session.feedToken = this.encryptionService.decryptSecret(connection.session.encryptedFeedToken);
    }

    return session;
  }

  public async reconnectAngel(
    userId: string,
    dto: ReconnectAngelConnectionDTO = {},
  ): Promise<BrokerConnectionSafeResponse> {
    this.assertValidUserId(userId);
    const connection = await this.repository.findOne({
      user: new Types.ObjectId(userId),
      broker: "ANGEL_ONE",
    }).select("+encryptedApiKey +encryptedPin +encryptedTotpSecret +session.encryptedRefreshToken").exec();

    if (!connection) {
      throw new AppError("Angel broker connection not found", 404);
    }

    const apiKey = dto.apiKey ?? this.encryptionService.decryptSecret(connection.encryptedApiKey);
    const pin = dto.pin ?? this.encryptionService.decryptSecret(connection.encryptedPin);

    let tokens: AngelSessionTokens;
    if (dto.totp) {
      tokens = await this.angelAuthService.loginByPassword({
        clientCode: dto.clientCode ?? connection.clientCode,
        pin,
        totp: dto.totp,
        apiKey,
        state: "live",
      });
    } else if (connection.session?.encryptedRefreshToken) {
      const refreshToken = this.encryptionService.decryptSecret(connection.session.encryptedRefreshToken);
      tokens = await this.angelAuthService.generateTokens(apiKey, refreshToken);
    } else {
      throw new AppError("Fresh TOTP is required to reconnect Angel broker connection", 400);
    }

    const connectionDto: ConnectAngelConnectionDTO = {
      clientCode: dto.clientCode ?? connection.clientCode,
      apiKey,
      pin,
      totp: dto.totp ?? "",
      ...(dto.totpSecret ? { totpSecret: dto.totpSecret } : {}),
    };
    const updatedConnection = await this.upsertActiveAngelConnection(userId, connectionDto, tokens, new Date());
    logger.info({ userId, broker: "ANGEL_ONE" }, "Angel reconnect attempted");
    return toBrokerConnectionSafeResponse(updatedConnection);
  }

  public async deleteAngelConnection(userId: string): Promise<BrokerConnectionSafeResponse> {
    this.assertValidUserId(userId);
    const connection = await this.repository.findOne({
      user: new Types.ObjectId(userId),
      broker: "ANGEL_ONE",
    }).select("+encryptedApiKey +session.encryptedJwtToken").exec();

    if (!connection) {
      throw new AppError("Angel broker connection not found", 404);
    }

    try {
      if (connection.session?.encryptedJwtToken) {
        const apiKey = this.encryptionService.decryptSecret(connection.encryptedApiKey);
        const jwtToken = this.encryptionService.decryptSecret(connection.session.encryptedJwtToken);
        await this.angelAuthService.logout(apiKey, jwtToken, connection.clientCode);
      }
    } catch {
      logger.warn({ userId, broker: "ANGEL_ONE" }, "Angel logout failed during local disable");
    }

    const disabled = await this.repository.findOneAndUpdate(
      {
        user: new Types.ObjectId(userId),
        broker: "ANGEL_ONE",
      },
      {
        $set: {
          status: "DISABLED",
          "permissions.marketData": false,
          "permissions.orderPlacement": false,
          "permissions.portfolioRead": false,
          lastError: undefined,
        },
      },
      { new: true, runValidators: true },
    ).exec();

    if (!disabled) {
      throw new AppError("Angel broker connection not found", 404);
    }

    logger.info({ userId, broker: "ANGEL_ONE" }, "Broker connection disabled");
    return toBrokerConnectionSafeResponse(disabled as BrokerConnection);
  }

  private async upsertActiveAngelConnection(
    userId: string,
    dto: ConnectAngelConnectionDTO,
    tokens: AngelSessionTokens,
    now: Date,
  ): Promise<BrokerConnection> {
    const encryptedSession = {
      encryptedJwtToken: this.encryptionService.encryptSecret(tokens.jwtToken),
      encryptedRefreshToken: this.encryptionService.encryptSecret(tokens.refreshToken),
      encryptedFeedToken: this.encryptionService.encryptSecret(tokens.feedToken),
      expiresAt: getNextMidnightIst(now),
      lastLoginAt: now,
      lastRefreshAt: now,
    };

    const update: Record<string, unknown> = {
      user: new Types.ObjectId(userId),
      broker: "ANGEL_ONE",
      status: "ACTIVE",
      clientCode: dto.clientCode,
      encryptedApiKey: this.encryptionService.encryptSecret(dto.apiKey),
      encryptedPin: this.encryptionService.encryptSecret(dto.pin),
      session: encryptedSession,
      permissions: {
        marketData: true,
        orderPlacement: false,
        portfolioRead: false,
      },
      lastVerifiedAt: now,
      lastError: undefined,
    };

    if (dto.totpSecret) {
      update.encryptedTotpSecret = this.encryptionService.encryptSecret(dto.totpSecret);
    }

    const connection = await this.repository.findOneAndUpdate(
      {
        user: new Types.ObjectId(userId),
        broker: "ANGEL_ONE",
      },
      { $set: update },
      { new: true, upsert: true, runValidators: true },
    ).exec();

    if (!connection) {
      throw new AppError("Failed to save Angel broker connection", 500);
    }

    return connection as BrokerConnection;
  }

  private assertValidUserId(userId: string): void {
    if (!isValidObjectId(userId)) {
      throw new AppError("Invalid user id", 400);
    }
  }
}
