import { Types, isValidObjectId } from "mongoose";
import pino from "pino";
import { z } from "zod";

import { AppError } from "../errors/AppError.js";
import { ActiveTradeModel } from "../models/active-trade.model.js";
import { TradeSetupModel } from "../models/trade-setup.model.js";
import type { InstrumentType, MarketType } from "../types/market-data.types.js";
import type { RiskMode } from "../types/risk.types.js";
import {
  EXECUTION_SOURCES,
  type ActiveTradeStatus,
  type ExecutionQuality,
  type ExecutionSource,
  type TradeDirection,
  type TradePermission,
  type TradeRuleViolation,
  type TradeSetupStatus,
} from "../types/trade.types.js";
import { auditLogService, type AuditLogService } from "./audit-log.service.js";
import {
  sharedActiveTradeSubscriptionService,
  type ActiveTradeSubscriptionService,
} from "./active-trade-subscription.service.js";

const logger = pino({ name: "active-trade-service" });

const positiveNumber = z.number().positive();

export const confirmActualTradeSchema = z.object({
  actualEntry: positiveNumber,
  actualQuantity: positiveNumber,
  initialStopLoss: positiveNumber,
  actualTarget1: positiveNumber,
  actualTarget2: positiveNumber.optional(),
  executionSource: z.enum(EXECUTION_SOURCES).optional().default("MANUAL_CONFIRMATION"),
});

export type ConfirmActualTradeInput = z.input<typeof confirmActualTradeSchema>;
type ParsedConfirmActualTradeInput = z.output<typeof confirmActualTradeSchema>;

type QueryExec<T> = {
  exec: () => Promise<T>;
};

type LeanQueryExec<T> = {
  lean: () => QueryExec<T>;
};

type SortableLeanQueryExec<T> = {
  sort: (sort: Record<string, 1 | -1>) => LeanQueryExec<T>;
};

type DeleteQueryExec = {
  exec: () => Promise<unknown>;
};

type TradeSetupRepository = {
  findOne: (filter: Record<string, unknown>) => LeanQueryExec<unknown | null>;
  findOneAndUpdate: (
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options: Record<string, unknown>,
  ) => LeanQueryExec<unknown | null>;
};

type ActiveTradeRepository = {
  create: (input: Record<string, unknown>) => Promise<unknown>;
  find: (filter: Record<string, unknown>) => SortableLeanQueryExec<unknown[]>;
  findOne: (filter: Record<string, unknown>) => LeanQueryExec<unknown | null>;
  findOneAndUpdate: (
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options: Record<string, unknown>,
  ) => LeanQueryExec<unknown | null>;
  deleteOne: (filter: Record<string, unknown>) => DeleteQueryExec;
};

type ActiveTradeServiceDependencies = {
  tradeSetupRepository: TradeSetupRepository;
  activeTradeRepository: ActiveTradeRepository;
  auditLogService: Pick<AuditLogService, "record">;
  subscriptionService: Pick<
    ActiveTradeSubscriptionService,
    "registerActiveTrade" | "unregisterActiveTrade"
  >;
  now: () => Date;
};

type TradeSetupRecord = {
  _id: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  tradePlanId: Types.ObjectId | string;
  sourceScoreCheckId?: Types.ObjectId | string;
  symbolId: Types.ObjectId | string;
  symbolSnapshot: Record<string, unknown>;
  marketType: MarketType;
  tradeStyle: string;
  instrumentType: InstrumentType;
  direction: TradeDirection;
  plannedEntry: number;
  plannedStopLoss: number;
  plannedTarget1: number;
  plannedTarget2?: number;
  plannedRiskPerUnit: number;
  plannedRewardRiskRatio: number;
  finalPermission: TradePermission;
  riskModeAtDecision: RiskMode;
  status: TradeSetupStatus;
  scoreValidUntil?: Date;
  executedAt?: Date;
};

