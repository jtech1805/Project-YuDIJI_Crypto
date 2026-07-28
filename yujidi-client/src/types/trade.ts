export type TradePermission =
  | 'TAKE_TRADE'
  | 'TAKE_SMALL_RISK'
  | 'WAIT'
  | 'REJECT'
  | 'STOP_TRADING'

export type TradeDirection = 'LONG' | 'SHORT'
export type MarketType = 'CRYPTO' | 'EQUITY' | 'FNO' | 'COMMODITY' | 'CURRENCY' | 'INDEX'
export type InstrumentType = 'SPOT' | 'CASH' | 'FUTURE' | 'OPTION' | 'INDEX' | 'UNKNOWN'

export type SymbolSnapshot = {
  symbolId: string
  symbol: string
  displayName: string
  provider: string
  marketType: MarketType
  exchange: string
  instrumentType: InstrumentType
  providerSymbol?: string
  requiresBrokerLogin?: boolean
}

export type TradePlan = {
  _id: string
  name: string
  description?: string
  marketType: MarketType
  tradeStyle: string
  instrumentType: InstrumentType
  planMode: 'FIXED_TRADE_COUNT' | 'DATE_RANGE' | 'CONTINUOUS'
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'STOPPED' | 'ARCHIVED'
  startingCapital: number
  currentCapital?: number
  currency: string
  maxRiskPerTradePercent: number
  maxDailyLossPercent?: number
  maxConsecutiveLosses?: number
  maxTrades?: number
  reviewCadence?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'PLAN_END'
  createdAt: string
  isDeleted?: boolean
  deletedAt?: string
}

export type CreateTradePlanInput = {
  name: string
  description?: string
  marketType: MarketType
  tradeStyle: string
  instrumentType: InstrumentType
  planMode: TradePlan['planMode']
  startingCapital: number
  currency: string
  maxRiskPerTradePercent: number
  maxDailyLossPercent?: number
  maxConsecutiveLosses?: number
  maxTrades?: number
  reviewCadence?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'PLAN_END'
}

export type UpdateTradePlanInput = Partial<CreateTradePlanInput>

export type TradePlanDashboardSummary = {
  plan: {
    id: string
    name: string
    status: TradePlan['status']
    marketType: MarketType
    instrumentType: InstrumentType
    tradeStyle: string
    planMode: TradePlan['planMode']
    allowedTrades: number | null
    usedTrades: number
    remainingTrades: number | null
  }
  capital: {
    startingCapital: number
    capitalBase: number
    totalDeposits: number
    totalWithdrawals: number
    realizedGrossPnl: number
    realizedNetPnl: number
    currentCapital: number
    availableCapital: number
    openRiskAmount: number
    pnlBasis: 'CONFIRMED_NET' | 'ESTIMATED_NET' | 'GROSS_FALLBACK'
  }
  performance: {
    totalClosedTrades: number
    wins: number
    losses: number
    breakeven: number
    winRate: number
    averageR: number
    totalRealizedR: number
  }
  risk: {
    riskMode: 'NORMAL_RISK' | 'REDUCED_RISK' | 'MICRO_RISK' | 'STOP_TRADING'
    dailyRiskUsed: number
    planRiskUsed: number
    maxDailyRisk: number | null
    maxPlanRisk: number
    canTakeNextTrade: boolean
    blockReasons: string[]
    stopTradingReasons?: string[]
    resetAvailable?: boolean
    restartAvailable?: boolean
    hasOpenTrades?: boolean
  }
  latestTrades: Array<{
    tradeResultId: string
    activeTradeId?: string
    symbol?: string
    displayName?: string
    direction?: TradeDirection
    entryPrice?: number
    exitPrice?: number
    quantity?: number
    grossPnl?: number
    netPnl?: number
    realizedR?: number
    resultType?: 'WIN' | 'LOSS' | 'BREAKEVEN'
    exitReason?: string
    closedAt?: string
  }>
}

export type ResetRiskLockInput = {
  reason: string
  resetDailyRisk?: boolean
  resetPlanRiskLock?: boolean
}

export type ResetRiskLockResult = {
  tradePlanId: string
  riskMode: TradePlanDashboardSummary['risk']['riskMode']
  canTakeNextTrade: boolean
  message: string
}

export type RestartTradePlanInput = {
  name?: string
  startingCapital: number
  archiveOldPlan?: boolean
  reason: string
  carrySettings?: boolean
  activateNewPlan?: boolean
}

export type RestartTradePlanResult = {
  oldTradePlanId: string
  newTradePlan: TradePlan
  oldPlanArchived: boolean
  message: string
}

