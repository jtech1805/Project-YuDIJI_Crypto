import { model, Schema, type InferSchemaType } from "mongoose";

import {
  EXCHANGES,
  INSTRUMENT_TYPES,
  MARKET_PROVIDERS,
  MARKET_TYPES,
} from "../types/market-data.types.js";
import { RISK_MODES } from "../types/risk.types.js";
import {
  ACTIVE_TRADE_STATUSES,
  EXECUTION_QUALITIES,
  EXECUTION_SOURCES,
  TRADE_DIRECTIONS,
  TRADE_PERMISSIONS,
  TRADE_RULE_VIOLATIONS,
} from "../types/trade.types.js";

const symbolSnapshotSchema = new Schema(
  {
    symbolId: {
      type: Schema.Types.ObjectId,
      ref: "Symbol",
      required: true,
    },
    symbol: {
      type: String,
      required: true,
      trim: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    provider: {
      type: String,
      enum: MARKET_PROVIDERS,
      required: true,
    },
    marketType: {
      type: String,
      enum: MARKET_TYPES,
      required: true,
    },
    exchange: {
      type: String,
      enum: EXCHANGES,
      required: true,
    },
    instrumentType: {
      type: String,
      enum: INSTRUMENT_TYPES,
      required: true,
    },
    providerSymbol: {
      type: String,
      trim: true,
    },
    requiresBrokerLogin: {
      type: Boolean,
    },
  },
  {
    _id: false,
  },
);

const activeTradeSchema = new Schema(
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
    tradeSetupId: {
      type: Schema.Types.ObjectId,
      ref: "TradeSetup",
      required: true,
    },
    sourceScoreCheckId: {
      type: Schema.Types.ObjectId,
      ref: "ScoreCheck",
      index: true,
    },
    symbolId: {
      type: Schema.Types.ObjectId,
      ref: "Symbol",
      required: true,
      index: true,
    },
    symbolSnapshot: {
      type: symbolSnapshotSchema,
      required: true,
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
    direction: {
      type: String,
      enum: TRADE_DIRECTIONS,
      required: true,
    },
    plannedEntry: {
      type: Number,
      required: true,
      min: 0,
    },
    plannedStopLoss: {
      type: Number,
      required: true,
      min: 0,
    },
    plannedTarget1: {
      type: Number,
      required: true,
      min: 0,
    },
    plannedTarget2: {
      type: Number,
      min: 0,
    },
    plannedRiskPerUnit: {
      type: Number,
      required: true,
      min: 0,
    },
    plannedRewardRiskRatio: {
      type: Number,
      required: true,
      min: 0,
    },
    actualEntry: {
      type: Number,
      required: true,
      min: 0,
    },
    actualQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    initialStopLoss: {
      type: Number,
      required: true,
      min: 0,
    },
    currentStopLoss: {
      type: Number,
      required: true,
      min: 0,
    },
    actualTarget1: {
      type: Number,
      required: true,
      min: 0,
    },
    actualTarget2: {
      type: Number,
      min: 0,
    },
    remainingQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    actualRiskPerUnit: {
      type: Number,
      required: true,
      min: 0,
    },
    actualRiskAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    actualRewardPerUnit: {
      type: Number,
      required: true,
      min: 0,
    },
    actualRewardRiskRatio: {
      type: Number,
      required: true,
      min: 0,
    },
    executionSource: {
      type: String,
      enum: EXECUTION_SOURCES,
      required: true,
    },
    executionQuality: {
      type: [{
        type: String,
        enum: EXECUTION_QUALITIES,
      }],
      required: true,
      default: ["AS_PLANNED"],
    },
    ruleViolations: {
      type: [{
        type: String,
        enum: TRADE_RULE_VIOLATIONS,
      }],
      required: true,
      default: [],
    },
    finalPermissionAtExecution: {
      type: String,
      enum: TRADE_PERMISSIONS,
      required: true,
    },
    riskModeAtExecution: {
      type: String,
      enum: RISK_MODES,
      required: true,
    },
    status: {
      type: String,
      enum: ACTIVE_TRADE_STATUSES,
      required: true,
      default: "ACTIVE",
      index: true,
    },
    openedAt: {
      type: Date,
      required: true,
    },
    cancelledAt: {
      type: Date,
    },
    closedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

activeTradeSchema.index({ userId: 1, status: 1, createdAt: -1 });
activeTradeSchema.index({ userId: 1, tradePlanId: 1, status: 1, createdAt: -1 });
activeTradeSchema.index({ tradeSetupId: 1 }, { unique: true });
activeTradeSchema.index({ symbolId: 1, status: 1, createdAt: -1 });
activeTradeSchema.index({ userId: 1, openedAt: -1 });

export type ActiveTrade = InferSchemaType<typeof activeTradeSchema>;

export const ActiveTradeModel = model<ActiveTrade>("ActiveTrade", activeTradeSchema);
