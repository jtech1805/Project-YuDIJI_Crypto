export type MarketResourceKey = string;

export type SnapshotMarketTick = {
  provider: string;
  exchange: string;
  marketType?: string;
  symbolId?: string;
  symbol?: string;
  providerSymbol?: string;
  instrumentToken?: string;
  userId?: string;
  price: number;
  volume?: number;
  cumulativeVolume?: number;
  bid?: number;
  ask?: number;
  open?: number;
  high?: number;
  low?: number;
  previousClose?: number;
  occurredAt?: Date;
  receivedAt: Date;
  source: "BINANCE_WS" | "ANGEL_WS" | "MANUAL" | "SYSTEM";
};

export type CandleTimeframe = "1m" | "3m" | "5m" | "15m";

export type CandleSnapshot = {
  timeframe: CandleTimeframe;
  startTime: Date;
  endTime: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  tickCount: number;
};

export type VwapSnapshot = {
  value?: number;
  cumulativePriceVolume: number;
  cumulativeVolume: number;
  positionVsVwap?: "ABOVE" | "BELOW" | "NEAR";
  distanceFromVwapPercent?: number;
  status: "READY" | "PARTIAL" | "UNAVAILABLE";
};

export type VolumeSnapshot = {
  latestVolume?: number;
  cumulativeVolume?: number;
  relativeVolume?: number;
  volumeTrend?: "EXPANDING" | "FLAT" | "DRYING";
  status: "READY" | "PARTIAL" | "UNAVAILABLE";
};

export type MarketSnapshot = {
  resourceKey: MarketResourceKey;
  provider: string;
  exchange: string;
  marketType?: string;
  symbolId?: string;
  symbol?: string;
  providerSymbol?: string;
  instrumentToken?: string;
  userId?: string;
  latestPrice?: number;
  previousPrice?: number;
  dayOpen?: number;
  high?: number;
  low?: number;
  previousClose?: number;
  changePercent?: number;
  lastTickAt?: Date;
  tickCount: number;
  candles: Record<CandleTimeframe, CandleSnapshot[]>;
  vwap: VwapSnapshot;
  volume: VolumeSnapshot;
  freshness: {
    status: "FRESH" | "STALE" | "MISSING";
    ageMs?: number;
  };
  dataConfidence: "HIGH" | "MEDIUM" | "LOW" | "UNAVAILABLE";
};
