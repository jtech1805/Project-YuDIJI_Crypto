import { model, Schema, type InferSchemaType } from "mongoose";

import {
  AUDIT_ACTOR_TYPES,
  AUDIT_ENTITY_TYPES,
} from "../types/audit.types.js";

const auditLogSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    actorType: {
      type: String,
      enum: AUDIT_ACTOR_TYPES,
      required: true,
      index: true,
    },
    actorId: {
      type: String,
      trim: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    entityType: {
      type: String,
      enum: AUDIT_ENTITY_TYPES,
      required: true,
      index: true,
    },
    entityId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    reasonCode: {
      type: String,
      trim: true,
    },
    correlationId: {
      type: String,
      trim: true,
      index: true,
    },
    causationId: {
      type: String,
      trim: true,
    },
    idempotencyKey: {
      type: String,
      trim: true,
      index: true,
    },
    before: {
      type: Schema.Types.Mixed,
    },
    after: {
      type: Schema.Types.Mixed,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
    ipAddress: {
      type: String,
      trim: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
    versionKey: false,
  },
);

auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

export type AuditLog = InferSchemaType<typeof auditLogSchema>;

export const AuditLogModel = model<AuditLog>("AuditLog", auditLogSchema);
