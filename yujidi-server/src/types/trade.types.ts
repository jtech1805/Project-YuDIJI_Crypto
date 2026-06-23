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

export const PLAN_MODES = [
  "FIXED_TRADE_COUNT",
  "DATE_RANGE",
  "CONTINUOUS",
] as const;
export type PlanMode = (typeof PLAN_MODES)[number];

export const TRADE_PLAN_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "STOPPED",
  "ARCHIVED",
] as const;
export type TradePlanStatus = (typeof TRADE_PLAN_STATUSES)[number];

export const REVIEW_CADENCES = [
  "DAILY",
  "WEEKLY",
  "MONTHLY",
  "PLAN_END",
] as const;
export type ReviewCadence = (typeof REVIEW_CADENCES)[number];

export const CAPITAL_ADJUSTMENT_TYPES = [
  "DEPOSIT",
  "WITHDRAWAL",
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "MANUAL_CORRECTION",
] as const;
export type CapitalAdjustmentType = (typeof CAPITAL_ADJUSTMENT_TYPES)[number];

export const TRADE_SETUP_STATUSES = [
  "DRAFT",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
  "EXECUTED",
  "CANCELLED",
] as const;
export type TradeSetupStatus = (typeof TRADE_SETUP_STATUSES)[number];

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