export type ScoreResourceReadinessSummary = {
  total: number
  ready: number
  stale: number
  missing: number
  partial: number
  blockingMissing: number
}

export type ScoreResolvedResource = {
  role: string
  symbolId: string
  symbol: string
  exchange: string
  provider: string
  marketType: string
  instrumentType: string
  required: boolean
  source: string
}

export type ScoreResourceSnapshot = {
  role: string
  symbolId: string
  symbol: string
  price?: number
  changePercent?: number
  open?: number
  high?: number
  low?: number
  previousClose?: number
  vwap?: number
  vwapPosition?: string
  volume?: number
  freshnessStatus: 'READY' | 'STALE' | 'MISSING' | 'PARTIAL' | 'BLOCKING_MISSING'
  ageMs?: number
  occurredAt?: string
  receivedAt?: string
  warnings: string[]
}

export type ScoreResourceSnapshotSummary = {
  resolvedResources: ScoreResolvedResource[]
  resourceSnapshots: ScoreResourceSnapshot[]
  resourceReadinessSummary: ScoreResourceReadinessSummary
  warnings: string[]
  blockers: string[]
}

export type ScoreCheckSnapshot = {
  _id: string
  scoreCheckId: string
  scoringTemplateId?: string
  scoringTemplateKey: string
  scoringTemplateName: string
  scoringTemplateVersion: string
  scoringTemplateScope: 'SYSTEM' | 'USER'
  selectedSymbol: {
    symbolId: string
    symbol: string
    exchange: string
    provider: string
    marketType: string
    instrumentType: string
  }
  resolvedResources: ScoreResolvedResource[]
  resourceSnapshots: ScoreResourceSnapshot[]
  resourceReadinessSummary: ScoreResourceReadinessSummary
  sectionBreakdown: Array<{
    sectionKey: string
    label?: string
    score?: number
    maxScore?: number
    weight?: number
    status?: string
    reasonCodes?: string[]
    warnings?: string[]
  }>
  finalScore: number
  permission: TradePermission
  scoreStatus: string
  dataConfidence: 'HIGH' | 'MEDIUM' | 'LOW'
  warnings: string[]
  blockers: string[]
  expiresAt: string
  createdAt: string
  updatedAt?: string
}

export type ScoreCheck = {
  _id: string
  symbolId: string
  symbolSnapshot?: SymbolSnapshot
  marketType: MarketType
  tradeStyle: string
  instrumentType: InstrumentType
  direction: TradeDirection
  entry: number
  stopLoss: number
  target1: number
  target2?: number
  rewardRiskRatio?: number
  scoringTemplateKey?: string
  scoringTemplateId?: string
  scoringTemplateVersion?: string
  scoringTemplateScope?: 'SYSTEM' | 'USER'
  scoringTemplateName?: string
  score?: number
  scoreStatus: string
  permission: TradePermission
  reasonCodes?: string[]
  warnings?: string[]
  breakdown?: Record<string, unknown>
  resourceSnapshotSummary?: ScoreResourceSnapshotSummary
  scoreCheckSnapshotId?: string
  scoreCheckSnapshotExpiresAt?: string
  scoreCheckSnapshotCreatedAt?: string
  tradeScoreSnapshotId?: string
  scoreValidUntil?: string
  convertedToTradeSetupId?: string
  createdAt: string
}

export type CreateScoreCheckInput = {
  symbolId: string
  marketType: MarketType
  tradeStyle: string
  instrumentType: InstrumentType
  direction: TradeDirection
  entry: number
  stopLoss: number
  target1: number
  target2?: number
  scoringTemplateKey?: string
  scoringTemplateId?: string
  scoringTemplateVersion?: string
  dataConfidence?: 'HIGH' | 'MEDIUM' | 'LOW'
}

export type UpdateScoreCheckInput = Partial<CreateScoreCheckInput>

export type ScoringTemplateSummary = {
  id?: string
  templateKey: string
  baseTemplateKey: string
  templateName: string
  description?: string
  scope: 'SYSTEM' | 'USER'
  version: number
  marketType: MarketType
  tradeStyle: string
  instrumentType: InstrumentType
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED'
  isReadonly: boolean
  isLatest: boolean
  usedCount: number
  lastUsedAt?: string
  resourceConfig?: ScoringTemplateResourceConfig
  allowedTradableSymbols?: string[]
  sectionOverrides?: ScoringTemplateSectionOverride[]
  snapshotPolicy?: ScoringTemplateSnapshotPolicy
}

export type ScoringTemplateResourceConfig = {
  marketRegime?: {
    marketIndexSymbolId?: string
    bankIndexSymbolId?: string
    volatilitySymbolId?: string
  }
  sectorContext?: {
    sectorName?: string
    sectorIndexSymbolId?: string
  }
  relatedSymbols?: string[]
}

