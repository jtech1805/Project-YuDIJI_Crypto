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

export const ACTIVE_TRADE_STATUSES = [
  "ACTIVE",
  "PARTIALLY_EXITED",
  "CLOSED",
  "STOPPED_OUT",
  "CANCELLED",
] as const;
export type ActiveTradeStatus = (typeof ACTIVE_TRADE_STATUSES)[number];

export const EXECUTION_SOURCES = [
  "MANUAL_CONFIRMATION",
  "BROKER_SYNC_ASSISTED",
] as const;
export type ExecutionSource = (typeof EXECUTION_SOURCES)[number];

export const EXECUTION_QUALITIES = [
  "AS_PLANNED",
  "LATE_ENTRY",
  "EARLY_ENTRY",
  "DEGRADED_RR",
  "EXCEEDED_APPROVED_RISK",
  "STOPLOSS_CHANGED",
  "QUANTITY_CHANGED",
  "MANUAL_OVERRIDE",
] as const;
export type ExecutionQuality = (typeof EXECUTION_QUALITIES)[number];

export const TRADE_RULE_VIOLATIONS = [
  "TRADE_TAKEN_AFTER_REJECT",
  "SCORE_EXPIRED_BEFORE_EXECUTION",
  "ACTUAL_RISK_EXCEEDED_APPROVED_RISK",
  "ACTUAL_RR_BELOW_MINIMUM",
  "LATE_ENTRY_DEGRADED_RR",
  "STOPLOSS_WIDENED_AFTER_APPROVAL",
  "QUANTITY_EXCEEDED_APPROVED_SIZE",
  "TRADE_TAKEN_WITHOUT_STOPLOSS",
] as const;
export type TradeRuleViolation = (typeof TRADE_RULE_VIOLATIONS)[number];

export const TRADE_RESULT_STATUSES = [
  "DRAFT",
  "FINALIZED",
  "ADJUSTED",
  "VOIDED",
] as const;
export type TradeResultStatus = (typeof TRADE_RESULT_STATUSES)[number];

export const TRADE_RESULT_TYPES = ["WIN", "LOSS", "BREAKEVEN"] as const;
export type TradeResultType = (typeof TRADE_RESULT_TYPES)[number];

export const TRADE_EXIT_REASONS = [
  "STOPLOSS",
  "TARGET_1",
  "TARGET_2",
  "TRAILING_STOP",
  "MANUAL_EXIT",
  "TIME_EXIT",
  "RISK_EXIT",
  "BROKER_SYNC_EXIT",
] as const;
export type TradeExitReason = (typeof TRADE_EXIT_REASONS)[number];

export const TRADE_RESULT_PROJECTION_STATUSES = [
  "PENDING",
  "APPLIED",
  "REVERSED",
  "FAILED",
] as const;
export type TradeResultProjectionStatus =
  (typeof TRADE_RESULT_PROJECTION_STATUSES)[number];

export const COST_COMPONENT_TYPES = [
  "BROKERAGE",
  "EXCHANGE_FEE",
  "TAX",
  "GST",
  "STT",
  "STAMP_DUTY",
  "SEBI_CHARGE",
  "TRANSACTION_CHARGE",
  "CRYPTO_TRADING_FEE",
  "FUNDING_COST",
  "CONVERSION_FEE",
  "OTHER",
] as const;
export type CostComponentType = (typeof COST_COMPONENT_TYPES)[number];

export const JOURNAL_STATUSES = ["DRAFT", "FINALIZED", "INCOMPLETE", "ARCHIVED"] as const;
export type JournalStatus = (typeof JOURNAL_STATUSES)[number];

export const JOURNAL_MODES = ["MANAGED_TRADE", "UNMANAGED_MANUAL"] as const;
export type JournalMode = (typeof JOURNAL_MODES)[number];

export const SETUP_TYPES = [
  "BREAKOUT", "BREAKDOWN", "PULLBACK", "VWAP_RECLAIM", "VWAP_REJECTION",
  "RANGE_BREAK", "REVERSAL", "MOMENTUM_CONTINUATION", "SCALP", "OTHER",
] as const;
export type SetupType = (typeof SETUP_TYPES)[number];

export const ENTRY_QUALITIES = [
  "VALID_ENTRY", "EARLY_ENTRY", "LATE_ENTRY", "CHASED_ENTRY",
  "NO_CLEAR_TRIGGER", "ENTERED_AGAINST_PLAN",
] as const;
export type EntryQuality = (typeof ENTRY_QUALITIES)[number];

export const EXIT_QUALITIES = [
  "FOLLOWED_STOP", "EXITED_AT_TARGET", "BOOKED_PARTIAL_AS_PLANNED",
  "EXITED_TOO_EARLY", "EXITED_TOO_LATE", "MOVED_SL_WIDER",
  "PANIC_EXIT", "NO_EXIT_PLAN",
] as const;
export type ExitQuality = (typeof EXIT_QUALITIES)[number];

export const OUTCOME_QUALITIES = [
  "PROFIT_WITH_GOOD_PROCESS", "PROFIT_WITH_BAD_PROCESS",
  "LOSS_WITH_GOOD_PROCESS", "LOSS_WITH_BAD_PROCESS",
  "BREAKEVEN_WITH_GOOD_PROCESS", "BREAKEVEN_WITH_BAD_PROCESS",
] as const;
export type OutcomeQuality = (typeof OUTCOME_QUALITIES)[number];

export const EMOTIONAL_STATES = [
  "CALM", "CONFIDENT", "FEARFUL", "FOMO", "REVENGE_TRADING",
  "GREEDY", "HESITANT", "IMPULSIVE", "FRUSTRATED", "TIRED",
] as const;
export type EmotionalState = (typeof EMOTIONAL_STATES)[number];

export const MISTAKE_TAGS = [
  "CHASED_ENTRY", "ENTERED_WITHOUT_CONFIRMATION", "IGNORED_MARKET_CONTEXT",
  "IGNORED_SECTOR_CONTEXT", "POOR_RR", "OVERSIZED_POSITION", "MOVED_SL_WIDER",
  "AVERAGED_LOSER", "EXITED_TOO_EARLY", "EXITED_TOO_LATE", "REVENGE_TRADE",
  "OVERTRADED", "BROKE_STOP_TRADING_RULE", "NONE",
] as const;
export type MistakeTag = (typeof MISTAKE_TAGS)[number];

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
