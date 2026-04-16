import { model, Schema, type InferSchemaType } from "mongoose";

const alertSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    symbol: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    triggerPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    dropPercentage: {
      type: Number,
      required: true,
      min: 0,
    },
    aiRootCause: {
      type: String,
      required: true,
      trim: true,
    },
    sentiment: {
      type: String,
      required: true,
      enum: ["Panic", "Bearish", "Neutral", "Bullish"],
    },
    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  },
);

export type Alert = InferSchemaType<typeof alertSchema>;

export const AlertModel = model<Alert>("Alert", alertSchema);
