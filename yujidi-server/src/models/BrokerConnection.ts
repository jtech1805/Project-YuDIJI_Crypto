import { model, Schema, type InferSchemaType } from "mongoose";

const brokerConnectionSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    broker: {
      type: String,
      enum: ["ANGEL_ONE", "KITE"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["DISCONNECTED", "READY", "REVOKED", "ERROR"],
      required: true,
      default: "DISCONNECTED",
      index: true,
    },
    scopes: {
      type: [String],
      enum: ["READ_MARKET_DATA"],
      default: ["READ_MARKET_DATA"],
    },
    lastConnectedAt: {
      type: Date,
    },
    lastError: {
      type: String,
      trim: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

brokerConnectionSchema.index({ user: 1, broker: 1 }, { unique: true });

export type BrokerConnection = InferSchemaType<typeof brokerConnectionSchema>;

export const BrokerConnectionModel = model<BrokerConnection>(
  "BrokerConnection",
  brokerConnectionSchema,
);