export type ActiveTradeRecord = {
  _id: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  tradePlanId: Types.ObjectId | string;
  tradeSetupId: Types.ObjectId | string;
  sourceScoreCheckId?: Types.ObjectId | string;
  symbolId: Types.ObjectId | string;
  symbolSnapshot: Record<string, unknown>;
  marketType: MarketType;
  tradeStyle: string;
  instrumentType: InstrumentType;
  direction: TradeDirection;
  plannedEntry: number;
  plannedStopLoss: number;
  plannedTarget1: number;
  plannedTarget2?: number;
  plannedRiskPerUnit: number;
  plannedRewardRiskRatio: number;
  actualEntry: number;
  actualQuantity: number;
  initialStopLoss: number;
  currentStopLoss: number;
  actualTarget1: number;
  actualTarget2?: number;
  remainingQuantity: number;
  actualRiskPerUnit: number;
  actualRiskAmount: number;
  actualRewardPerUnit: number;
  actualRewardRiskRatio: number;
  executionSource: ExecutionSource;
  executionQuality: ExecutionQuality[];
  ruleViolations: TradeRuleViolation[];
  finalPermissionAtExecution: TradePermission;
  riskModeAtExecution: RiskMode;
  status: ActiveTradeStatus;
  openedAt: Date;
  cancelledAt?: Date;
  closedAt?: Date;
};

export type ActualTradeGeometry = {
  actualRiskPerUnit: number;
  actualRiskAmount: number;
  actualRewardPerUnit: number;
  actualRewardRiskRatio: number;
};

