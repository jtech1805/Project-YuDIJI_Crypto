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
      enum: ["ACTIVE", "EXPIRED", "REAUTH_REQUIRED", "DISABLED", "FAILED"],
      required: true,
      default: "REAUTH_REQUIRED",
      index: true,
    },
    clientCode: {
      type: String,
      required: true,
      trim: true,
    },
    encryptedApiKey: {
      type: String,
      required: true,
      select: false,
    },
    encryptedPin: {
      type: String,
      required: true,
      select: false,
    },
    encryptedTotpSecret: {
      type: String,
      select: false,
    },
    session: {
      encryptedJwtToken: {
        type: String,
        select: false,
      },
      encryptedRefreshToken: {
        type: String,
        select: false,
      },
      encryptedFeedToken: {
        type: String,
        select: false,
      },
      expiresAt: {
        type: Date,
      },
      lastLoginAt: {
        type: Date,
      },
      lastRefreshAt: {
        type: Date,
      },
    },
    permissions: {
      marketData: {
        type: Boolean,
        required: true,
        default: true,
      },
      orderPlacement: {
        type: Boolean,
        required: true,
        default: false,
      },
      portfolioRead: {
        type: Boolean,
        required: true,
        default: false,
      },
    },
    lastError: {
      type: String,
      trim: true,
    },
    lastVerifiedAt: {
      type: Date,
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
