import { Types, isValidObjectId } from "mongoose";

import { AppError } from "../../errors/AppError.js";
import { ActiveTradeModel } from "../../models/active-trade.model.js";
import { AiExplanationModel } from "../../models/ai-explanation.model.js";
import { CapitalAdjustmentEventModel } from "../../models/capital-adjustment-event.model.js";
import { ScoreCheckModel } from "../../models/score-check.model.js";
import { TradeEventModel } from "../../models/trade-event.model.js";
import { TradeJournalModel } from "../../models/trade-journal.model.js";
import { TradePlanModel } from "../../models/trade-plan.model.js";
import { TradePlanRiskStateModel } from "../../models/trade-plan-risk-state.model.js";
import { TradeResultModel } from "../../models/trade-result.model.js";
import { TradeScoreSnapshotModel } from "../../models/trade-score-snapshot.model.js";
import { TradeSetupModel } from "../../models/trade-setup.model.js";
import { UserDailyRiskStateModel } from "../../models/user-daily-risk-state.model.js";
import {
  type InstrumentType,
  type MarketType,
} from "../../types/market-data.types.js";
import type { RiskMode } from "../../types/risk.types.js";
import {
  type CapitalAdjustmentType,
  type PlanMode,
  type TradePlanStatus,
} from "../../types/trade.types.js";
import { auditLogService, type AuditLogService } from "../access/audit-log.service.js";
import {
  calculateTradePlanDashboardTotals,
  getTradePlanDashboardBlockReasons,
  getTradePlanStopTradingReasons,
  projectLatestTradeResults,
  projectTradePlanPerformance,
  toSafeNumber,
  type DashboardActiveTrade,
  type DashboardCapitalAdjustment,
  type DashboardDailyRiskState,
  type DashboardRiskState,
  type DashboardTradeResult,
} from "./trade-plan-dashboard-projection.js";
import {
  buildRiskBucketKey,
  capitalAdjustmentSchema,
  createTradePlanSchema,
  deleteTradePlanSchema,
  resetRiskLockSchema,
  restartTradePlanSchema,
  updateTradePlanSchema,
  type CreateCapitalAdjustmentInput,
  type CreateTradePlanInput,
  type DeleteTradePlanInput,
  type ResetRiskLockInput,
  type RestartTradePlanInput,
  type UpdateTradePlanInput,
} from "./trade-plan-validation.js";

export {
  buildRiskBucketKey,
  capitalAdjustmentSchema,
  createTradePlanSchema,
  deleteTradePlanSchema,
  resetRiskLockSchema,
  restartTradePlanSchema,
  updateTradePlanSchema,
};
export type {
  CreateCapitalAdjustmentInput,
  CreateTradePlanInput,
  DeleteTradePlanInput,
  ResetRiskLockInput,
  RestartTradePlanInput,
  UpdateTradePlanInput,
};

type QueryExec<T> = {
  exec: () => Promise<T>;
};

type LeanQueryExec<T> = {
  lean: () => QueryExec<T>;
};

type SortableLeanQueryExec<T> = {
  sort: (sort: Record<string, 1 | -1>) => LeanQueryExec<T>;
};

type TradePlanRepository = {
  create: (input: Record<string, unknown>) => Promise<unknown>;
  find: (filter: Record<string, unknown>) => SortableLeanQueryExec<unknown[]>;
  findOne: (filter: Record<string, unknown>) => LeanQueryExec<unknown | null>;
  findOneAndUpdate: (
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options: Record<string, unknown>,
  ) => LeanQueryExec<unknown | null>;
};

type CapitalAdjustmentRepository = {
  create: (input: Record<string, unknown>) => Promise<unknown>;
};

type RiskStateRepository = {
  findOneAndUpdate: (
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options: Record<string, unknown>,
  ) => LeanQueryExec<unknown | null>;
};

type TradePlanServiceDependencies = {
  tradePlanRepository: TradePlanRepository;
  capitalAdjustmentRepository: CapitalAdjustmentRepository;
  riskStateRepository: RiskStateRepository;
  auditLogService: Pick<AuditLogService, "record">;
  now: () => Date;
};

type TradePlanRecord = {
  _id: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  name: string;
  description?: string;
  marketType: MarketType;
  tradeStyle: string;
  instrumentType: InstrumentType;
  planMode: PlanMode;
  status: TradePlanStatus;
  startingCapital: number;
  currentCapital?: number;
  currency: string;
  maxRiskPerTradePercent: number;
  maxDailyLossPercent?: number;
  maxConsecutiveLosses?: number;
  maxTrades?: number;
  startDate?: Date;
  endDate?: Date;
  reviewCadence?: string;
  scoringTemplateKey?: string;
  scoringTemplateVersion?: string;
  riskTemplateKey?: string;
  riskTemplateVersion?: string;
  monitoringTemplateKey?: string;
  monitoringTemplateVersion?: string;
  activatedAt?: Date;
  pausedAt?: Date;
  completedAt?: Date;
  stoppedAt?: Date;
  archivedAt?: Date;
  isDeleted?: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId | string;
  deleteReason?: string;
};

