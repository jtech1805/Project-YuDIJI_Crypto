import { model, Schema, type InferSchemaType } from "mongoose";

import {
  EXCHANGES,
  INSTRUMENT_TYPES,
  MARKET_PROVIDERS,
  MARKET_TYPES,
  SUPPORTED_BROKERS,
} from "../types/market-data.types.js";

const symbolSchema = new Schema(
  {
    provider: {
      type: String,
      enum: MARKET_PROVIDERS,
      default: "BINANCE",
      index: true,
    },
    marketType: {
      type: String,
      enum: MARKET_TYPES,
      default: "CRYPTO",
      index: true,
    },
    exchange: {
      type: String,
      enum: EXCHANGES,
      default: "BINANCE",
      index: true,
    },
    symbol: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      trim: true,
    },
    displayName: {
      type: String,
      trim: true,
    },
    providerSymbol: {
      type: String,
      trim: true,
      index: true,
    },
    instrumentToken: {
      type: String,
      trim: true,
      index: true,
    },
    baseAsset: {
      type: String,
      uppercase: true,
      trim: true,
    },
    quoteAsset: {
      type: String,
      uppercase: true,
      trim: true,
      index: true,
    },
    instrumentType: {
      type: String,
      enum: INSTRUMENT_TYPES,
      default: "UNKNOWN",
      index: true,
    },
    expiry: {
      type: Date,
    },
    strikePrice: {
      type: Number,
      min: 0,
    },
    optionType: {
      type: String,
      enum: ["CE", "PE"],
    },
    lotSize: {
      type: Number,
      min: 0,
    },
    tickSize: {
      type: Number,
      min: 0,
    },
    requiresBrokerLogin: {
      type: Boolean,
      required: true,
      default: false,
      index: true,
    },
    supportedBroker: {
      type: String,
      enum: SUPPORTED_BROKERS,
      required: true,
      default: "NONE",
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["TRADING", "ACTIVE", "EXPIRED", "DISABLED"],
      default: "ACTIVE",
      trim: true,
      index: true,
    },
    raw: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

symbolSchema.index({ provider: 1, exchange: 1, instrumentToken: 1 }, { unique: true });
symbolSchema.index({ provider: 1, exchange: 1, symbol: 1 });
symbolSchema.index({ provider: 1, exchange: 1, quoteAsset: 1, status: 1, symbol: 1 });
symbolSchema.index({ marketType: 1, instrumentType: 1, status: 1 });
symbolSchema.index({ name: "text", symbol: "text", displayName: "text" });

export type SymbolDocument = InferSchemaType<typeof symbolSchema>;

export const SymbolModel = model<SymbolDocument>("Symbol", symbolSchema);
