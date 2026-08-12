import type { Types } from "mongoose";

import type { SymbolDocument } from "../../../models/Symbol.js";
import type {
  MarketDepthLevel,
  MarketQuoteMode,
  NormalizedMarketSnapshot,
} from "../../../types/market-data.types.js";
import type { AngelQuoteDepthLevel, AngelQuoteFetchedItem } from "./angel-quote.service.js";

type SymbolLike = SymbolDocument & {
  _id?: Types.ObjectId | string | undefined;
};

type MapAngelQuoteInput = {
  symbol: SymbolLike;
  angelQuote: AngelQuoteFetchedItem;
  mode: MarketQuoteMode;
};

const numberOrUndefined = (value: unknown): number | undefined => {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
};

const mapDepthLevels = (levels: AngelQuoteDepthLevel[] | undefined): MarketDepthLevel[] => {
  return (levels ?? []).map((level) => ({
    price: numberOrUndefined(level.price) ?? 0,
    quantity: numberOrUndefined(level.quantity) ?? 0,
    orders: numberOrUndefined(level.orders) ?? 0,
  }));
};

export const mapAngelQuoteToMarketSnapshot = ({
  symbol,
  angelQuote,
  mode,
}: MapAngelQuoteInput): NormalizedMarketSnapshot => {
  const snapshot: NormalizedMarketSnapshot = {
    provider: "ANGEL_ONE",
    marketType: symbol.marketType,
    exchange: symbol.exchange,
    symbol: symbol.symbol,
    displayName: symbol.displayName || symbol.symbol,
    providerSymbol: symbol.providerSymbol || angelQuote.tradingSymbol || symbol.symbol,
    instrumentToken: symbol.instrumentToken || angelQuote.symbolToken || "",
    mode,
  };

  if (symbol._id) {
    snapshot.symbolId = symbol._id.toString();
  }

  const numericFields: Array<[keyof NormalizedMarketSnapshot, unknown]> = [
    ["ltp", angelQuote.ltp],
    ["open", angelQuote.open],
    ["high", angelQuote.high],
    ["low", angelQuote.low],
    ["close", angelQuote.close],
    ["lastTradeQty", angelQuote.lastTradeQty],
    ["avgPrice", angelQuote.avgPrice],
    ["tradeVolume", angelQuote.tradeVolume],
    ["openInterest", angelQuote.opnInterest],
    ["netChange", angelQuote.netChange],
    ["percentChange", angelQuote.percentChange],
    ["lowerCircuit", angelQuote.lowerCircuit],
    ["upperCircuit", angelQuote.upperCircuit],
    ["totalBuyQuantity", angelQuote.totBuyQuan],
    ["totalSellQuantity", angelQuote.totSellQuan],
  ];

  for (const [key, value] of numericFields) {
    const numericValue = numberOrUndefined(value);
    if (numericValue !== undefined) {
      (snapshot as Record<string, unknown>)[key] = numericValue;
    }
  }

  if (angelQuote.exchFeedTime) {
    snapshot.exchangeFeedTime = angelQuote.exchFeedTime;
  }
  if (angelQuote.exchTradeTime) {
    snapshot.exchangeTradeTime = angelQuote.exchTradeTime;
  }
  if (angelQuote.depth) {
    snapshot.depth = {
      buy: mapDepthLevels(angelQuote.depth.buy),
      sell: mapDepthLevels(angelQuote.depth.sell),
    };
  }

  return snapshot;
};
