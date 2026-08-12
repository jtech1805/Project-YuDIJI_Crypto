import type { Exchange, MarketProvider } from "./market-data.types.js";

export const MONITORING_EVENT_SEVERITIES = ["INFO", "WARNING", "CRITICAL"] as const;
export type MonitoringEventSeverity = (typeof MONITORING_EVENT_SEVERITIES)[number];

export const TRADE_EVENT_TYPES = [
  "MONITORING_EVALUATED",
  "PRICE_NEAR_SL",
  "SL_HIT",
  "TARGET_1_HIT",
  "TARGET_2_HIT",
  "PLUS_ONE_R_HIT",
  "PRICE_BACK_TO_ENTRY",
  "TRADE_MOVED_AGAINST_POSITION",
  "TRADE_MOVED_IN_FAVOR",
  "STOPLOSS_WIDENED",
  "MONITORING_DEGRADED",
  "MONITORING_STOPPED",
] as const;
export type TradeEventType = (typeof TRADE_EVENT_TYPES)[number];

export const TRADE_EVENT_SOURCES = [
  "MANUAL_EVALUATION",
  "MARKET_TICK",
  "BROKER_SYNC",
  "SYSTEM",
] as const;
export type TradeEventSource = (typeof TRADE_EVENT_SOURCES)[number];

export type ProviderMarketIdentity = {
  provider: MarketProvider;
  exchange: Exchange;
  instrumentToken?: string;
  providerSymbol?: string;
};

export type MonitoringRuleContext = {
  symbolId: string;
  providerIdentity: ProviderMarketIdentity;
  timestamp: number;
};
