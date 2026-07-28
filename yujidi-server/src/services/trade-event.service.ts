import { Types, isValidObjectId } from "mongoose";
import pino from "pino";

import { AppError } from "../errors/AppError.js";
import { TradeEventModel } from "../models/trade-event.model.js";
import type {
  MonitoringEventSeverity,
  TradeEventSource,
  TradeEventType,
} from "../types/monitoring.types.js";
import type { TradeDirection } from "../types/trade.types.js";
import { auditLogService, type AuditLogService } from "./audit-log.service.js";
import { TradeEventDeliveryService } from "./trade-event-delivery.service.js";

const logger = pino({ name: "trade-event-service" });

type QueryExec<T> = {
  exec: () => Promise<T>;
};

type LeanQueryExec<T> = {
  lean: () => QueryExec<T>;
};

type SortableLeanQueryExec<T> = {
  sort: (sort: Record<string, 1 | -1>) => LeanQueryExec<T>;
};

type TradeEventRepository = {
  create: (input: Record<string, unknown>) => Promise<unknown>;
  find: (filter: Record<string, unknown>) => SortableLeanQueryExec<unknown[]>;
  findOne: (filter: Record<string, unknown>) => LeanQueryExec<unknown | null>;
};

type TradeEventServiceDependencies = {
  tradeEventRepository: TradeEventRepository;
  auditLogService: Pick<AuditLogService, "record">;
  deliveryService: Pick<TradeEventDeliveryService, "deliver">;
};

export type CreateTradeEventInput = {
  userId: string;
  tradePlanId: string;
  activeTradeId: string;
  tradeSetupId?: string;
  symbolId: string;
  symbolSnapshot: Record<string, unknown>;
  eventType: TradeEventType;
  severity: MonitoringEventSeverity;
  source: TradeEventSource;
  direction: TradeDirection;
  price: number;
  previousPrice?: number;
  currentR?: number;
  distanceToStopLossPercent?: number;
  distanceToTarget1Percent?: number;
  reasonCodes: string[];
  message: string;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
  occurredAt: Date;
};

