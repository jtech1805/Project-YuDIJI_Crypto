import { model, Schema, type InferSchemaType } from "mongoose";

import { EXCHANGES, MARKET_PROVIDERS, MARKET_TYPES } from "../types/market-data.types.js";

const instrumentSchema = new Schema(
  {
    provider: {
      type: String,
      required: true,
      enum: MARKET_PROVIDERS,
      index: true,
    },
    marketType: {
      type: String,
      required: true,
      enum: MARKET_TYPES,
      index: true,
    },
    exchange: {
      type: String,
      required: true,
      enum: EXCHANGES,
      index: true,
    },
    symbol: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    instrumentToken: {
      type: String,
      required: true,
      trim: true,
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
    },
    expiry: {
      type: Date,
    },
    lotSize: {
      type: Number,
      min: 0,
    },
    tickSize: {
      type: Number,
      min: 0,
    },
    status: {
      type: String,
      required: true,
      enum: ["ACTIVE", "EXPIRED", "DISABLED"],
      default: "ACTIVE",
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

instrumentSchema.index({ provider: 1, exchange: 1, instrumentToken: 1 }, { unique: true });
instrumentSchema.index({ provider: 1, exchange: 1, symbol: 1 });

export type Instrument = InferSchemaType<typeof instrumentSchema>;

export const InstrumentModel = model<Instrument>("Instrument", instrumentSchema);
