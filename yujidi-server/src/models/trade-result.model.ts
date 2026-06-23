import { model, Schema, type InferSchemaType } from "mongoose";

import {
  EXCHANGES,
  INSTRUMENT_TYPES,
  MARKET_PROVIDERS,
  MARKET_TYPES,
} from "../types/market-data.types.js";
import { PNL_BASES } from "../types/risk.types.js";
import {
  COST_COMPONENT_TYPES,
  TRADE_DIRECTIONS,
  TRADE_EXIT_REASONS,
  TRADE_RESULT_PROJECTION_STATUSES,
  TRADE_RESULT_STATUSES,
  TRADE_RESULT_TYPES,
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
  { _id: false },
);

const costComponentSchema = new Schema(
  {
    type: {
      type: String,
      enum: COST_COMPONENT_TYPES,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    isEstimated: {
      type: Boolean,
      required: true,
      default: false,
    },
    source: {
      type: String,
      trim: true,
    },
  },
  { _id: false },
);

const tradeResultSchema = new Schema(
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
      index: true,
    },
    activeTradeId: {
      type: Schema.Types.ObjectId,
      ref: "ActiveTrade",
      required: true,
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
    },
    tradeStyle: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    instrumentType: {
      type: String,
      enum: INSTRUMENT_TYPES,
      required: true,
    },
    direction: {
      type: String,
      enum: TRADE_DIRECTIONS,
      required: true,
    },
    entryPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    exitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    grossPnl: {
      type: Number,
      required: true,
    },
    chargesTotal: {
      type: Number,
      min: 0,
    },
    netPnl: {
      type: Number,
    },
    realizedPnlUsedForRisk: {
      type: Number,
      required: true,
    },
    pnlBasis: {
      type: String,
      enum: PNL_BASES,
      required: true,
    },
    realizedR: {
      type: Number,
      required: true,
    },
    resultType: {
      type: String,
      enum: TRADE_RESULT_TYPES,
      required: true,
      index: true,
    },
    exitReason: {
      type: String,
      enum: TRADE_EXIT_REASONS,
      required: true,
    },
    exitNotes: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    costComponents: {
      type: [costComponentSchema],
      default: [],
    },
    status: {
      type: String,
      enum: TRADE_RESULT_STATUSES,
      required: true,
      default: "FINALIZED",
      index: true,
    },
    projectionStatus: {
      type: String,
      enum: TRADE_RESULT_PROJECTION_STATUSES,
      required: true,
      default: "PENDING",
      index: true,
    },
    projectedAt: {
      type: Date,
    },
    resultVersion: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
    closedAt: {
      type: Date,
      required: true,
      index: true,
    },
    timezone: {
      type: String,
      required: true,
      trim: true,
      default: "UTC",
    },
    reasonCodes: {
      type: [String],
      default: [],
    },
    warnings: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

tradeResultSchema.index({ userId: 1, createdAt: -1 });
tradeResultSchema.index({ userId: 1, tradePlanId: 1, createdAt: -1 });
tradeResultSchema.index({ activeTradeId: 1 }, { unique: true });
tradeResultSchema.index({ symbolId: 1, closedAt: -1 });
tradeResultSchema.index({ projectionStatus: 1, createdAt: -1 });

export type TradeResult = InferSchemaType<typeof tradeResultSchema>;

export const TradeResultModel = model<TradeResult>("TradeResult", tradeResultSchema);
