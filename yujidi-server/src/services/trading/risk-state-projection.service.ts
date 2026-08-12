import { Types, isValidObjectId } from "mongoose";

import { AppError } from "../../errors/AppError.js";
import { TradePlanModel } from "../../models/trade-plan.model.js";
import { TradePlanRiskStateModel } from "../../models/trade-plan-risk-state.model.js";
import { TradeResultModel } from "../../models/trade-result.model.js";
import { UserDailyRiskStateModel } from "../../models/user-daily-risk-state.model.js";
import type { InstrumentType, MarketType } from "../../types/market-data.types.js";
import type { RiskMode } from "../../types/risk.types.js";
import type {
  TradeResultProjectionStatus,
  TradeResultStatus,
  TradeResultType,
} from "../../types/trade.types.js";
import { auditLogService, type AuditLogService } from "../access/audit-log.service.js";
import { buildRiskBucketKey } from "./trade-plan.service.js";

type QueryExec<T> = {
  exec: () => Promise<T>;
};

type LeanQueryExec<T> = {
  lean: () => QueryExec<T>;
};

type TradeResultRepository = {
  findOne: (filter: Record<string, unknown>) => LeanQueryExec<unknown | null>;
  findOneAndUpdate: (
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options: Record<string, unknown>,
  ) => LeanQueryExec<unknown | null>;
};

type TradePlanRepository = {
  findOne: (filter: Record<string, unknown>) => LeanQueryExec<unknown | null>;
};

type RiskStateRepository = {
  findOne: (filter: Record<string, unknown>) => LeanQueryExec<unknown | null>;
  findOneAndUpdate: (
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options: Record<string, unknown>,
  ) => LeanQueryExec<unknown | null>;
};

type DailyRiskStateRepository = {
  findOne: (filter: Record<string, unknown>) => LeanQueryExec<unknown | null>;
  findOneAndUpdate: (
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options: Record<string, unknown>,
  ) => LeanQueryExec<unknown | null>;
};

type RiskStateProjectionDependencies = {
  tradeResultRepository: TradeResultRepository;
  tradePlanRepository: TradePlanRepository;
  riskStateRepository: RiskStateRepository;
  dailyRiskStateRepository: DailyRiskStateRepository;
  auditLogService: Pick<AuditLogService, "record">;
  now: () => Date;
};

export type ProjectableTradeResult = {
  _id: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  tradePlanId: Types.ObjectId | string;
  marketType: MarketType;
  tradeStyle: string;
  instrumentType: InstrumentType;
  grossPnl: number;
  realizedPnlUsedForRisk: number;
  realizedR: number;
  resultType: TradeResultType;
  status: TradeResultStatus;
  projectionStatus: TradeResultProjectionStatus;
  closedAt: Date;
  timezone: string;
  projectedAt?: Date;
};

type TradePlanRecord = {
  _id: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  startingCapital: number;
  maxDailyLossPercent?: number;
  maxConsecutiveLosses?: number;
};

type RiskStateRecord = {
  riskMode: RiskMode;
  consecutiveLosses: number;
};

type DailyRiskStateRecord = {
  netPnl: number;
  riskMode?: RiskMode;
  dailyLossLimitHit?: boolean;
  stopTradingTriggered?: boolean;
};

export type RiskProjectionResult = {
  tradeResultId: string;
  alreadyApplied: boolean;
  riskBucketKey: string;
  dateKey: string;
  planRiskMode: RiskMode;
  dailyRiskMode: RiskMode;
};

const toObjectId = (value: string, label: string): Types.ObjectId => {
  if (!isValidObjectId(value)) {
    throw new AppError(`Invalid ${label}`, 400);
  }
  return new Types.ObjectId(value);
};

const getCountIncrements = (resultType: TradeResultType): Record<string, number> => ({
  winCount: resultType === "WIN" ? 1 : 0,
  lossCount: resultType === "LOSS" ? 1 : 0,
  breakevenCount: resultType === "BREAKEVEN" ? 1 : 0,
});

export const getDateKeyInTimezone = (date: Date, timezone: string): string => {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;
    if (!year || !month || !day) throw new Error("Date parts unavailable");
    return `${year}-${month}-${day}`;
  } catch {
    throw new AppError("Invalid timezone", 400);
  }
};

export class RiskStateProjectionService {
  public constructor(private readonly dependencies: Partial<RiskStateProjectionDependencies> = {}) {}

