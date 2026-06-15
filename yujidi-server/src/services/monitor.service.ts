import { Types, isValidObjectId } from "mongoose";
import { z } from "zod";

import { AppError } from "../errors/AppError.js";
import { SymbolModel, type SymbolDocument } from "../models/Symbol.js";
import {
  TripwireConfigModel,
  type TripwireConfig,
  type TripwireConfigWithSymbolMetadata,
} from "../models/TripwireConfig.js";
import {
  EXCHANGES,
  MARKET_PROVIDERS,
  MARKET_TYPES,
  type Exchange,
  type MarketProvider,
  type MarketType,
  type SupportedBroker,
} from "../types/market-data.types.js";
import { BrokerConnectionService } from "./broker-connection.service.js";
// Define an interface for the fields a user is allowed to edit
export interface UpdateMonitorDTO {
  thresholdPercentage?: number;
  trigger?: 'spike' | 'drop';
  timeWindowMinutes?: number;
  isActive?: boolean;
}
const createMonitorSchema = z.object({
  symbolId: z.string().min(1).optional(),
  symbol: z.string().min(1).transform((value): string => value.toUpperCase().trim()).optional(),
  thresholdPercentage: z.number().positive().max(100),
  timeWindowMinutes: z.number().int().positive().max(24 * 60),
  trigger: z.enum(["drop", "spike"]),
  provider: z.enum(MARKET_PROVIDERS).optional(),
  exchange: z.enum(EXCHANGES).optional(),
  instrumentToken: z.string().min(1).optional(),
}).refine((value) => Boolean(value.symbolId || value.symbol), {
  message: "symbolId or symbol is required",
});
const SUPPORTED_CRYPTO_SYMBOL_STATUSES = ["TRADING", "ACTIVE"];
const SYMBOL_LIST_CACHE_TTL_MS = 60_000;

const symbolListProjection = {
  symbol: 1,
  baseAsset: 1,
  quoteAsset: 1,
  status: 1,
  provider: 1,
  marketType: 1,
  exchange: 1,
  name: 1,
  displayName: 1,
  providerSymbol: 1,
  instrumentToken: 1,
  instrumentType: 1,
  requiresBrokerLogin: 1,
  supportedBroker: 1,
} as const;

export type CreateMonitorInput = z.infer<typeof createMonitorSchema>;
export type SearchSymbolsInput = {
  query?: string;
  provider?: MarketProvider;
  marketType?: MarketType;
  exchange?: Exchange;
  includeBrokerRequired?: boolean;
  limit?: number;
};

type SymbolSnapshot = {
  _id?: Types.ObjectId | string;
  symbol: string;
  provider: MarketProvider;
  marketType: MarketType;
  exchange: Exchange;
  displayName?: string;
  providerSymbol?: string;
  instrumentToken?: string;
  instrumentType?: string;
  requiresBrokerLogin: boolean;
  supportedBroker: SupportedBroker;
  status: string;
};

type MonitorServiceDependencies = {
  symbolModel: typeof SymbolModel;
  tripwireConfigModel: typeof TripwireConfigModel;
  brokerConnectionService: Pick<BrokerConnectionService, "hasActiveBrokerConnection">;
};

export class MonitorService {
  private static symbolListCache: {
    expiresAt: number;
    symbols: SymbolDocument[];
  } | null = null;

  public constructor(
    private readonly dependencies: Partial<MonitorServiceDependencies> = {},
  ) {}

  public async getSymbols(): Promise<SymbolDocument[]> {
    const cachedSymbols = MonitorService.symbolListCache;
    if (cachedSymbols && cachedSymbols.expiresAt > Date.now()) {
      return cachedSymbols.symbols;
    }

    const universalSymbols = await this.getSymbolModel().find({
      provider: "BINANCE",
      exchange: "BINANCE",
      quoteAsset: "USDT",
      status: { $in: SUPPORTED_CRYPTO_SYMBOL_STATUSES },
    }, symbolListProjection)
      .sort({ symbol: 1 })
      .lean()
      .exec();

    if (universalSymbols.length > 0) {
      MonitorService.symbolListCache = {
        expiresAt: Date.now() + SYMBOL_LIST_CACHE_TTL_MS,
        symbols: universalSymbols,
      };

      return universalSymbols;
    }

    const legacySymbols = await this.getSymbolModel().find({
      provider: { $exists: false },
      exchange: { $exists: false },
      quoteAsset: "USDT",
      status: { $in: SUPPORTED_CRYPTO_SYMBOL_STATUSES },
    }, symbolListProjection)
      .sort({ symbol: 1 })
      .lean()
      .exec();

    MonitorService.symbolListCache = {
      expiresAt: Date.now() + SYMBOL_LIST_CACHE_TTL_MS,
      symbols: legacySymbols,
    };

    return legacySymbols;
  }

