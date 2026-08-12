export const AI_TASK_TYPES = [
  "PRE_TRADE_EXPLANATION",
  "SCORE_REJECTION_EXPLANATION",
  "RISK_REDUCTION_EXPLANATION",
  "STOP_TRADING_EXPLANATION",
  "ACTIVE_TRADE_ALERT_EXPLANATION",
  "POST_TRADE_REVIEW",
  "PLAN_REVIEW",
  "DATA_QUALITY_WARNING",
] as const;
export type AiTaskType = (typeof AI_TASK_TYPES)[number];

export const AI_EXPLANATION_STATUSES = [
  "REQUESTED",
  "COMPLETED",
  "VALIDATION_FAILED",
  "FALLBACK_USED",
  "FAILED",
] as const;
export type AiExplanationStatus = (typeof AI_EXPLANATION_STATUSES)[number];

export const AI_SOURCE_TYPES = [
  "SCORE_CHECK",
  "TRADE_SETUP",
  "ACTIVE_TRADE",
  "TRADE_EVENT",
  "TRADE_RESULT",
  "TRADE_JOURNAL",
  "TRADE_PLAN",
] as const;
export type AiSourceType = (typeof AI_SOURCE_TYPES)[number];

export const AI_PROCESS_QUALITIES = [
  "GOOD_PROCESS",
  "MIXED_PROCESS",
  "BAD_PROCESS",
] as const;
export type AiProcessQuality = (typeof AI_PROCESS_QUALITIES)[number];

export const AI_CONFIDENCE_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;
export type AiConfidence = (typeof AI_CONFIDENCE_LEVELS)[number];