type CapitalAdjustmentRecord = {
  _id: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  tradePlanId: Types.ObjectId | string;
  adjustmentType: CapitalAdjustmentType;
  amount: number;
  currency: string;
  reason?: string;
  createdBy: Types.ObjectId | string;
};

const ACTIVE_CONFLICT_STATUSES: TradePlanStatus[] = ["ACTIVE", "PAUSED"];
const ACTIVE_TRADE_PLAN_UPDATE_FIELDS = new Set(["name", "description", "maxTrades", "reviewCadence"]);
const FINALIZED_RESULT_STATUSES = ["FINALIZED", "ADJUSTED"];
const OPEN_ACTIVE_TRADE_STATUSES = ["ACTIVE", "PARTIALLY_EXITED"];

type TradeUsageSnapshot = {
  usedTrades: number;
  riskStateTotalTrades: number;
  executedSetupCount: number;
  activeTradeCount: number;
  finalizedResultCount: number;
};

type ResetRiskLockResult = {
  tradePlanId: string;
  riskMode: RiskMode;
  canTakeNextTrade: boolean;
  message: string;
};

type RestartTradePlanResult = {
  oldTradePlanId: string;
  newTradePlan: TradePlanRecord;
  oldPlanArchived: boolean;
  message: string;
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

export class TradePlanService {
  public constructor(private readonly dependencies: Partial<TradePlanServiceDependencies> = {}) {}

  public async createTradePlan(userId: string, input: CreateTradePlanInput): Promise<TradePlanRecord> {
    const userObjectId = toObjectId(userId, "user id");
    const parsedInput = this.parseCreateInput(input);
    const plan = normalizeRecord<TradePlanRecord>(await this.getTradePlanRepository().create({
      ...parsedInput,
      userId: userObjectId,
      status: "DRAFT",
      currentCapital: parsedInput.currentCapital ?? parsedInput.startingCapital,
    }));

    await this.audit("TRADE_PLAN_CREATED", userId, plan._id, {
      after: this.toAuditPlanSnapshot(plan),
    });

    return plan;
  }

  public async listTradePlans(userId: string): Promise<TradePlanRecord[]> {
    const userObjectId = toObjectId(userId, "user id");
    return this.getTradePlanRepository()
      .find({ userId: userObjectId, isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .lean()
      .exec() as Promise<TradePlanRecord[]>;
  }

  public async getTradePlan(userId: string, planId: string): Promise<TradePlanRecord> {
    const plan = await this.findUserPlan(userId, planId);
    if (!plan) {
      throw new AppError("TRADE_PLAN_NOT_FOUND", 404);
    }
    return plan;
  }

  public async updateTradePlan(
    userId: string,
    planId: string,
    input: UpdateTradePlanInput,
  ): Promise<TradePlanRecord> {
    const parsedInput = this.parseUpdateInput(input);
    if (Object.keys(parsedInput).length === 0) {
      throw new AppError("No update fields provided", 400);
    }

    const existingPlan = await this.getTradePlan(userId, planId);
    if (existingPlan.status === "ACTIVE") {
      return this.updateActiveTradePlan(userId, planId, existingPlan, parsedInput);
    }
    if (existingPlan.status !== "DRAFT") {
      throw new AppError("TradePlan can only be fully updated while in DRAFT", 409);
    }

    const mergedPlan = {
      ...existingPlan,
      ...parsedInput,
    };
    const validation = createTradePlanSchema.safeParse({
      ...mergedPlan,
      description: mergedPlan.description,
    });
    if (!validation.success) {
      throw new AppError("Invalid TradePlan update payload", 400);
    }

    const updatedPlan = await this.updateUserPlan(userId, planId, { $set: parsedInput });
    await this.audit("TRADE_PLAN_UPDATED", userId, updatedPlan._id, {
      before: this.toAuditPlanSnapshot(existingPlan),
      after: this.toAuditPlanSnapshot(updatedPlan),
    });

    return updatedPlan;
  }

  public async getTradePlanDashboardSummary(userId: string, planId: string): Promise<Record<string, unknown>> {
    const plan = await this.getTradePlan(userId, planId);
    const userObjectId = toObjectId(userId, "user id");
    const planObjectId = toObjectId(planId, "trade plan id");
    const usage = await this.getTradeUsageSnapshot(userId, planId);
    const riskBucketKey = this.getRiskBucketKey(userId, plan);

    const [
      riskState,
      dailyRiskState,
      capitalAdjustments,
      tradeResults,
      openActiveTrades,
    ] = await Promise.all([
      TradePlanRiskStateModel.findOne({
        userId: userObjectId,
        tradePlanId: planObjectId,
      }).lean().exec() as Promise<DashboardRiskState | null>,
      UserDailyRiskStateModel.findOne({
        userId: userObjectId,
        riskBucketKey,
      }).sort({ dateKey: -1 }).lean().exec() as Promise<DashboardDailyRiskState | null>,
      CapitalAdjustmentEventModel.find({
        userId: userObjectId,
        tradePlanId: planObjectId,
      }).lean().exec() as Promise<DashboardCapitalAdjustment[]>,
      TradeResultModel.find({
        userId: userObjectId,
        tradePlanId: planObjectId,
        status: { $in: FINALIZED_RESULT_STATUSES },
      }).sort({ closedAt: -1 }).lean().exec() as Promise<DashboardTradeResult[]>,
      ActiveTradeModel.find({
        userId: userObjectId,
        tradePlanId: planObjectId,
        status: { $in: OPEN_ACTIVE_TRADE_STATUSES },
      }).lean().exec() as Promise<DashboardActiveTrade[]>,
    ]);

    const totals = calculateTradePlanDashboardTotals(plan, capitalAdjustments, tradeResults, openActiveTrades);
    const hasOpenTrades = openActiveTrades.length > 0;
    const allowedTrades = plan.maxTrades ?? null;
    const remainingTrades = allowedTrades === null ? null : Math.max(allowedTrades - usage.usedTrades, 0);
    const riskMode = riskState?.riskMode ?? "NORMAL_RISK";
    const blockReasons = getTradePlanDashboardBlockReasons({
      planStatus: plan.status,
      remainingTrades,
      riskMode,
      dailyStopTradingTriggered: dailyRiskState?.stopTradingTriggered === true,
    });
    const stopTradingReasons = getTradePlanStopTradingReasons(riskMode, dailyRiskState);

    return {
      plan: {
        id: String(plan._id),
        name: plan.name,
        status: plan.status,
        marketType: plan.marketType,
        instrumentType: plan.instrumentType,
        tradeStyle: plan.tradeStyle,
        planMode: plan.planMode,
        allowedTrades,
        usedTrades: usage.usedTrades,
        remainingTrades,
        usageBreakdown: usage,
      },
      capital: totals,
      performance: projectTradePlanPerformance(tradeResults),
      risk: {
        riskMode,
        dailyRiskUsed: toSafeNumber(dailyRiskState?.netPnl ?? dailyRiskState?.grossPnl),
        planRiskUsed: toSafeNumber(riskState?.netPnl ?? riskState?.grossPnl),
        maxDailyRisk: plan.maxDailyLossPercent ? (totals.capitalBase * plan.maxDailyLossPercent) / 100 : null,
        maxPlanRisk: (totals.capitalBase * plan.maxRiskPerTradePercent) / 100,
        canTakeNextTrade: blockReasons.length === 0,
        blockReasons,
        stopTradingReasons,
        resetAvailable: (plan.status === "ACTIVE" || plan.status === "PAUSED") && !hasOpenTrades,
        restartAvailable: !hasOpenTrades && plan.status !== "ARCHIVED",
        hasOpenTrades,
      },
      latestTrades: projectLatestTradeResults(tradeResults),
    };
  }

  public async activateTradePlan(userId: string, planId: string): Promise<TradePlanRecord> {
    const plan = await this.getTradePlan(userId, planId);
    if (plan.status !== "DRAFT") {
      throw new AppError("Only DRAFT TradePlans can be activated", 409);
    }
    await this.assertNoRiskBucketConflict(userId, plan);

    const now = this.getNow();
    const activatedPlan = await this.updateUserPlan(userId, planId, {
      $set: {
        status: "ACTIVE",
        activatedAt: now,
      },
    });

    await this.initializeRiskState(userId, activatedPlan);
    await this.audit("TRADE_PLAN_ACTIVATED", userId, activatedPlan._id, {
      before: this.toAuditPlanSnapshot(plan),
      after: this.toAuditPlanSnapshot(activatedPlan),
    });

    return activatedPlan;
  }

  public async pauseTradePlan(userId: string, planId: string): Promise<TradePlanRecord> {
    return this.transitionTradePlan(userId, planId, ["ACTIVE"], "PAUSED", "pausedAt", "TRADE_PLAN_PAUSED");
  }

  public async stopTradePlan(userId: string, planId: string): Promise<TradePlanRecord> {
    return this.transitionTradePlan(userId, planId, ["ACTIVE", "PAUSED"], "STOPPED", "stoppedAt", "TRADE_PLAN_STOPPED");
  }

  public async completeTradePlan(userId: string, planId: string): Promise<TradePlanRecord> {
    return this.transitionTradePlan(
      userId,
      planId,
      ["ACTIVE", "PAUSED"],
      "COMPLETED",
      "completedAt",
      "TRADE_PLAN_COMPLETED",
    );
  }

  public async archiveTradePlan(userId: string, planId: string): Promise<TradePlanRecord> {
    return this.transitionTradePlan(
      userId,
      planId,
      ["DRAFT", "STOPPED", "COMPLETED"],
      "ARCHIVED",
      "archivedAt",
      "TRADE_PLAN_ARCHIVED",
    );
  }

  public async deleteTradePlan(
    userId: string,
    planId: string,
    input: DeleteTradePlanInput = {},
  ): Promise<{ tradePlan: TradePlanRecord; cascadeSummary: Record<string, number> }> {
    const parsedInput = this.parseDeleteInput(input);
    const plan = await this.getTradePlan(userId, planId);
    const userObjectId = toObjectId(userId, "user id");
    const planObjectId = toObjectId(planId, "trade plan id");

    const openActiveTradeCount = await ActiveTradeModel.countDocuments({
      userId: userObjectId,
      tradePlanId: planObjectId,
      status: { $in: ["ACTIVE", "PARTIALLY_EXITED"] },
    }).exec();
    if (openActiveTradeCount > 0) {
      await this.audit("TRADE_PLAN_DELETE_BLOCKED", userId, plan._id, {
        metadata: {
          reason: "OPEN_ACTIVE_TRADES",
          openActiveTradeCount,
        },
      });
      throw new AppError("TradePlan has open ActiveTrades. Close or cancel them before deleting.", 409);
    }

    const finalizedResultCount = await TradeResultModel.countDocuments({
      userId: userObjectId,
      tradePlanId: planObjectId,
      status: { $in: ["FINALIZED", "ADJUSTED"] },
    }).exec();
    const finalizedJournalCount = await TradeJournalModel.countDocuments({
      userId: userObjectId,
      tradePlanId: planObjectId,
      status: "FINALIZED",
    }).exec();
    if (finalizedResultCount > 0 || finalizedJournalCount > 0) {
      await this.audit("TRADE_PLAN_DELETE_BLOCKED", userId, plan._id, {
        metadata: {
          reason: "FINALIZED_HISTORY",
          finalizedResultCount,
          finalizedJournalCount,
        },
      });
      throw new AppError("TradePlan has finalized trade history. Archive it instead.", 409);
    }

    const now = this.getNow();
    const setupDocs = await TradeSetupModel.find({
      userId: userObjectId,
      tradePlanId: planObjectId,
      isDeleted: { $ne: true },
    }, { _id: 1, sourceScoreCheckId: 1, status: 1 }).lean().exec();
    const setupIds = setupDocs.map((setup) => setup._id);
    const scoreCheckIds = setupDocs
      .map((setup) => setup.sourceScoreCheckId)
      .filter((id): id is Types.ObjectId => Boolean(id));

    const activeTradeDocs = await ActiveTradeModel.find({
      userId: userObjectId,
      tradePlanId: planObjectId,
    }, { _id: 1 }).lean().exec();
    const activeTradeIds = activeTradeDocs.map((trade) => trade._id);

    const deleteFields = {
      isDeleted: true,
      deletedAt: now,
      deletedBy: userObjectId,
      deleteReason: parsedInput.reason ?? "User deleted trade plan",
    };
    const snapshotDeleteFilter = [
      ...(scoreCheckIds.length > 0 ? [{ scoreCheckId: { $in: scoreCheckIds } }] : []),
      ...(setupIds.length > 0 ? [{ tradeSetupId: { $in: setupIds } }] : []),
    ];

    const [
      setupResult,
      scoreCheckResult,
      snapshotResult,
      eventResult,
      aiResult,
      planResult,
    ] = await Promise.all([
      TradeSetupModel.updateMany(
        {
          userId: userObjectId,
          tradePlanId: planObjectId,
          status: { $ne: "EXECUTED" },
          isDeleted: { $ne: true },
        },
        {
          $set: {
            status: "CANCELLED",
            cancelledAt: now,
            ...deleteFields,
          },
        },
      ).exec(),
      scoreCheckIds.length > 0
        ? ScoreCheckModel.updateMany(
          {
            userId: userObjectId,
            _id: { $in: scoreCheckIds },
            isDeleted: { $ne: true },
          },
          { $set: deleteFields },
        ).exec()
        : Promise.resolve({ modifiedCount: 0 }),
      snapshotDeleteFilter.length > 0
        ? TradeScoreSnapshotModel.updateMany(
          {
            userId: userObjectId,
            isDeleted: { $ne: true },
            $or: snapshotDeleteFilter,
          },
          { $set: deleteFields },
        ).exec()
        : Promise.resolve({ modifiedCount: 0 }),
      TradeEventModel.updateMany(
        {
          userId: userObjectId,
          tradePlanId: planObjectId,
        },
        {
          $set: {
            metadata: {
              deletedWithTradePlan: true,
              deletedAt: now.toISOString(),
            },
          },
        },
      ).exec(),
      AiExplanationModel.updateMany(
        {
          userId: userObjectId,
          $or: [
            { tradePlanId: planObjectId },
            ...(setupIds.length > 0 ? [{ tradeSetupId: { $in: setupIds } }] : []),
            ...(activeTradeIds.length > 0 ? [{ activeTradeId: { $in: activeTradeIds } }] : []),
          ],
        },
        {
          $set: {
            warnings: ["Deleted with TradePlan"],
          },
        },
      ).exec(),
      this.getTradePlanRepository().findOneAndUpdate(
        {
          _id: planObjectId,
          userId: userObjectId,
          isDeleted: { $ne: true },
        },
        { $set: deleteFields },
        { new: true },
      ).lean().exec() as Promise<TradePlanRecord | null>,
    ]);

    if (!planResult) {
      throw new AppError("TRADE_PLAN_NOT_FOUND", 404);
    }

    const cascadeSummary = {
      tradeSetups: setupResult.modifiedCount ?? 0,
      scoreChecks: scoreCheckResult.modifiedCount ?? 0,
      tradeScoreSnapshots: snapshotResult.modifiedCount ?? 0,
      tradeEventsMarked: eventResult.modifiedCount ?? 0,
      aiExplanationsMarked: aiResult.modifiedCount ?? 0,
    };

    await this.audit("TRADE_DELETE_CASCADE_APPLIED", userId, plan._id, {
      metadata: {
        reason: parsedInput.reason,
        cascade: parsedInput.cascade !== false,
        ...cascadeSummary,
      },
    });
    await this.audit("TRADE_PLAN_DELETED", userId, planResult._id, {
      before: this.toAuditPlanSnapshot(plan),
      after: this.toAuditPlanSnapshot(planResult),
      metadata: cascadeSummary,
    });

    return {
      tradePlan: planResult,
      cascadeSummary,
    };
  }

  public async createCapitalAdjustment(
    userId: string,
    planId: string,
    input: CreateCapitalAdjustmentInput,
  ): Promise<{ event: CapitalAdjustmentRecord; tradePlan: TradePlanRecord }> {
    const parsedInput = this.parseCapitalAdjustmentInput(input);
    const plan = await this.getTradePlan(userId, planId);
    if (plan.status === "ARCHIVED") {
      throw new AppError("Cannot adjust capital on archived TradePlan", 409);
    }
    if (plan.currency !== parsedInput.currency) {
      throw new AppError("Capital adjustment currency must match TradePlan currency", 400);
    }
    if (parsedInput.adjustmentType === "MANUAL_CORRECTION" && !parsedInput.reason?.trim()) {
      throw new AppError("Manual capital correction requires a reason", 400);
    }

    const userObjectId = toObjectId(userId, "user id");
    const planObjectId = toObjectId(planId, "trade plan id");
    const event = normalizeRecord<CapitalAdjustmentRecord>(await this.getCapitalAdjustmentRepository().create({
      userId: userObjectId,
      tradePlanId: planObjectId,
      adjustmentType: parsedInput.adjustmentType,
      amount: parsedInput.amount,
      currency: parsedInput.currency,
      ...(parsedInput.reason ? { reason: parsedInput.reason } : {}),
      createdBy: userObjectId,
    }));

    const capitalDelta = this.calculateCapitalDelta(parsedInput.adjustmentType, parsedInput.amount);
    const nextCapital = (plan.currentCapital ?? plan.startingCapital) + capitalDelta;
    if (nextCapital < 0) {
      throw new AppError("Capital adjustment cannot make current capital negative", 400);
    }
    const updatedPlan = await this.updateUserPlan(userId, planId, {
      $set: {
        currentCapital: nextCapital,
      },
    });

    await this.audit("CAPITAL_ADJUSTED", userId, plan._id, {
      before: { currentCapital: plan.currentCapital ?? plan.startingCapital },
      after: { currentCapital: updatedPlan.currentCapital },
      metadata: {
        adjustmentType: parsedInput.adjustmentType,
        amount: parsedInput.amount,
        currency: parsedInput.currency,
        eventId: String(event._id),
      },
    });

    return {
      event,
      tradePlan: updatedPlan,
    };
  }

  public async resetRiskLock(
    userId: string,
    planId: string,
    input: ResetRiskLockInput,
  ): Promise<ResetRiskLockResult> {
    const parsedInput = this.parseResetRiskLockInput(input);
    const plan = await this.getTradePlan(userId, planId);
    if (plan.status === "ARCHIVED") {
      throw new AppError("Archived TradePlan risk lock cannot be reset", 409);
    }
    if (plan.status !== "ACTIVE" && plan.status !== "PAUSED") {
      throw new AppError("Risk lock can only be reset for ACTIVE or PAUSED TradePlans", 409);
    }

    await this.assertNoOpenActiveTrades(userId, planId, "Cannot reset risk lock while open active trades exist.");

    const userObjectId = toObjectId(userId, "user id");
    const planObjectId = toObjectId(planId, "trade plan id");
    const riskBucketKey = this.getRiskBucketKey(userId, plan);
    const existingRiskState = await TradePlanRiskStateModel.findOne({
      userId: userObjectId,
      tradePlanId: planObjectId,
    }).lean().exec() as DashboardRiskState | null;
    const dailyStates = await UserDailyRiskStateModel.find({
      userId: userObjectId,
      riskBucketKey,
    }).lean().exec() as DashboardDailyRiskState[];
    const previousStopReasons = [
      ...getTradePlanStopTradingReasons(existingRiskState?.riskMode ?? "NORMAL_RISK", null),
      ...dailyStates.flatMap((state) => getTradePlanStopTradingReasons(state.riskMode ?? "NORMAL_RISK", state)),
    ];

    if (parsedInput.resetPlanRiskLock) {
      await TradePlanRiskStateModel.findOneAndUpdate(
        {
          userId: userObjectId,
          tradePlanId: planObjectId,
        },
        {
          $set: {
            riskMode: "NORMAL_RISK",
            lastUpdatedAt: this.getNow(),
          },
          $setOnInsert: {
            userId: userObjectId,
            tradePlanId: planObjectId,
            riskBucketKey,
            totalTrades: 0,
            winCount: 0,
            lossCount: 0,
            breakevenCount: 0,
            consecutiveLosses: 0,
            grossPnl: 0,
            netPnl: 0,
            realizedR: 0,
            currentDrawdown: 0,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ).lean().exec();
    }

    if (parsedInput.resetDailyRisk) {
      await UserDailyRiskStateModel.updateMany(
        {
          userId: userObjectId,
          riskBucketKey,
        },
        {
          $set: {
            riskMode: "NORMAL_RISK",
            dailyLossLimitHit: false,
            stopTradingTriggered: false,
          },
        },
      ).exec();
    }

    await this.audit("TRADE_PLAN_RISK_LOCK_RESET", userId, plan._id, {
      metadata: {
        previousRiskMode: existingRiskState?.riskMode ?? "NORMAL_RISK",
        newRiskMode: "NORMAL_RISK",
        previousStopReasons,
        reason: parsedInput.reason,
        resetDailyRisk: parsedInput.resetDailyRisk,
        resetPlanRiskLock: parsedInput.resetPlanRiskLock,
      },
    });

    return {
      tradePlanId: planId,
      riskMode: "NORMAL_RISK",
      canTakeNextTrade: true,
      message: "Risk lock reset. Historical P&L and journals were preserved.",
    };
  }

  public async restartTradePlan(
    userId: string,
    planId: string,
    input: RestartTradePlanInput,
  ): Promise<RestartTradePlanResult> {
    const parsedInput = this.parseRestartTradePlanInput(input);
    const oldPlan = await this.getTradePlan(userId, planId);
    await this.assertNoOpenActiveTrades(userId, planId, "Cannot restart TradePlan while open active trades exist.");

    const restartName = parsedInput.name ?? `${oldPlan.name}_restart`;
    const descriptionParts = [
      oldPlan.description,
      `Restarted from plan ${String(oldPlan._id)}. Reason: ${parsedInput.reason}`,
    ].filter(Boolean);
    const createInput: CreateTradePlanInput = {
      name: restartName,
      description: descriptionParts.join("\n\n"),
      marketType: oldPlan.marketType,
      tradeStyle: oldPlan.tradeStyle,
      instrumentType: oldPlan.instrumentType,
      planMode: oldPlan.planMode,
      startingCapital: parsedInput.startingCapital,
      currentCapital: parsedInput.startingCapital,
      currency: oldPlan.currency,
      maxRiskPerTradePercent: oldPlan.maxRiskPerTradePercent,
      maxDailyLossPercent: oldPlan.maxDailyLossPercent,
      maxConsecutiveLosses: oldPlan.maxConsecutiveLosses,
      maxTrades: oldPlan.maxTrades,
      startDate: oldPlan.startDate,
      endDate: oldPlan.endDate,
      reviewCadence: oldPlan.reviewCadence as CreateTradePlanInput["reviewCadence"],
      scoringTemplateKey: oldPlan.scoringTemplateKey,
      scoringTemplateVersion: oldPlan.scoringTemplateVersion,
      riskTemplateKey: oldPlan.riskTemplateKey,
      riskTemplateVersion: oldPlan.riskTemplateVersion,
      monitoringTemplateKey: oldPlan.monitoringTemplateKey,
      monitoringTemplateVersion: oldPlan.monitoringTemplateVersion,
    };

    let newPlan = await this.createTradePlan(userId, createInput);
    if (parsedInput.activateNewPlan) {
      newPlan = await this.activateTradePlan(userId, String(newPlan._id));
    }

    let oldPlanArchived = false;
    if (parsedInput.archiveOldPlan) {
      const archivedAt = this.getNow();
      await this.updateUserPlan(userId, planId, {
        $set: {
          status: "ARCHIVED",
          archivedAt,
        },
      });
      oldPlanArchived = true;
      await this.audit("TRADE_PLAN_ARCHIVED_BY_RESTART", userId, oldPlan._id, {
        metadata: {
          newTradePlanId: String(newPlan._id),
          reason: parsedInput.reason,
        },
      });
    }

    await this.audit("TRADE_PLAN_RESTARTED", userId, oldPlan._id, {
      metadata: {
        newTradePlanId: String(newPlan._id),
        oldPlanArchived,
        reason: parsedInput.reason,
      },
    });
    await this.audit("TRADE_PLAN_CREATED_FROM_RESTART", userId, newPlan._id, {
      metadata: {
        oldTradePlanId: String(oldPlan._id),
        startingCapital: parsedInput.startingCapital,
        activated: parsedInput.activateNewPlan,
      },
    });

    return {
      oldTradePlanId: planId,
      newTradePlan: newPlan,
      oldPlanArchived,
      message: "New plan created. Old trade history was preserved.",
    };
  }

  private async updateActiveTradePlan(
    userId: string,
    planId: string,
    existingPlan: TradePlanRecord,
    input: UpdateTradePlanInput,
  ): Promise<TradePlanRecord> {
    const disallowedFields = Object.keys(input).filter((key) => !ACTIVE_TRADE_PLAN_UPDATE_FIELDS.has(key));
    if (disallowedFields.length > 0) {
      throw new AppError(
        `Active TradePlan can only update name, description, maxTrades, and reviewCadence. Disallowed: ${disallowedFields.join(", ")}`,
        409,
      );
    }

    if (input.maxTrades !== undefined) {
      const usage = await this.getTradeUsageSnapshot(userId, planId);
      if (input.maxTrades < usage.usedTrades) {
        throw new AppError(
          `maxTrades cannot be lower than existing used trades (${usage.usedTrades})`,
          409,
        );
      }
    }

    const updatedPlan = await this.updateUserPlan(userId, planId, { $set: input });
    await this.audit("TRADE_PLAN_UPDATED", userId, updatedPlan._id, {
      before: this.toAuditPlanSnapshot(existingPlan),
      after: this.toAuditPlanSnapshot(updatedPlan),
      metadata: {
        activePlanSafeEdit: true,
        changedFields: Object.keys(input),
      },
    });

    return updatedPlan;
  }

  private async getTradeUsageSnapshot(userId: string, planId: string): Promise<TradeUsageSnapshot> {
    const userObjectId = toObjectId(userId, "user id");
    const planObjectId = toObjectId(planId, "trade plan id");
    const [
      riskState,
      executedSetupCount,
      activeTradeCount,
      finalizedResultCount,
    ] = await Promise.all([
      TradePlanRiskStateModel.findOne({
        userId: userObjectId,
        tradePlanId: planObjectId,
      }).lean().exec() as Promise<DashboardRiskState | null>,
      TradeSetupModel.countDocuments({
        userId: userObjectId,
        tradePlanId: planObjectId,
        status: "EXECUTED",
        isDeleted: { $ne: true },
      }).exec(),
      ActiveTradeModel.countDocuments({
        userId: userObjectId,
        tradePlanId: planObjectId,
        status: { $in: ["ACTIVE", "PARTIALLY_EXITED", "CLOSED", "STOPPED_OUT"] },
      }).exec(),
      TradeResultModel.countDocuments({
        userId: userObjectId,
        tradePlanId: planObjectId,
        status: { $in: FINALIZED_RESULT_STATUSES },
      }).exec(),
    ]);
    const riskStateTotalTrades = toSafeNumber(riskState?.totalTrades);
    const usedTrades = Math.max(
      riskStateTotalTrades,
      executedSetupCount,
      activeTradeCount,
      finalizedResultCount,
    );

    return {
      usedTrades,
      riskStateTotalTrades,
      executedSetupCount,
      activeTradeCount,
      finalizedResultCount,
    };
  }

  private async assertNoOpenActiveTrades(userId: string, planId: string, message: string): Promise<void> {
    const openActiveTradeCount = await ActiveTradeModel.countDocuments({
      userId: toObjectId(userId, "user id"),
      tradePlanId: toObjectId(planId, "trade plan id"),
      status: { $in: OPEN_ACTIVE_TRADE_STATUSES },
    }).exec();
    if (openActiveTradeCount > 0) {
      throw new AppError(message, 409);
    }
  }

  private async transitionTradePlan(
    userId: string,
    planId: string,
    allowedStatuses: TradePlanStatus[],
    nextStatus: TradePlanStatus,
    timestampField: "pausedAt" | "stoppedAt" | "completedAt" | "archivedAt",
    auditAction: string,
  ): Promise<TradePlanRecord> {
    const plan = await this.getTradePlan(userId, planId);
    if (!allowedStatuses.includes(plan.status)) {
      throw new AppError(`TradePlan cannot transition from ${plan.status} to ${nextStatus}`, 409);
    }

    const updatedPlan = await this.updateUserPlan(userId, planId, {
      $set: {
        status: nextStatus,
        [timestampField]: this.getNow(),
      },
    });

    await this.audit(auditAction, userId, updatedPlan._id, {
      before: this.toAuditPlanSnapshot(plan),
      after: this.toAuditPlanSnapshot(updatedPlan),
    });

    return updatedPlan;
  }

  private async initializeRiskState(userId: string, plan: TradePlanRecord): Promise<void> {
    const userObjectId = toObjectId(userId, "user id");
    const planObjectId = toObjectId(String(plan._id), "trade plan id");
    const riskBucketKey = this.getRiskBucketKey(userId, plan);
    const now = this.getNow();
    const riskState = await this.getRiskStateRepository().findOneAndUpdate(
      {
        userId: userObjectId,
        tradePlanId: planObjectId,
      },
      {
        $setOnInsert: {
          userId: userObjectId,
          tradePlanId: planObjectId,
          riskBucketKey,
          riskMode: "NORMAL_RISK",
          totalTrades: 0,
          winCount: 0,
          lossCount: 0,
          breakevenCount: 0,
          consecutiveLosses: 0,
          grossPnl: 0,
          netPnl: 0,
          realizedR: 0,
          currentDrawdown: 0,
          lastUpdatedAt: now,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    ).lean().exec();

    await this.audit("TRADE_PLAN_RISK_STATE_INITIALIZED", userId, String(plan._id), {
      metadata: {
        riskStateId: riskState && typeof riskState === "object" && "_id" in riskState ? String(riskState._id) : undefined,
        riskBucketKey,
      },
    });
  }

  private async assertNoRiskBucketConflict(userId: string, plan: TradePlanRecord): Promise<void> {
    const userObjectId = toObjectId(userId, "user id");
    const conflictingPlan = await this.getTradePlanRepository().findOne({
      userId: userObjectId,
      marketType: plan.marketType,
      tradeStyle: plan.tradeStyle,
      instrumentType: plan.instrumentType,
      status: { $in: ACTIVE_CONFLICT_STATUSES },
      _id: { $ne: toObjectId(String(plan._id), "trade plan id") },
    }).lean().exec() as TradePlanRecord | null;

    if (conflictingPlan) {
      throw new AppError("Active TradePlan risk bucket already exists", 409);
    }
  }

  private async findUserPlan(userId: string, planId: string): Promise<TradePlanRecord | null> {
    const userObjectId = toObjectId(userId, "user id");
    const planObjectId = toObjectId(planId, "trade plan id");
    return this.getTradePlanRepository().findOne({
      _id: planObjectId,
      userId: userObjectId,
      isDeleted: { $ne: true },
    }).lean().exec() as Promise<TradePlanRecord | null>;
  }

  private async updateUserPlan(
    userId: string,
    planId: string,
    update: Record<string, unknown>,
  ): Promise<TradePlanRecord> {
    const userObjectId = toObjectId(userId, "user id");
    const planObjectId = toObjectId(planId, "trade plan id");
    const updatedPlan = await this.getTradePlanRepository().findOneAndUpdate(
      {
        _id: planObjectId,
        userId: userObjectId,
        isDeleted: { $ne: true },
      },
      update,
      {
        new: true,
      },
    ).lean().exec() as TradePlanRecord | null;

    if (!updatedPlan) {
      throw new AppError("TRADE_PLAN_NOT_FOUND", 404);
    }

    return updatedPlan;
  }

  private parseCreateInput(input: CreateTradePlanInput): CreateTradePlanInput {
    const parsed = createTradePlanSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError("Invalid TradePlan payload", 400);
    }
    return parsed.data;
  }

  private parseUpdateInput(input: UpdateTradePlanInput): UpdateTradePlanInput {
    const parsed = updateTradePlanSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError("Invalid TradePlan update payload", 400);
    }
    return parsed.data;
  }

  private parseCapitalAdjustmentInput(input: CreateCapitalAdjustmentInput): CreateCapitalAdjustmentInput {
    const parsed = capitalAdjustmentSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError("Invalid capital adjustment payload", 400);
    }
    return parsed.data;
  }

  private parseResetRiskLockInput(input: ResetRiskLockInput): ResetRiskLockInput {
    const parsed = resetRiskLockSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError("Invalid risk lock reset payload", 400);
    }
    return parsed.data;
  }

  private parseRestartTradePlanInput(input: RestartTradePlanInput): RestartTradePlanInput {
    const parsed = restartTradePlanSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError("Invalid TradePlan restart payload", 400);
    }
    return parsed.data;
  }

  private parseDeleteInput(input: DeleteTradePlanInput): DeleteTradePlanInput {
    const parsed = deleteTradePlanSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError("Invalid TradePlan delete payload", 400);
    }
    return parsed.data;
  }

  private calculateCapitalDelta(adjustmentType: CapitalAdjustmentType, amount: number): number {
    if (adjustmentType === "WITHDRAWAL" || adjustmentType === "TRANSFER_OUT") {
      return -Math.abs(amount);
    }
    if (adjustmentType === "MANUAL_CORRECTION") {
      return amount;
    }
    return Math.abs(amount);
  }

  private getRiskBucketKey(userId: string, plan: TradePlanRecord): string {
    return buildRiskBucketKey({
      userId,
      marketType: plan.marketType,
      tradeStyle: plan.tradeStyle,
      instrumentType: plan.instrumentType,
    });
  }

  private toAuditPlanSnapshot(plan: TradePlanRecord): Record<string, unknown> {
    return {
      id: String(plan._id),
      status: plan.status,
      name: plan.name,
      marketType: plan.marketType,
      tradeStyle: plan.tradeStyle,
      instrumentType: plan.instrumentType,
      planMode: plan.planMode,
      currency: plan.currency,
      startingCapital: plan.startingCapital,
      currentCapital: plan.currentCapital,
      maxRiskPerTradePercent: plan.maxRiskPerTradePercent,
      maxDailyLossPercent: plan.maxDailyLossPercent,
      maxConsecutiveLosses: plan.maxConsecutiveLosses,
      maxTrades: plan.maxTrades,
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
      entityType: action === "TRADE_PLAN_RISK_STATE_INITIALIZED" ? "RISK_STATE" : "TRADE_PLAN",
      entityId: String(entityId),
      ...payload,
    });
  }

  private getNow(): Date {
    return this.dependencies.now?.() ?? new Date();
  }

  private getTradePlanRepository(): TradePlanRepository {
    return this.dependencies.tradePlanRepository ?? TradePlanModel;
  }

  private getCapitalAdjustmentRepository(): CapitalAdjustmentRepository {
    return this.dependencies.capitalAdjustmentRepository ?? CapitalAdjustmentEventModel;
  }

  private getRiskStateRepository(): RiskStateRepository {
    return this.dependencies.riskStateRepository ?? TradePlanRiskStateModel;
  }

  private getAuditLogService(): Pick<AuditLogService, "record"> {
    return this.dependencies.auditLogService ?? auditLogService;
  }
}
