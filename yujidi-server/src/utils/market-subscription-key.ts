export type MarketSubscriptionKeyInput = {
  provider: string;
  exchange: string;
  instrumentToken: string;
  userId?: string;
};

export function buildMarketSubscriptionKey(input: MarketSubscriptionKeyInput): string {
  if (input.provider === "ANGEL_ONE") {
    if (!input.userId) {
      throw new Error("userId is required for ANGEL_ONE subscription key");
    }

    return `${input.provider}:${input.userId}:${input.exchange}:${input.instrumentToken}`;
  }

  return `${input.provider}:${input.exchange}:${input.instrumentToken}`;
}
