import type { TradeDirection, TradePermission } from "./trade.types.js";
import type { InstrumentType, MarketType } from "./market-data.types.js";

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

export const MISSING_DATA_POLICIES = ["BLOCK", "PARTIAL", "ZERO", "IGNORE"] as const;
export type MissingDataPolicy = (typeof MISSING_DATA_POLICIES)[number];

export const RULE_EXECUTION_STATUSES = ["EXECUTED", "PARTIAL", "SKIPPED", "BLOCKED"] as const;
export type RuleExecutionStatus = (typeof RULE_EXECUTION_STATUSES)[number];

export const SCORING_TEMPLATE_KEYS = [
  "INDIA_EQUITY_INTRADAY_V1",
  "INDIA_EQUITY_SWING_V1",
  "CRYPTO_SPOT_INTRADAY_V1",
  "CRYPTO_PERPETUAL_INTRADAY_V1",
  "COMMODITY_MCX_INTRADAY_V1",
] as const;
export type ScoringTemplateKey = (typeof SCORING_TEMPLATE_KEYS)[number];

export type ScoringSectionDefinition = {
  key: string;
  label: string;
  weight: number;
  evaluators: string[];
  missingDataPolicy: MissingDataPolicy;
};

export type ScoringTemplateDefinition = {
  key: ScoringTemplateKey;
  version: number;
  marketType: MarketType;
  tradeStyle: string;
  instrumentType: InstrumentType;
  maxScore: number;
  sections: ScoringSectionDefinition[];
};

export type ScoringRuleEvaluationResult = {
  evaluatorKey: string;
  status: RuleExecutionStatus;
  score: number;
  maxScore: number;
  reasonCodes: string[];
  warnings: string[];
  dataConfidence: DataConfidence;
  metadata?: Record<string, unknown>;
};

export type ScoringSectionResult = {
  sectionKey: string;
  label: string;
  score: number;
  maxScore: number;
  weight: number;
  status: RuleExecutionStatus;
  evaluatorResults: ScoringRuleEvaluationResult[];
  reasonCodes: string[];
  warnings: string[];
};

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
  "COMMODITY_TEMPLATE_USED",
  "MCX_CONTRACT_VALIDATED",
  "LOT_SIZE_AVAILABLE",
  "LOT_SIZE_MISSING",
  "TICK_SIZE_AVAILABLE",
  "TICK_SIZE_MISSING",
  "COMMODITY_BASELINE_ONLY",
  "EXPIRY_NEAR_WARNING",
  "BROKER_LOGIN_REQUIRED_FOR_LIVE_MONITORING",
] as const;
export type ScoreReasonCode = (typeof SCORE_REASON_CODES)[number];

export type ScoreDecision = {
  score: number;
  permission: TradePermission;
  direction: TradeDirection;
  reasonCodes: string[];
};
