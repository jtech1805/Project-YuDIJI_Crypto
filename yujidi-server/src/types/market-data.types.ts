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

export const EXCHANGES = ["BINANCE", "NSE", "BSE", "NFO", "MCX", "CDS"] as const;
export type Exchange = (typeof EXCHANGES)[number];

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
