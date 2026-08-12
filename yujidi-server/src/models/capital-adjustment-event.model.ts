import { model, Schema, type InferSchemaType } from "mongoose";

import { CAPITAL_ADJUSTMENT_TYPES } from "../types/trade.types.js";

const capitalAdjustmentEventSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tradePlanId: {
      type: Schema.Types.ObjectId,
      ref: "TradePlan",
      required: true,
      index: true,
    },
    adjustmentType: {
      type: String,
      enum: CAPITAL_ADJUSTMENT_TYPES,
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    reason: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
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

capitalAdjustmentEventSchema.index({ userId: 1, tradePlanId: 1, createdAt: -1 });

export type CapitalAdjustmentEvent = InferSchemaType<typeof capitalAdjustmentEventSchema>;

export const CapitalAdjustmentEventModel = model<CapitalAdjustmentEvent>(
  "CapitalAdjustmentEvent",
  capitalAdjustmentEventSchema,
);
