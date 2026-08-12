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

export type MarketDataScope = "GLOBAL" | "USER_SESSION";

export type NormalizedMarketTick = {
  provider: MarketProvider;
  scope?: MarketDataScope;
  userId?: string;
  marketType: MarketType;
  exchange: Exchange;

  symbol: string;
  displayName?: string;
  displaySymbol: string;
  providerSymbol?: string;
  instrumentToken: string;

  price: number;
  volume?: number;
  timestamp: number;

  raw?: unknown;
};

export type MarketQuoteMode = "LTP" | "OHLC" | "FULL";

export type MarketDepthLevel = {
  price: number;
  quantity: number;
  orders: number;
};

export type NormalizedMarketSnapshot = {
  provider: MarketProvider;
  marketType: MarketType;
  exchange: Exchange | string;

  symbolId?: string;
  symbol: string;
  displayName: string;

  providerSymbol: string;
  instrumentToken: string;

  mode: MarketQuoteMode;

  ltp?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;

  lastTradeQty?: number;
  avgPrice?: number;
  tradeVolume?: number;
  openInterest?: number;

  netChange?: number;
  percentChange?: number;

  lowerCircuit?: number;
  upperCircuit?: number;

  totalBuyQuantity?: number;
  totalSellQuantity?: number;

  exchangeFeedTime?: string;
  exchangeTradeTime?: string;

  depth?: {
    buy: MarketDepthLevel[];
    sell: MarketDepthLevel[];
  };

  raw?: unknown;
};
