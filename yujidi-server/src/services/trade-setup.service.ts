import { Types, isValidObjectId } from "mongoose";
import { z } from "zod";

import { AppError } from "../errors/AppError.js";
import { ScoreCheckModel } from "../models/score-check.model.js";
import { TradePlanModel } from "../models/trade-plan.model.js";
import { TradePlanRiskStateModel } from "../models/trade-plan-risk-state.model.js";
import { TradeSetupModel } from "../models/trade-setup.model.js";
import { UserDailyRiskStateModel } from "../models/user-daily-risk-state.model.js";
import type { InstrumentType, MarketType } from "../types/market-data.types.js";
import type { RiskMode } from "../types/risk.types.js";
import type { ScoringTemplateKey } from "../types/scoring.types.js";
import type {
  TradeDirection,
  TradePermission,
  TradePlanStatus,
  TradeSetupStatus,
} from "../types/trade.types.js";
import { auditLogService, type AuditLogService } from "./audit-log.service.js";
import { buildRiskBucketKey } from "./trade-plan.service.js";
import { RiskGovernorService, type RiskGovernorDecision } from "./risk-governor.service.js";

export const convertScoreCheckToTradeSetupSchema = z.object({
  tradePlanId: z.string().min(1),
});

export type ConvertScoreCheckToTradeSetupInput = z.infer<typeof convertScoreCheckToTradeSetupSchema>;

type QueryExec<T> = {
  exec: () => Promise<T>;
};

type LeanQueryExec<T> = {
  lean: () => QueryExec<T>;
};

type SortableLeanQueryExec<T> = {
  sort: (sort: Record<string, 1 | -1>) => LeanQueryExec<T>;
};

