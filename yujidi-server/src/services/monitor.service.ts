import { Types, isValidObjectId } from "mongoose";
import { z } from "zod";

import { AppError } from "../errors/AppError.js";
import { SymbolModel, type SymbolDocument } from "../models/Symbol.js";
import {
  TripwireConfigModel,
  type TripwireConfig,
  type TripwireConfigWithSymbolMetadata,
} from "../models/TripwireConfig.js";

const createMonitorSchema = z.object({
  symbol: z.string().min(1).transform((value): string => value.toUpperCase().trim()),
  thresholdPercentage: z.number().positive().max(100),
  timeWindowMinutes: z.number().int().positive().max(24 * 60),
  trigger: z.string().min(1).max(10)
});

export type CreateMonitorInput = z.infer<typeof createMonitorSchema>;

export class MonitorService {
  public async getSymbols(): Promise<SymbolDocument[]> {
    return SymbolModel.find({
      quoteAsset: "USDT",
      status: "TRADING",
    })
      .sort({ symbol: 1 })
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
          symbolMeta: {
            baseAsset: "$symbolMeta.baseAsset",
            quoteAsset: "$symbolMeta.quoteAsset",
            status: "$symbolMeta.status",
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

    const symbolExists = await SymbolModel.exists({
      symbol: parsedPayload.data.symbol,
      quoteAsset: "USDT",
      status: "TRADING",
    });

    if (!symbolExists) {
      throw new AppError("Symbol not supported", 400);
    }

    const monitor = await TripwireConfigModel.create({
      user: userId,
      symbol: parsedPayload.data.symbol,
      thresholdPercentage: parsedPayload.data.thresholdPercentage,
      timeWindowMinutes: parsedPayload.data.timeWindowMinutes,
      trigger: parsedPayload.data.trigger,
      isActive: true,
    });
    return monitor.toObject() as TripwireConfig;
  }

  public async deleteMonitor(userId: string, monitorId: string): Promise<void> {
    if (!isValidObjectId(userId)) {
      throw new AppError("Invalid user id", 400);
    }
    if (!isValidObjectId(monitorId)) {
      throw new AppError("Invalid monitor id", 400);
    }

    const deletionResult = await TripwireConfigModel.deleteOne({
      _id: new Types.ObjectId(monitorId),
      user: new Types.ObjectId(userId),
    }).exec();

    if (deletionResult.deletedCount === 0) {
      throw new AppError("Monitor not found", 404);
    }
  }
}
