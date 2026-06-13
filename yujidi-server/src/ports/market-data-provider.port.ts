import type {
  Exchange,
  MarketProvider,
  NormalizedMarketTick,
} from "../types/market-data.types.js";

export type InstrumentSubscription = {
  provider: MarketProvider;
  exchange: Exchange;
  symbol: string;
  instrumentToken: string;
};

export interface MarketDataProvider {
  provider: MarketProvider;

  connect(): Promise<void>;
  disconnect(): Promise<void>;

  subscribe(instruments: InstrumentSubscription[]): Promise<void>;
  unsubscribe(instruments: InstrumentSubscription[]): Promise<void>;

  onTick(handler: (tick: NormalizedMarketTick) => void): void;
}
