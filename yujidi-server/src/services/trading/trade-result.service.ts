import { Types, isValidObjectId } from "mongoose";
import pino from "pino";
import { z } from "zod";

import { AppError } from "../../errors/AppError.js";
import { ActiveTradeModel } from "../../models/active-trade.model.js";
import { TradeResultModel } from "../../models/trade-result.model.js";
import type { InstrumentType, MarketType } from "../../types/market-data.types.js";
import { PNL_BASES, type PnlBasis } from "../../types/risk.types.js";
import {
  COST_COMPONENT_TYPES,
  TRADE_EXIT_REASONS,
  type ActiveTradeStatus,
  type CostComponentType,
  type TradeDirection,
  type TradeExitReason,
  type TradeResultProjectionStatus,
  type TradeResultStatus,
  type TradeResultType,
} from "../../types/trade.types.js";
import { auditLogService, type AuditLogService } from "../access/audit-log.service.js";
import {
  sharedActiveTradeSubscriptionService,
  type ActiveTradeSubscriptionService,
} from "./active-trade-subscription.service.js";
import {
  getDateKeyInTimezone,
  RiskStateProjectionService,
  type RiskProjectionResult,
} from "./risk-state-projection.service.js";

const logger = pino({ name: "trade-result-service" });

const costComponentSchema = z.object({
  type: z.enum(COST_COMPONENT_TYPES),
  amount: z.number().nonnegative(),
  currency: z.string().min(1).max(12).transform((value) => value.trim().toUpperCase()),
  isEstimated: z.boolean().optional().default(false),
  source: z.string().max(120).optional(),
});

export const closeActiveTradeSchema = z.object({
  exitPrice: z.number().positive(),
  exitQuantity: z.number().positive().optional(),
  exitReason: z.enum(TRADE_EXIT_REASONS),
  grossPnl: z.number().optional(),
  netPnl: z.number().optional(),
  chargesTotal: z.number().nonnegative().optional(),
  costComponents: z.array(costComponentSchema).max(50).optional(),
  exitNotes: z.string().max(2000).optional(),
  closedAt: z.coerce.date().optional(),
  timezone: z.string().min(1).max(100).optional().default("UTC"),
});

export type CloseActiveTradeInput = z.input<typeof closeActiveTradeSchema>;
type ParsedCloseActiveTradeInput = z.output<typeof closeActiveTradeSchema>;

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

type ActiveTradeRepository = {
  findOne: (filter: Record<string, unknown>) => LeanQueryExec<unknown | null>;
  findOneAndUpdate: (
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options: Record<string, unknown>,
  ) => LeanQueryExec<unknown | null>;
};

type TradeResultRepository = {
  create: (input: Record<string, unknown>) => Promise<unknown>;
  find: (filter: Record<string, unknown>) => SortableLeanQueryExec<unknown[]>;
  findOne: (filter: Record<string, unknown>) => LeanQueryExec<unknown | null>;
  deleteOne: (filter: Record<string, unknown>) => DeleteQueryExec;
};

type TradeResultServiceDependencies = {
  activeTradeRepository: ActiveTradeRepository;
  tradeResultRepository: TradeResultRepository;
  riskStateProjectionService: Pick<RiskStateProjectionService, "applyFinalizedTradeResult">;
  auditLogService: Pick<AuditLogService, "record">;
  subscriptionService: Pick<ActiveTradeSubscriptionService, "unregisterActiveTrade">;
  now: () => Date;
};

type ClosableActiveTrade = {
  _id: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  tradePlanId: Types.ObjectId | string;
  tradeSetupId: Types.ObjectId | string;
  symbolId: Types.ObjectId | string;
  symbolSnapshot: Record<string, unknown>;
  marketType: MarketType;
  tradeStyle: string;
  instrumentType: InstrumentType;
  direction: TradeDirection;
  actualEntry: number;
  remainingQuantity: number;
  actualRiskAmount: number;
  status: ActiveTradeStatus;
  closedAt?: Date;
};

export type CostComponent = {
  type: CostComponentType;
  amount: number;
  currency: string;
  isEstimated: boolean;
  source?: string | undefined;
};

