import { model, Schema, type InferSchemaType } from "mongoose";

const symbolSchema = new Schema(
  {
    symbol: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    baseAsset: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    quoteAsset: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export type SymbolDocument = InferSchemaType<typeof symbolSchema>;

export const SymbolModel = model<SymbolDocument>("Symbol", symbolSchema);