  public async applyFinalizedTradeResult(
    userId: string,
    tradeResultId: string,
  ): Promise<RiskProjectionResult> {
    const result = await this.getTradeResult(userId, tradeResultId);
    if (result.status !== "FINALIZED") {
      throw new AppError("Only FINALIZED TradeResult can be projected", 409);
    }

    const plan = await this.getTradePlan(userId, String(result.tradePlanId));
    const riskBucketKey = buildRiskBucketKey({
      userId,
      marketType: result.marketType,
      tradeStyle: result.tradeStyle,
      instrumentType: result.instrumentType,
    });
    const dateKey = getDateKeyInTimezone(result.closedAt, result.timezone);

    if (result.projectionStatus === "APPLIED") {
      const existingRiskState = await this.getRiskState(userId, String(result.tradePlanId));
      const existingDailyState = await this.getDailyRiskState(userId, riskBucketKey, dateKey);
      return {
        tradeResultId,
        alreadyApplied: true,
        riskBucketKey,
        dateKey,
        planRiskMode: existingRiskState?.riskMode ?? "NORMAL_RISK",
        dailyRiskMode: existingDailyState && "riskMode" in existingDailyState
          ? (existingDailyState.riskMode as RiskMode)
          : "NORMAL_RISK",
      };
    }
    if (result.projectionStatus !== "PENDING") {
      throw new AppError(`TradeResult projection is ${result.projectionStatus}`, 409);
    }

    const now = this.getNow();
    const claimed = await this.getTradeResultRepository().findOneAndUpdate(
      {
        _id: toObjectId(tradeResultId, "trade result id"),
        userId: toObjectId(userId, "user id"),
        status: "FINALIZED",
        projectionStatus: "PENDING",
      },
      {
        $set: {
          projectionStatus: "APPLIED",
          projectedAt: now,
        },
      },
      { new: true },
    ).lean().exec() as ProjectableTradeResult | null;

    if (!claimed) {
      const latest = await this.getTradeResult(userId, tradeResultId);
      if (latest.projectionStatus === "APPLIED") {
        return {
          tradeResultId,
          alreadyApplied: true,
          riskBucketKey,
          dateKey,
          planRiskMode: "NORMAL_RISK",
          dailyRiskMode: "NORMAL_RISK",
        };
      }
      throw new AppError("TradeResult projection could not be claimed", 409);
    }

    try {
      const planRiskMode = await this.applyTradePlanRiskState(userId, claimed, plan, riskBucketKey, now);
      const dailyRiskMode = await this.applyUserDailyRiskState(
        userId,
        claimed,
        plan,
        riskBucketKey,
        dateKey,
      );

      await this.getAuditLogService().record({
        userId,
        actorType: "SYSTEM",
        action: "RISK_PROJECTION_APPLIED",
        entityType: "RISK_STATE",
        entityId: tradeResultId,
        metadata: {
          tradeResultId,
          tradePlanId: String(claimed.tradePlanId),
          riskBucketKey,
          dateKey,
          planRiskMode,
          dailyRiskMode,
        },
      });

      return {
        tradeResultId,
        alreadyApplied: false,
        riskBucketKey,
        dateKey,
        planRiskMode,
        dailyRiskMode,
      };
    } catch (error: unknown) {
      await this.getTradeResultRepository().findOneAndUpdate(
        { _id: toObjectId(tradeResultId, "trade result id") },
        { $set: { projectionStatus: "FAILED" }, $unset: { projectedAt: 1 } },
        { new: true },
      ).lean().exec();
      throw error;
    }
  }

  private async applyTradePlanRiskState(
    userId: string,
    result: ProjectableTradeResult,
    plan: TradePlanRecord,
    riskBucketKey: string,
    now: Date,
  ): Promise<RiskMode> {
    const existing = await this.getRiskState(userId, String(result.tradePlanId));
    const nextConsecutiveLosses = result.resultType === "LOSS"
      ? (existing?.consecutiveLosses ?? 0) + 1
      : 0;
    const shouldStop = plan.maxConsecutiveLosses !== undefined
      && nextConsecutiveLosses >= plan.maxConsecutiveLosses;
    const nextRiskMode: RiskMode = shouldStop
      ? "STOP_TRADING"
      : existing?.riskMode ?? "NORMAL_RISK";

    await this.getRiskStateRepository().findOneAndUpdate(
      {
        userId: toObjectId(userId, "user id"),
        tradePlanId: toObjectId(String(result.tradePlanId), "trade plan id"),
      },
      {
        $setOnInsert: {
          userId: toObjectId(userId, "user id"),
          tradePlanId: toObjectId(String(result.tradePlanId), "trade plan id"),
          riskBucketKey,
        },
        $inc: {
          totalTrades: 1,
          ...getCountIncrements(result.resultType),
          grossPnl: result.grossPnl,
          netPnl: result.realizedPnlUsedForRisk,
          realizedR: result.realizedR,
        },
        $set: {
          consecutiveLosses: nextConsecutiveLosses,
          riskMode: nextRiskMode,
          lastTradeResultId: result._id,
          lastUpdatedAt: now,
        },
      },
      { new: true, upsert: true },
    ).lean().exec();

    return nextRiskMode;
  }

