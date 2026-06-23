import { model, Schema, type InferSchemaType } from "mongoose";

import { INSTRUMENT_TYPES, MARKET_TYPES } from "../types/market-data.types.js";
import {
  PLAN_MODES,
  REVIEW_CADENCES,
  TRADE_PLAN_STATUSES,
} from "../types/trade.types.js";

const tradePlanSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    marketType: {
      type: String,
      enum: MARKET_TYPES,
      required: true,
      index: true,
    },
    tradeStyle: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    instrumentType: {
      type: String,
      enum: INSTRUMENT_TYPES,
      required: true,
      index: true,
    },
    planMode: {
      type: String,
      enum: PLAN_MODES,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: TRADE_PLAN_STATUSES,
      required: true,
      default: "DRAFT",
      index: true,
    },
    startingCapital: {
      type: Number,
      required: true,
      min: 0,
    },
    currentCapital: {
      type: Number,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    maxRiskPerTradePercent: {
      type: Number,
      required: true,
      min: 0,
      max: 10,
    },
    maxDailyLossPercent: {
      type: Number,
      min: 0,
      max: 20,
    },
    maxConsecutiveLosses: {
      type: Number,
      min: 1,
    },
    maxTrades: {
      type: Number,
      min: 1,
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    reviewCadence: {
      type: String,
      enum: REVIEW_CADENCES,
    },
    scoringTemplateKey: {
      type: String,
      trim: true,
    },
    scoringTemplateVersion: {
      type: String,
      trim: true,
    },
    riskTemplateKey: {
      type: String,
      trim: true,
    },
    riskTemplateVersion: {
      type: String,
      trim: true,
    },
    monitoringTemplateKey: {
      type: String,
      trim: true,
    },
    monitoringTemplateVersion: {
      type: String,
      trim: true,
    },
    activatedAt: {
      type: Date,
    },
    pausedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    stoppedAt: {
      type: Date,
    },
    archivedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

tradePlanSchema.index({ userId: 1, status: 1, createdAt: -1 });
tradePlanSchema.index({
  userId: 1,
  marketType: 1,
  tradeStyle: 1,
  instrumentType: 1,
  status: 1,
});
tradePlanSchema.index({ userId: 1, createdAt: -1 });

export type TradePlan = InferSchemaType<typeof tradePlanSchema>;

export const TradePlanModel = model<TradePlan>("TradePlan", tradePlanSchema);
