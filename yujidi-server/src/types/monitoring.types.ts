import type { Exchange, MarketProvider } from "./market-data.types.js";

export const MONITORING_EVENT_SEVERITIES = ["INFO", "WARNING", "CRITICAL"] as const;
export type MonitoringEventSeverity = (typeof MONITORING_EVENT_SEVERITIES)[number];

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
