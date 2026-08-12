export interface PriceTick {
  price: number;
  timestamp: number;
}

export interface CvdTrade {
  volumeDelta: number;
  timestamp: number;
}

const MAX_BUFFER_WINDOW_MS = 60 * 60 * 1000;
const CVD_BUFFER_WINDOW_MS = 60 * 1000;
const WHALE_THRESHOLD_BTC = 0.1;

export const advanceAnalyzerPriceBuffer = (
  ticks: PriceTick[],
  currentPrice: number,
  currentTimestamp: number,
): { ticks: PriceTick[]; bufferSizeBeforePush: number; culledCount: number } => {
  const bufferSizeBeforePush = ticks.length;
  ticks.push({ price: currentPrice, timestamp: currentTimestamp });
  const cullBefore = currentTimestamp - MAX_BUFFER_WINDOW_MS;
  let culledCount = 0;
  while (ticks.length > 0) {
    const oldestTick = ticks[0];
    if (!oldestTick || oldestTick.timestamp >= cullBefore) break;
    ticks.shift();
    culledCount += 1;
  }
  return { ticks, bufferSizeBeforePush, culledCount };
};

export const advanceAnalyzerCvdState = (
  cvdTrades: CvdTrade[],
  currentCvd: number,
  currentTimestamp: number,
  isBuyerMaker: boolean,
  quantity: number,
): { cvdTrades: CvdTrade[]; currentCvd: number } => {
  let nextCvd = currentCvd;
  const numericQuantity = parseFloat(quantity.toString());
  if (numericQuantity >= WHALE_THRESHOLD_BTC) {
    const volumeDelta = isBuyerMaker ? -numericQuantity : numericQuantity;
    nextCvd += volumeDelta;
    cvdTrades.push({ volumeDelta, timestamp: currentTimestamp });
  }

  const cullBefore = currentTimestamp - CVD_BUFFER_WINDOW_MS;
  while (cvdTrades.length > 0) {
    const oldestCvdTrade = cvdTrades[0];
    if (!oldestCvdTrade || oldestCvdTrade.timestamp >= cullBefore) break;
    nextCvd -= oldestCvdTrade.volumeDelta;
    cvdTrades.shift();
  }
  return { cvdTrades, currentCvd: nextCvd };
};

export const findAnalyzerBaseTick = (
  ticks: PriceTick[],
  windowStart: number,
): PriceTick | null => {
  for (let index = ticks.length - 1; index >= 0; index -= 1) {
    const tick = ticks[index];
    if (tick && tick.timestamp <= windowStart) return tick;
  }
  return null;
};
