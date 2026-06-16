import axios, { type AxiosResponse } from "axios";
import type { AnyBulkWriteOperation } from "mongoose";

import { SymbolModel, type SymbolDocument } from "../models/Symbol.js";
import { tokenizeSymbolSearch } from "../utils/symbol-search-tokenizer.js";

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

const cryptoNameMap: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  SOL: "Solana",
  BNB: "BNB",
  XRP: "XRP",
  ADA: "Cardano",
  DOGE: "Dogecoin",
};

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

  const writeOperations: AnyBulkWriteOperation<SymbolDocument>[] = filteredSymbols.map((item) => {
    const name = cryptoNameMap[item.baseAsset] ?? item.baseAsset;
    const displayName = `${item.baseAsset} / ${item.quoteAsset}`;
    const searchFields = tokenizeSymbolSearch({
      symbol: item.symbol,
      displayName,
      providerSymbol: item.symbol,
      name,
      baseAsset: item.baseAsset,
      quoteAsset: item.quoteAsset,
      exchange: "BINANCE",
      marketType: "CRYPTO",
      instrumentType: "SPOT",
    });

    return {
      updateOne: {
        filter: {
          $or: [
            {
              provider: "BINANCE",
              exchange: "BINANCE",
              instrumentToken: item.symbol,
            },
            {
              symbol: item.symbol,
            },
          ],
        },
        update: {
          $set: {
            provider: "BINANCE",
            marketType: "CRYPTO",
            exchange: "BINANCE",
            symbol: item.symbol,
            name,
            displayName,
            providerSymbol: item.symbol,
            instrumentToken: item.symbol,
            baseAsset: item.baseAsset,
            quoteAsset: item.quoteAsset,
            instrumentType: "SPOT",
            requiresBrokerLogin: false,
            supportedBroker: "NONE",
            status: "ACTIVE",
            ...searchFields,
            searchRank: item.symbol === "BTCUSDT" ? 100 : item.symbol === "ETHUSDT" ? 90 : 0,
            raw: item,
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
