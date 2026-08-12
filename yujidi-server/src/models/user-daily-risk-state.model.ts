import { model, Schema, type InferSchemaType } from "mongoose";

import { RISK_MODES } from "../types/risk.types.js";

const userDailyRiskStateSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    riskBucketKey: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    dateKey: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    timezone: {
      type: String,
      required: true,
      trim: true,
    },
    riskMode: {
      type: String,
      enum: RISK_MODES,
      required: true,
      default: "NORMAL_RISK",
      index: true,
    },
    tradesTaken: {
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
    dailyLossLimitHit: {
      type: Boolean,
      required: true,
      default: false,
    },
    stopTradingTriggered: {
      type: Boolean,
      required: true,
      default: false,
    },
    lastTradeResultId: {
      type: Schema.Types.ObjectId,
      ref: "TradeResult",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

userDailyRiskStateSchema.index(
  { userId: 1, riskBucketKey: 1, dateKey: 1 },
  { unique: true },
);

export type UserDailyRiskState = InferSchemaType<typeof userDailyRiskStateSchema>;

export const UserDailyRiskStateModel = model<UserDailyRiskState>(
  "UserDailyRiskState",
  userDailyRiskStateSchema,
);
