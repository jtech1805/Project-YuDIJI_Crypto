# YuJiDi Data Model Map

## User

Purpose: authenticated account. Important fields: `email`, `name`, `password`, `refreshToken`. Created by registration; updated by auth refresh/logout. Owns monitors, alerts, broker connections, trade workflow records, chats, and audit records.

## Symbol

Purpose: global universal symbol registry. Important fields: `provider`, `marketType`, `exchange`, `symbol`, `displayName`, `providerSymbol`, `instrumentToken`, `instrumentType`, `expiry`, `strikePrice`, `lotSize`, `tickSize`, `requiresBrokerLogin`, `supportedBroker`, `status`, search fields. Created/updated by Binance and Angel reference sync. Referenced by monitors, scores, setups, active trades, results, journals, events through `symbolId` and snapshots.

## Instrument

Purpose: provider instrument abstraction/future bridge. Important fields mirror provider/exchange/token metadata. Created by instrument sync/provider work. Currently overlaps with universal Symbol direction.

## TripwireConfig

Purpose: user-owned monitor. Important fields: `user`, `symbol`, `symbolId`, provider/exchange/token snapshots, `thresholdPercentage`, `timeWindowMinutes`, `trigger`, `isActive`. Created/updated/deleted by monitor APIs. Read by AnalyzerEngine. Emits Alert.

## Alert

Purpose: AI-enriched monitor trigger. Important fields: `user`, `monitor`, provider metadata, `symbol`, `triggerPrice`, `changePercentage`, legacy `dropPercentage`, `triggerType`, `direction`, AI report fields, `cvdAtTrigger`. Created by AnalyzerEngine. Read by alert APIs/dashboard.

## BrokerConnection

Purpose: user-specific broker login/session state. Important fields: `user`, `broker`, `status`, encrypted credential fields, session metadata, permission flags, `lastLoginAt`, `lastError`. Created/updated by BrokerConnectionService. Used by Angel live data/session services. Must not leak secrets.

## ChatSession

Purpose: symbol-scoped copilot memory. Important fields: `user`, `symbol`, `messages`. Created/updated by chat controller. Stores recent user/assistant messages.

## AuditLog

Purpose: append-only record of critical lifecycle decisions. Important fields: `userId`, `actorType`, `action`, `entityType`, `entityId`, `before`, `after`, `metadata`, correlation/idempotency fields. Created by services via `AuditLogService`; sanitized before persistence.

## TradePlan

Purpose: user-owned risk/capital container. Important fields: `userId`, `name`, `marketType`, `tradeStyle`, `instrumentType`, `planMode`, `status`, `startingCapital`, `currentCapital`, risk limits, lifecycle timestamps, soft-delete fields. Created DRAFT, activated, paused/stopped/completed/archived, safely edited, restarted/deleted by `TradePlanService`.

## CapitalAdjustmentEvent

Purpose: immutable-ish capital adjustment entry. Important fields: `userId`, `tradePlanId`, `adjustmentType`, `amount`, `currency`, `reason`, `createdBy`. Created by capital adjustment API; used in dashboard capital summary.

## TradePlanRiskState

Purpose: plan-scoped risk projection. Important fields: `userId`, `tradePlanId`, `riskBucketKey`, `riskMode`, counts, P&L totals, `consecutiveLosses`, `lastTradeResultId`. Created on TradePlan activation and updated by result projection/reset. Unique per `userId + tradePlanId`.

## UserDailyRiskState

Purpose: user/day/bucket risk circuit breaker. Important fields: `userId`, `riskBucketKey`, `dateKey`, `riskMode`, daily trade/P&L counters, `dailyLossLimitHit`, `stopTradingTriggered`, `lastTradeResultId`. Updated by result projection and reset-risk-lock.

## ScoreCheck

Purpose: deterministic pre-trade score. Important fields: `userId`, `scoreMode`, `symbolId`, `symbolSnapshot`, market scope, direction, entry/stop/targets, setup/context fields, risk/reward math, template key/version, `scoreStatus`, `score`, `permission`, confidence, reasons, warnings, breakdown, `tradeScoreSnapshotId`, `convertedToTradeSetupId`, soft-delete fields. Created/updated/deleted by `ScoreCheckService`; converted by `TradeSetupService`.

## TradeScoreSnapshot

Purpose: immutable replay/audit snapshot of score output. Important fields: `userId`, `scoreCheckId`, `tradeSetupId`, `symbolId`, template key/version, score, permission, status, context, reasons/warnings, computed scores, validity timestamps, soft-delete fields. Created with ScoreCheck; linked when converted.

## TradeSetup

Purpose: governed planned trade. Important fields: `userId`, `tradePlanId`, `sourceScoreCheckId`, `symbolId`, `symbolSnapshot`, market scope, direction, planned geometry, score/template fields, `scorePermission`, `riskGovernorPermission`, `finalPermission`, `riskModeAtDecision`, reasons/warnings, `status`, `riskEvaluatedAt`, execution/cancel/delete fields. Created from ScoreCheck. Updated before execution, retried if rejected, marked executed by ActiveTradeService.

## ActiveTrade

Purpose: actual confirmed trade. Important fields: `userId`, `tradePlanId`, `tradeSetupId`, `scoreCheckId`, `symbolId`, symbol snapshot, planned and actual values, actual risk/RR, execution source/quality, rule violations, final permission, `status`, opened/closed timestamps. Created by confirming approved setup. Updated on cancellation/close.

## TradeEvent

Purpose: monitoring event. Important fields: `userId`, `tradePlanId`, `activeTradeId`, `tradeSetupId`, `symbolId`, symbol snapshot, `eventType`, `severity`, source, direction, price/currentR, distance metrics, reason codes, idempotency key, metadata, occurredAt. Created by TradeMonitoringService from manual/live evaluation.

## TradeResult

Purpose: finalized close result. Important fields: `userId`, `tradePlanId`, `tradeSetupId`, `activeTradeId`, `symbolId`, symbol snapshot, entry/exit/quantity, gross/net P&L, P&L basis, realizedR, result type, exit reason, costs, status, projection status, projectedAt, close metadata, warnings. Created by closing ActiveTrade; projected into risk state.

## TradeJournal

Purpose: post-trade journal. Important fields: links to plan/setup/active/result/score/symbol, copied deterministic trade facts, user reflection fields, quality tags, mistake tags, notes, screenshots, AI review id, status/finalized/archive timestamps. Created from finalized result, updated/finalized/archived by JournalService.

## AiExplanation

Purpose: persisted AI review/explanation. Important fields: `userId`, task/source references, trade references, `contextHash`, prompt/schema version, model info, `status`, summary, mistakes, strengths, suggestions, process quality, risk notes, validation errors/warnings. Created by AI review service; linked to journal.