export type TradeEventRecord = CreateTradeEventInput & {
  _id: Types.ObjectId | string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type CreateTradeEventResult = {
  event: TradeEventRecord;
  created: boolean;
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

export class TradeEventService {
  public constructor(private readonly dependencies: Partial<TradeEventServiceDependencies> = {}) {}

  public async createIdempotently(input: CreateTradeEventInput): Promise<CreateTradeEventResult> {
    if (input.idempotencyKey) {
      const existing = await this.findByIdempotencyKey(input.idempotencyKey);
      if (existing) {
        await this.auditDeduped(input, existing);
        return { event: existing, created: false };
      }
    }

    try {
      const event = normalizeRecord<TradeEventRecord>(await this.getTradeEventRepository().create({
        userId: toObjectId(input.userId, "user id"),
        tradePlanId: toObjectId(input.tradePlanId, "trade plan id"),
        activeTradeId: toObjectId(input.activeTradeId, "active trade id"),
        ...(input.tradeSetupId
          ? { tradeSetupId: toObjectId(input.tradeSetupId, "trade setup id") }
          : {}),
        symbolId: toObjectId(input.symbolId, "symbol id"),
        symbolSnapshot: input.symbolSnapshot,
        eventType: input.eventType,
        severity: input.severity,
        source: input.source,
        direction: input.direction,
        price: input.price,
        ...(input.previousPrice !== undefined ? { previousPrice: input.previousPrice } : {}),
        ...(input.currentR !== undefined ? { currentR: input.currentR } : {}),
        ...(input.distanceToStopLossPercent !== undefined
          ? { distanceToStopLossPercent: input.distanceToStopLossPercent }
          : {}),
        ...(input.distanceToTarget1Percent !== undefined
          ? { distanceToTarget1Percent: input.distanceToTarget1Percent }
          : {}),
        reasonCodes: input.reasonCodes,
        message: input.message,
        ...(input.metadata ? { metadata: input.metadata } : {}),
        ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
        occurredAt: input.occurredAt,
      }));

      await this.getAuditLogService().record({
        userId: input.userId,
        actorType: input.source === "MANUAL_EVALUATION" ? "USER" : "SYSTEM",
        action: "TRADE_EVENT_CREATED",
        entityType: "TRADE_EVENT",
        entityId: String(event._id),
        after: {
          activeTradeId: input.activeTradeId,
          eventType: input.eventType,
          severity: input.severity,
          source: input.source,
          price: input.price,
          currentR: input.currentR,
          idempotencyKey: input.idempotencyKey,
          occurredAt: input.occurredAt,
        },
      });
      try {
        await this.getDeliveryService().deliver(event);
      } catch (error: unknown) {
        logger.warn(
          {
            event: "TRADE_EVENT_DELIVERY_UNEXPECTED_FAILURE",
            tradeEventId: String(event._id),
            userId: input.userId,
            error: error instanceof Error ? error.message : "Unknown delivery error",
          },
          "TradeEvent persisted but delivery service unexpectedly failed",
        );
      }

      return { event, created: true };
    } catch (error: unknown) {
      if (input.idempotencyKey && this.isDuplicateKeyError(error)) {
        const existing = await this.findByIdempotencyKey(input.idempotencyKey);
        if (existing) {
          await this.auditDeduped(input, existing);
          return { event: existing, created: false };
        }
      }
      throw error;
    }
  }

  public async listTradeEvents(userId: string): Promise<TradeEventRecord[]> {
    return this.getTradeEventRepository().find({
      userId: toObjectId(userId, "user id"),
    }).sort({ createdAt: -1 }).lean().exec() as Promise<TradeEventRecord[]>;
  }

  public async listTradeEventsForPlan(userId: string, tradePlanId: string): Promise<TradeEventRecord[]> {
    return this.getTradeEventRepository().find({
      userId: toObjectId(userId, "user id"),
      tradePlanId: toObjectId(tradePlanId, "trade plan id"),
    }).sort({ createdAt: -1 }).lean().exec() as Promise<TradeEventRecord[]>;
  }

  public async listActiveTradeEvents(userId: string, activeTradeId: string): Promise<TradeEventRecord[]> {
    return this.getTradeEventRepository().find({
      userId: toObjectId(userId, "user id"),
      activeTradeId: toObjectId(activeTradeId, "active trade id"),
    }).sort({ createdAt: -1 }).lean().exec() as Promise<TradeEventRecord[]>;
  }

  public async getTradeEvent(userId: string, tradeEventId: string): Promise<TradeEventRecord> {
    const event = await this.getTradeEventRepository().findOne({
      _id: toObjectId(tradeEventId, "trade event id"),
      userId: toObjectId(userId, "user id"),
    }).lean().exec() as TradeEventRecord | null;

    if (!event) {
      throw new AppError("TRADE_EVENT_NOT_FOUND", 404);
    }

    return event;
  }

  private async findByIdempotencyKey(idempotencyKey: string): Promise<TradeEventRecord | null> {
    return this.getTradeEventRepository().findOne({
      idempotencyKey,
    }).lean().exec() as Promise<TradeEventRecord | null>;
  }

  private async auditDeduped(input: CreateTradeEventInput, existing: TradeEventRecord): Promise<void> {
    await this.getAuditLogService().record({
      userId: input.userId,
      actorType: input.source === "MANUAL_EVALUATION" ? "USER" : "SYSTEM",
      action: "TRADE_EVENT_DEDUPED",
      entityType: "TRADE_EVENT",
      entityId: String(existing._id),
      metadata: {
        activeTradeId: input.activeTradeId,
        eventType: input.eventType,
        idempotencyKey: input.idempotencyKey,
      },
    });
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return Boolean(
      error
      && typeof error === "object"
      && "code" in error
      && error.code === 11000,
    );
  }

  private getTradeEventRepository(): TradeEventRepository {
    return this.dependencies.tradeEventRepository ?? TradeEventModel;
  }

  private getAuditLogService(): Pick<AuditLogService, "record"> {
    return this.dependencies.auditLogService ?? auditLogService;
  }

  private getDeliveryService(): Pick<TradeEventDeliveryService, "deliver"> {
    return this.dependencies.deliveryService ?? new TradeEventDeliveryService();
  }
}