  private async applyUserDailyRiskState(
    userId: string,
    result: ProjectableTradeResult,
    plan: TradePlanRecord,
    riskBucketKey: string,
    dateKey: string,
  ): Promise<RiskMode> {
    const existing = await this.getDailyRiskState(userId, riskBucketKey, dateKey);
    const nextNetPnl = (existing?.netPnl ?? 0) + result.realizedPnlUsedForRisk;
    const dailyLossLimit = plan.maxDailyLossPercent !== undefined
      ? plan.startingCapital * plan.maxDailyLossPercent / 100
      : undefined;
    const dailyLimitHit = existing?.dailyLossLimitHit === true
      || (dailyLossLimit !== undefined && nextNetPnl <= -dailyLossLimit);
    const stopTradingTriggered = existing?.stopTradingTriggered === true || dailyLimitHit;
    const riskMode: RiskMode = stopTradingTriggered
      ? "STOP_TRADING"
      : existing?.riskMode ?? "NORMAL_RISK";

    await this.getDailyRiskStateRepository().findOneAndUpdate(
      {
        userId: toObjectId(userId, "user id"),
        riskBucketKey,
        dateKey,
      },
      {
        $setOnInsert: {
          userId: toObjectId(userId, "user id"),
          riskBucketKey,
          dateKey,
          timezone: result.timezone,
        },
        $inc: {
          tradesTaken: 1,
          ...getCountIncrements(result.resultType),
          grossPnl: result.grossPnl,
          netPnl: result.realizedPnlUsedForRisk,
          realizedR: result.realizedR,
        },
        $set: {
          riskMode,
          dailyLossLimitHit: dailyLimitHit,
          stopTradingTriggered,
          lastTradeResultId: result._id,
        },
      },
      { new: true, upsert: true },
    ).lean().exec();

    return riskMode;
  }

  private async getTradeResult(userId: string, tradeResultId: string): Promise<ProjectableTradeResult> {
    const result = await this.getTradeResultRepository().findOne({
      _id: toObjectId(tradeResultId, "trade result id"),
      userId: toObjectId(userId, "user id"),
    }).lean().exec() as ProjectableTradeResult | null;
    if (!result) throw new AppError("TRADE_RESULT_NOT_FOUND", 404);
    return result;
  }

  private async getTradePlan(userId: string, tradePlanId: string): Promise<TradePlanRecord> {
    const plan = await this.getTradePlanRepository().findOne({
      _id: toObjectId(tradePlanId, "trade plan id"),
      userId: toObjectId(userId, "user id"),
    }).lean().exec() as TradePlanRecord | null;
    if (!plan) throw new AppError("TRADE_PLAN_NOT_FOUND", 404);
    return plan;
  }

  private async getRiskState(userId: string, tradePlanId: string): Promise<RiskStateRecord | null> {
    return this.getRiskStateRepository().findOne({
      userId: toObjectId(userId, "user id"),
      tradePlanId: toObjectId(tradePlanId, "trade plan id"),
    }).lean().exec() as Promise<RiskStateRecord | null>;
  }

  private async getDailyRiskState(
    userId: string,
    riskBucketKey: string,
    dateKey: string,
  ): Promise<DailyRiskStateRecord | null> {
    return this.getDailyRiskStateRepository().findOne({
      userId: toObjectId(userId, "user id"),
      riskBucketKey,
      dateKey,
    }).lean().exec() as Promise<DailyRiskStateRecord | null>;
  }

  private getTradeResultRepository(): TradeResultRepository {
    return this.dependencies.tradeResultRepository ?? TradeResultModel;
  }

  private getTradePlanRepository(): TradePlanRepository {
    return this.dependencies.tradePlanRepository ?? TradePlanModel;
  }

  private getRiskStateRepository(): RiskStateRepository {
    return this.dependencies.riskStateRepository ?? TradePlanRiskStateModel;
  }

  private getDailyRiskStateRepository(): DailyRiskStateRepository {
    return this.dependencies.dailyRiskStateRepository ?? UserDailyRiskStateModel;
  }

  private getAuditLogService(): Pick<AuditLogService, "record"> {
    return this.dependencies.auditLogService ?? auditLogService;
  }

  private getNow(): Date {
    return this.dependencies.now?.() ?? new Date();
  }
}
