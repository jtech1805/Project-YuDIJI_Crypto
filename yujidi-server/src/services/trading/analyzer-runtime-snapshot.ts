import type { CvdTrade, PriceTick } from "./analyzer-state-transition.js";

export type AnalyzerRuntimeSnapshot = {
  streamKey?: string;
  latestPrice?: number;
  priceBuffer: {
    available: boolean;
    count: number;
    returnedCount: number;
    firstTimestamp?: number;
    lastTimestamp?: number;
    minPrice?: number;
    maxPrice?: number;
    changePercent?: number;
    items?: PriceTick[];
  };
  cvd: {
    available: boolean;
    currentCVD?: number;
    bufferCount: number;
    returnedCount: number;
    netDelta?: number;
    items?: CvdTrade[];
  };
  cooldown: {
    active: boolean;
    activeCount: number;
    remainingMs: number;
  };
  orderBook: {
    available: boolean;
    bidLevels: number;
    askLevels: number;
    bestBid?: number;
    bestAsk?: number;
    reasonCode?: string;
  };
};

type AnalyzerOrderBook = { bids: string[][]; asks: string[][] };

export const buildAnalyzerRuntimeSnapshot = (input: {
  streamKeys: string[];
  includeBuffers?: boolean;
  bufferLimit?: number;
  now?: number;
  cooldownMs: number;
  priceBuffer: ReadonlyMap<string, PriceTick[]>;
  cvdBuffer: ReadonlyMap<string, CvdTrade[]>;
  currentCVD: ReadonlyMap<string, number>;
  cooldowns: ReadonlyMap<string, number>;
  orderBookSnapshot: ReadonlyMap<string, AnalyzerOrderBook>;
}): AnalyzerRuntimeSnapshot => {
  const limit = Math.min(100, Math.max(1, Math.trunc(input.bufferLimit ?? 20)));
  const streamKey = input.streamKeys.find((key) =>
    input.priceBuffer.has(key)
    || input.cvdBuffer.has(key)
    || input.currentCVD.has(key)
    || input.orderBookSnapshot.has(key));
  const priceTicks = streamKey ? input.priceBuffer.get(streamKey) ?? [] : [];
  const cvdTrades = streamKey ? input.cvdBuffer.get(streamKey) ?? [] : [];
  const currentCvd = streamKey ? input.currentCVD.get(streamKey) : undefined;
  const orderBook = streamKey ? input.orderBookSnapshot.get(streamKey) : undefined;
  const firstPrice = priceTicks[0];
  const lastPrice = priceTicks.at(-1);
  const prices = priceTicks.map((tick) => tick.price);
  const now = input.now ?? Date.now();
  const activeCooldowns = [...input.cooldowns.values()]
    .map((triggeredAt) => Math.max(0, input.cooldownMs - (now - triggeredAt)))
    .filter((remainingMs) => remainingMs > 0);
  const bids = orderBook?.bids ?? [];
  const asks = orderBook?.asks ?? [];
  const bestBid = Number(bids[0]?.[0]);
  const bestAsk = Number(asks[0]?.[0]);

  return {
    ...(streamKey ? { streamKey } : {}),
    ...(lastPrice ? { latestPrice: lastPrice.price } : {}),
    priceBuffer: {
      available: priceTicks.length > 0,
      count: priceTicks.length,
      returnedCount: input.includeBuffers ? Math.min(limit, priceTicks.length) : 0,
      ...(firstPrice ? { firstTimestamp: firstPrice.timestamp } : {}),
      ...(lastPrice ? { lastTimestamp: lastPrice.timestamp } : {}),
      ...(prices.length > 0 ? {
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
      } : {}),
      ...(firstPrice && lastPrice && firstPrice.price > 0 ? {
        changePercent: Number((((lastPrice.price - firstPrice.price) / firstPrice.price) * 100).toFixed(4)),
      } : {}),
      ...(input.includeBuffers ? { items: priceTicks.slice(-limit).map((item) => ({ ...item })) } : {}),
    },
    cvd: {
      available: cvdTrades.length > 0 || (streamKey ? input.currentCVD.has(streamKey) : false),
      ...(currentCvd !== undefined ? { currentCVD: currentCvd } : {}),
      bufferCount: cvdTrades.length,
      returnedCount: input.includeBuffers ? Math.min(limit, cvdTrades.length) : 0,
      ...(cvdTrades.length > 0 ? {
        netDelta: Number(cvdTrades.reduce((total, item) => total + item.volumeDelta, 0).toFixed(4)),
      } : {}),
      ...(input.includeBuffers ? { items: cvdTrades.slice(-limit).map((item) => ({ ...item })) } : {}),
    },
    cooldown: {
      active: activeCooldowns.length > 0,
      activeCount: activeCooldowns.length,
      remainingMs: activeCooldowns.length > 0 ? Math.max(...activeCooldowns) : 0,
    },
    orderBook: orderBook ? {
      available: true,
      bidLevels: bids.length,
      askLevels: asks.length,
      ...(Number.isFinite(bestBid) ? { bestBid } : {}),
      ...(Number.isFinite(bestAsk) ? { bestAsk } : {}),
    } : {
      available: false,
      bidLevels: 0,
      askLevels: 0,
      reasonCode: "ORDER_BOOK_UNAVAILABLE",
    },
  };
};
