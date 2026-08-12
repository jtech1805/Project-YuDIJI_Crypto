export interface BinancePublicMarketClient {
  getTickerPrice(symbol: string): Promise<unknown>;
}
