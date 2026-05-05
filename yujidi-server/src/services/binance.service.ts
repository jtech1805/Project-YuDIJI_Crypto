import axios, { type AxiosResponse } from "axios";

import { SymbolModel } from "../models/Symbol.js";

interface BinanceExchangeInfoSymbol {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
}
// Add this interface near your other interfaces
interface BinanceTickerResponse {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  prevClosePrice: string;
  lastPrice: string;
  lastQty: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  firstId: number;
  lastId: number;
  count: number;
}

interface BinanceExchangeInfoResponse {
  symbols: BinanceExchangeInfoSymbol[];
}

export const syncBinanceSymbols = async (): Promise<number> => {
  const response: AxiosResponse<BinanceExchangeInfoResponse> = await axios.get(
    "https://api.binance.com/api/v3/exchangeInfo",
    {
      timeout: 15000,
    },
  );

  const filteredSymbols = response.data.symbols.filter((item): boolean => {
    return item.status === "TRADING" && item.quoteAsset === "USDT";
  });

  if (filteredSymbols.length === 0) {
    return 0;
  }

  const writeOperations = filteredSymbols.map((item) => {
    return {
      updateOne: {
        filter: { symbol: item.symbol },
        update: {
          $set: {
            symbol: item.symbol,
            baseAsset: item.baseAsset,
            quoteAsset: item.quoteAsset,
            status: item.status,
          },
        },
        upsert: true,
      },
    };
  });

  const bulkResult = await SymbolModel.bulkWrite(writeOperations, { ordered: false });

  return bulkResult.upsertedCount + bulkResult.modifiedCount;
};

// Add the LTP fetcher function
export const getSymbolLtp = async (symbol: string) => {
  const formattedSymbol = symbol.toUpperCase();

  const response: AxiosResponse<BinanceTickerResponse> = await axios.get(
    `https://api.binance.com/api/v3/ticker/24hr?symbol=${formattedSymbol}`,
    { timeout: 5000 }
  );

  const data = response.data;

  // Transform the Binance response into your exact required format
  return {
    type: "TICKER_UPDATE",
    symbol: data.symbol,
    currentPrice: data.lastPrice,
    previousClose: data.prevClosePrice,
    priceChangePercent: data.priceChangePercent,
  };
};