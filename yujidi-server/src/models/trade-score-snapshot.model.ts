import { model, Schema, type InferSchemaType } from "mongoose";

import {
  DATA_CONFIDENCE_LEVELS,
  SCORE_STATUSES,
} from "../types/scoring.types.js";
import { TRADE_PERMISSIONS } from "../types/trade.types.js";
import {
  EXCHANGES,
  INSTRUMENT_TYPES,
  MARKET_PROVIDERS,
  MARKET_TYPES,
} from "../types/market-data.types.js";

const selectedSymbolSchema = new Schema(
  {
    symbolId: { type: Schema.Types.ObjectId, ref: "Symbol", required: true },
    symbol: { type: String, required: true, trim: true },
    exchange: { type: String, enum: EXCHANGES, required: true },
    provider: { type: String, enum: MARKET_PROVIDERS, required: true },
    marketType: { type: String, enum: MARKET_TYPES, required: true },
    instrumentType: { type: String, enum: INSTRUMENT_TYPES, required: true },
  },
  { _id: false },
);

const tradeScoreSnapshotSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    scoreCheckId: {
      type: Schema.Types.ObjectId,
      ref: "ScoreCheck",
      index: true,
    },
    tradeSetupId: {
      type: Schema.Types.ObjectId,
      ref: "TradeSetup",
      index: true,
    },
    symbolId: {
      type: Schema.Types.ObjectId,
      ref: "Symbol",
      required: true,
      index: true,
    },
    selectedSymbol: {
      type: selectedSymbolSchema,
      required: true,
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
    },
    scoringTemplateName: {
      type: String,
      required: true,
      trim: true,
      default: "System Template",
    },
    score: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    finalScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    permission: {
      type: String,
      enum: TRADE_PERMISSIONS,
      required: true,
    },
    scoreStatus: {
      type: String,
      enum: SCORE_STATUSES,
      required: true,
    },
    dataConfidence: {
      type: String,
      enum: DATA_CONFIDENCE_LEVELS,
      required: true,
    },
    breakdown: {
      type: Schema.Types.Mixed,
      required: true,
      default: {},
    },
    resolvedResources: {
      type: [Schema.Types.Mixed],
      default: [],
    },
    resourceSnapshots: {
      type: [Schema.Types.Mixed],
      default: [],
    },
    resourceReadinessSummary: {
      type: Schema.Types.Mixed,
      default: {},
    },
    sectionBreakdown: {
      type: [Schema.Types.Mixed],
      default: [],
    },
    reasonCodes: {
      type: [String],
      default: [],
    },
    warnings: {
      type: [String],
      default: [],
    },
    blockers: {
      type: [String],
      default: [],
    },
    sourceSnapshotId: {
      type: Schema.Types.ObjectId,
      ref: "ScoreCheckSnapshot",
      index: true,
    },
    sourceSnapshotCreatedAt: {
      type: Date,
    },
    sourceSnapshotExpiresAt: {
      type: Date,
    },
    snapshotRefs: {
      marketSnapshotId: {
        type: String,
        trim: true,
      },
      sectorSnapshotId: {
        type: String,
        trim: true,
      },
      indexSnapshotId: {
        type: String,
        trim: true,
      },
      vixSnapshotId: {
        type: String,
        trim: true,
      },
      symbolSnapshotId: {
        type: String,
        trim: true,
      },
    },
    runtimeSnapshot: {
      type: Schema.Types.Mixed,
      default: {},
    },
    inputHash: {
      type: String,
      trim: true,
      index: true,
    },
    calculatedAt: {
      type: Date,
      required: true,
    },
    validUntil: {
      type: Date,
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

tradeScoreSnapshotSchema.index({ userId: 1, createdAt: -1 });
tradeScoreSnapshotSchema.index({ userId: 1, isDeleted: 1, createdAt: -1 });
tradeScoreSnapshotSchema.index({ symbolId: 1, calculatedAt: -1 });
tradeScoreSnapshotSchema.index({ userId: 1, scoreCheckId: 1 });

export type TradeScoreSnapshot = InferSchemaType<typeof tradeScoreSnapshotSchema>;

export const TradeScoreSnapshotModel = model<TradeScoreSnapshot>(
  "TradeScoreSnapshot",
  tradeScoreSnapshotSchema,
);
