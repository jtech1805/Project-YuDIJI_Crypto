import { model, Schema, type InferSchemaType, type Model, type Types } from "mongoose";

const tripwireConfigSchema = new Schema(
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
      trim: true,
      uppercase: true,
      index: true,
    },
    thresholdPercentage: {
      type: Number,
      required: true,
      min: 0,
    },
    timeWindowMinutes: {
      type: Number,
      required: true,
      min: 1,
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export type TripwireConfig = InferSchemaType<typeof tripwireConfigSchema>;

export interface TripwireConfigModel extends Model<TripwireConfig> {}

export interface TripwireConfigWithSymbolMetadata {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  symbol: string;
  thresholdPercentage: number;
  timeWindowMinutes: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  symbolMeta: {
    baseAsset: string;
    quoteAsset: string;
    status: string;
  } | null;
}

export const TripwireConfigModel = model<TripwireConfig, TripwireConfigModel>(
  "TripwireConfig",
  tripwireConfigSchema,
);
