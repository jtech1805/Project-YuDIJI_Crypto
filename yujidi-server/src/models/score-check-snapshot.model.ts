import { model, Schema, type InferSchemaType } from "mongoose";

import {
  EXCHANGES,
  INSTRUMENT_TYPES,
  MARKET_PROVIDERS,
  MARKET_TYPES,
} from "../types/market-data.types.js";
import {
  DATA_CONFIDENCE_LEVELS,
  SCORE_STATUSES,
} from "../types/scoring.types.js";
import { TRADE_PERMISSIONS } from "../types/trade.types.js";

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

const scoreCheckSnapshotSchema = new Schema(
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
      required: true,
      unique: true,
    },
    scoringTemplateId: {
      type: Schema.Types.ObjectId,
      ref: "ScoringTemplate",
      index: true,
    },
    scoringTemplateKey: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    scoringTemplateName: {
      type: String,
      required: true,
      trim: true,
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
      index: true,
    },
    selectedSymbol: {
      type: selectedSymbolSchema,
      required: true,
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
    warnings: {
      type: [String],
      default: [],
    },
    blockers: {
      type: [String],
      default: [],
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

scoreCheckSnapshotSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
scoreCheckSnapshotSchema.index({ userId: 1, scoreCheckId: 1 });
scoreCheckSnapshotSchema.index({ createdAt: -1 });

export type ScoreCheckSnapshot = InferSchemaType<typeof scoreCheckSnapshotSchema>;

export const ScoreCheckSnapshotModel = model<ScoreCheckSnapshot>(
  "ScoreCheckSnapshot",
  scoreCheckSnapshotSchema,
);
