import { model, Schema, type InferSchemaType } from "mongoose";

import {
  EXCHANGES,
  INSTRUMENT_TYPES,
  MARKET_PROVIDERS,
  MARKET_TYPES,
} from "../types/market-data.types.js";
import {
  MONITORING_EVENT_SEVERITIES,
  TRADE_EVENT_SOURCES,
  TRADE_EVENT_TYPES,
} from "../types/monitoring.types.js";
import { TRADE_DIRECTIONS } from "../types/trade.types.js";

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

const tradeEventSchema = new Schema(
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
    activeTradeId: {
      type: Schema.Types.ObjectId,
      ref: "ActiveTrade",
      required: true,
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
    symbolSnapshot: {
      type: symbolSnapshotSchema,
      required: true,
    },
    eventType: {
      type: String,
      enum: TRADE_EVENT_TYPES,
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: MONITORING_EVENT_SEVERITIES,
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: TRADE_EVENT_SOURCES,
      required: true,
    },
    direction: {
      type: String,
      enum: TRADE_DIRECTIONS,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    previousPrice: {
      type: Number,
      min: 0,
    },
    currentR: {
      type: Number,
    },
    distanceToStopLossPercent: {
      type: Number,
      min: 0,
    },
    distanceToTarget1Percent: {
      type: Number,
      min: 0,
    },
    reasonCodes: {
      type: [String],
      default: [],
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
    idempotencyKey: {
      type: String,
      trim: true,
    },
    occurredAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

tradeEventSchema.index({ userId: 1, createdAt: -1 });
tradeEventSchema.index({ userId: 1, activeTradeId: 1, createdAt: -1 });
tradeEventSchema.index({ activeTradeId: 1, eventType: 1, createdAt: -1 });
tradeEventSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });
tradeEventSchema.index({ symbolId: 1, createdAt: -1 });

export type TradeEvent = InferSchemaType<typeof tradeEventSchema>;

export const TradeEventModel = model<TradeEvent>("TradeEvent", tradeEventSchema);
