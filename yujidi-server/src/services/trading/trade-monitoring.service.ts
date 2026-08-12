import { Types, isValidObjectId } from "mongoose";
import { z } from "zod";

import { AppError } from "../../errors/AppError.js";
import { ActiveTradeModel } from "../../models/active-trade.model.js";
import {
  TRADE_EVENT_SOURCES,
  type MonitoringEventSeverity,
  type TradeEventSource,
  type TradeEventType,
} from "../../types/monitoring.types.js";
import type { ActiveTradeStatus, TradeDirection } from "../../types/trade.types.js";
import { auditLogService, type AuditLogService } from "../access/audit-log.service.js";
import {
  TradeEventService,
  type CreateTradeEventInput,
  type TradeEventRecord,
} from "./trade-event.service.js";

export const evaluateActiveTradeSchema = z.object({
  price: z.number().positive(),
  source: z.enum(TRADE_EVENT_SOURCES).optional().default("MANUAL_EVALUATION"),
  occurredAt: z.coerce.date().optional(),
});

export type EvaluateActiveTradeInput = z.input<typeof evaluateActiveTradeSchema>;
type ParsedEvaluateActiveTradeInput = z.output<typeof evaluateActiveTradeSchema>;

type QueryExec<T> = {
  exec: () => Promise<T>;
};

type LeanQueryExec<T> = {
  lean: () => QueryExec<T>;
};

type ActiveTradeRepository = {
  findOne: (filter: Record<string, unknown>) => LeanQueryExec<unknown | null>;
};

type TradeMonitoringServiceDependencies = {
  activeTradeRepository: ActiveTradeRepository;
  tradeEventService: Pick<TradeEventService, "createIdempotently">;
  auditLogService: Pick<AuditLogService, "record">;
  now: () => Date;
  nearStopThresholdPercent: number;
};

type MonitoredActiveTrade = {
  _id: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  tradePlanId: Types.ObjectId | string;
  tradeSetupId?: Types.ObjectId | string;
  symbolId: Types.ObjectId | string;
  symbolSnapshot: Record<string, unknown>;
  direction: TradeDirection;
  actualEntry: number;
  currentStopLoss: number;
  actualTarget1: number;
  actualTarget2?: number;
  actualRiskPerUnit: number;
  status: ActiveTradeStatus;
};

type DetectedEvent = {
  eventType: TradeEventType;
  severity: MonitoringEventSeverity;
  reasonCodes: string[];
  message: string;
};

export type ActiveTradeEvaluationResult = {
  activeTradeId: string;
  price: number;
  currentR: number;
  distanceToStopLossPercent: number;
  distanceToTarget1Percent: number;
  events: TradeEventRecord[];
  dedupedEventTypes: TradeEventType[];
  evaluatedAt: Date;
};

const toObjectId = (value: string, label: string): Types.ObjectId => {
  if (!isValidObjectId(value)) {
    throw new AppError(`Invalid ${label}`, 400);
  }
  return new Types.ObjectId(value);
};

const roundMetric = (value: number): number => Number(value.toFixed(4));

export const calculateCurrentR = (input: {
  direction: TradeDirection;
  price: number;
  actualEntry: number;
  actualRiskPerUnit: number;
}): number => {
  const movement = input.direction === "LONG"
    ? input.price - input.actualEntry
    : input.actualEntry - input.price;
  return roundMetric(movement / input.actualRiskPerUnit);
};

export class TradeMonitoringService {
  public constructor(private readonly dependencies: Partial<TradeMonitoringServiceDependencies> = {}) {}

