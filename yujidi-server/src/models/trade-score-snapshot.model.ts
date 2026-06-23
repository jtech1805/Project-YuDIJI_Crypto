import { model, Schema, type InferSchemaType } from "mongoose";

import {
  DATA_CONFIDENCE_LEVELS,
  SCORE_STATUSES,
  SCORING_TEMPLATE_KEYS,
} from "../types/scoring.types.js";
import { TRADE_PERMISSIONS } from "../types/trade.types.js";

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
    scoringTemplateKey: {
      type: String,
      enum: SCORING_TEMPLATE_KEYS,
      required: true,
      index: true,
    },
    scoringTemplateVersion: {
      type: String,
      required: true,
      trim: true,
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
    reasonCodes: {
      type: [String],
      default: [],
    },
    warnings: {
      type: [String],
      default: [],
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
      symbolSnapshotId: {
        type: String,
        trim: true,
      },
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
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

tradeScoreSnapshotSchema.index({ userId: 1, createdAt: -1 });
tradeScoreSnapshotSchema.index({ symbolId: 1, calculatedAt: -1 });

export type TradeScoreSnapshot = InferSchemaType<typeof tradeScoreSnapshotSchema>;

export const TradeScoreSnapshotModel = model<TradeScoreSnapshot>(
  "TradeScoreSnapshot",
  tradeScoreSnapshotSchema,
);
