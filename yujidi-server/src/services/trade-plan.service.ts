import { Types, isValidObjectId } from "mongoose";
import { z } from "zod";

import { AppError } from "../errors/AppError.js";
import { CapitalAdjustmentEventModel } from "../models/capital-adjustment-event.model.js";
import { TradePlanModel } from "../models/trade-plan.model.js";
import { TradePlanRiskStateModel } from "../models/trade-plan-risk-state.model.js";
import {
  INSTRUMENT_TYPES,
  MARKET_TYPES,
  type InstrumentType,
  type MarketType,
} from "../types/market-data.types.js";
import {
  CAPITAL_ADJUSTMENT_TYPES,
  PLAN_MODES,
  REVIEW_CADENCES,
  type CapitalAdjustmentType,
  type PlanMode,
  type TradePlanStatus,
} from "../types/trade.types.js";
import { auditLogService, type AuditLogService } from "./audit-log.service.js";

const baseTradePlanSchema = z.object({
  name: z.string().min(1).max(120).transform((value) => value.trim()),
  description: z.string().max(1000).optional(),
  marketType: z.enum(MARKET_TYPES),
  tradeStyle: z.string().min(1).max(64).transform((value) => value.trim().toUpperCase()),
  instrumentType: z.enum(INSTRUMENT_TYPES),
  planMode: z.enum(PLAN_MODES),
  startingCapital: z.number().positive(),
  currentCapital: z.number().nonnegative().optional(),
  currency: z.string().min(1).max(12).transform((value) => value.trim().toUpperCase()),
  maxRiskPerTradePercent: z.number().positive().max(10),
  maxDailyLossPercent: z.number().positive().max(20).optional(),
  maxConsecutiveLosses: z.number().int().min(1).optional(),
  maxTrades: z.number().int().min(1).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  reviewCadence: z.enum(REVIEW_CADENCES).optional(),
  scoringTemplateKey: z.string().min(1).max(120).optional(),
  scoringTemplateVersion: z.string().min(1).max(64).optional(),
  riskTemplateKey: z.string().min(1).max(120).optional(),
  riskTemplateVersion: z.string().min(1).max(64).optional(),
  monitoringTemplateKey: z.string().min(1).max(120).optional(),
  monitoringTemplateVersion: z.string().min(1).max(64).optional(),
});

export const createTradePlanSchema = baseTradePlanSchema.superRefine((value, context) => {
  validatePlanModeRules(value, context);
});

export const updateTradePlanSchema = baseTradePlanSchema.partial().superRefine((value, context) => {
  validatePlanModeRules(value, context);
});

export const capitalAdjustmentSchema = z.object({
  adjustmentType: z.enum(CAPITAL_ADJUSTMENT_TYPES),
  amount: z.number().refine((value) => value !== 0, "Amount cannot be zero"),
  currency: z.string().min(1).max(12).transform((value) => value.trim().toUpperCase()),
  reason: z.string().max(500).optional(),
});

export type CreateTradePlanInput = z.infer<typeof createTradePlanSchema>;
export type UpdateTradePlanInput = z.infer<typeof updateTradePlanSchema>;
export type CreateCapitalAdjustmentInput = z.infer<typeof capitalAdjustmentSchema>;

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

const validatePlanModeRules = (
  value: {
    planMode?: PlanMode | undefined;
    maxTrades?: number | undefined;
    startDate?: Date | undefined;
    endDate?: Date | undefined;
  },
  context: z.RefinementCtx,
): void => {
  if (value.planMode === "FIXED_TRADE_COUNT" && value.maxTrades === undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["maxTrades"],
      message: "maxTrades is required for FIXED_TRADE_COUNT plans",
    });
  }

  if (value.planMode === "DATE_RANGE" && !value.endDate) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endDate"],
      message: "endDate is required for DATE_RANGE plans",
    });
  }

  if (value.endDate && value.startDate && value.endDate <= value.startDate) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endDate"],
      message: "endDate must be after startDate",
    });
  }
};

export const buildRiskBucketKey = (input: {
  userId: string;
  marketType: string;
  tradeStyle: string;
  instrumentType: string;
}): string => {
  return [
    input.userId,
    input.marketType.trim().toUpperCase(),
    input.tradeStyle.trim().toUpperCase(),
    input.instrumentType.trim().toUpperCase(),
  ].join(":");
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
      .find({ userId: userObjectId })
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
    if (existingPlan.status !== "DRAFT") {
      throw new AppError("TradePlan can only be updated while in DRAFT", 409);
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
    const nextCapital = Math.max((plan.currentCapital ?? plan.startingCapital) + capitalDelta, 0);
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