  public async searchUniversalSymbols(input: SearchSymbolsInput = {}): Promise<SymbolDocument[]> {
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
    const filters: Record<string, unknown> = {
      status: "ACTIVE",
    };

    if (input.provider) {
      filters.provider = input.provider;
    }

    if (input.marketType) {
      filters.marketType = input.marketType;
    }

    if (input.exchange) {
      filters.exchange = input.exchange;
    }

    if (input.includeBrokerRequired !== true) {
      filters.requiresBrokerLogin = false;
    }

    if (input.query?.trim()) {
      const escapedQuery = input.query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filters.$or = [
        { symbol: { $regex: escapedQuery, $options: "i" } },
        { name: { $regex: escapedQuery, $options: "i" } },
        { displayName: { $regex: escapedQuery, $options: "i" } },
        { providerSymbol: { $regex: escapedQuery, $options: "i" } },
        { instrumentToken: { $regex: escapedQuery, $options: "i" } },
      ];
    }

    return this.getSymbolModel().find(filters, symbolListProjection)
      .sort({ provider: 1, exchange: 1, symbol: 1 })
      .limit(limit)
      .lean()
      .exec();
  }

  public async getUserMonitors(userId: string): Promise<TripwireConfigWithSymbolMetadata[]> {
    if (!isValidObjectId(userId)) {
      throw new AppError("Invalid user id", 400);
    }

    const monitors = await this.getTripwireConfigModel().aggregate<TripwireConfigWithSymbolMetadata>([
      {
        $match: {
          user: new Types.ObjectId(userId),
        },
      },
      {
        $lookup: {
          from: "symbols",
          localField: "symbol",
          foreignField: "symbol",
          as: "symbolMeta",
        },
      },
      {
        $unwind: {
          path: "$symbolMeta",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          user: 1,
          symbolId: 1,
          symbol: 1,
          thresholdPercentage: 1,
          timeWindowMinutes: 1,
          isActive: 1,
          createdAt: 1,
          updatedAt: 1,
          trigger: 1,
          provider: 1,
          marketType: 1,
          exchange: 1,
          instrumentToken: 1,
          providerSymbol: 1,
          instrumentType: 1,
          displayName: 1,
          requiresBrokerLogin: 1,
          supportedBroker: 1,
          symbolMeta: {
            baseAsset: "$symbolMeta.baseAsset",
            quoteAsset: "$symbolMeta.quoteAsset",
            status: "$symbolMeta.status",
            provider: "$symbolMeta.provider",
            marketType: "$symbolMeta.marketType",
            exchange: "$symbolMeta.exchange",
            displayName: "$symbolMeta.displayName",
            instrumentToken: "$symbolMeta.instrumentToken",
            providerSymbol: "$symbolMeta.providerSymbol",
            instrumentType: "$symbolMeta.instrumentType",
            requiresBrokerLogin: "$symbolMeta.requiresBrokerLogin",
            supportedBroker: "$symbolMeta.supportedBroker",
          },
        },
      },
      {
        $sort: {
          createdAt: -1,
        },
      },
    ]).exec();

    return monitors;
  }

