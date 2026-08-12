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
    symbolId: {
      type: Schema.Types.ObjectId,
      ref: "Symbol",
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
    providerSymbol: {
      type: String,
      trim: true,
    },
    instrumentType: {
      type: String,
      enum: ["SPOT", "CASH", "FUTURE", "OPTION", "INDEX", "UNKNOWN"],
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
    supportedBroker: {
      type: String,
      enum: ["ANGEL_ONE", "KITE", "NONE"],
      default: "NONE",
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

tripwireConfigSchema.index({ user: 1, isActive: 1 });
tripwireConfigSchema.index({ provider: 1, exchange: 1, instrumentToken: 1, isActive: 1 });
tripwireConfigSchema.index({ user: 1, provider: 1, exchange: 1, instrumentToken: 1 });

export type TripwireConfig = InferSchemaType<typeof tripwireConfigSchema>;

export interface TripwireConfigModel extends Model<TripwireConfig> { }

export interface TripwireConfigWithSymbolMetadata {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  symbol: string;
  symbolId?: Types.ObjectId;
  provider?: string;
  marketType?: string;
  exchange?: string;
  instrumentToken?: string;
  providerSymbol?: string;
  instrumentType?: string;
  displayName?: string;
  requiresBrokerLogin?: boolean;
  supportedBroker?: string;
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
            providerSymbol?: string;
            instrumentType?: string;
            requiresBrokerLogin?: boolean;
            supportedBroker?: string;
          } | null;
}

export const TripwireConfigModel = model<TripwireConfig, TripwireConfigModel>(
  "TripwireConfig",
  tripwireConfigSchema,
);