export type ScoringTemplateSectionOverride = {
  sectionKey: string
  weight: number
  enabled: boolean
}

export type ScoringTemplateSnapshotPolicy = {
  captureMarketRegime: boolean
  captureSectorContext: boolean
  captureRelatedSymbols: boolean
  captureAllowedTradableSymbol: boolean
  maxSnapshotAgeSeconds: number
}

export type ScoringTemplateDetail = ScoringTemplateSummary & {
  permissionThresholds: {
    rejectBelow: number
    waitBelow: number
    takeSmallRiskBelow: number
    takeTradeAtOrAbove: number
  }
  sections: Array<{
    sectionKey: string
    label: string
    weight: number
    enabled: boolean
    missingDataPolicy: 'BLOCK' | 'PARTIAL' | 'ZERO' | 'IGNORE'
    evaluators: Array<{
      evaluatorKey: string
      label: string
      weight: number
      enabled: boolean
      missingDataPolicy?: 'BLOCK' | 'PARTIAL' | 'ZERO' | 'IGNORE'
      config?: Record<string, unknown>
    }>
  }>
}

export type TradeSetup = {
  _id: string
  tradePlanId: string
  sourceScoreCheckId?: string
  tradeScoreSnapshotId?: string
  symbolSnapshot: SymbolSnapshot
  direction: TradeDirection
  plannedEntry: number
  plannedStopLoss: number
  plannedTarget1: number
  plannedTarget2?: number
  plannedRewardRiskRatio: number
  score: number
  scorePermission: TradePermission
  riskGovernorPermission: TradePermission
  finalPermission: TradePermission
  riskModeAtDecision: string
  status: 'DRAFT' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'EXECUTED' | 'CANCELLED'
  reasonCodes: string[]
  warnings: string[]
  createdAt: string
  isDeleted?: boolean
  deletedAt?: string
}

export type UpdateTradeSetupInput = {
  entry?: number
  stopLoss?: number
  target1?: number
  target2?: number
  expiresAt?: string
}

export type RetryTradeSetupRiskCheckInput = {
  reason: string
}

export type RetryTradeSetupRiskCheckResult = {
  tradeSetup: TradeSetup
  riskDecision: {
    permission: TradePermission
    riskMode: string
    reasonCodes: string[]
    warnings: string[]
    evaluatedAt: string
  }
  message: string
}

export type ConfirmActualTradeInput = {
  actualEntry: number
  actualQuantity: number
  initialStopLoss: number
  actualTarget1: number
  actualTarget2?: number
  executionSource?: 'MANUAL_CONFIRMATION' | 'BROKER_SYNC_ASSISTED'
}

export type ActiveTrade = {
  _id: string
  tradePlanId: string
  tradeSetupId: string
  symbolSnapshot: SymbolSnapshot
  direction: TradeDirection
  plannedEntry: number
  plannedStopLoss: number
  plannedTarget1: number
  actualEntry: number
  actualQuantity: number
  remainingQuantity: number
  currentStopLoss: number
  actualTarget1: number
  actualTarget2?: number
  actualRiskAmount: number
  actualRewardRiskRatio: number
  ruleViolations?: string[]
  finalPermissionAtExecution: TradePermission
  status: 'ACTIVE' | 'PARTIALLY_EXITED' | 'CLOSED' | 'STOPPED_OUT' | 'CANCELLED'
  openedAt: string
}

export type TradeEvent = {
  _id?: string
  tradeEventId?: string
  activeTradeId: string
  tradePlanId: string
  tradeSetupId?: string
  eventType: string
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | string
  symbolId: string
  symbol?: string
  displayName?: string
  symbolSnapshot?: SymbolSnapshot
  marketType?: string
  exchange?: string
  instrumentType?: string
  direction: TradeDirection
  price: number
  currentR?: number
  message: string
  occurredAt: string
}

export type ActiveTradeEvaluation = {
  activeTradeId: string
  price: number
  currentR: number
  distanceToStopLossPercent: number
  distanceToTarget1Percent: number
  events: TradeEvent[]
  dedupedEventTypes: string[]
  evaluatedAt: string
}

export type CloseActiveTradeInput = {
  exitPrice: number
  exitQuantity?: number
  exitReason:
    | 'STOPLOSS'
    | 'TARGET_1'
    | 'TARGET_2'
    | 'TRAILING_STOP'
    | 'MANUAL_EXIT'
    | 'TIME_EXIT'
    | 'RISK_EXIT'
    | 'BROKER_SYNC_EXIT'
  exitNotes?: string
  chargesTotal?: number
  timezone?: string
}