type ScoreCheckRepository = {
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

type TradeSetupRepository = {
  create: (input: Record<string, unknown>) => Promise<unknown>;
  find: (filter: Record<string, unknown>) => SortableLeanQueryExec<unknown[]>;
  findOne: (filter: Record<string, unknown>) => LeanQueryExec<unknown | null>;
  findOneAndUpdate: (
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options: Record<string, unknown>,
  ) => LeanQueryExec<unknown | null>;
};

type RiskStateRepository = {
  findOne: (filter: Record<string, unknown>) => LeanQueryExec<unknown | null>;
};

type UserDailyRiskStateRepository = {
  findOne: (filter: Record<string, unknown>) => LeanQueryExec<unknown | null>;
};

type TradeSetupServiceDependencies = {
  scoreCheckRepository: ScoreCheckRepository;
  tradePlanRepository: TradePlanRepository;
  tradeSetupRepository: TradeSetupRepository;
  riskStateRepository: RiskStateRepository;
  userDailyRiskStateRepository: UserDailyRiskStateRepository;
  riskGovernorService: Pick<RiskGovernorService, "evaluate">;
  auditLogService: Pick<AuditLogService, "record">;
  now: () => Date;
};

type ScoreCheckRecord = {
  _id: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  symbolId: Types.ObjectId | string;
  symbolSnapshot: Record<string, unknown>;
  marketType: MarketType;
  tradeStyle: string;
  instrumentType: InstrumentType;
  direction: TradeDirection;
  entry: number;
  stopLoss: number;
  target1: number;
  target2?: number;
  riskPerUnit: number;
  rewardPerUnit: number;
  rewardRiskRatio: number;
  scoringTemplateKey: ScoringTemplateKey;
  scoringTemplateVersion: string;
  scoreStatus: string;
  score: number;
  permission: TradePermission;
  reasonCodes: string[];
  warnings: string[];
  tradeScoreSnapshotId?: Types.ObjectId | string;
  scoreCalculatedAt?: Date;
  scoreValidUntil?: Date;
  convertedToTradeSetupId?: Types.ObjectId | string;
};

type TradePlanRecord = {
  _id: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  status: TradePlanStatus;
  marketType: MarketType;
  tradeStyle: string;
  instrumentType: InstrumentType;
  maxTrades?: number;
  maxConsecutiveLosses?: number;
};

type RiskStateRecord = {
  riskMode?: RiskMode;
  totalTrades?: number;
  consecutiveLosses?: number;
};

type UserDailyRiskStateRecord = {
  stopTradingTriggered?: boolean;
};

type TradeSetupRecord = {
  _id: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  tradePlanId: Types.ObjectId | string;
  sourceScoreCheckId?: Types.ObjectId | string;
  status: TradeSetupStatus;
  finalPermission: TradePermission;
  riskGovernorPermission: TradePermission;
  riskModeAtDecision: RiskMode;
  reasonCodes: string[];
  warnings: string[];
  executedAt?: Date;
  cancelledAt?: Date;
};

const toObjectId = (value: string, label: string): Types.ObjectId => {
  if (!isValidObjectId(value)) {
    throw new AppError(`Invalid ${label}`, 400);
  }
  return new Types.ObjectId(value);
};

const normalizeRecord = <T>(value: unknown): T => {
  if (value && typeof value === "object" && "toObject" in value && typeof value.toObject === "function") {
    return value.toObject() as T;
  }
  return value as T;
};

const getDateKey = (date: Date): string => {
  return date.toISOString().slice(0, 10);
};

const isApprovalPermission = (permission: TradePermission): boolean => {
  return permission === "TAKE_TRADE" || permission === "TAKE_SMALL_RISK";
};

export class TradeSetupService {
  public constructor(private readonly dependencies: Partial<TradeSetupServiceDependencies> = {}) {}

  public async convertScoreCheckToTradeSetup(
    userId: string,
    scoreCheckId: string,
    input: ConvertScoreCheckToTradeSetupInput,
  ): Promise<TradeSetupRecord> {
    const parsedInput = this.parseConvertInput(input);
    const scoreCheck = await this.getUserScoreCheck(userId, scoreCheckId);
    if (scoreCheck.convertedToTradeSetupId) {
      throw new AppError("ScoreCheck already converted", 409);
    }
    if (!["READY", "READY_WITH_STALE_DATA"].includes(scoreCheck.scoreStatus)) {
      throw new AppError("ScoreCheck is not ready for conversion", 409);
    }
    const now = this.getNow();
    if (scoreCheck.scoreValidUntil && scoreCheck.scoreValidUntil < now) {
      throw new AppError("ScoreCheck is expired", 409);
    }
    if (!scoreCheck.tradeScoreSnapshotId) {
      throw new AppError("ScoreCheck snapshot is missing", 409);
    }

    const tradePlan = await this.getUserTradePlan(userId, parsedInput.tradePlanId);
    if (tradePlan.status !== "ACTIVE") {
      throw new AppError("TradeSetup requires an ACTIVE TradePlan", 409);
    }
    this.assertPlanMatchesScoreCheck(tradePlan, scoreCheck);

    const riskBucketKey = buildRiskBucketKey({
      userId,
      marketType: tradePlan.marketType,
      tradeStyle: tradePlan.tradeStyle,
      instrumentType: tradePlan.instrumentType,
    });
    const riskState = await this.getTradePlanRiskState(userId, parsedInput.tradePlanId);
    const dailyRiskState = await this.getUserDailyRiskState(userId, riskBucketKey, now);
    const riskDecision = this.getRiskGovernorService().evaluate({
      tradePlan,
      tradePlanRiskState: riskState,
      userDailyRiskState: dailyRiskState,
      scorePermission: scoreCheck.permission,
      plannedRewardRiskRatio: scoreCheck.rewardRiskRatio,
      evaluatedAt: now,
    });

    const setupStatus: TradeSetupStatus = isApprovalPermission(riskDecision.permission) ? "APPROVED" : "REJECTED";
    const tradeSetup = normalizeRecord<TradeSetupRecord>(await this.getTradeSetupRepository().create({
      userId: toObjectId(userId, "user id"),
      tradePlanId: toObjectId(parsedInput.tradePlanId, "trade plan id"),
      sourceScoreCheckId: toObjectId(scoreCheckId, "score check id"),
      symbolId: toObjectId(String(scoreCheck.symbolId), "symbol id"),
      symbolSnapshot: scoreCheck.symbolSnapshot,
      marketType: scoreCheck.marketType,
      tradeStyle: scoreCheck.tradeStyle,
      instrumentType: scoreCheck.instrumentType,
      direction: scoreCheck.direction,
      plannedEntry: scoreCheck.entry,
      plannedStopLoss: scoreCheck.stopLoss,
      plannedTarget1: scoreCheck.target1,
      ...(scoreCheck.target2 ? { plannedTarget2: scoreCheck.target2 } : {}),
      plannedRiskPerUnit: scoreCheck.riskPerUnit,
      plannedRewardPerUnit: scoreCheck.rewardPerUnit,
      plannedRewardRiskRatio: scoreCheck.rewardRiskRatio,
      scoringTemplateKey: scoreCheck.scoringTemplateKey,
      scoringTemplateVersion: scoreCheck.scoringTemplateVersion,
      tradeScoreSnapshotId: toObjectId(String(scoreCheck.tradeScoreSnapshotId), "trade score snapshot id"),
      score: scoreCheck.score,
      scorePermission: scoreCheck.permission,
      riskGovernorPermission: riskDecision.permission,
      finalPermission: riskDecision.permission,
      riskModeAtDecision: riskDecision.riskMode,
      reasonCodes: [...scoreCheck.reasonCodes, ...riskDecision.reasonCodes],
      warnings: [...scoreCheck.warnings, ...riskDecision.warnings],
      status: setupStatus,
      ...(scoreCheck.scoreCalculatedAt ? { scoreCalculatedAt: scoreCheck.scoreCalculatedAt } : {}),
      ...(scoreCheck.scoreValidUntil ? { scoreValidUntil: scoreCheck.scoreValidUntil } : {}),
      riskEvaluatedAt: riskDecision.evaluatedAt,
      expiresAt: scoreCheck.scoreValidUntil,
    }));

    const updatedScoreCheck = await this.getScoreCheckRepository().findOneAndUpdate(
      {
        _id: toObjectId(scoreCheckId, "score check id"),
        userId: toObjectId(userId, "user id"),
        convertedToTradeSetupId: { $exists: false },
      },
      {
        $set: {
          convertedToTradeSetupId: tradeSetup._id,
        },
      },
      {
        new: true,
      },
    ).lean().exec();
    if (!updatedScoreCheck) {
      throw new AppError("ScoreCheck already converted", 409);
    }

    await this.audit("SCORE_CHECK_CONVERTED_TO_TRADE_SETUP", userId, scoreCheck._id, {
      metadata: {
        tradeSetupId: String(tradeSetup._id),
        tradePlanId: parsedInput.tradePlanId,
      },
    });
    await this.audit("TRADE_SETUP_CREATED", userId, tradeSetup._id, {
      after: this.toAuditTradeSetupSnapshot(tradeSetup),
    });
    await this.auditRiskDecision(userId, tradeSetup._id, riskDecision);

    return tradeSetup;
  }

  public async listTradeSetups(userId: string): Promise<TradeSetupRecord[]> {
    return this.getTradeSetupRepository().find({
      userId: toObjectId(userId, "user id"),
    }).sort({ createdAt: -1 }).lean().exec() as Promise<TradeSetupRecord[]>;
  }

  public async listTradeSetupsForPlan(userId: string, tradePlanId: string): Promise<TradeSetupRecord[]> {
    return this.getTradeSetupRepository().find({
      userId: toObjectId(userId, "user id"),
      tradePlanId: toObjectId(tradePlanId, "trade plan id"),
    }).sort({ createdAt: -1 }).lean().exec() as Promise<TradeSetupRecord[]>;
  }

  public async getTradeSetup(userId: string, tradeSetupId: string): Promise<TradeSetupRecord> {
    const tradeSetup = await this.getTradeSetupRepository().findOne({
      _id: toObjectId(tradeSetupId, "trade setup id"),
      userId: toObjectId(userId, "user id"),
    }).lean().exec() as TradeSetupRecord | null;

    if (!tradeSetup) {
      throw new AppError("TRADE_SETUP_NOT_FOUND", 404);
    }

    return tradeSetup;
  }

  public async cancelTradeSetup(userId: string, tradeSetupId: string): Promise<TradeSetupRecord> {
    const tradeSetup = await this.getTradeSetup(userId, tradeSetupId);
    if (tradeSetup.status === "EXECUTED" || tradeSetup.executedAt) {
      throw new AppError("Executed TradeSetup cannot be cancelled", 409);
    }

    const cancelled = await this.getTradeSetupRepository().findOneAndUpdate(
      {
        _id: toObjectId(tradeSetupId, "trade setup id"),
        userId: toObjectId(userId, "user id"),
      },
      {
        $set: {
          status: "CANCELLED",
          cancelledAt: this.getNow(),
        },
      },
      {
        new: true,
      },
    ).lean().exec() as TradeSetupRecord | null;

    if (!cancelled) {
      throw new AppError("TRADE_SETUP_NOT_FOUND", 404);
    }

    await this.audit("TRADE_SETUP_CANCELLED", userId, cancelled._id, {
      before: this.toAuditTradeSetupSnapshot(tradeSetup),
      after: this.toAuditTradeSetupSnapshot(cancelled),
    });

    return cancelled;
  }

  private parseConvertInput(input: ConvertScoreCheckToTradeSetupInput): ConvertScoreCheckToTradeSetupInput {
    const parsed = convertScoreCheckToTradeSetupSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError("Invalid TradeSetup conversion payload", 400);
    }
    return parsed.data;
  }

  private async getUserScoreCheck(userId: string, scoreCheckId: string): Promise<ScoreCheckRecord> {
    const scoreCheck = await this.getScoreCheckRepository().findOne({
      _id: toObjectId(scoreCheckId, "score check id"),
      userId: toObjectId(userId, "user id"),
    }).lean().exec() as ScoreCheckRecord | null;

    if (!scoreCheck) {
      throw new AppError("SCORE_CHECK_NOT_FOUND", 404);
    }

    return scoreCheck;
  }

  private async getUserTradePlan(userId: string, tradePlanId: string): Promise<TradePlanRecord> {
    const tradePlan = await this.getTradePlanRepository().findOne({
      _id: toObjectId(tradePlanId, "trade plan id"),
      userId: toObjectId(userId, "user id"),
    }).lean().exec() as TradePlanRecord | null;

    if (!tradePlan) {
      throw new AppError("TRADE_PLAN_NOT_FOUND", 404);
    }

    return tradePlan;
  }

  private async getTradePlanRiskState(userId: string, tradePlanId: string): Promise<RiskStateRecord | null> {
    return this.getRiskStateRepository().findOne({
      userId: toObjectId(userId, "user id"),
      tradePlanId: toObjectId(tradePlanId, "trade plan id"),
    }).lean().exec() as Promise<RiskStateRecord | null>;
  }

  private async getUserDailyRiskState(
    userId: string,
    riskBucketKey: string,
    now: Date,
  ): Promise<UserDailyRiskStateRecord | null> {
    return this.getUserDailyRiskStateRepository().findOne({
      userId: toObjectId(userId, "user id"),
      riskBucketKey,
      dateKey: getDateKey(now),
    }).lean().exec() as Promise<UserDailyRiskStateRecord | null>;
  }

  private assertPlanMatchesScoreCheck(tradePlan: TradePlanRecord, scoreCheck: ScoreCheckRecord): void {
    if (
      tradePlan.marketType !== scoreCheck.marketType
      || tradePlan.tradeStyle !== scoreCheck.tradeStyle
      || tradePlan.instrumentType !== scoreCheck.instrumentType
    ) {
      throw new AppError("TradePlan scope does not match ScoreCheck", 409);
    }
  }

  private toAuditTradeSetupSnapshot(tradeSetup: TradeSetupRecord): Record<string, unknown> {
    return {
      id: String(tradeSetup._id),
      tradePlanId: String(tradeSetup.tradePlanId),
      sourceScoreCheckId: tradeSetup.sourceScoreCheckId ? String(tradeSetup.sourceScoreCheckId) : undefined,
      status: tradeSetup.status,
      finalPermission: tradeSetup.finalPermission,
      riskGovernorPermission: tradeSetup.riskGovernorPermission,
      riskModeAtDecision: tradeSetup.riskModeAtDecision,
    };
  }

  private async audit(
    action: string,
    userId: string,
    entityId: Types.ObjectId | string,
    payload: {
      before?: Record<string, unknown>;
      after?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    } = {},
  ): Promise<void> {
    await this.getAuditLogService().record({
      userId,
      actorType: "USER",
      actorId: userId,
      action,
      entityType: action.startsWith("SCORE_CHECK") ? "SCORE_CHECK" : "TRADE_SETUP",
      entityId: String(entityId),
      ...payload,
    });
  }

  private async auditRiskDecision(
    userId: string,
    tradeSetupId: Types.ObjectId | string,
    decision: RiskGovernorDecision,
  ): Promise<void> {
    await this.getAuditLogService().record({
      userId,
      actorType: "SYSTEM",
      action: "RISK_GOVERNOR_EVALUATED",
      entityType: "TRADE_SETUP",
      entityId: String(tradeSetupId),
      metadata: {
        permission: decision.permission,
        riskMode: decision.riskMode,
        reasonCodes: decision.reasonCodes,
        warnings: decision.warnings,
        evaluatedAt: decision.evaluatedAt.toISOString(),
      },
    });
  }

  private getNow(): Date {
    return this.dependencies.now?.() ?? new Date();
  }

  private getScoreCheckRepository(): ScoreCheckRepository {
    return this.dependencies.scoreCheckRepository ?? ScoreCheckModel;
  }

  private getTradePlanRepository(): TradePlanRepository {
    return this.dependencies.tradePlanRepository ?? TradePlanModel;
  }

  private getTradeSetupRepository(): TradeSetupRepository {
    return this.dependencies.tradeSetupRepository ?? TradeSetupModel;
  }

  private getRiskStateRepository(): RiskStateRepository {
    return this.dependencies.riskStateRepository ?? TradePlanRiskStateModel;
  }

  private getUserDailyRiskStateRepository(): UserDailyRiskStateRepository {
    return this.dependencies.userDailyRiskStateRepository ?? UserDailyRiskStateModel;
  }

  private getRiskGovernorService(): Pick<RiskGovernorService, "evaluate"> {
    return this.dependencies.riskGovernorService ?? new RiskGovernorService();
  }

  private getAuditLogService(): Pick<AuditLogService, "record"> {
    return this.dependencies.auditLogService ?? auditLogService;
  }
}
