export const TRADE_PERMISSIONS = [
  "TAKE_TRADE",
  "TAKE_SMALL_RISK",
  "WAIT",
  "REJECT",
  "STOP_TRADING",
] as const;
export type TradePermission = (typeof TRADE_PERMISSIONS)[number];

export const TRADE_DIRECTIONS = ["LONG", "SHORT"] as const;
export type TradeDirection = (typeof TRADE_DIRECTIONS)[number];

export type CanonicalSymbolRef = {
  symbolId: string;
  symbol: string;
  displayName: string;
};

export type TradeIdentityScope = {
  userId: string;
  tradePlanId?: string;
  symbolId?: string;
};
