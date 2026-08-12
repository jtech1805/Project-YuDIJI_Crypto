import pino from "pino";

import type { AuditLogService } from "../access/audit-log.service.js";
import { auditLogService } from "../access/audit-log.service.js";
import type { TradeEventRecord } from "./trade-event.service.js";

const logger = pino({ name: "trade-event-delivery-service" });

export type TradeEventCreatedPayload = {
  type: "TRADE_EVENT_CREATED";
  payload: {
    tradeEventId: string;
    activeTradeId: string;
    tradePlanId: string;
    tradeSetupId?: string;
    eventType: string;
    severity: string;
    symbolId: string;
    symbol: string;
    displayName: string;
    marketType: string;
    exchange: string;
    instrumentType: string;
    direction: string;
    price: number;
    currentR?: number;
    message: string;
    occurredAt: string;
  };
};

type UserEventEmitter = {
  emitToUser: (userId: string, payload: TradeEventCreatedPayload) => number;
};

type Dependencies = {
  emitter: UserEventEmitter;
  auditLogService: Pick<AuditLogService, "record">;
};

const optionalNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

export const buildTradeEventCreatedPayload = (
  event: TradeEventRecord,
): TradeEventCreatedPayload => {
  const snapshot =
    event.symbolSnapshot && typeof event.symbolSnapshot === "object"
      ? event.symbolSnapshot as Record<string, unknown>
      : {};
  const payload: TradeEventCreatedPayload["payload"] = {
    tradeEventId: String(event._id),
    activeTradeId: String(event.activeTradeId),
    tradePlanId: String(event.tradePlanId),
    eventType: event.eventType,
    severity: event.severity,
    symbolId: String(event.symbolId),
    symbol: String(snapshot.symbol ?? ""),
    displayName: String(snapshot.displayName ?? snapshot.symbol ?? ""),
    marketType: String(snapshot.marketType ?? ""),
    exchange: String(snapshot.exchange ?? ""),
    instrumentType: String(snapshot.instrumentType ?? ""),
    direction: event.direction,
    price: event.price,
    message: event.message,
    occurredAt: event.occurredAt.toISOString(),
  };
  if (event.tradeSetupId) payload.tradeSetupId = String(event.tradeSetupId);
  const currentR = optionalNumber(event.currentR);
  if (currentR !== undefined) payload.currentR = currentR;

  return { type: "TRADE_EVENT_CREATED", payload };
};

export class TradeEventDeliveryService {
  public constructor(private readonly dependencies: Partial<Dependencies> = {}) {}

  public async deliver(event: TradeEventRecord): Promise<void> {
    const userId = String(event.userId);
    const entityId = String(event._id);
    await this.safeAudit("TRADE_EVENT_DELIVERY_ATTEMPTED", userId, entityId, {
      eventType: event.eventType,
      activeTradeId: String(event.activeTradeId),
    });

    try {
      const payload = buildTradeEventCreatedPayload(event);
      const deliveredSocketCount = (await this.getEmitter()).emitToUser(userId, payload);
      await this.safeAudit("TRADE_EVENT_DELIVERED", userId, entityId, {
        eventType: event.eventType,
        deliveredSocketCount,
      });
    } catch (error: unknown) {
      logger.warn(
        {
          event: "TRADE_EVENT_DELIVERY_FAILED",
          tradeEventId: entityId,
          userId,
          error: error instanceof Error ? error.message : "Unknown delivery error",
        },
        "TradeEvent websocket delivery failed after persistence",
      );
      await this.safeAudit("TRADE_EVENT_DELIVERY_FAILED", userId, entityId, {
        eventType: event.eventType,
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : "TradeEvent delivery failed",
      });
    }
  }

  private async safeAudit(
    action: string,
    userId: string,
    entityId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.getAuditLogService().record({
        userId,
        actorType: "SYSTEM",
        actorId: "trade-event-delivery",
        action,
        entityType: "TRADE_EVENT",
        entityId,
        metadata,
      });
    } catch (error: unknown) {
      logger.warn(
        {
          event: "TRADE_EVENT_DELIVERY_AUDIT_FAILED",
          action,
          tradeEventId: entityId,
          error: error instanceof Error ? error.message : "Unknown audit error",
        },
        "TradeEvent delivery audit failed",
      );
    }
  }

  private async getEmitter(): Promise<UserEventEmitter> {
    if (this.dependencies.emitter) return this.dependencies.emitter;
    const { sharedWebsocketManager } = await import("./websocket.service.js");
    return sharedWebsocketManager;
  }

  private getAuditLogService(): Pick<AuditLogService, "record"> {
    return this.dependencies.auditLogService ?? auditLogService;
  }
}
