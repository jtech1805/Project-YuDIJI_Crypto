import type { MarketProvider } from "../types/market-data.types.js";

export interface InstrumentProvider<TInstrument = unknown> {
  provider: MarketProvider;

  syncInstruments(): Promise<TInstrument[]>;
  searchInstruments(query: string): Promise<TInstrument[]>;
  getInstrumentByToken(token: string): Promise<TInstrument | null>;
}
