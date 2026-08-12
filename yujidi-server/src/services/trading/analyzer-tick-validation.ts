import type { NormalizedMarketTick } from "../../types/market-data.types.js";
import { buildMarketSubscriptionKey } from "../../utils/market-subscription-key.js";

export type AnalyzerTickValidationFailure = "INVALID_PRICE" | "MISSING_USER_ID";

export const validateNormalizedAnalyzerTick = (
  tick: NormalizedMarketTick,
): AnalyzerTickValidationFailure | null => {
  if (!Number.isFinite(tick.price) || tick.price <= 0) return "INVALID_PRICE";
  if (tick.provider === "ANGEL_ONE" && !tick.userId) return "MISSING_USER_ID";
  return null;
};

export const buildAnalyzerStreamKey = (tick: NormalizedMarketTick): string => {
  return tick.provider === "ANGEL_ONE"
    ? buildMarketSubscriptionKey({
      provider: tick.provider,
      userId: tick.userId!,
      exchange: tick.exchange,
      instrumentToken: tick.instrumentToken,
    })
    : buildMarketSubscriptionKey({
      provider: tick.provider,
      exchange: tick.exchange,
      instrumentToken: tick.instrumentToken,
    });
};
