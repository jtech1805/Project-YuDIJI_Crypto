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
    provider: {
      type: String,
      enum: ["BINANCE", "ANGEL_ONE", "KITE"],
      default: "BINANCE",
      index: true,
    },
    marketType: {
      type: String,
      enum: ["CRYPTO", "EQUITY", "FNO", "COMMODITY", "CURRENCY", "INDEX"],
      default: "CRYPTO",
      index: true,
    },
    exchange: {
      type: String,
      enum: ["BINANCE", "NSE", "BSE", "NFO", "BFO", "MCX", "CDS", "NCDEX"],
      default: "BINANCE",
      index: true,
    },
    instrumentToken: {
      type: String,
      trim: true,
      index: true,
    },
    displayName: {
      type: String,
      trim: true,
    },
    requiresBrokerLogin: {
      type: Boolean,
      default: false,
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
    trigger: {
      type: String,
      enum: ['spike', 'drop']
    }
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export type TripwireConfig = InferSchemaType<typeof tripwireConfigSchema>;

export interface TripwireConfigModel extends Model<TripwireConfig> { }

export interface TripwireConfigWithSymbolMetadata {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  symbol: string;
  provider?: string;
  marketType?: string;
  exchange?: string;
  instrumentToken?: string;
  displayName?: string;
  requiresBrokerLogin?: boolean;
  thresholdPercentage: number;
  timeWindowMinutes: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  trigger: string;
          symbolMeta: {
            baseAsset: string;
            quoteAsset: string;
            status: string;
            provider?: string;
            marketType?: string;
            exchange?: string;
            displayName?: string;
            instrumentToken?: string;
            requiresBrokerLogin?: boolean;
          } | null;
}

export const TripwireConfigModel = model<TripwireConfig, TripwireConfigModel>(
  "TripwireConfig",
  tripwireConfigSchema,
);