  public async createMonitor(userId: string, payload: CreateMonitorInput): Promise<TripwireConfig> {
    if (!isValidObjectId(userId)) {
      throw new AppError("Invalid user id", 400);
    }

    const parsedPayload = createMonitorSchema.safeParse(payload);
    if (!parsedPayload.success) {
      throw new AppError("Invalid monitor payload", 400);
    }

    const symbolDocument = await this.findMonitorSymbol(parsedPayload.data);

    if (!symbolDocument) {
      throw new AppError("SYMBOL_NOT_FOUND", 404);
    }

    await this.assertCanMonitorSymbol(userId, symbolDocument);

    const monitorPayload: Record<string, unknown> = {
      user: new Types.ObjectId(userId),
      symbol: symbolDocument.symbol,
      provider: symbolDocument.provider,
      marketType: symbolDocument.marketType,
      exchange: symbolDocument.exchange,
      requiresBrokerLogin: symbolDocument.requiresBrokerLogin,
      supportedBroker: symbolDocument.supportedBroker,
      thresholdPercentage: parsedPayload.data.thresholdPercentage,
      timeWindowMinutes: parsedPayload.data.timeWindowMinutes,
      trigger: parsedPayload.data.trigger,
      isActive: true,
    };

    if (symbolDocument._id) {
      monitorPayload.symbolId = symbolDocument._id;
    }
    if (symbolDocument.instrumentToken) {
      monitorPayload.instrumentToken = symbolDocument.instrumentToken;
    }
    if (symbolDocument.providerSymbol) {
      monitorPayload.providerSymbol = symbolDocument.providerSymbol;
    }
    if (symbolDocument.instrumentType) {
      monitorPayload.instrumentType = symbolDocument.instrumentType;
    }
    if (symbolDocument.displayName) {
      monitorPayload.displayName = symbolDocument.displayName;
    }

    const monitor = await this.getTripwireConfigModel().create(monitorPayload);
    return monitor.toObject() as TripwireConfig;
  }

  public async getActiveMonitorsByMarketKey(input: {
    provider: string;
    exchange: string;
    instrumentToken: string;
    userId?: string;
  }): Promise<TripwireConfig[]> {
    const filter: Record<string, unknown> = {
      provider: input.provider,
      exchange: input.exchange,
      instrumentToken: input.instrumentToken,
      isActive: true,
    };

    if (input.userId) {
      if (!isValidObjectId(input.userId)) {
        throw new AppError("Invalid user id", 400);
      }
      filter.user = new Types.ObjectId(input.userId);
    }

    // TODO Phase 7: Analyzer should use provider/exchange/instrumentToken market key instead of symbol string.
    return this.getTripwireConfigModel().find(filter).lean().exec() as Promise<TripwireConfig[]>;
  }

  private async findMonitorSymbol(payload: CreateMonitorInput): Promise<SymbolSnapshot | null> {
    if (payload.symbolId) {
      if (!isValidObjectId(payload.symbolId)) {
        throw new AppError("INVALID_SYMBOL_SELECTION", 400);
      }

      const symbolById = await this.getSymbolModel().findById(
        payload.symbolId,
        symbolListProjection,
      ).lean().exec();

      if (!symbolById) {
        return null;
      }

      if (!SUPPORTED_CRYPTO_SYMBOL_STATUSES.includes(symbolById.status)) {
        throw new AppError("SYMBOL_NOT_ACTIVE", 400);
      }

      return this.toSymbolSnapshot(symbolById);
    }

    if (payload.provider && payload.exchange && payload.instrumentToken) {
      const providerSymbol = await this.getSymbolModel().findOne({
        provider: payload.provider,
        exchange: payload.exchange,
        instrumentToken: payload.instrumentToken,
        status: { $in: SUPPORTED_CRYPTO_SYMBOL_STATUSES },
      }, symbolListProjection)
        .lean()
        .exec();

      return providerSymbol ? this.toSymbolSnapshot(providerSymbol) : null;
    }

    const legacySymbol = payload.symbol;
    if (!legacySymbol) {
      return null;
    }

    const binanceSymbol = await this.getSymbolModel().findOne({
      $and: [
        { $or: [{ provider: "BINANCE" }, { provider: { $exists: false } }] },
        { $or: [{ exchange: "BINANCE" }, { exchange: { $exists: false } }] },
      ],
      symbol: legacySymbol,
      quoteAsset: "USDT",
      status: { $in: SUPPORTED_CRYPTO_SYMBOL_STATUSES },
    }, symbolListProjection)
      .lean()
      .exec();

    return binanceSymbol ? this.toSymbolSnapshot(binanceSymbol) : this.buildLegacyBinanceSnapshot(legacySymbol);
  }

