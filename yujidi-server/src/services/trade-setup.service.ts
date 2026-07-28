import { Types, isValidObjectId } from "mongoose";
import { z } from "zod";

import { AppError } from "../errors/AppError.js";
import { ActiveTradeModel } from "../models/active-trade.model.js";
import { ScoreCheckModel } from "../models/score-check.model.js";
import { TradePlanModel } from "../models/trade-plan.model.js";
import { TradePlanRiskStateModel } from "../models/trade-plan-risk-state.model.js";
import { TradeSetupModel } from "../models/trade-setup.model.js";
import { UserDailyRiskStateModel } from "../models/user-daily-risk-state.model.js";
import { ScoreCheckSnapshotModel } from "../models/score-check-snapshot.model.js";
import { TradeScoreSnapshotModel } from "../models/trade-score-snapshot.model.js";
import type { InstrumentType, MarketType } from "../types/market-data.types.js";
import type { RiskMode } from "../types/risk.types.js";
import type {
  TradeDirection,
  TradePermission,
  TradePlanStatus,
  TradeSetupStatus,
} from "../types/trade.types.js";
import { auditLogService, type AuditLogService } from "./audit-log.service.js";
import { buildRiskBucketKey } from "./trade-plan.service.js";
import { RiskGovernorService, type RiskGovernorDecision } from "./risk-governor.service.js";
import { calculateTradeGeometry } from "./score-check.service.js";

export const convertScoreCheckToTradeSetupSchema = z.object({
  tradePlanId: z.string().min(1),
});

export type ConvertScoreCheckToTradeSetupInput = z.infer<typeof convertScoreCheckToTradeSetupSchema>;