export type TradeResult = {
  _id: string
  activeTradeId: string
  tradePlanId: string
  symbolSnapshot?: SymbolSnapshot
  direction: TradeDirection
  entryPrice: number
  exitPrice: number
  quantity: number
  grossPnl?: number
  netPnl?: number
  realizedR?: number
  resultType: 'WIN' | 'LOSS' | 'BREAKEVEN'
  exitReason: string
  status: string
  closedAt: string
}

export type TradeJournal = {
  _id: string
  tradeResultId: string
  activeTradeId: string
  symbolSnapshot?: SymbolSnapshot
  status: 'DRAFT' | 'FINALIZED' | 'INCOMPLETE' | 'ARCHIVED'
  direction: TradeDirection
  realizedR?: number
  resultType: string
  setupType?: SetupType
  entryQuality?: EntryQuality
  exitQuality?: ExitQuality
  outcomeQuality?: OutcomeQuality
  emotionalStateBefore?: EmotionalState
  emotionalStateDuring?: EmotionalState
  emotionalStateAfter?: EmotionalState
  mistakeTags?: MistakeTag[]
  userNotes?: string
  lessonLearned?: string
  selfRating?: number
  followedPlan?: boolean
  whatWentWell?: string
  whatWentWrong?: string
  nextTimeFocus?: string
  aiReviewId?: string
}

export type UpdateTradeJournalInput = {
  setupType?: SetupType
  entryQuality?: EntryQuality
  exitQuality?: ExitQuality
  outcomeQuality?: OutcomeQuality
  emotionalStateBefore?: EmotionalState
  emotionalStateDuring?: EmotionalState
  emotionalStateAfter?: EmotionalState
  mistakeTags?: MistakeTag[]
  userNotes?: string
  lessonLearned?: string
  selfRating?: number
  followedPlan?: boolean
  whatWentWell?: string
  whatWentWrong?: string
  nextTimeFocus?: string
}

export type SetupType =
  | 'BREAKOUT'
  | 'BREAKDOWN'
  | 'PULLBACK'
  | 'VWAP_RECLAIM'
  | 'VWAP_REJECTION'
  | 'RANGE_BREAK'
  | 'REVERSAL'
  | 'MOMENTUM_CONTINUATION'
  | 'SCALP'
  | 'OTHER'

export type EntryQuality =
  | 'VALID_ENTRY'
  | 'EARLY_ENTRY'
  | 'LATE_ENTRY'
  | 'CHASED_ENTRY'
  | 'NO_CLEAR_TRIGGER'
  | 'ENTERED_AGAINST_PLAN'

export type ExitQuality =
  | 'FOLLOWED_STOP'
  | 'EXITED_AT_TARGET'
  | 'BOOKED_PARTIAL_AS_PLANNED'
  | 'EXITED_TOO_EARLY'
  | 'EXITED_TOO_LATE'
  | 'MOVED_SL_WIDER'
  | 'PANIC_EXIT'
  | 'NO_EXIT_PLAN'

export type OutcomeQuality =
  | 'PROFIT_WITH_GOOD_PROCESS'
  | 'PROFIT_WITH_BAD_PROCESS'
  | 'LOSS_WITH_GOOD_PROCESS'
  | 'LOSS_WITH_BAD_PROCESS'
  | 'BREAKEVEN_WITH_GOOD_PROCESS'
  | 'BREAKEVEN_WITH_BAD_PROCESS'

export type EmotionalState =
  | 'CALM'
  | 'CONFIDENT'
  | 'FEARFUL'
  | 'FOMO'
  | 'REVENGE_TRADING'
  | 'GREEDY'
  | 'HESITANT'
  | 'IMPULSIVE'
  | 'FRUSTRATED'
  | 'TIRED'

export type MistakeTag =
  | 'CHASED_ENTRY'
  | 'ENTERED_WITHOUT_CONFIRMATION'
  | 'IGNORED_MARKET_CONTEXT'
  | 'IGNORED_SECTOR_CONTEXT'
  | 'POOR_RR'
  | 'OVERSIZED_POSITION'
  | 'MOVED_SL_WIDER'
  | 'AVERAGED_LOSER'
  | 'EXITED_TOO_EARLY'
  | 'EXITED_TOO_LATE'
  | 'REVENGE_TRADE'
  | 'OVERTRADED'
  | 'BROKE_STOP_TRADING_RULE'
  | 'NONE'

export type AiExplanation = {
  _id: string
  status: string
  summary?: string
  keyMistakes?: string[]
  strengths?: string[]
  improvementSuggestions?: string[]
  processQuality?: string
  riskNotes?: string[]
  warnings?: string[]
  fallbackOutput?: unknown
}