export type ExecutionAssessment = {
  executionQuality: ExecutionQuality[];
  ruleViolations: TradeRuleViolation[];
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

const roundTradeNumber = (value: number): number => Number(value.toFixed(4));

const isExecutionPermission = (permission: TradePermission): boolean => {
  return permission === "TAKE_TRADE" || permission === "TAKE_SMALL_RISK";
};

export const calculateActualTradeGeometry = (input: {
  direction: TradeDirection;
  actualEntry: number;
  actualQuantity: number;
  initialStopLoss: number;
  actualTarget1: number;
}): ActualTradeGeometry => {
  const actualRiskPerUnit = input.direction === "LONG"
    ? input.actualEntry - input.initialStopLoss
    : input.initialStopLoss - input.actualEntry;
  const actualRewardPerUnit = input.direction === "LONG"
    ? input.actualTarget1 - input.actualEntry
    : input.actualEntry - input.actualTarget1;

  return {
    actualRiskPerUnit: roundTradeNumber(actualRiskPerUnit),
    actualRiskAmount: roundTradeNumber(actualRiskPerUnit * input.actualQuantity),
    actualRewardPerUnit: roundTradeNumber(actualRewardPerUnit),
    actualRewardRiskRatio: roundTradeNumber(actualRewardPerUnit / actualRiskPerUnit),
  };
};

export const assessExecutionQuality = (input: {
  direction: TradeDirection;
  plannedEntry: number;
  plannedStopLoss: number;
  plannedRiskPerUnit: number;
  plannedRewardRiskRatio: number;
  actualEntry: number;
  initialStopLoss: number;
  actualRiskPerUnit: number;
  actualRewardRiskRatio: number;
}): ExecutionAssessment => {
  const quality = new Set<ExecutionQuality>();
  const violations = new Set<TradeRuleViolation>();
  const epsilon = 0.0001;

  const isLateEntry = input.direction === "LONG"
    ? input.actualEntry > input.plannedEntry + epsilon
    : input.actualEntry < input.plannedEntry - epsilon;
  const isEarlyEntry = input.direction === "LONG"
    ? input.actualEntry < input.plannedEntry - epsilon
    : input.actualEntry > input.plannedEntry + epsilon;
  const isStopLossWidened = input.direction === "LONG"
    ? input.initialStopLoss < input.plannedStopLoss - epsilon
    : input.initialStopLoss > input.plannedStopLoss + epsilon;
  const isRiskExceeded = input.actualRiskPerUnit > input.plannedRiskPerUnit + epsilon;
  const isRewardRiskDegraded = input.actualRewardRiskRatio < input.plannedRewardRiskRatio - epsilon;

  if (isLateEntry) quality.add("LATE_ENTRY");
  if (isEarlyEntry) quality.add("EARLY_ENTRY");

  if (isRewardRiskDegraded) {
    quality.add("DEGRADED_RR");
    if (isLateEntry) {
      violations.add("LATE_ENTRY_DEGRADED_RR");
    }
  }

  if (isStopLossWidened) {
    quality.add("STOPLOSS_CHANGED");
    violations.add("STOPLOSS_WIDENED_AFTER_APPROVAL");
  }

  if (isRiskExceeded) {
    quality.add("EXCEEDED_APPROVED_RISK");
    violations.add("ACTUAL_RISK_EXCEEDED_APPROVED_RISK");
  }

  return {
    executionQuality: quality.size > 0 ? [...quality] : ["AS_PLANNED"],
    ruleViolations: [...violations],
  };
};

export class ActiveTradeService {
  public constructor(private readonly dependencies: Partial<ActiveTradeServiceDependencies> = {}) {}

  public async confirmActualTrade(
    userId: string,
    tradeSetupId: string,
    input: ConfirmActualTradeInput,
  ): Promise<ActiveTradeRecord> {
    const parsedInput = this.parseConfirmInput(input);
    const tradeSetup = await this.getUserTradeSetup(userId, tradeSetupId);
    this.assertTradeSetupCanExecute(tradeSetup);
    this.assertActualGeometry(tradeSetup.direction, parsedInput);

    const now = this.getNow();
    if (tradeSetup.scoreValidUntil && tradeSetup.scoreValidUntil < now) {
      throw new AppError("SCORE_EXPIRED_BEFORE_EXECUTION", 409);
    }

    const existingActiveTrade = await this.getActiveTradeRepository().findOne({
      tradeSetupId: toObjectId(tradeSetupId, "trade setup id"),
    }).lean().exec();
    if (existingActiveTrade) {
      throw new AppError("TradeSetup already executed", 409);
    }

    const geometry = calculateActualTradeGeometry({
      direction: tradeSetup.direction,
      actualEntry: parsedInput.actualEntry,
      actualQuantity: parsedInput.actualQuantity,
      initialStopLoss: parsedInput.initialStopLoss,
      actualTarget1: parsedInput.actualTarget1,
    });
    if (geometry.actualRewardRiskRatio < 1) {
      throw new AppError("ACTUAL_RR_BELOW_MINIMUM", 409);
    }

    const assessment = assessExecutionQuality({
      direction: tradeSetup.direction,
      plannedEntry: tradeSetup.plannedEntry,
      plannedStopLoss: tradeSetup.plannedStopLoss,
      plannedRiskPerUnit: tradeSetup.plannedRiskPerUnit,
      plannedRewardRiskRatio: tradeSetup.plannedRewardRiskRatio,
      actualEntry: parsedInput.actualEntry,
      initialStopLoss: parsedInput.initialStopLoss,
      actualRiskPerUnit: geometry.actualRiskPerUnit,
      actualRewardRiskRatio: geometry.actualRewardRiskRatio,
    });

    let activeTrade: ActiveTradeRecord;
    try {
      activeTrade = normalizeRecord<ActiveTradeRecord>(
        await this.getActiveTradeRepository().create({
        userId: toObjectId(userId, "user id"),
        tradePlanId: toObjectId(String(tradeSetup.tradePlanId), "trade plan id"),
        tradeSetupId: toObjectId(tradeSetupId, "trade setup id"),
        ...(tradeSetup.sourceScoreCheckId
          ? { sourceScoreCheckId: toObjectId(String(tradeSetup.sourceScoreCheckId), "score check id") }
          : {}),
        symbolId: toObjectId(String(tradeSetup.symbolId), "symbol id"),
        symbolSnapshot: tradeSetup.symbolSnapshot,
        marketType: tradeSetup.marketType,
        tradeStyle: tradeSetup.tradeStyle,
        instrumentType: tradeSetup.instrumentType,
        direction: tradeSetup.direction,
        plannedEntry: tradeSetup.plannedEntry,
        plannedStopLoss: tradeSetup.plannedStopLoss,
        plannedTarget1: tradeSetup.plannedTarget1,
        ...(tradeSetup.plannedTarget2 ? { plannedTarget2: tradeSetup.plannedTarget2 } : {}),
        plannedRiskPerUnit: tradeSetup.plannedRiskPerUnit,
        plannedRewardRiskRatio: tradeSetup.plannedRewardRiskRatio,
        actualEntry: parsedInput.actualEntry,
        actualQuantity: parsedInput.actualQuantity,
        initialStopLoss: parsedInput.initialStopLoss,
        currentStopLoss: parsedInput.initialStopLoss,
        actualTarget1: parsedInput.actualTarget1,
        ...(parsedInput.actualTarget2 ? { actualTarget2: parsedInput.actualTarget2 } : {}),
        remainingQuantity: parsedInput.actualQuantity,
        ...geometry,
        executionSource: parsedInput.executionSource,
        executionQuality: assessment.executionQuality,
        ruleViolations: assessment.ruleViolations,
        finalPermissionAtExecution: tradeSetup.finalPermission,
        riskModeAtExecution: tradeSetup.riskModeAtDecision,
        status: "ACTIVE",
        openedAt: now,
        }),
      );
    } catch (error: unknown) {
      if (this.isDuplicateKeyError(error)) {
        throw new AppError("TradeSetup already executed", 409);
      }
      throw error;
    }

    const executedTradeSetup = await this.getTradeSetupRepository().findOneAndUpdate(
      {
        _id: toObjectId(tradeSetupId, "trade setup id"),
        userId: toObjectId(userId, "user id"),
        status: "APPROVED",
        executedAt: { $exists: false },
      },
      {
        $set: {
          status: "EXECUTED",
          executedAt: now,
        },
      },
      {
        new: true,
      },
    ).lean().exec();

    if (!executedTradeSetup) {
      await this.getActiveTradeRepository().deleteOne({ _id: activeTrade._id }).exec();
      throw new AppError("TradeSetup already executed", 409);
    }

    await this.audit("ACTUAL_TRADE_CONFIRMED", userId, activeTrade._id, {
      metadata: {
        tradeSetupId,
        executionSource: parsedInput.executionSource,
        executionQuality: assessment.executionQuality,
        ruleViolations: assessment.ruleViolations,
      },
    });
    await this.audit("ACTIVE_TRADE_CREATED", userId, activeTrade._id, {
      after: this.toAuditActiveTradeSnapshot(activeTrade),
    });
    await this.getAuditLogService().record({
      userId,
      actorType: "USER",
      actorId: userId,
      action: "TRADE_SETUP_EXECUTED",
      entityType: "TRADE_SETUP",
      entityId: tradeSetupId,
      before: {
        status: tradeSetup.status,
        executedAt: tradeSetup.executedAt,
      },
      after: {
        status: "EXECUTED",
        executedAt: now,
      },
      metadata: {
        activeTradeId: String(activeTrade._id),
      },
    });
    await this.registerMonitoringSafely(activeTrade);

    return activeTrade;
  }

  public async listActiveTrades(userId: string): Promise<ActiveTradeRecord[]> {
    return this.getActiveTradeRepository().find({
      userId: toObjectId(userId, "user id"),
    }).sort({ createdAt: -1 }).lean().exec() as Promise<ActiveTradeRecord[]>;
  }

  public async listActiveTradesForPlan(userId: string, tradePlanId: string): Promise<ActiveTradeRecord[]> {
    return this.getActiveTradeRepository().find({
      userId: toObjectId(userId, "user id"),
      tradePlanId: toObjectId(tradePlanId, "trade plan id"),
    }).sort({ createdAt: -1 }).lean().exec() as Promise<ActiveTradeRecord[]>;
  }

  public async getActiveTrade(userId: string, activeTradeId: string): Promise<ActiveTradeRecord> {
    const activeTrade = await this.getActiveTradeRepository().findOne({
      _id: toObjectId(activeTradeId, "active trade id"),
      userId: toObjectId(userId, "user id"),
    }).lean().exec() as ActiveTradeRecord | null;

    if (!activeTrade) {
      throw new AppError("ACTIVE_TRADE_NOT_FOUND", 404);
    }

    return activeTrade;
  }

  public async cancelActiveTrade(userId: string, activeTradeId: string): Promise<ActiveTradeRecord> {
    const activeTrade = await this.getActiveTrade(userId, activeTradeId);
    if (activeTrade.status !== "ACTIVE") {
      throw new AppError("Only ACTIVE trades can be cancelled", 409);
    }

    const cancelledAt = this.getNow();
    const cancelled = await this.getActiveTradeRepository().findOneAndUpdate(
      {
        _id: toObjectId(activeTradeId, "active trade id"),
        userId: toObjectId(userId, "user id"),
        status: "ACTIVE",
      },
      {
        $set: {
          status: "CANCELLED",
          cancelledAt,
        },
      },
      {
        new: true,
      },
    ).lean().exec() as ActiveTradeRecord | null;

    if (!cancelled) {
      throw new AppError("ActiveTrade can no longer be cancelled", 409);
    }

    await this.audit("ACTIVE_TRADE_CANCELLED", userId, cancelled._id, {
      before: this.toAuditActiveTradeSnapshot(activeTrade),
      after: this.toAuditActiveTradeSnapshot(cancelled),
    });
    await this.unregisterMonitoringSafely(cancelled);

    return cancelled;
  }

  private parseConfirmInput(input: ConfirmActualTradeInput): ParsedConfirmActualTradeInput {
    const parsed = confirmActualTradeSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError("Invalid actual trade confirmation payload", 400);
    }
    return parsed.data;
  }

  private async getUserTradeSetup(userId: string, tradeSetupId: string): Promise<TradeSetupRecord> {
    const tradeSetup = await this.getTradeSetupRepository().findOne({
      _id: toObjectId(tradeSetupId, "trade setup id"),
      userId: toObjectId(userId, "user id"),
    }).lean().exec() as TradeSetupRecord | null;

    if (!tradeSetup) {
      throw new AppError("TRADE_SETUP_NOT_FOUND", 404);
    }

    return tradeSetup;
  }

  private assertTradeSetupCanExecute(tradeSetup: TradeSetupRecord): void {
    if (tradeSetup.status === "EXECUTED" || tradeSetup.executedAt) {
      throw new AppError("TradeSetup already executed", 409);
    }
    if (tradeSetup.status !== "APPROVED") {
      throw new AppError("Only APPROVED TradeSetup can be executed", 409);
    }
    if (!isExecutionPermission(tradeSetup.finalPermission)) {
      throw new AppError(`TradeSetup permission ${tradeSetup.finalPermission} cannot be executed`, 409);
    }
  }

  private assertActualGeometry(
    direction: TradeDirection,
    input: ParsedConfirmActualTradeInput,
  ): void {
    const isValid = direction === "LONG"
      ? input.initialStopLoss < input.actualEntry && input.actualEntry < input.actualTarget1
      : input.actualTarget1 < input.actualEntry && input.actualEntry < input.initialStopLoss;

    if (!isValid) {
      throw new AppError(
        direction === "LONG" ? "INVALID_LONG_GEOMETRY" : "INVALID_SHORT_GEOMETRY",
        400,
      );
    }
  }

  private toAuditActiveTradeSnapshot(activeTrade: ActiveTradeRecord): Record<string, unknown> {
    return {
      tradePlanId: String(activeTrade.tradePlanId),
      tradeSetupId: String(activeTrade.tradeSetupId),
      symbolId: String(activeTrade.symbolId),
      direction: activeTrade.direction,
      actualEntry: activeTrade.actualEntry,
      actualQuantity: activeTrade.actualQuantity,
      initialStopLoss: activeTrade.initialStopLoss,
      actualTarget1: activeTrade.actualTarget1,
      actualRiskAmount: activeTrade.actualRiskAmount,
      actualRewardRiskRatio: activeTrade.actualRewardRiskRatio,
      executionSource: activeTrade.executionSource,
      executionQuality: activeTrade.executionQuality,
      ruleViolations: activeTrade.ruleViolations,
      finalPermissionAtExecution: activeTrade.finalPermissionAtExecution,
      riskModeAtExecution: activeTrade.riskModeAtExecution,
      status: activeTrade.status,
      openedAt: activeTrade.openedAt,
      cancelledAt: activeTrade.cancelledAt,
    };
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return Boolean(
      error
      && typeof error === "object"
      && "code" in error
      && error.code === 11000,
    );
  }

  private async audit(
    action: string,
    userId: string,
    entityId: Types.ObjectId | string,
    details: {
      before?: Record<string, unknown>;
      after?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void> {
    await this.getAuditLogService().record({
      userId,
      actorType: "USER",
      actorId: userId,
      action,
      entityType: "ACTIVE_TRADE",
      entityId: String(entityId),
      ...(details.before ? { before: details.before } : {}),
      ...(details.after ? { after: details.after } : {}),
      ...(details.metadata ? { metadata: details.metadata } : {}),
    });
  }

  private getTradeSetupRepository(): TradeSetupRepository {
    return this.dependencies.tradeSetupRepository ?? TradeSetupModel;
  }

  private getActiveTradeRepository(): ActiveTradeRepository {
    return this.dependencies.activeTradeRepository ?? ActiveTradeModel;
  }

  private getAuditLogService(): Pick<AuditLogService, "record"> {
    return this.dependencies.auditLogService ?? auditLogService;
  }

  private getSubscriptionService(): Pick<
    ActiveTradeSubscriptionService,
    "registerActiveTrade" | "unregisterActiveTrade"
  > {
    return this.dependencies.subscriptionService ?? sharedActiveTradeSubscriptionService;
  }

  private async registerMonitoringSafely(activeTrade: ActiveTradeRecord): Promise<void> {
    try {
      await this.getSubscriptionService().registerActiveTrade(activeTrade);
    } catch (error: unknown) {
      logger.warn(
        {
          event: "ACTIVE_TRADE_MONITORING_REGISTRATION_FAILED",
          activeTradeId: String(activeTrade._id),
          userId: String(activeTrade.userId),
          error: error instanceof Error ? error.message : "Unknown registration error",
        },
        "ActiveTrade created but live monitoring registration failed",
      );
    }
  }

  private async unregisterMonitoringSafely(activeTrade: ActiveTradeRecord): Promise<void> {
    try {
      await this.getSubscriptionService().unregisterActiveTrade(activeTrade);
    } catch (error: unknown) {
      logger.warn(
        {
          event: "ACTIVE_TRADE_MONITORING_UNREGISTRATION_FAILED",
          activeTradeId: String(activeTrade._id),
          userId: String(activeTrade.userId),
          error: error instanceof Error ? error.message : "Unknown unregistration error",
        },
        "ActiveTrade cancelled but live monitoring unregistration failed",
      );
    }
  }

  private getNow(): Date {
    return this.dependencies.now?.() ?? new Date();
  }
}
