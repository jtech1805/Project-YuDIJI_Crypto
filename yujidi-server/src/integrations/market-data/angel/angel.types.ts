import type { Exchange, MarketType } from "../../../types/market-data.types.js";

export type AngelSmartApiConfig = {
  enabled: boolean;
  apiKey?: string;
  clientCode?: string;
  debugEnabled: boolean;
  debugExchange?: Exchange;
  debugSymbolToken?: string;
};

export type AngelInstrument = {
  token: string;
  symbol: string;
  name: string;
  exchange: Exchange;
  marketType: MarketType;
  expiry?: string;
  lotSize?: number;
  tickSize?: number;
  raw?: unknown;
};

export type AngelRawTick = {
  token?: string;
  exchange?: Exchange;
  symbol?: string;
  lastTradedPrice?: number;
  volume?: number;
  timestamp?: number;
  raw?: unknown;
};