  public async evaluateActiveTrade(
    userId: string,
    activeTradeId: string,
    input: EvaluateActiveTradeInput,
  ): Promise<ActiveTradeEvaluationResult> {
    const parsedInput = this.parseEvaluationInput(input);
    const activeTrade = await this.getUserActiveTrade(userId, activeTradeId);
    if (!["ACTIVE", "PARTIALLY_EXITED"].includes(activeTrade.status)) {
      throw new AppError("ActiveTrade is not eligible for monitoring", 409);
    }
    if (!(activeTrade.actualRiskPerUnit > 0)) {
      throw new AppError("ActiveTrade actual risk is invalid", 409);
    }

    const evaluatedAt = parsedInput.occurredAt ?? this.getNow();
    const currentR = calculateCurrentR({
      direction: activeTrade.direction,
      price: parsedInput.price,
      actualEntry: activeTrade.actualEntry,
      actualRiskPerUnit: activeTrade.actualRiskPerUnit,
    });
    const distanceToStopLossPercent = this.calculateDistancePercent(
      parsedInput.price,
      activeTrade.currentStopLoss,
    );
    const distanceToTarget1Percent = this.calculateDistancePercent(
      parsedInput.price,
      activeTrade.actualTarget1,
    );
    const detectedEvents = this.detectEvents(
      activeTrade,
      parsedInput.price,
      currentR,
      distanceToStopLossPercent,
    );

    const events: TradeEventRecord[] = [];
    const dedupedEventTypes: TradeEventType[] = [];
    for (const detectedEvent of detectedEvents) {
      const result = await this.getTradeEventService().createIdempotently(
        this.buildTradeEventInput({
          activeTrade,
          detectedEvent,
          price: parsedInput.price,
          source: parsedInput.source,
          currentR,
          distanceToStopLossPercent,
          distanceToTarget1Percent,
          occurredAt: evaluatedAt,
        }),
      );
      if (result.created) {
        events.push(result.event);
      } else {
        dedupedEventTypes.push(detectedEvent.eventType);
      }
    }

    await this.getAuditLogService().record({
      userId,
      actorType: parsedInput.source === "MANUAL_EVALUATION" ? "USER" : "SYSTEM",
      action: "TRADE_MONITORING_EVALUATED",
      entityType: "ACTIVE_TRADE",
      entityId: activeTradeId,
      metadata: {
        source: parsedInput.source,
        price: parsedInput.price,
        currentR,
        detectedEventTypes: detectedEvents.map((event) => event.eventType),
        createdEventTypes: events.map((event) => event.eventType),
        dedupedEventTypes,
        evaluatedAt,
      },
    });

    return {
      activeTradeId,
      price: parsedInput.price,
      currentR,
      distanceToStopLossPercent,
      distanceToTarget1Percent,
      events,
      dedupedEventTypes,
      evaluatedAt,
    };
  }

  private detectEvents(
    activeTrade: MonitoredActiveTrade,
    price: number,
    currentR: number,
    distanceToStopLossPercent: number,
  ): DetectedEvent[] {
    const events: DetectedEvent[] = [];
    const isLong = activeTrade.direction === "LONG";
    const stopHit = isLong
      ? price <= activeTrade.currentStopLoss
      : price >= activeTrade.currentStopLoss;
    const target1Hit = isLong
      ? price >= activeTrade.actualTarget1
      : price <= activeTrade.actualTarget1;
    const target2Hit = activeTrade.actualTarget2 !== undefined && (
      isLong ? price >= activeTrade.actualTarget2 : price <= activeTrade.actualTarget2
    );
    const nearStop = !stopHit && (
      isLong ? price > activeTrade.currentStopLoss : price < activeTrade.currentStopLoss
    ) && distanceToStopLossPercent <= this.getNearStopThresholdPercent();

    if (stopHit) {
      events.push({
        eventType: "SL_HIT",
        severity: "CRITICAL",
        reasonCodes: ["CURRENT_STOPLOSS_REACHED"],
        message: `Price reached the current stoploss for this ${activeTrade.direction} trade.`,
      });
    }
    if (target2Hit) {
      events.push({
        eventType: "TARGET_2_HIT",
        severity: "INFO",
        reasonCodes: ["ACTUAL_TARGET_2_REACHED"],
        message: "Price reached actual target 2.",
      });
    }
    if (target1Hit) {
      events.push({
        eventType: "TARGET_1_HIT",
        severity: "INFO",
        reasonCodes: ["ACTUAL_TARGET_1_REACHED"],
        message: "Price reached actual target 1.",
      });
    }
    if (currentR >= 1) {
      events.push({
        eventType: "PLUS_ONE_R_HIT",
        severity: "INFO",
        reasonCodes: ["CURRENT_R_AT_LEAST_ONE"],
        message: "Trade reached at least +1R.",
      });
    }
    if (nearStop) {
      events.push({
        eventType: "PRICE_NEAR_SL",
        severity: "WARNING",
        reasonCodes: ["PRICE_WITHIN_NEAR_STOP_THRESHOLD"],
        message: "Price is near the current stoploss.",
      });
    }

    return events;
  }

