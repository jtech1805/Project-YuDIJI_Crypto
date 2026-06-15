export const MARKET_PROVIDERS = ["BINANCE", "ANGEL_ONE", "KITE"] as const;
export type MarketProvider = (typeof MARKET_PROVIDERS)[number];

export const MARKET_TYPES = [
  "CRYPTO",
  "EQUITY",
  "FNO",
  "COMMODITY",
  "CURRENCY",
  "INDEX",
] as const;
export type MarketType = (typeof MARKET_TYPES)[number];

export const EXCHANGES = ["BINANCE", "NSE", "BSE", "NFO", "BFO", "MCX", "CDS", "NCDEX"] as const;
export type Exchange = (typeof EXCHANGES)[number];

export const INSTRUMENT_TYPES = ["SPOT", "CASH", "FUTURE", "OPTION", "INDEX", "UNKNOWN"] as const;
export type InstrumentType = (typeof INSTRUMENT_TYPES)[number];

export const SUPPORTED_BROKERS = ["ANGEL_ONE", "KITE", "NONE"] as const;
export type SupportedBroker = (typeof SUPPORTED_BROKERS)[number];

export type NormalizedMarketTick = {
  provider: MarketProvider;
  marketType: MarketType;
  exchange: Exchange;

  symbol: string;
  displaySymbol: string;
  instrumentToken: string;

  price: number;
  volume?: number;
  timestamp: number;

  raw?: unknown;
};
