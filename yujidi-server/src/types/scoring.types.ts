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
  "INDIA_FNO_FUTURE_INTRADAY_V1",
  "INDIA_FNO_OPTION_INTRADAY_V1",
] as const;
export type ScoringTemplateKey = (typeof SCORING_TEMPLATE_KEYS)[number];
export const INTERNAL_SYSTEM_TEMPLATE_KEYS = ["CRYPTO_BTC_ETF_FLOW_DAILY_V1"] as const;
export type InternalSystemTemplateKey = (typeof INTERNAL_SYSTEM_TEMPLATE_KEYS)[number];
export type SystemTemplateKey = ScoringTemplateKey | InternalSystemTemplateKey;

export type ScoringSectionDefinition = {
  key: string;
  label: string;
  weight: number;
  evaluators: string[];
  missingDataPolicy: MissingDataPolicy;
};

export type ScoringTemplateDefinition = {
  key: SystemTemplateKey;
  version: number;
  marketType: MarketType;
  tradeStyle: string;
  instrumentType: InstrumentType;
  maxScore: number;
  aggregationMode?: "NORMALIZE_EXECUTED" | "WEIGHTED_SUM";
  sections: ScoringSectionDefinition[];
};

export type SystemTemplateCapabilities = Readonly<{
  listable: boolean;
  scoreCheckSelectable: boolean;
  duplicable: boolean;
  compileEligible: boolean;
}>;

export type SystemTemplateRegistration = Readonly<{
  template: ScoringTemplateDefinition;
  capabilities: SystemTemplateCapabilities;
}>;

export const SCORING_TEMPLATE_SCOPES = ["SYSTEM", "USER"] as const;
export type ScoringTemplateScope = (typeof SCORING_TEMPLATE_SCOPES)[number];

export const SCORING_TEMPLATE_VISIBILITIES = ["PRIVATE", "PUBLIC"] as const;
export type ScoringTemplateVisibility = (typeof SCORING_TEMPLATE_VISIBILITIES)[number];

export const SCORING_TEMPLATE_STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
export type ScoringTemplateStatus = (typeof SCORING_TEMPLATE_STATUSES)[number];

export type ScoringPermissionThresholds = {
  rejectBelow: number;
  waitBelow: number;
  takeSmallRiskBelow: number;
  takeTradeAtOrAbove: number;
};

export type EditableScoringEvaluatorDefinition = {
  evaluatorKey: string;
  label: string;
  weight: number;
  enabled: boolean;
  missingDataPolicy?: MissingDataPolicy;
  config?: Record<string, unknown>;
};

export type EditableScoringSectionDefinition = {
  sectionKey: string;
  label: string;
  weight: number;
  enabled: boolean;
  missingDataPolicy: MissingDataPolicy;
  evaluators: EditableScoringEvaluatorDefinition[];
};

export type ScoringTemplateResourceConfig = {
  marketRegime?: {
    marketIndexSymbolId?: string | undefined;
    bankIndexSymbolId?: string | undefined;
    volatilitySymbolId?: string | undefined;
  } | undefined;
  sectorContext?: {
    sectorName?: string | undefined;
    sectorIndexSymbolId?: string | undefined;
  } | undefined;
  relatedSymbols?: string[] | undefined;
};

export type ScoringTemplateSectionOverride = {
  sectionKey: string;
  weight: number;
  enabled: boolean;
};

export type ScoringTemplateSnapshotPolicy = {
  captureMarketRegime: boolean;
  captureSectorContext: boolean;
  captureRelatedSymbols: boolean;
  captureAllowedTradableSymbol: boolean;
  maxSnapshotAgeSeconds: number;
};

export type ScoringTemplateResourceRole =
  | "PRIMARY_SYMBOL"
  | "MARKET_INDEX"
  | "BANK_INDEX"
  | "VOLATILITY_INDEX"
  | "SECTOR_INDEX"
  | "RELATED_SYMBOL";

export type ScoringTemplateResourceFreshnessStatus =
  | "READY"
  | "STALE"
  | "MISSING"
  | "PARTIAL"
  | "BLOCKING_MISSING";

export type ScoringTemplateResolvedResource = {
  role: ScoringTemplateResourceRole;
  symbolId: string;
  symbol: string;
  exchange: string;
  provider: string;
  marketType: string;
  instrumentType: string;
  required: boolean;
  source: "SCORE_CHECK_SYMBOL" | "TEMPLATE_RESOURCE_CONFIG";
};

export type ScoringTemplateResourceSnapshot = {
  role: ScoringTemplateResourceRole;
  symbolId: string;
  symbol: string;
  price?: number;
  changePercent?: number;
  open?: number;
  high?: number;
  low?: number;
  previousClose?: number;
  vwap?: number;
  vwapPosition?: string;
  volume?: number;
  freshnessStatus: ScoringTemplateResourceFreshnessStatus;
  ageMs?: number;
  occurredAt?: Date;
  receivedAt?: Date;
  warnings: string[];
};

export type ScoringTemplateResourceSnapshotContext = {
  resolvedResources: ScoringTemplateResolvedResource[];
  resourceSnapshots: ScoringTemplateResourceSnapshot[];
  resourceReadinessSummary: {
    total: number;
    ready: number;
    stale: number;
    missing: number;
    partial: number;
    blockingMissing: number;
  };
  warnings: string[];
  blockers: string[];
};

export type ResolvedScoringTemplateDefinition = {
  id?: string;
  templateKey: string;
  baseTemplateKey: ScoringTemplateKey;
  templateName: string;
  description?: string;
  scope: ScoringTemplateScope;
  version: number;
  marketType: MarketType;
  tradeStyle: string;
  instrumentType: InstrumentType;
  maxScore: number;
  aggregationMode?: "NORMALIZE_EXECUTED" | "WEIGHTED_SUM";
  sections: EditableScoringSectionDefinition[];
  permissionThresholds: ScoringPermissionThresholds;
  resourceConfig?: ScoringTemplateResourceConfig;
  allowedTradableSymbols?: string[];
  sectionOverrides?: ScoringTemplateSectionOverride[];
  snapshotPolicy?: ScoringTemplateSnapshotPolicy;
};

export const SCORING_SETUP_TYPES = [
  "BREAKOUT",
  "PULLBACK",
  "VWAP_RECLAIM",
  "VWAP_REJECTION",
  "RANGE_BREAKDOWN",
  "SUPPORT_BOUNCE",
  "RESISTANCE_REJECTION",
] as const;
export type ScoringSetupType = (typeof SCORING_SETUP_TYPES)[number];

export type ScoringUserLevels = {
  breakoutLevel?: number;
  supportLevel?: number;
  resistanceLevel?: number;
  pullbackZone?: number;
  rangeHigh?: number;
  rangeLow?: number;
};

export type ScoringContextSymbolIds = {
  indexSymbolId?: string;
  sectorSymbolId?: string;
  vixSymbolId?: string;
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