  private toSymbolSnapshot(symbol: SymbolDocument & { _id?: Types.ObjectId | string }): SymbolSnapshot {
    return {
      ...(symbol._id ? { _id: symbol._id } : {}),
      symbol: symbol.symbol,
      provider: symbol.provider ?? "BINANCE",
      marketType: symbol.marketType ?? "CRYPTO",
      exchange: symbol.exchange ?? "BINANCE",
      ...(symbol.displayName ? { displayName: symbol.displayName } : {}),
      ...(symbol.providerSymbol ? { providerSymbol: symbol.providerSymbol } : {}),
      ...(symbol.instrumentToken ? { instrumentToken: symbol.instrumentToken } : {}),
      ...(symbol.instrumentType ? { instrumentType: symbol.instrumentType } : {}),
      requiresBrokerLogin: symbol.requiresBrokerLogin ?? false,
      supportedBroker: symbol.supportedBroker ?? "NONE",
      status: symbol.status,
    };
  }

  private buildLegacyBinanceSnapshot(symbol: string): SymbolSnapshot {
    return {
      symbol,
      provider: "BINANCE",
      marketType: "CRYPTO",
      exchange: "BINANCE",
      displayName: symbol,
      providerSymbol: symbol,
      instrumentToken: symbol,
      instrumentType: "SPOT",
      requiresBrokerLogin: false,
      supportedBroker: "NONE",
      status: "ACTIVE",
    };
  }

  private async assertCanMonitorSymbol(userId: string, symbol: SymbolSnapshot): Promise<void> {
    if (!SUPPORTED_CRYPTO_SYMBOL_STATUSES.includes(symbol.status)) {
      throw new AppError("SYMBOL_NOT_ACTIVE", 400);
    }

    if (!symbol.requiresBrokerLogin) {
      return;
    }

    if (symbol.supportedBroker === "NONE") {
      throw new AppError("UNSUPPORTED_BROKER", 400);
    }

    const hasActiveConnection = await this.getBrokerConnectionService().hasActiveBrokerConnection(
      userId,
      symbol.supportedBroker,
    );

    if (!hasActiveConnection) {
      throw new AppError(`BROKER_LOGIN_REQUIRED: Connect your ${symbol.supportedBroker} account to monitor this symbol.`, 400);
    }
  }

  private getSymbolModel(): typeof SymbolModel {
    return this.dependencies.symbolModel ?? SymbolModel;
  }

  private getTripwireConfigModel(): typeof TripwireConfigModel {
    return this.dependencies.tripwireConfigModel ?? TripwireConfigModel;
  }

  private getBrokerConnectionService(): Pick<BrokerConnectionService, "hasActiveBrokerConnection"> {
    return this.dependencies.brokerConnectionService ?? new BrokerConnectionService();
  }

  public async updateMonitor(
    userId: string,
    monitorId: string,
    updateData: UpdateMonitorDTO
  ): Promise<any> { // Replace 'any' with your actual ITripwireConfig interface
    if (!isValidObjectId(userId)) {
      throw new AppError("Invalid user id", 400);
    }
    if (!isValidObjectId(monitorId)) {
      throw new AppError("Invalid monitor id", 400);
    }
    // Ensure we don't accidentally update read-only fields like _id or user
    const sanitizedUpdate = { ...updateData };
    console.log(sanitizedUpdate)
    delete (sanitizedUpdate as any)._id;
    delete (sanitizedUpdate as any).user;

    const updatedMonitor = await this.getTripwireConfigModel().findOneAndUpdate(
      {
        _id: monitorId,
        user: userId,
      },
      { $set: sanitizedUpdate },
      {
        new: true, // Returns the updated document instead of the old one
        runValidators: true // Ensures the new threshold meets your Mongoose schema rules
      }
    ).exec();

    if (!updatedMonitor) {
      throw new AppError("Monitor not found", 404);
    }

    return updatedMonitor;
  }
  public async deleteMonitor(userId: string, monitorId: string): Promise<TripwireConfig> {
    if (!isValidObjectId(userId)) {
      throw new AppError("Invalid user id", 400);
    }
    if (!isValidObjectId(monitorId)) {
      throw new AppError("Invalid monitor id", 400);
    }

    const deletedMonitor = await this.getTripwireConfigModel().findOneAndDelete({
      _id: new Types.ObjectId(monitorId),
      user: new Types.ObjectId(userId),
    }).exec();

    if (!deletedMonitor) {
      throw new AppError("Monitor not found", 404);
    }

    return deletedMonitor.toObject() as TripwireConfig;
  }
}
