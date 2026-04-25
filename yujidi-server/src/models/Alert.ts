
import { model, Schema, type InferSchemaType } from "mongoose";

const alertSchema = new Schema(
  {
    // --- 1. The Trigger Context (Kept exactly the same) ---
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

    // --- 2. The AI Playbook (Replaces aiRootCause & sentiment) ---
    catalyst: {
      type: String,
      required: true,
      trim: true,
    },
    threatLevel: {
      type: String,
      required: true,
      trim: true, // Example: "🔴 High Volatility / Liquidity Void"
    },
    support: {
      type: String,
      required: true,
      trim: true, // Example: "$78,474.83 (1.89 BTC)"
    },
    resistance: {
      type: String,
      required: true,
      trim: true, // Example: "$78,474.84 (6.64 BTC)"
    },
    summary: {
      type: String,
      required: true,
      trim: true,
    },

    // --- 3. The Momentum Metrics (New) ---
    cvdAtTrigger: {
      type: Number,
      required: true,
    },

    // --- 4. Timestamps ---
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