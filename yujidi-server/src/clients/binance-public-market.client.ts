import axios, { type AxiosInstance } from "axios";

import type { BinancePublicMarketClient } from "../ports/binance-public-market-client.port.js";

export const BINANCE_PUBLIC_API_BASE_URL = "https://api.binance.com";
export const BINANCE_PUBLIC_REQUEST_TIMEOUT_MS = 5000;

export class BinancePublicMarketClientError extends Error {
  public constructor() {
    super("Binance public market request failed");
    this.name = "BinancePublicMarketClientError";
  }
}

export class AxiosBinancePublicMarketClient
implements BinancePublicMarketClient {
  public constructor(
    private readonly httpClient: AxiosInstance = axios,
  ) {}

  public async getTickerPrice(symbol: string): Promise<unknown> {
    try {
      const response = await this.httpClient.get<unknown>(
        `${BINANCE_PUBLIC_API_BASE_URL}/api/v3/ticker/price`,
        {
          params: { symbol },
          timeout: BINANCE_PUBLIC_REQUEST_TIMEOUT_MS,
        },
      );
      if (response.status < 200 || response.status >= 300) {
        throw new BinancePublicMarketClientError();
      }
      return response.data;
    } catch {
      throw new BinancePublicMarketClientError();
    }
  }
}
