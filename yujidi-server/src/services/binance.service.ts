import axios, { type AxiosResponse } from "axios";

import { SymbolModel } from "../models/Symbol.js";

interface BinanceExchangeInfoSymbol {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
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
