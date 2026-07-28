import { model, Schema, type InferSchemaType } from "mongoose";

import {
  EXCHANGES,
  INSTRUMENT_TYPES,
  MARKET_PROVIDERS,
  MARKET_TYPES,
} from "../types/market-data.types.js";
import {
  DATA_CONFIDENCE_LEVELS,
  SCORING_SETUP_TYPES,
  SCORE_MODES,
  SCORE_STATUSES,
} from "../types/scoring.types.js";
import { TRADE_DIRECTIONS, TRADE_PERMISSIONS } from "../types/trade.types.js";

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
    lotSize: {
      type: Number,
      min: 0,
    },
    tickSize: {
      type: Number,
      min: 0,
    },
    expiry: {
      type: Date,
    },
    requiresBrokerLogin: {
      type: Boolean,
    },
  },
  {
    _id: false,
  },
);

const scoreCheckSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    scoreMode: {
      type: String,
      enum: SCORE_MODES,
      required: true,
      default: "STANDALONE_SCORE_CHECK",
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
      index: true,
    },
    entry: {
      type: Number,
      required: true,
      min: 0,
    },
    stopLoss: {
      type: Number,
      required: true,
      min: 0,
    },
    target1: {
      type: Number,
      required: true,
      min: 0,
    },
    target2: {
      type: Number,
      min: 0,
    },
    setupType: {
      type: String,
      enum: SCORING_SETUP_TYPES,
    },
    userLevels: {
      breakoutLevel: { type: Number, min: 0 },
      supportLevel: { type: Number, min: 0 },
      resistanceLevel: { type: Number, min: 0 },
      pullbackZone: { type: Number, min: 0 },
      rangeHigh: { type: Number, min: 0 },
      rangeLow: { type: Number, min: 0 },
    },
    contextSymbolIds: {
      indexSymbolId: { type: Schema.Types.ObjectId, ref: "Symbol" },
      sectorSymbolId: { type: Schema.Types.ObjectId, ref: "Symbol" },
      vixSymbolId: { type: Schema.Types.ObjectId, ref: "Symbol" },
    },
    riskPerUnit: {
      type: Number,
      required: true,
      min: 0,
    },
    rewardPerUnit: {
      type: Number,
      required: true,
      min: 0,
    },
    rewardRiskRatio: {
      type: Number,
      required: true,
      min: 0,
    },
    scoringTemplateKey: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    scoringTemplateId: {
      type: Schema.Types.ObjectId,
      ref: "ScoringTemplate",
      index: true,
    },
    scoringTemplateVersion: {
      type: String,
      required: true,
      trim: true,
    },
    scoringTemplateScope: {
      type: String,
      enum: ["SYSTEM", "USER"],
      required: true,
      default: "SYSTEM",
      index: true,
    },
    scoringTemplateName: {
      type: String,
      required: true,
      trim: true,
      default: "System Template",
    },
    scoreStatus: {
      type: String,
      enum: SCORE_STATUSES,
      required: true,
      default: "PROCESSING",
      index: true,
    },
    score: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    permission: {
      type: String,
      enum: TRADE_PERMISSIONS,
      required: true,
      index: true,
    },
    dataConfidence: {
      type: String,
      enum: DATA_CONFIDENCE_LEVELS,
      required: true,
      default: "MEDIUM",
    },
    reasonCodes: {
      type: [String],
      default: [],
    },
    warnings: {
      type: [String],
      default: [],
    },
    breakdown: {
      type: Schema.Types.Mixed,
    },
    tradeScoreSnapshotId: {
      type: Schema.Types.ObjectId,
      ref: "TradeScoreSnapshot",
      index: true,
    },
    scoreCalculatedAt: {
      type: Date,
    },
    scoreValidUntil: {
      type: Date,
    },
    convertedToTradeSetupId: {
      type: Schema.Types.ObjectId,
      ref: "TradeSetup",
      index: true,
    },
    isDeleted: {
      type: Boolean,
      required: true,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
    },
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    deleteReason: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

scoreCheckSchema.index({ userId: 1, createdAt: -1 });
scoreCheckSchema.index({ userId: 1, isDeleted: 1, createdAt: -1 });
scoreCheckSchema.index({ userId: 1, symbolId: 1, createdAt: -1 });
scoreCheckSchema.index({ userId: 1, scoreStatus: 1, createdAt: -1 });

export type ScoreCheck = InferSchemaType<typeof scoreCheckSchema>;

export const ScoreCheckModel = model<ScoreCheck>("ScoreCheck", scoreCheckSchema);