export const updateTradeSetupSchema = z.object({
  entry: z.number().positive().optional(),
  stopLoss: z.number().positive().optional(),
  target1: z.number().positive().optional(),
  target2: z.number().positive().optional(),
  expiresAt: z.coerce.date().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "No update fields provided");

export const deleteTradeSetupSchema = z.object({
  reason: z.string().max(500).optional(),
  deleteLinkedScoreCheck: z.boolean().optional(),
}).strict();

export const retryTradeSetupRiskCheckSchema = z.object({
  reason: z.string().trim().min(1).max(500),
}).strict();

export type UpdateTradeSetupInput = z.infer<typeof updateTradeSetupSchema>;
export type DeleteTradeSetupInput = z.infer<typeof deleteTradeSetupSchema>;
export type RetryTradeSetupRiskCheckInput = z.infer<typeof retryTradeSetupRiskCheckSchema>;

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

type ActiveTradeRepository = {
  findOne: (filter: Record<string, unknown>) => LeanQueryExec<unknown | null>;
};

type ScoreCheckSnapshotRepository = {
  findOne: (filter: Record<string, unknown>) => LeanQueryExec<unknown | null>;
};

type TradeScoreSnapshotRepository = {
  create: (input: Record<string, unknown>) => Promise<unknown>;
  findOne: (filter: Record<string, unknown>) => LeanQueryExec<unknown | null>;
  findOneAndUpdate: (
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options: Record<string, unknown>,
  ) => LeanQueryExec<unknown | null>;
};

type TradeSetupServiceDependencies = {
  scoreCheckRepository: ScoreCheckRepository;
  tradePlanRepository: TradePlanRepository;
  tradeSetupRepository: TradeSetupRepository;
  riskStateRepository: RiskStateRepository;
  userDailyRiskStateRepository: UserDailyRiskStateRepository;
  activeTradeRepository: ActiveTradeRepository;
  scoreCheckSnapshotRepository: ScoreCheckSnapshotRepository;
  tradeScoreSnapshotRepository: TradeScoreSnapshotRepository;
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
  scoringTemplateKey: string;
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

type ScoreCheckSnapshotRecord = Record<string, any> & {
  _id: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  scoreCheckId: Types.ObjectId | string;
  scoringTemplateId?: Types.ObjectId | string;
  scoringTemplateKey: string;
  scoringTemplateName: string;
  scoringTemplateVersion: string;
  scoringTemplateScope: "SYSTEM" | "USER";
  selectedSymbol: Record<string, any>;
  resolvedResources?: unknown[];
  resourceSnapshots?: unknown[];
  resourceReadinessSummary?: Record<string, unknown>;
  sectionBreakdown?: unknown[];
  finalScore: number;
  permission: TradePermission;
  scoreStatus: string;
  dataConfidence: string;
  warnings?: string[];
  blockers?: string[];
  expiresAt: Date;
  createdAt?: Date;
};

type TradeScoreSnapshotRecord = Record<string, any> & {
  _id: Types.ObjectId | string;
};

type TradeSetupRecord = {
  _id: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  tradePlanId: Types.ObjectId | string;
  sourceScoreCheckId?: Types.ObjectId | string;
  tradeScoreSnapshotId?: Types.ObjectId | string;
  status: TradeSetupStatus;
  scorePermission: TradePermission;
  finalPermission: TradePermission;
  riskGovernorPermission: TradePermission;
  riskModeAtDecision: RiskMode;
  reasonCodes: string[];
  warnings: string[];
  direction?: TradeDirection;
  plannedEntry?: number;
  plannedStopLoss?: number;
  plannedTarget1?: number;
  plannedTarget2?: number;
  plannedRiskPerUnit?: number;
  plannedRewardPerUnit?: number;
  plannedRewardRiskRatio?: number;
  scoringTemplateKey?: string;
  scoringTemplateVersion?: string;
  executedAt?: Date;
  cancelledAt?: Date;
  isDeleted?: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId | string;
  deleteReason?: string;
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
  public constructor(private readonly dependencies: Partial<TradeSetupServiceDependencies> = {}) { }

  public async convertScoreCheckToTradeSetup(
    userId: string,
    scoreCheckId: string,
    input: ConvertScoreCheckToTradeSetupInput,
  ): Promise<TradeSetupRecord> {
    const parsedInput = this.parseConvertInput(input);
    const scoreCheck = await this.getUserScoreCheck(userId, scoreCheckId);
    if (scoreCheck.convertedToTradeSetupId) {
      const existingSetup = await this.getTradeSetupRepository().findOne({
        _id: toObjectId(String(scoreCheck.convertedToTradeSetupId), "trade setup id"),
        userId: toObjectId(userId, "user id"),
        isDeleted: { $ne: true },
      }).lean().exec() as TradeSetupRecord | null;
      if (existingSetup?.status === "REJECTED") {
        throw new AppError("ScoreCheck already has a rejected governed setup. Retry the setup instead.", 409);
      }
      throw new AppError("ScoreCheck already converted", 409);
    }
    if (!["READY", "READY_WITH_STALE_DATA"].includes(scoreCheck.scoreStatus)) {
      throw new AppError("ScoreCheck is not ready for conversion", 409);
    }
    const now = this.getNow();
    if (scoreCheck.scoreValidUntil && scoreCheck.scoreValidUntil < now) {
      throw new AppError("ScoreCheck is expired", 409);
    }
    const scoreCheckSnapshot = await this.getValidScoreCheckSnapshot(userId, scoreCheckId, now);
    const tradeScoreSnapshot = await this.getOrCreateTradeScoreSnapshot(
      userId,
      scoreCheck,
      scoreCheckSnapshot,
    );

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
      tradeScoreSnapshotId: toObjectId(String(tradeScoreSnapshot._id), "trade score snapshot id"),
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
          tradeScoreSnapshotId: tradeScoreSnapshot._id,
        },
      },
      {
        new: true,
      },
    ).lean().exec();
    if (!updatedScoreCheck) {
      throw new AppError("ScoreCheck already converted", 409);
    }

    const linkedSnapshot = await this.linkTradeScoreSnapshotToSetup(
      userId,
      tradeScoreSnapshot._id,
      tradeSetup._id,
    );
    const linkedTradeSetup = {
      ...tradeSetup,
      tradeScoreSnapshotId: linkedSnapshot._id,
    };

    await this.audit("SCORE_CHECK_CONVERTED_TO_TRADE_SETUP", userId, scoreCheck._id, {
      metadata: {
        tradeSetupId: String(tradeSetup._id),
        tradePlanId: parsedInput.tradePlanId,
        tradeScoreSnapshotId: String(linkedSnapshot._id),
      },
    });
    await this.audit("TRADE_SETUP_CREATED", userId, linkedTradeSetup._id, {
      after: this.toAuditTradeSetupSnapshot(linkedTradeSetup),
    });
    await this.auditRiskDecision(userId, linkedTradeSetup._id, riskDecision);

    return linkedTradeSetup;
  }

  public async retryRiskCheck(
    userId: string,
    tradeSetupId: string,
    input: RetryTradeSetupRiskCheckInput,
  ): Promise<{
    tradeSetup: TradeSetupRecord;
    riskDecision: RiskGovernorDecision;
    message: string;
  }> {
    const parsedInput = this.parseRetryInput(input);
    const tradeSetup = await this.getTradeSetup(userId, tradeSetupId);

    if (tradeSetup.isDeleted || tradeSetup.deletedAt) {
      throw new AppError("Deleted TradeSetup cannot retry risk check", 409);
    }
    if (tradeSetup.status === "CANCELLED" || tradeSetup.cancelledAt) {
      throw new AppError("Cancelled TradeSetup cannot retry risk check", 409);
    }
    if (tradeSetup.status === "EXECUTED" || tradeSetup.executedAt) {
      throw new AppError("Executed TradeSetup cannot retry risk check", 409);
    }
    if (tradeSetup.status !== "REJECTED") {
      throw new AppError("Only rejected TradeSetups can retry risk check", 409);
    }
    await this.assertNoActiveTrade(userId, tradeSetup);
    if (!tradeSetup.scorePermission || !tradeSetup.plannedRewardRiskRatio) {
      throw new AppError("TradeSetup risk inputs are incomplete", 409);
    }

    const tradePlan = await this.getUserTradePlan(userId, String(tradeSetup.tradePlanId));
    if (tradePlan.status !== "ACTIVE") {
      throw new AppError("Risk retry requires an ACTIVE TradePlan", 409);
    }

    const now = this.getNow();
    const riskBucketKey = buildRiskBucketKey({
      userId,
      marketType: tradePlan.marketType,
      tradeStyle: tradePlan.tradeStyle,
      instrumentType: tradePlan.instrumentType,
    });
    const riskState = await this.getTradePlanRiskState(userId, String(tradePlan._id));
    const dailyRiskState = await this.getUserDailyRiskState(userId, riskBucketKey, now);
    const riskDecision = this.getRiskGovernorService().evaluate({
      tradePlan,
      tradePlanRiskState: riskState,
      userDailyRiskState: dailyRiskState,
      scorePermission: tradeSetup.scorePermission,
      plannedRewardRiskRatio: tradeSetup.plannedRewardRiskRatio,
      evaluatedAt: now,
    });

    const nextStatus: TradeSetupStatus = isApprovalPermission(riskDecision.permission) ? "APPROVED" : "REJECTED";
    const updated = await this.getTradeSetupRepository().findOneAndUpdate(
      {
        _id: toObjectId(tradeSetupId, "trade setup id"),
        userId: toObjectId(userId, "user id"),
        isDeleted: { $ne: true },
        status: "REJECTED",
      },
      {
        $set: {
          status: nextStatus,
          riskGovernorPermission: riskDecision.permission,
          finalPermission: riskDecision.permission,
          riskModeAtDecision: riskDecision.riskMode,
          reasonCodes: riskDecision.reasonCodes,
          warnings: riskDecision.warnings,
          riskEvaluatedAt: riskDecision.evaluatedAt,
        },
      },
      { new: true },
    ).lean().exec() as TradeSetupRecord | null;

    if (!updated) {
      throw new AppError("TRADE_SETUP_NOT_FOUND", 404);
    }

    await this.audit("TRADE_SETUP_RISK_RETRY", userId, updated._id, {
      before: this.toAuditTradeSetupSnapshot(tradeSetup),
      after: this.toAuditTradeSetupSnapshot(updated),
      metadata: {
        reason: parsedInput.reason,
        previousStatus: tradeSetup.status,
        newStatus: updated.status,
        previousPermission: tradeSetup.finalPermission,
        newPermission: updated.finalPermission,
        outcome: nextStatus === "APPROVED" ? "APPROVED" : "REJECTED",
        riskDecision: {
          permission: riskDecision.permission,
          riskMode: riskDecision.riskMode,
          reasonCodes: riskDecision.reasonCodes,
          warnings: riskDecision.warnings,
          evaluatedAt: riskDecision.evaluatedAt.toISOString(),
        },
      },
    });
    await this.auditRiskDecision(userId, updated._id, riskDecision);

    return {
      tradeSetup: updated,
      riskDecision,
      message: "Risk check retried.",
    };
  }

  public async listTradeSetups(userId: string): Promise<TradeSetupRecord[]> {
    return this.getTradeSetupRepository().find({
      userId: toObjectId(userId, "user id"),
      isDeleted: { $ne: true },
    }).sort({ createdAt: -1 }).lean().exec() as Promise<TradeSetupRecord[]>;
  }

  public async listTradeSetupsForPlan(userId: string, tradePlanId: string): Promise<TradeSetupRecord[]> {
    return this.getTradeSetupRepository().find({
      userId: toObjectId(userId, "user id"),
      tradePlanId: toObjectId(tradePlanId, "trade plan id"),
      isDeleted: { $ne: true },
    }).sort({ createdAt: -1 }).lean().exec() as Promise<TradeSetupRecord[]>;
  }

  public async getTradeSetup(userId: string, tradeSetupId: string): Promise<TradeSetupRecord> {
    const tradeSetup = await this.getTradeSetupRepository().findOne({
      _id: toObjectId(tradeSetupId, "trade setup id"),
      userId: toObjectId(userId, "user id"),
      isDeleted: { $ne: true },
    }).lean().exec() as TradeSetupRecord | null;

    if (!tradeSetup) {
      throw new AppError("TRADE_SETUP_NOT_FOUND", 404);
    }

    return tradeSetup;
  }

  public async updateTradeSetup(
    userId: string,
    tradeSetupId: string,
    input: UpdateTradeSetupInput,
  ): Promise<TradeSetupRecord> {
    const parsedInput = this.parseUpdateInput(input);
    const tradeSetup = await this.getTradeSetup(userId, tradeSetupId);
    await this.assertSetupCanMutate(userId, tradeSetup);

    const nextEntry = parsedInput.entry ?? tradeSetup.plannedEntry;
    const nextStopLoss = parsedInput.stopLoss ?? tradeSetup.plannedStopLoss;
    const nextTarget1 = parsedInput.target1 ?? tradeSetup.plannedTarget1;
    if (!tradeSetup.direction || !nextEntry || !nextStopLoss || !nextTarget1) {
      throw new AppError("TradeSetup planned geometry is incomplete", 409);
    }
    const geometryValidation = {
      direction: tradeSetup.direction,
      entry: nextEntry,
      stopLoss: nextStopLoss,
      target1: nextTarget1,
    };
    if (tradeSetup.direction === "LONG" && !(nextStopLoss < nextEntry && nextEntry < nextTarget1)) {
      throw new AppError("INVALID_LONG_GEOMETRY", 400);
    }
    if (tradeSetup.direction === "SHORT" && !(nextTarget1 < nextEntry && nextEntry < nextStopLoss)) {
      throw new AppError("INVALID_SHORT_GEOMETRY", 400);
    }
    const geometry = calculateTradeGeometry(geometryValidation);

    const updated = await this.getTradeSetupRepository().findOneAndUpdate(
      {
        _id: toObjectId(tradeSetupId, "trade setup id"),
        userId: toObjectId(userId, "user id"),
        isDeleted: { $ne: true },
      },
      {
        $set: {
          plannedEntry: nextEntry,
          plannedStopLoss: nextStopLoss,
          plannedTarget1: nextTarget1,
          ...(parsedInput.target2 !== undefined ? { plannedTarget2: parsedInput.target2 } : {}),
          ...{
            plannedRiskPerUnit: geometry.riskPerUnit,
            plannedRewardPerUnit: geometry.rewardPerUnit,
            plannedRewardRiskRatio: geometry.rewardRiskRatio,
          },
          ...(parsedInput.expiresAt ? { expiresAt: parsedInput.expiresAt } : {}),
        },
        $unset: {
          ...(parsedInput.target2 === undefined ? {} : {}),
        },
      },
      { new: true },
    ).lean().exec() as TradeSetupRecord | null;

    if (!updated) {
      throw new AppError("TRADE_SETUP_NOT_FOUND", 404);
    }

    await this.audit("TRADE_SETUP_UPDATED", userId, updated._id, {
      before: this.toAuditTradeSetupSnapshot(tradeSetup),
      after: this.toAuditTradeSetupSnapshot(updated),
      metadata: {
        changedFields: Object.keys(parsedInput),
      },
    });

    return updated;
  }

  public async deleteTradeSetup(
    userId: string,
    tradeSetupId: string,
    input: DeleteTradeSetupInput = {},
  ): Promise<TradeSetupRecord> {
    const parsedInput = this.parseDeleteInput(input);
    const tradeSetup = await this.getTradeSetup(userId, tradeSetupId);
    await this.assertSetupCanMutate(userId, tradeSetup);

    const now = this.getNow();
    const deleted = await this.getTradeSetupRepository().findOneAndUpdate(
      {
        _id: toObjectId(tradeSetupId, "trade setup id"),
        userId: toObjectId(userId, "user id"),
        isDeleted: { $ne: true },
      },
      {
        $set: {
          status: "CANCELLED",
          cancelledAt: now,
          isDeleted: true,
          deletedAt: now,
          deletedBy: toObjectId(userId, "user id"),
          deleteReason: parsedInput.reason ?? "User deleted setup",
        },
      },
      { new: true },
    ).lean().exec() as TradeSetupRecord | null;

    if (!deleted) {
      throw new AppError("TRADE_SETUP_NOT_FOUND", 404);
    }

    if (tradeSetup.sourceScoreCheckId) {
      if (parsedInput.deleteLinkedScoreCheck) {
        await ScoreCheckModel.findOneAndUpdate(
          {
            _id: toObjectId(String(tradeSetup.sourceScoreCheckId), "score check id"),
            userId: toObjectId(userId, "user id"),
            isDeleted: { $ne: true },
          },
          {
            $set: {
              isDeleted: true,
              deletedAt: now,
              deletedBy: toObjectId(userId, "user id"),
              deleteReason: parsedInput.reason ?? "Deleted with TradeSetup",
            },
          },
        ).exec();
      } else {
        await ScoreCheckModel.findOneAndUpdate(
          {
            _id: toObjectId(String(tradeSetup.sourceScoreCheckId), "score check id"),
            userId: toObjectId(userId, "user id"),
          },
          { $unset: { convertedToTradeSetupId: "" } },
        ).exec();
      }
    }

    await this.audit("TRADE_SETUP_DELETED", userId, deleted._id, {
      before: this.toAuditTradeSetupSnapshot(tradeSetup),
      after: this.toAuditTradeSetupSnapshot(deleted),
      metadata: {
        reason: parsedInput.reason,
        deleteLinkedScoreCheck: parsedInput.deleteLinkedScoreCheck === true,
      },
    });

    return deleted;
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

  private parseUpdateInput(input: UpdateTradeSetupInput): UpdateTradeSetupInput {
    const parsed = updateTradeSetupSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError("Invalid TradeSetup update payload", 400);
    }
    return parsed.data;
  }

  private parseDeleteInput(input: DeleteTradeSetupInput): DeleteTradeSetupInput {
    const parsed = deleteTradeSetupSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError("Invalid TradeSetup delete payload", 400);
    }
    return parsed.data;
  }

  private parseRetryInput(input: RetryTradeSetupRiskCheckInput): RetryTradeSetupRiskCheckInput {
    const parsed = retryTradeSetupRiskCheckSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError("Invalid TradeSetup risk retry payload", 400);
    }
    return parsed.data;
  }

  private async getValidScoreCheckSnapshot(
    userId: string,
    scoreCheckId: string,
    now: Date,
  ): Promise<ScoreCheckSnapshotRecord> {
    const snapshot = await this.getScoreCheckSnapshotRepository().findOne({
      userId: toObjectId(userId, "user id"),
      scoreCheckId: toObjectId(scoreCheckId, "score check id"),
      expiresAt: { $gt: now },
    }).lean().exec() as ScoreCheckSnapshotRecord | null;

    if (!snapshot) {
      throw new AppError("SCORE_CHECK_SNAPSHOT_EXPIRED_RERUN_REQUIRED", 409);
    }

    return snapshot;
  }

  private async getOrCreateTradeScoreSnapshot(
    userId: string,
    scoreCheck: ScoreCheckRecord,
    sourceSnapshot: ScoreCheckSnapshotRecord,
  ): Promise<TradeScoreSnapshotRecord> {
    const existingSnapshot = await this.getTradeScoreSnapshotRepository().findOne({
      userId: toObjectId(userId, "user id"),
      scoreCheckId: toObjectId(String(scoreCheck._id), "score check id"),
      isDeleted: { $ne: true },
    }).lean().exec() as TradeScoreSnapshotRecord | null;

    if (existingSnapshot) {
      return existingSnapshot;
    }

    const selectedSymbol = sourceSnapshot.selectedSymbol;
    const symbolId = selectedSymbol?.symbolId ?? scoreCheck.symbolId;
    const created = normalizeRecord<TradeScoreSnapshotRecord>(await this.getTradeScoreSnapshotRepository().create({
      userId: toObjectId(userId, "user id"),
      scoreCheckId: toObjectId(String(scoreCheck._id), "score check id"),
      symbolId: toObjectId(String(symbolId), "symbol id"),
      selectedSymbol,
      ...(sourceSnapshot.scoringTemplateId
        ? { scoringTemplateId: toObjectId(String(sourceSnapshot.scoringTemplateId), "scoring template id") }
        : {}),
      scoringTemplateKey: sourceSnapshot.scoringTemplateKey,
      scoringTemplateName: sourceSnapshot.scoringTemplateName,
      scoringTemplateVersion: sourceSnapshot.scoringTemplateVersion,
      scoringTemplateScope: sourceSnapshot.scoringTemplateScope,
      score: sourceSnapshot.finalScore,
      finalScore: sourceSnapshot.finalScore,
      permission: sourceSnapshot.permission,
      scoreStatus: sourceSnapshot.scoreStatus,
      dataConfidence: sourceSnapshot.dataConfidence,
      breakdown: {
        sectionBreakdown: sourceSnapshot.sectionBreakdown ?? [],
      },
      resolvedResources: sourceSnapshot.resolvedResources ?? [],
      resourceSnapshots: sourceSnapshot.resourceSnapshots ?? [],
      resourceReadinessSummary: sourceSnapshot.resourceReadinessSummary ?? {},
      sectionBreakdown: sourceSnapshot.sectionBreakdown ?? [],
      reasonCodes: scoreCheck.reasonCodes ?? [],
      warnings: sourceSnapshot.warnings ?? [],
      blockers: sourceSnapshot.blockers ?? [],
      sourceSnapshotId: toObjectId(String(sourceSnapshot._id), "score check snapshot id"),
      ...(sourceSnapshot.createdAt ? { sourceSnapshotCreatedAt: sourceSnapshot.createdAt } : {}),
      sourceSnapshotExpiresAt: sourceSnapshot.expiresAt,
      calculatedAt: scoreCheck.scoreCalculatedAt ?? sourceSnapshot.createdAt ?? this.getNow(),
      ...(scoreCheck.scoreValidUntil ? { validUntil: scoreCheck.scoreValidUntil } : {}),
    }));

    return created;
  }

  private async linkTradeScoreSnapshotToSetup(
    userId: string,
    tradeScoreSnapshotId: Types.ObjectId | string,
    tradeSetupId: Types.ObjectId | string,
  ): Promise<TradeScoreSnapshotRecord> {
    const linked = await this.getTradeScoreSnapshotRepository().findOneAndUpdate(
      {
        _id: toObjectId(String(tradeScoreSnapshotId), "trade score snapshot id"),
        userId: toObjectId(userId, "user id"),
      },
      {
        $set: {
          tradeSetupId: toObjectId(String(tradeSetupId), "trade setup id"),
        },
      },
      { new: true },
    ).lean().exec() as TradeScoreSnapshotRecord | null;

    if (!linked) {
      throw new AppError("TRADE_SCORE_SNAPSHOT_LINK_FAILED", 500);
    }

    return linked;
  }

  private async assertSetupCanMutate(userId: string, tradeSetup: TradeSetupRecord): Promise<void> {
    if (tradeSetup.status === "EXECUTED" || tradeSetup.executedAt) {
      throw new AppError("Executed TradeSetup cannot be updated or deleted", 409);
    }
    await this.assertNoActiveTrade(userId, tradeSetup);
  }

  private async assertNoActiveTrade(userId: string, tradeSetup: TradeSetupRecord): Promise<void> {
    const activeTrade = await this.getActiveTradeRepository().findOne({
      userId: toObjectId(userId, "user id"),
      tradeSetupId: toObjectId(String(tradeSetup._id), "trade setup id"),
    }).lean().exec();
    if (activeTrade) {
      throw new AppError("TradeSetup has an ActiveTrade and cannot be retried, updated, or deleted", 409);
    }
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

  private getActiveTradeRepository(): ActiveTradeRepository {
    return this.dependencies.activeTradeRepository ?? ActiveTradeModel;
  }

  private getScoreCheckSnapshotRepository(): ScoreCheckSnapshotRepository {
    return this.dependencies.scoreCheckSnapshotRepository ?? ScoreCheckSnapshotModel;
  }

  private getTradeScoreSnapshotRepository(): TradeScoreSnapshotRepository {
    return this.dependencies.tradeScoreSnapshotRepository ?? TradeScoreSnapshotModel;
  }

  private getRiskGovernorService(): Pick<RiskGovernorService, "evaluate"> {
    return this.dependencies.riskGovernorService ?? new RiskGovernorService();
  }

  private getAuditLogService(): Pick<AuditLogService, "record"> {
    return this.dependencies.auditLogService ?? auditLogService;
  }
}