export type TradeResultRecord = {
  _id: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  tradePlanId: Types.ObjectId | string;
  tradeSetupId: Types.ObjectId | string;
  activeTradeId: Types.ObjectId | string;
  symbolId: Types.ObjectId | string;
  symbolSnapshot: Record<string, unknown>;
  marketType: MarketType;
  tradeStyle: string;
  instrumentType: InstrumentType;
  direction: TradeDirection;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  grossPnl: number;
  chargesTotal?: number;
  netPnl?: number;
  realizedPnlUsedForRisk: number;
  pnlBasis: PnlBasis;
  realizedR: number;
  resultType: TradeResultType;
  exitReason: TradeExitReason;
  exitNotes?: string;
  costComponents: CostComponent[];
  status: TradeResultStatus;
  projectionStatus: TradeResultProjectionStatus;
  projectedAt?: Date;
  resultVersion: number;
  closedAt: Date;
  timezone: string;
  reasonCodes: string[];
  warnings: string[];
};

export type TradeResultCalculation = {
  grossPnl: number;
  chargesTotal?: number;
  netPnl?: number;
  realizedPnlUsedForRisk: number;
  pnlBasis: PnlBasis;
  realizedR: number;
  resultType: TradeResultType;
  reasonCodes: string[];
  warnings: string[];
};

