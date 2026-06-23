import type { TradeDirection, TradePermission } from "./trade.types.js";

export const SCORE_MODES = [
  "STANDALONE_SCORE_CHECK",
  "TRADE_PLAN_SCORE",
] as const;
export type ScoreMode = (typeof SCORE_MODES)[number];

export const SCORE_STATUSES = [
  "READY",
  "READY_WITH_STALE_DATA",
  "PARTIAL_DATA",
  "PROCESSING",
  "UNAVAILABLE",
] as const;
export type ScoreStatus = (typeof SCORE_STATUSES)[number];

export const DATA_CONFIDENCE_LEVELS = ["HIGH", "MEDIUM", "LOW"] as const;
export type DataConfidence = (typeof DATA_CONFIDENCE_LEVELS)[number];

export const SCORING_TEMPLATE_KEYS = [
  "INDIA_EQUITY_INTRADAY_V1",
  "INDIA_EQUITY_SWING_V1",
  "CRYPTO_SPOT_INTRADAY_V1",
  "CRYPTO_PERPETUAL_INTRADAY_V1",
] as const;
export type ScoringTemplateKey = (typeof SCORING_TEMPLATE_KEYS)[number];

export const SCORE_REASON_CODES = [
  "VALID_GEOMETRY",
  "INVALID_LONG_GEOMETRY",
  "INVALID_SHORT_GEOMETRY",
  "RR_BELOW_MINIMUM",
  "RR_ACCEPTABLE",
  "SYMBOL_NOT_FOUND",
  "SYMBOL_INACTIVE",
  "UNSUPPORTED_TEMPLATE",
  "DATA_CONFIDENCE_LOW",
  "SCORE_CHECK_CREATED",
  "SCORE_CALCULATED",
] as const;
export type ScoreReasonCode = (typeof SCORE_REASON_CODES)[number];

export type ScoreDecision = {
  score: number;
  permission: TradePermission;
  direction: TradeDirection;
  reasonCodes: string[];
};
