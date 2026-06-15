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
} from "../types/market-data.types.js";
// Define an interface for the fields a user is allowed to edit
export interface UpdateMonitorDTO {
  thresholdPercentage?: number;
  trigger?: 'spike' | 'drop';
  timeWindowMinutes?: number;
  isActive?: boolean;
}
const createMonitorSchema = z.object({
  symbol: z.string().min(1).transform((value): string => value.toUpperCase().trim()),
  thresholdPercentage: z.number().positive().max(100),
  timeWindowMinutes: z.number().int().positive().max(24 * 60),
  trigger: z.string().min(1).max(10),
  provider: z.enum(MARKET_PROVIDERS).optional(),
  exchange: z.enum(EXCHANGES).optional(),
  instrumentToken: z.string().min(1).optional(),
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

export class MonitorService {
  private static symbolListCache: {
    expiresAt: number;
    symbols: SymbolDocument[];
  } | null = null;

  public async getSymbols(): Promise<SymbolDocument[]> {
    const cachedSymbols = MonitorService.symbolListCache;
    if (cachedSymbols && cachedSymbols.expiresAt > Date.now()) {
      return cachedSymbols.symbols;
    }

    const universalSymbols = await SymbolModel.find({
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

    const legacySymbols = await SymbolModel.find({
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

    return SymbolModel.find(filters, symbolListProjection)
      .sort({ provider: 1, exchange: 1, symbol: 1 })
      .limit(limit)
      .lean()
      .exec();
  }

  public async getUserMonitors(userId: string): Promise<TripwireConfigWithSymbolMetadata[]> {
    if (!isValidObjectId(userId)) {
      throw new AppError("Invalid user id", 400);
    }

    const monitors = await TripwireConfigModel.aggregate<TripwireConfigWithSymbolMetadata>([
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
          displayName: 1,
          requiresBrokerLogin: 1,
          symbolMeta: {
            baseAsset: "$symbolMeta.baseAsset",
            quoteAsset: "$symbolMeta.quoteAsset",
            status: "$symbolMeta.status",
            provider: "$symbolMeta.provider",
            marketType: "$symbolMeta.marketType",
            exchange: "$symbolMeta.exchange",
            displayName: "$symbolMeta.displayName",
            instrumentToken: "$symbolMeta.instrumentToken",
            requiresBrokerLogin: "$symbolMeta.requiresBrokerLogin",
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
      throw new AppError("Symbol not supported", 400);
    }

    if (symbolDocument.requiresBrokerLogin) {
      throw new AppError("Broker login is required before this symbol can be monitored", 400);
    }

    const monitorPayload: Record<string, unknown> = {
      user: userId,
      symbol: symbolDocument.symbol,
      provider: symbolDocument.provider ?? "BINANCE",
      marketType: symbolDocument.marketType ?? "CRYPTO",
      exchange: symbolDocument.exchange ?? "BINANCE",
      requiresBrokerLogin: symbolDocument.requiresBrokerLogin ?? false,
      thresholdPercentage: parsedPayload.data.thresholdPercentage,
      timeWindowMinutes: parsedPayload.data.timeWindowMinutes,
      trigger: parsedPayload.data.trigger,
      isActive: true,
    };

    if (symbolDocument.instrumentToken) {
      monitorPayload.instrumentToken = symbolDocument.instrumentToken;
    }

    if (symbolDocument.displayName) {
      monitorPayload.displayName = symbolDocument.displayName;
    }

    const monitor = await TripwireConfigModel.create(monitorPayload);
    return monitor.toObject() as TripwireConfig;
  }

  private async findMonitorSymbol(payload: CreateMonitorInput): Promise<SymbolDocument | null> {
    if (payload.provider && payload.exchange && payload.instrumentToken) {
      return SymbolModel.findOne({
        provider: payload.provider,
        exchange: payload.exchange,
        instrumentToken: payload.instrumentToken,
        status: { $in: SUPPORTED_CRYPTO_SYMBOL_STATUSES },
      }, symbolListProjection)
        .lean()
        .exec();
    }

    return SymbolModel.findOne({
      $and: [
        { $or: [{ provider: "BINANCE" }, { provider: { $exists: false } }] },
        { $or: [{ exchange: "BINANCE" }, { exchange: { $exists: false } }] },
      ],
      symbol: payload.symbol,
      quoteAsset: "USDT",
      status: { $in: SUPPORTED_CRYPTO_SYMBOL_STATUSES },
    }, symbolListProjection)
      .lean()
      .exec();
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

    const updatedMonitor = await TripwireConfigModel.findOneAndUpdate(
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

    const deletedMonitor = await TripwireConfigModel.findOneAndDelete({
      _id: new Types.ObjectId(monitorId),
      user: new Types.ObjectId(userId),
    }).exec();

    if (!deletedMonitor) {
      throw new AppError("Monitor not found", 404);
    }

    return deletedMonitor.toObject() as TripwireConfig;
  }
}
