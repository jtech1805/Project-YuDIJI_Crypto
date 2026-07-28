import { apiClient } from './client';

export type SymbolSearchResult = {
  symbolId: string;
  symbol: string;
  displayName: string;
  provider: 'BINANCE' | 'ANGEL_ONE' | 'KITE';
  exchange: string;
  marketType: string;
  instrumentType?: string;
  providerSymbol: string;
  instrumentToken: string;
  expiry?: string;
  underlyingSymbol?: string;
  strikePrice?: number;
  optionType?: 'CE' | 'PE';
  lotSize?: number;
  tickSize?: number;
  requiresBrokerLogin: boolean;
  supportedBroker: 'ANGEL_ONE' | 'KITE' | 'NONE';
};

type SearchSymbolsParams = {
  q: string;
  provider?: string;
  marketType?: string;
  exchange?: string;
  instrumentType?: string;
  underlyingSymbol?: string;
  expiry?: string;
  optionType?: string;
  strikePrice?: number;
  limit?: number;
  signal?: AbortSignal;
};

export async function searchSymbols(params: SearchSymbolsParams): Promise<SymbolSearchResult[]> {
  const { signal, ...queryParams } = params;
  const response = await apiClient.get('/symbols/search', {
    params: queryParams,
    signal,
  });

  return Array.isArray(response.data?.data) ? response.data.data : [];
}