  private buildTradeEventInput(input: {
    activeTrade: MonitoredActiveTrade;
    detectedEvent: DetectedEvent;
    price: number;
    source: TradeEventSource;
    currentR: number;
    distanceToStopLossPercent: number;
    distanceToTarget1Percent: number;
    occurredAt: Date;
  }): CreateTradeEventInput {
    const activeTradeId = String(input.activeTrade._id);
    return {
      userId: String(input.activeTrade.userId),
      tradePlanId: String(input.activeTrade.tradePlanId),
      activeTradeId,
      ...(input.activeTrade.tradeSetupId
        ? { tradeSetupId: String(input.activeTrade.tradeSetupId) }
        : {}),
      symbolId: String(input.activeTrade.symbolId),
      symbolSnapshot: input.activeTrade.symbolSnapshot,
      eventType: input.detectedEvent.eventType,
      severity: input.detectedEvent.severity,
      source: input.source,
      direction: input.activeTrade.direction,
      price: input.price,
      currentR: input.currentR,
      distanceToStopLossPercent: input.distanceToStopLossPercent,
      distanceToTarget1Percent: input.distanceToTarget1Percent,
      reasonCodes: input.detectedEvent.reasonCodes,
      message: input.detectedEvent.message,
      idempotencyKey: `${activeTradeId}:${input.detectedEvent.eventType}`,
      occurredAt: input.occurredAt,
    };
  }

  private parseEvaluationInput(input: EvaluateActiveTradeInput): ParsedEvaluateActiveTradeInput {
    const parsed = evaluateActiveTradeSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError("Invalid ActiveTrade evaluation payload", 400);
    }
    return parsed.data;
  }

  private async getUserActiveTrade(userId: string, activeTradeId: string): Promise<MonitoredActiveTrade> {
    const activeTrade = await this.getActiveTradeRepository().findOne({
      _id: toObjectId(activeTradeId, "active trade id"),
      userId: toObjectId(userId, "user id"),
    }).lean().exec() as MonitoredActiveTrade | null;

    if (!activeTrade) {
      throw new AppError("ACTIVE_TRADE_NOT_FOUND", 404);
    }

    return activeTrade;
  }

  private calculateDistancePercent(price: number, level: number): number {
    return roundMetric((Math.abs(price - level) / price) * 100);
  }

  private getActiveTradeRepository(): ActiveTradeRepository {
    return this.dependencies.activeTradeRepository ?? ActiveTradeModel;
  }

  private getTradeEventService(): Pick<TradeEventService, "createIdempotently"> {
    return this.dependencies.tradeEventService ?? new TradeEventService();
  }

  private getAuditLogService(): Pick<AuditLogService, "record"> {
    return this.dependencies.auditLogService ?? auditLogService;
  }

  private getNow(): Date {
    return this.dependencies.now?.() ?? new Date();
  }

  private getNearStopThresholdPercent(): number {
    return this.dependencies.nearStopThresholdPercent ?? 0.5;
  }
}
