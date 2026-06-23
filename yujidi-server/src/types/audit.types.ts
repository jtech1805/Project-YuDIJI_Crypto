import type { Types } from "mongoose";

export const AUDIT_ACTOR_TYPES = [
  "USER",
  "SYSTEM",
  "WORKER",
  "BROKER_SYNC",
  "AI",
  "ADMIN",
] as const;
export type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number];

export const AUDIT_ENTITY_TYPES = [
  "USER",
  "SYMBOL",
  "BROKER_CONNECTION",
  "MONITOR",
  "ALERT",
  "TRADE_PLAN",
  "SCORE_CHECK",
  "TRADE_SETUP",
  "TRADE_SCORE_SNAPSHOT",
  "RISK_STATE",
  "ACTIVE_TRADE",
  "TRADE_EVENT",
  "TRADE_RESULT",
  "TRADE_JOURNAL",
  "AI_EXPLANATION",
  "RAG_DOCUMENT",
] as const;
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

export type AuditPayload = Record<string, unknown>;

export type CreateAuditLogInput = {
  userId?: string | Types.ObjectId;
  actorType: AuditActorType;
  actorId?: string;
  action: string;
  entityType: AuditEntityType;
  entityId: string;
  reasonCode?: string;
  correlationId?: string;
  causationId?: string;
  idempotencyKey?: string;
  before?: AuditPayload;
  after?: AuditPayload;
  metadata?: AuditPayload;
  ipAddress?: string;
  userAgent?: string;
};
