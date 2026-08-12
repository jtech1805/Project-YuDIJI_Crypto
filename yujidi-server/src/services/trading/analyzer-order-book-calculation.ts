export type AnalyzerOrderBookSnapshot = {
  bids: string[][];
  asks: string[][];
};

export type AnalyzerStructuralLevels = {
  currentPrice: string;
  support: string;
  resistance: string;
  rawCurrentPrice?: number;
  rawSupport?: number;
  rawResistance?: number;
  debugData?: {
    averageBid: string;
    requiredBidWall: string;
    averageAsk: string;
    requiredAskWall: string;
  };
};

const UNKNOWN_LEVELS = {
  currentPrice: "Unknown",
  support: "Unknown",
  resistance: "Unknown",
} as const;

const averageVolumeAfterNoiseLevels = (levels: string[][]): number => {
  let totalVolume = 0;
  let validLevels = 0;
  let levelNumber = 0;
  for (const entry of levels) {
    levelNumber += 1;
    if (levelNumber <= 3) continue;
    const quantity = parseFloat(entry[1] ?? "0");
    if (!Number.isNaN(quantity)) {
      totalVolume += quantity;
      validLevels += 1;
    }
  }
  return validLevels > 0 ? totalVolume / validLevels : 0;
};

const findStructuralWall = (
  levels: string[][],
  requiredVolume: number,
): { price: string; volume: number } => {
  let structuralPrice = "0";
  let structuralVolume = 0;
  let levelNumber = 0;
  for (const entry of levels) {
    levelNumber += 1;
    const priceText = entry[0];
    const quantityText = entry[1];
    if (priceText === undefined || quantityText === undefined) continue;
    const price = parseFloat(priceText);
    const quantity = parseFloat(quantityText);
    if (Number.isNaN(price) || Number.isNaN(quantity)) continue;
    if (levelNumber <= 3) continue;
    if (quantity > structuralVolume && quantity >= requiredVolume) {
      structuralVolume = quantity;
      structuralPrice = priceText;
    }
  }
  return { price: structuralPrice, volume: structuralVolume };
};

export const calculateStructuralSupportResistance = (
  book: AnalyzerOrderBookSnapshot | undefined,
): AnalyzerStructuralLevels => {
  if (!book || !book.bids.length || !book.asks.length) return UNKNOWN_LEVELS;
  const topBidText = book.bids[0]?.[0];
  const topAskText = book.asks[0]?.[0];
  if (!topBidText || !topAskText) return UNKNOWN_LEVELS;

  const currentPrice = (parseFloat(topBidText) + parseFloat(topAskText)) / 2;
  const averageBid = averageVolumeAfterNoiseLevels(book.bids);
  const averageAsk = averageVolumeAfterNoiseLevels(book.asks);
  const requiredBidWall = averageBid * 2.5;
  const requiredAskWall = averageAsk * 2.5;
  const support = findStructuralWall(book.bids, requiredBidWall);
  const resistance = findStructuralWall(book.asks, requiredAskWall);

  return {
    currentPrice: `$${currentPrice.toLocaleString()}`,
    support: support.volume > 0
      ? `$${parseFloat(support.price).toLocaleString()} (${support.volume.toFixed(2)} coins)`
      : "No strong support found",
    resistance: resistance.volume > 0
      ? `$${parseFloat(resistance.price).toLocaleString()} (${resistance.volume.toFixed(2)} coins)`
      : "No strong resistance found",
    rawCurrentPrice: currentPrice,
    rawSupport: parseFloat(support.price),
    rawResistance: parseFloat(resistance.price),
    debugData: {
      averageBid: averageBid.toFixed(2),
      requiredBidWall: requiredBidWall.toFixed(2),
      averageAsk: averageAsk.toFixed(2),
      requiredAskWall: requiredAskWall.toFixed(2),
    },
  };
};