export type CloseActiveTradeResult = {
  tradeResult: TradeResultRecord;
  projection: RiskProjectionResult;
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

const roundMoney = (value: number): number => Number(value.toFixed(4));

const getResultType = (realizedPnl: number): TradeResultType => {
  if (realizedPnl > 0) return "WIN";
  if (realizedPnl < 0) return "LOSS";
  return "BREAKEVEN";
};

export const calculateTradeResult = (input: {
  direction: TradeDirection;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  actualRiskAmount: number;
  grossPnl?: number;
  netPnl?: number;
  chargesTotal?: number;
  costComponents?: CostComponent[];
}): TradeResultCalculation => {
  const calculatedGrossPnl = input.direction === "LONG"
    ? (input.exitPrice - input.entryPrice) * input.quantity
    : (input.entryPrice - input.exitPrice) * input.quantity;
  const grossPnl = roundMoney(input.grossPnl ?? calculatedGrossPnl);
  const componentCharges = input.costComponents?.reduce((total, component) => total + component.amount, 0);
  const chargesTotal = input.chargesTotal ?? componentCharges;
  const reasonCodes = ["TRADE_RESULT_FINALIZED"];
  const warnings: string[] = [];

  let netPnl: number | undefined;
  let realizedPnlUsedForRisk: number;
  let pnlBasis: PnlBasis;

  if (input.netPnl !== undefined) {
    netPnl = roundMoney(input.netPnl);
    realizedPnlUsedForRisk = netPnl;
    pnlBasis = "CONFIRMED_NET";
    reasonCodes.push("CONFIRMED_NET_PNL_USED");
  } else if (chargesTotal !== undefined) {
    netPnl = roundMoney(grossPnl - chargesTotal);
    realizedPnlUsedForRisk = netPnl;
    pnlBasis = "ESTIMATED_NET";
    reasonCodes.push("ESTIMATED_NET_PNL_USED");
  } else {
    realizedPnlUsedForRisk = grossPnl;
    pnlBasis = "GROSS_FALLBACK";
    reasonCodes.push("GROSS_PNL_FALLBACK_USED");
    warnings.push("Net P&L and charges were unavailable; risk projection uses gross P&L.");
  }

  const realizedR = roundMoney(realizedPnlUsedForRisk / input.actualRiskAmount);
  return {
    grossPnl,
    ...(chargesTotal !== undefined ? { chargesTotal: roundMoney(chargesTotal) } : {}),
    ...(netPnl !== undefined ? { netPnl } : {}),
    realizedPnlUsedForRisk,
    pnlBasis,
    realizedR,
    resultType: getResultType(realizedPnlUsedForRisk),
    reasonCodes,
    warnings,
  };
};

export class TradeResultService {
  public constructor(private readonly dependencies: Partial<TradeResultServiceDependencies> = {}) {}

  public async closeActiveTrade(
    userId: string,
    activeTradeId: string,
    input: CloseActiveTradeInput,
  ): Promise<CloseActiveTradeResult> {
    const parsedInput = this.parseCloseInput(input);
    const activeTrade = await this.getUserActiveTrade(userId, activeTradeId);
    if (!["ACTIVE", "PARTIALLY_EXITED"].includes(activeTrade.status)) {
      throw new AppError("ActiveTrade is not eligible for close", 409);
    }
    if (!(activeTrade.actualRiskAmount > 0)) {
      throw new AppError("ActiveTrade actual risk amount is invalid", 409);
    }
    const exitQuantity = parsedInput.exitQuantity ?? activeTrade.remainingQuantity;
    if (exitQuantity > activeTrade.remainingQuantity) {
      throw new AppError("exitQuantity exceeds remainingQuantity", 400);
    }
    if (Math.abs(exitQuantity - activeTrade.remainingQuantity) > 0.0000001) {
      throw new AppError("Partial close is not supported in Phase 7", 409);
    }

    const existing = await this.getTradeResultRepository().findOne({
      activeTradeId: toObjectId(activeTradeId, "active trade id"),
    }).lean().exec();
    if (existing) {
      throw new AppError("ActiveTrade already has a TradeResult", 409);
    }

    const closedAt = parsedInput.closedAt ?? this.getNow();
    getDateKeyInTimezone(closedAt, parsedInput.timezone);
    const costComponents = parsedInput.costComponents ?? [];
    const calculation = calculateTradeResult({
      direction: activeTrade.direction,
      entryPrice: activeTrade.actualEntry,
      exitPrice: parsedInput.exitPrice,
      quantity: exitQuantity,
      actualRiskAmount: activeTrade.actualRiskAmount,
      ...(parsedInput.grossPnl !== undefined ? { grossPnl: parsedInput.grossPnl } : {}),
      ...(parsedInput.netPnl !== undefined ? { netPnl: parsedInput.netPnl } : {}),
      ...(parsedInput.chargesTotal !== undefined ? { chargesTotal: parsedInput.chargesTotal } : {}),
      ...(costComponents.length > 0 ? { costComponents } : {}),
    });

    let tradeResult: TradeResultRecord;
    try {
      tradeResult = normalizeRecord<TradeResultRecord>(await this.getTradeResultRepository().create({
        userId: toObjectId(userId, "user id"),
        tradePlanId: toObjectId(String(activeTrade.tradePlanId), "trade plan id"),
        tradeSetupId: toObjectId(String(activeTrade.tradeSetupId), "trade setup id"),
        activeTradeId: toObjectId(activeTradeId, "active trade id"),
        symbolId: toObjectId(String(activeTrade.symbolId), "symbol id"),
        symbolSnapshot: activeTrade.symbolSnapshot,
        marketType: activeTrade.marketType,
        tradeStyle: activeTrade.tradeStyle,
        instrumentType: activeTrade.instrumentType,
        direction: activeTrade.direction,
        entryPrice: activeTrade.actualEntry,
        exitPrice: parsedInput.exitPrice,
        quantity: exitQuantity,
        ...calculation,
        exitReason: parsedInput.exitReason,
        ...(parsedInput.exitNotes ? { exitNotes: parsedInput.exitNotes } : {}),
        costComponents,
        status: "FINALIZED",
        projectionStatus: "PENDING",
        resultVersion: 1,
        closedAt,
        timezone: parsedInput.timezone,
      }));
    } catch (error: unknown) {
      if (this.isDuplicateKeyError(error)) {
        throw new AppError("ActiveTrade already has a TradeResult", 409);
      }
      throw error;
    }

    const nextStatus: ActiveTradeStatus = parsedInput.exitReason === "STOPLOSS"
      ? "STOPPED_OUT"
      : "CLOSED";
    const closedTrade = await this.getActiveTradeRepository().findOneAndUpdate(
      {
        _id: toObjectId(activeTradeId, "active trade id"),
        userId: toObjectId(userId, "user id"),
        status: { $in: ["ACTIVE", "PARTIALLY_EXITED"] },
      },
      {
        $set: {
          status: nextStatus,
          remainingQuantity: 0,
          closedAt,
        },
      },
      { new: true },
    ).lean().exec();

    if (!closedTrade) {
      await this.getTradeResultRepository().deleteOne({ _id: tradeResult._id }).exec();
      throw new AppError("ActiveTrade can no longer be closed", 409);
    }
    try {
      await this.getSubscriptionService().unregisterActiveTrade(activeTradeId);
    } catch (error: unknown) {
      logger.warn(
        {
          event: "ACTIVE_TRADE_MONITORING_UNREGISTRATION_FAILED",
          activeTradeId,
          userId,
          error: error instanceof Error ? error.message : "Unknown unregistration error",
        },
        "ActiveTrade closed but live monitoring unregistration failed",
      );
    }

    await this.getAuditLogService().record({
      userId,
      actorType: "USER",
      actorId: userId,
      action: "TRADE_RESULT_FINALIZED",
      entityType: "TRADE_RESULT",
      entityId: String(tradeResult._id),
      after: {
        activeTradeId,
        tradePlanId: String(activeTrade.tradePlanId),
        grossPnl: tradeResult.grossPnl,
        netPnl: tradeResult.netPnl,
        realizedPnlUsedForRisk: tradeResult.realizedPnlUsedForRisk,
        pnlBasis: tradeResult.pnlBasis,
        realizedR: tradeResult.realizedR,
        resultType: tradeResult.resultType,
        exitReason: tradeResult.exitReason,
        status: tradeResult.status,
      },
    });

    const projection = await this.getRiskStateProjectionService().applyFinalizedTradeResult(
      userId,
      String(tradeResult._id),
    );
    const projectedTradeResult = await this.getActiveTradeResult(userId, activeTradeId);
    return { tradeResult: projectedTradeResult, projection };
  }

  public async listTradeResults(userId: string): Promise<TradeResultRecord[]> {
    return this.getTradeResultRepository().find({
      userId: toObjectId(userId, "user id"),
    }).sort({ createdAt: -1 }).lean().exec() as Promise<TradeResultRecord[]>;
  }

  public async listTradeResultsForPlan(userId: string, tradePlanId: string): Promise<TradeResultRecord[]> {
    return this.getTradeResultRepository().find({
      userId: toObjectId(userId, "user id"),
      tradePlanId: toObjectId(tradePlanId, "trade plan id"),
    }).sort({ createdAt: -1 }).lean().exec() as Promise<TradeResultRecord[]>;
  }

  public async getTradeResult(userId: string, tradeResultId: string): Promise<TradeResultRecord> {
    const result = await this.getTradeResultRepository().findOne({
      _id: toObjectId(tradeResultId, "trade result id"),
      userId: toObjectId(userId, "user id"),
    }).lean().exec() as TradeResultRecord | null;
    if (!result) throw new AppError("TRADE_RESULT_NOT_FOUND", 404);
    return result;
  }

  public async getActiveTradeResult(userId: string, activeTradeId: string): Promise<TradeResultRecord> {
    const result = await this.getTradeResultRepository().findOne({
      activeTradeId: toObjectId(activeTradeId, "active trade id"),
      userId: toObjectId(userId, "user id"),
    }).lean().exec() as TradeResultRecord | null;
    if (!result) throw new AppError("TRADE_RESULT_NOT_FOUND", 404);
    return result;
  }

  private parseCloseInput(input: CloseActiveTradeInput): ParsedCloseActiveTradeInput {
    const parsed = closeActiveTradeSchema.safeParse(input);
    if (!parsed.success) throw new AppError("Invalid ActiveTrade close payload", 400);
    return parsed.data;
  }

  private async getUserActiveTrade(userId: string, activeTradeId: string): Promise<ClosableActiveTrade> {
    const activeTrade = await this.getActiveTradeRepository().findOne({
      _id: toObjectId(activeTradeId, "active trade id"),
      userId: toObjectId(userId, "user id"),
    }).lean().exec() as ClosableActiveTrade | null;
    if (!activeTrade) throw new AppError("ACTIVE_TRADE_NOT_FOUND", 404);
    return activeTrade;
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return Boolean(error && typeof error === "object" && "code" in error && error.code === 11000);
  }

  private getActiveTradeRepository(): ActiveTradeRepository {
    return this.dependencies.activeTradeRepository ?? ActiveTradeModel;
  }

  private getTradeResultRepository(): TradeResultRepository {
    return this.dependencies.tradeResultRepository ?? TradeResultModel;
  }

  private getRiskStateProjectionService(): Pick<RiskStateProjectionService, "applyFinalizedTradeResult"> {
    return this.dependencies.riskStateProjectionService ?? new RiskStateProjectionService();
  }

  private getAuditLogService(): Pick<AuditLogService, "record"> {
    return this.dependencies.auditLogService ?? auditLogService;
  }

  private getSubscriptionService(): Pick<ActiveTradeSubscriptionService, "unregisterActiveTrade"> {
    return this.dependencies.subscriptionService ?? sharedActiveTradeSubscriptionService;
  }

  private getNow(): Date {
    return this.dependencies.now?.() ?? new Date();
  }
}
