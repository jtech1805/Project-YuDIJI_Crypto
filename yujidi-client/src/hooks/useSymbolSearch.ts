import { useEffect, useRef, useState } from 'react';
import { AxiosError } from 'axios';

import { searchSymbols, type SymbolSearchResult } from '../api/symbols';

type UseSymbolSearchOptions = {
  provider?: string;
  marketType?: string;
  exchange?: string;
  instrumentType?: string;
  underlyingSymbol?: string;
  optionType?: string;
  strikePrice?: number;
  limit?: number;
  debounceMs?: number;
};

export function useSymbolSearch(query: string, options: UseSymbolSearchOptions = {}) {
  const [results, setResults] = useState<SymbolSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestQueryRef = useRef('');

  useEffect(() => {
    const normalizedQuery = query.trim();
    latestQueryRef.current = normalizedQuery;

    if (normalizedQuery.length < 2) {
      setResults([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const debounceMs = options.debounceMs ?? 300;
    const timeoutId = window.setTimeout(() => {
      setIsLoading(true);
      setError(null);

      searchSymbols({
        q: normalizedQuery,
        provider: options.provider,
        marketType: options.marketType,
        exchange: options.exchange,
        instrumentType: options.instrumentType,
        underlyingSymbol: options.underlyingSymbol,
        optionType: options.optionType,
        strikePrice: options.strikePrice,
        limit: options.limit ?? 20,
        signal: controller.signal,
      })
        .then((nextResults) => {
          if (latestQueryRef.current === normalizedQuery) {
            setResults(nextResults);
          }
        })
        .catch((requestError: unknown) => {
          if (
            requestError instanceof AxiosError &&
            (requestError.code === 'ERR_CANCELED' || requestError.name === 'CanceledError')
          ) {
            return;
          }

          if (latestQueryRef.current === normalizedQuery) {
            setError('Unable to search symbols');
            setResults([]);
          }
        })
        .finally(() => {
          if (latestQueryRef.current === normalizedQuery) {
            setIsLoading(false);
          }
        });
    }, debounceMs);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [
    query,
    options.provider,
    options.marketType,
    options.exchange,
    options.instrumentType,
    options.underlyingSymbol,
    options.optionType,
    options.strikePrice,
    options.limit,
    options.debounceMs,
  ]);

  return {
    results,
    isLoading,
    error,
  };
}
