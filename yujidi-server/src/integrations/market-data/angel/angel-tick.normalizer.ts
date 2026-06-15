import type { Exchange, MarketType, NormalizedMarketTick } from "../../../types/market-data.types.js";
import type { AngelRawTick } from "./angel.types.js";

const inferMarketTypeFromExchange = (exchange: Exchange): MarketType => {
  if (exchange === "MCX" || exchange === "NCDEX") {
    return "COMMODITY";
  }

  if (exchange === "NFO" || exchange === "BFO") {
    return "FNO";
  }

  if (exchange === "CDS") {
    return "CURRENCY";
  }

  if (exchange === "NSE" || exchange === "BSE") {
    return "EQUITY";
  }

  return "INDEX";
};

export const normalizeAngelTick = (rawTick: AngelRawTick): NormalizedMarketTick => {
  const exchange = rawTick.exchange;
  const token = rawTick.token;
  const symbol = rawTick.symbol;
  const price = rawTick.lastTradedPrice ?? rawTick.ltp ?? rawTick.price;

  if (!exchange) {
    throw new Error("Angel tick is missing exchange");
  }

  if (!token) {
    throw new Error("Angel tick is missing instrument token");
  }

  if (!symbol) {
    throw new Error("Angel tick is missing symbol");
  }

  if (!Number.isFinite(price) || !price || price <= 0) {
    throw new Error("Angel tick has invalid last traded price");
  }

  const normalized: NormalizedMarketTick = {
    provider: "ANGEL_ONE",
    marketType: rawTick.marketType ?? inferMarketTypeFromExchange(exchange),
    exchange,
    symbol,
    displaySymbol: rawTick.displaySymbol ?? symbol,
    instrumentToken: token,
    price,
    timestamp: rawTick.timestamp ?? Date.now(),
    raw: rawTick.raw ?? rawTick,
  };

  if (rawTick.volume !== undefined) {
    normalized.volume = rawTick.volume;
  }

  return normalized;
};
