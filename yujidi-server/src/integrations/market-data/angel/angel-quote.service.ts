import axios, { type AxiosInstance } from "axios";

import type { MarketQuoteMode } from "../../../types/market-data.types.js";

export type AngelQuoteMode = MarketQuoteMode;

export type AngelQuoteRequest = {
  jwtToken: string;
  apiKey: string;
  mode: AngelQuoteMode;
  exchangeTokens: Record<string, string[]>;
};

export type AngelQuoteDepthLevel = {
  price?: number;
  quantity?: number;
  orders?: number;
};

export type AngelQuoteFetchedItem = {
  exchange?: string;
  tradingSymbol?: string;
  symbolToken?: string;
  ltp?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  lastTradeQty?: number;
  exchFeedTime?: string;
  exchTradeTime?: string;
  netChange?: number;
  percentChange?: number;
  avgPrice?: number;
  tradeVolume?: number;
  opnInterest?: number;
  lowerCircuit?: number;
  upperCircuit?: number;
  totBuyQuan?: number;
  totSellQuan?: number;
  depth?: {
    buy?: AngelQuoteDepthLevel[];
    sell?: AngelQuoteDepthLevel[];
  };
};

export type AngelQuoteUnfetchedItem = {
  exchange?: string;
  symbolToken?: string;
  message?: string;
  errorCode?: string;
};

export type AngelQuoteResponse = {
  fetched: AngelQuoteFetchedItem[];
  unfetched: AngelQuoteUnfetchedItem[];
};

type AngelApiEnvelope<TData> = {
  status: boolean;
  message?: string;
  errorcode?: string;
  data?: TData;
};

type AngelQuoteConfig = {
  clientLocalIp?: string | undefined;
  clientPublicIp?: string | undefined;
  macAddress?: string | undefined;
  baseUrl?: string | undefined;
};

const DEFAULT_BASE_URL = "https://apiconnect.angelone.in";

export class AngelQuoteService {
  private readonly baseUrl: string;

  public constructor(
    private readonly httpClient: AxiosInstance = axios,
    private readonly config: AngelQuoteConfig = {
      clientLocalIp: process.env.ANGEL_CLIENT_LOCAL_IP,
      clientPublicIp: process.env.ANGEL_CLIENT_PUBLIC_IP,
      macAddress: process.env.ANGEL_MAC_ADDRESS,
    },
  ) {
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  }

  public async fetchAngelQuote(request: AngelQuoteRequest): Promise<AngelQuoteResponse> {
    const response = await this.httpClient.post<AngelApiEnvelope<AngelQuoteResponse>>(
      `${this.baseUrl}/rest/secure/angelbroking/market/v1/quote/`,
      {
        mode: request.mode,
        exchangeTokens: request.exchangeTokens,
      },
      {
        headers: this.buildHeaders(request.apiKey, request.jwtToken),
        timeout: 15000,
      },
    );

    if (!response.data.status || !response.data.data) {
      const message = response.data.message || "Angel quote fetch failed";
      const suffix = response.data.errorcode ? ` (${response.data.errorcode})` : "";
      throw new Error(`${message}${suffix}`);
    }

    return {
      fetched: response.data.data.fetched ?? [],
      unfetched: response.data.data.unfetched ?? [],
    };
  }

  private buildHeaders(apiKey: string, jwtToken: string): Record<string, string> {
    const { clientLocalIp, clientPublicIp, macAddress } = this.config;
    if (!clientLocalIp || !clientPublicIp || !macAddress) {
      throw new Error("Angel client local IP, public IP, and MAC address configuration are required");
    }

    return {
      Authorization: `Bearer ${jwtToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-UserType": "USER",
      "X-SourceID": "WEB",
      "X-ClientLocalIP": clientLocalIp,
      "X-ClientPublicIP": clientPublicIp,
      "X-MACAddress": macAddress,
      "X-PrivateKey": apiKey,
    };
  }
}
