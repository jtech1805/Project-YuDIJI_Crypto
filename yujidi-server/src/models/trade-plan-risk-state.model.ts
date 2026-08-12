import { model, Schema, type InferSchemaType } from "mongoose";

import { RISK_MODES } from "../types/risk.types.js";

const tradePlanRiskStateSchema = new Schema(
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
    riskBucketKey: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    riskMode: {
      type: String,
      enum: RISK_MODES,
      required: true,
      default: "NORMAL_RISK",
      index: true,
    },
    totalTrades: {
      type: Number,
      required: true,
      default: 0,
    },
    winCount: {
      type: Number,
      required: true,
      default: 0,
    },
    lossCount: {
      type: Number,
      required: true,
      default: 0,
    },
    breakevenCount: {
      type: Number,
      required: true,
      default: 0,
    },
    consecutiveLosses: {
      type: Number,
      required: true,
      default: 0,
    },
    grossPnl: {
      type: Number,
      required: true,
      default: 0,
    },
    netPnl: {
      type: Number,
      required: true,
      default: 0,
    },
    realizedR: {
      type: Number,
      required: true,
      default: 0,
    },
    currentDrawdown: {
      type: Number,
      required: true,
      default: 0,
    },
    lastTradeResultId: {
      type: Schema.Types.ObjectId,
      ref: "TradeResult",
    },
    lastUpdatedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

tradePlanRiskStateSchema.index({ userId: 1, tradePlanId: 1 }, { unique: true });
tradePlanRiskStateSchema.index({ userId: 1, riskBucketKey: 1 });

export type TradePlanRiskState = InferSchemaType<typeof tradePlanRiskStateSchema>;

export const TradePlanRiskStateModel = model<TradePlanRiskState>(
  "TradePlanRiskState",
  tradePlanRiskStateSchema,
);
