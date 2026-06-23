import { model, Schema, type InferSchemaType } from "mongoose";

import {
  EXCHANGES,
  INSTRUMENT_TYPES,
  MARKET_PROVIDERS,
  MARKET_TYPES,
} from "../types/market-data.types.js";
import { RISK_MODES } from "../types/risk.types.js";
import { SCORING_TEMPLATE_KEYS } from "../types/scoring.types.js";
import {
  TRADE_DIRECTIONS,
  TRADE_PERMISSIONS,
  TRADE_SETUP_STATUSES,
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

const tradeSetupSchema = new Schema(
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
    sourceScoreCheckId: {
      type: Schema.Types.ObjectId,
      ref: "ScoreCheck",
      index: true,
      unique: true,
      sparse: true,
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
    plannedRewardPerUnit: {
      type: Number,
      required: true,
      min: 0,
    },
    plannedRewardRiskRatio: {
      type: Number,
      required: true,
      min: 0,
    },
    scoringTemplateKey: {
      type: String,
      enum: SCORING_TEMPLATE_KEYS,
      required: true,
    },
    scoringTemplateVersion: {
      type: String,
      required: true,
      trim: true,
    },
    tradeScoreSnapshotId: {
      type: Schema.Types.ObjectId,
      ref: "TradeScoreSnapshot",
      required: true,
      index: true,
    },
    score: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    scorePermission: {
      type: String,
      enum: TRADE_PERMISSIONS,
      required: true,
    },
    riskGovernorPermission: {
      type: String,
      enum: TRADE_PERMISSIONS,
      required: true,
    },
    finalPermission: {
      type: String,
      enum: TRADE_PERMISSIONS,
      required: true,
      index: true,
    },
    riskModeAtDecision: {
      type: String,
      enum: RISK_MODES,
      required: true,
    },
    reasonCodes: {
      type: [String],
      default: [],
    },
    warnings: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: TRADE_SETUP_STATUSES,
      required: true,
      index: true,
    },
    scoreCalculatedAt: {
      type: Date,
    },
    scoreValidUntil: {
      type: Date,
    },
    riskEvaluatedAt: {
      type: Date,
      required: true,
    },
    expiresAt: {
      type: Date,
    },
    executedAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

tradeSetupSchema.index({ userId: 1, createdAt: -1 });
tradeSetupSchema.index({ userId: 1, tradePlanId: 1, createdAt: -1 });
tradeSetupSchema.index({ userId: 1, status: 1, createdAt: -1 });
tradeSetupSchema.index({ sourceScoreCheckId: 1 }, { unique: true, sparse: true });
tradeSetupSchema.index({ tradeScoreSnapshotId: 1 });
tradeSetupSchema.index({ symbolId: 1, createdAt: -1 });

export type TradeSetup = InferSchemaType<typeof tradeSetupSchema>;

export const TradeSetupModel = model<TradeSetup>("TradeSetup", tradeSetupSchema);
