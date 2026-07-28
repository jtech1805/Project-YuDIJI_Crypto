import { model, Schema, type InferSchemaType } from "mongoose";

import {
  INSTRUMENT_TYPES,
  MARKET_TYPES,
} from "../types/market-data.types.js";
import {
  MISSING_DATA_POLICIES,
  SCORING_TEMPLATE_KEYS,
  SCORING_TEMPLATE_SCOPES,
  SCORING_TEMPLATE_STATUSES,
  SCORING_TEMPLATE_VISIBILITIES,
} from "../types/scoring.types.js";

const evaluatorSchema = new Schema(
  {
    evaluatorKey: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    weight: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    enabled: {
      type: Boolean,
      required: true,
      default: true,
    },
    missingDataPolicy: {
      type: String,
      enum: MISSING_DATA_POLICIES,
    },
    config: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { _id: false },
);

const sectionSchema = new Schema(
  {
    sectionKey: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    weight: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    enabled: {
      type: Boolean,
      required: true,
      default: true,
    },
    missingDataPolicy: {
      type: String,
      enum: MISSING_DATA_POLICIES,
      required: true,
    },
    evaluators: {
      type: [evaluatorSchema],
      default: [],
    },
  },
  { _id: false },
);

const resourceConfigSchema = new Schema(
  {
    marketRegime: {
      marketIndexSymbolId: { type: Schema.Types.ObjectId, ref: "Symbol" },
      bankIndexSymbolId: { type: Schema.Types.ObjectId, ref: "Symbol" },
      volatilitySymbolId: { type: Schema.Types.ObjectId, ref: "Symbol" },
    },
    sectorContext: {
      sectorName: { type: String, trim: true, maxlength: 120 },
      sectorIndexSymbolId: { type: Schema.Types.ObjectId, ref: "Symbol" },
    },
    relatedSymbols: {
      type: [{ type: Schema.Types.ObjectId, ref: "Symbol" }],
      default: [],
    },
  },
  { _id: false },
);

const sectionOverrideSchema = new Schema(
  {
    sectionKey: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    weight: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    enabled: {
      type: Boolean,
      required: true,
      default: true,
    },
  },
  { _id: false },
);

const snapshotPolicySchema = new Schema(
  {
    captureMarketRegime: { type: Boolean, required: true, default: true },
    captureSectorContext: { type: Boolean, required: true, default: true },
    captureRelatedSymbols: { type: Boolean, required: true, default: true },
    captureAllowedTradableSymbol: { type: Boolean, required: true, default: true },
    maxSnapshotAgeSeconds: { type: Number, required: true, min: 0, max: 86400, default: 900 },
  },
  { _id: false },
);

const scoringTemplateSchema = new Schema(
  {
    scope: {
      type: String,
      enum: SCORING_TEMPLATE_SCOPES,
      required: true,
      default: "USER",
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    templateKey: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    baseTemplateKey: {
      type: String,
      enum: SCORING_TEMPLATE_KEYS,
      required: true,
      index: true,
    },
    templateName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
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
    version: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    isLatest: {
      type: Boolean,
      required: true,
      default: true,
      index: true,
    },
    isReadonly: {
      type: Boolean,
      required: true,
      default: false,
    },
    visibility: {
      type: String,
      enum: SCORING_TEMPLATE_VISIBILITIES,
      required: true,
      default: "PRIVATE",
    },
    status: {
      type: String,
      enum: SCORING_TEMPLATE_STATUSES,
      required: true,
      default: "ACTIVE",
      index: true,
    },
    maxScore: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
      default: 100,
    },
    aggregationMode: {
      type: String,
      enum: ["NORMALIZE_EXECUTED", "WEIGHTED_SUM"],
    },
    sections: {
      type: [sectionSchema],
      required: true,
      default: [],
    },
    permissionThresholds: {
      rejectBelow: { type: Number, required: true, min: 0, max: 100, default: 40 },
      waitBelow: { type: Number, required: true, min: 0, max: 100, default: 60 },
      takeSmallRiskBelow: { type: Number, required: true, min: 0, max: 100, default: 75 },
      takeTradeAtOrAbove: { type: Number, required: true, min: 0, max: 100, default: 75 },
    },
    resourceConfig: {
      type: resourceConfigSchema,
      default: {},
    },
    allowedTradableSymbols: {
      type: [{ type: Schema.Types.ObjectId, ref: "Symbol" }],
      default: [],
    },
    sectionOverrides: {
      type: [sectionOverrideSchema],
      default: [],
    },
    snapshotPolicy: {
      type: snapshotPolicySchema,
      default: () => ({}),
    },
    usedCount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    lastUsedAt: {
      type: Date,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

scoringTemplateSchema.index(
  { userId: 1, templateKey: 1, version: 1 },
  { unique: true, partialFilterExpression: { scope: "USER" } },
);
scoringTemplateSchema.index({ userId: 1, status: 1, isLatest: 1 });
scoringTemplateSchema.index({ scope: 1, status: 1, marketType: 1, tradeStyle: 1, instrumentType: 1 });
scoringTemplateSchema.index({ "resourceConfig.marketRegime.marketIndexSymbolId": 1 });
scoringTemplateSchema.index({ allowedTradableSymbols: 1 });

export type ScoringTemplate = InferSchemaType<typeof scoringTemplateSchema>;

export const ScoringTemplateModel = model<ScoringTemplate>(
  "ScoringTemplate",
  scoringTemplateSchema,
);
