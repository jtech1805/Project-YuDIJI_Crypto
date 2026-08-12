# YuJiDi Route Map

Backend route roots are mounted from `yujidi-server/src/app.ts`. Most trade workflow routes use `requireAuth`; public exceptions are noted.

## Auth Routes

| Method | Path | Controller | Service / Models | Auth | Purpose |
|---|---|---|---|---|---|
| POST | `/api/auth/register` | `auth.controller.register` | `AuthService.registerUser`, `User`, `TripwireConfig`, `Alert` | No | Create user, seed default monitors, clone starter alerts. |
| POST | `/api/auth/login` | `auth.controller.login` | `AuthService.loginUser`, `User` | No | Validate credentials, issue cookies. |
| POST | `/api/auth/refresh` | `auth.controller.refresh` | `AuthService.refreshSession`, `User` | Refresh cookie | Rotate/refresh access token. |
| POST | `/api/auth/logout` | `auth.controller.logout` | `AuthService.logoutUser`, `User` | Refresh cookie | Clear stored refresh token and cookies. |
| GET | `/api/auth/me` | `auth.controller.getCurrentUser` | `User` | Yes | Return current user without password/refresh token. |

## Monitor, Symbol, Market Routes

| Method | Path | Controller | Service / Models | Auth | Purpose |
|---|---|---|---|---|---|
| GET | `/api/monitors/symbols` | `monitor.controller.getSymbols` | `MonitorService.getSymbols`, `Symbol` | No | Legacy Binance symbol list. |
| GET | `/api/monitors/symbols/universal` | `monitor.controller.searchUniversalSymbols` | `MonitorService.searchUniversalSymbols`, `Symbol` | No | Universal symbol search for monitor creation. |
| GET | `/api/monitors` | `monitor.controller.getUserMonitors` | `MonitorService.getUserMonitors`, `TripwireConfig` | Yes | List user monitors. |
| POST | `/api/monitors` | `monitor.controller.createMonitor` | `MonitorService.createMonitor`, `TripwireConfig`, `Symbol`, `BrokerConnection` | Yes | Create Binance or provider-aware monitor. |
| PATCH | `/api/monitors/:id` | `monitor.controller.updateMonitor` | `MonitorService.updateMonitor`, `TripwireConfig` | Yes | Update monitor fields. |
| DELETE | `/api/monitors/:id` | `monitor.controller.deleteMonitor` | `MonitorService.deleteMonitor`, `TripwireConfig` | Yes | Delete monitor. |
| GET | `/api/monitors/debug/engine-state` | `monitor.controller.debugEngineState` | `WebSocketManager`, `AnalyzerEngine` | Yes | Runtime analyzer/cache snapshot. |
| GET | `/api/symbols/search` | `symbol.controller.searchSymbols` | `SymbolSearchService`, `Symbol` | No, rate limited | Fast searchable symbol registry. |
| GET | `/api/market-quotes/:symbolId` | `market-quote.controller.getMarketQuoteBySymbolId` | `MarketQuoteService`, `Symbol`, provider quote services | Yes | Fetch LTP/OHLC/FULL quote snapshot. |
| POST | `/api/market-streams/angel/monitors/:monitorId/subscribe` | `market-stream.controller.subscribeAngelMonitorStream` | `AngelUserMarketDataSessionService`, `TripwireConfig`, `BrokerConnection` | Yes | Subscribe user's Angel monitor stream. |
| POST | `/api/market-streams/angel/monitors/:monitorId/unsubscribe` | `market-stream.controller.unsubscribeAngelMonitorStream` | `AngelUserMarketDataSessionService` | Yes | Unsubscribe user's Angel monitor stream. |
| GET | `/api/market-streams/angel/status` | `market-stream.controller.getAngelMarketStreamStatus` | `AngelUserMarketDataSessionService` | Yes | User-scoped Angel stream session status. |

## Alert And Chat Routes

| Method | Path | Controller | Service / Models | Auth | Purpose |
|---|---|---|---|---|---|
| GET | `/api/alerts/ltp/:symbol` | `alert.controller.getLtp` | Binance REST, `WebSocketManager` HTTP subscription | No | Fetch Binance LTP/ticker. |
| GET | `/api/alerts` | `alert.controller.getUserAlerts` | `Alert` | Yes | List latest user alerts. |
| GET | `/api/alerts/:id` | `alert.controller.getAlertById` | `Alert` | Yes | Fetch one user alert. |
| POST | `/api/chat` | `chat.controller.handleCopilotChat` | `ChatSession`, `LlmService`, `WebSocketManager` | Yes | Copilot prompt, deterministic trade math, LLM response. |
| GET | `/api/chat/history/:symbol` | `chat.controller.getChatHistory` | `ChatSession` | Yes | Chat history for symbol. |

## Broker Connection Routes

| Method | Path | Controller | Service / Models | Auth | Purpose |
|---|---|---|---|---|---|
| POST | `/api/broker-connections/angel` | `broker-connection.controller.connectAngelConnection` | `BrokerConnectionService`, `BrokerConnection`, credential encryption, Angel auth | Yes | Store encrypted Angel credentials after login verification. |
| GET | `/api/broker-connections` | `broker-connection.controller.getBrokerConnections` | `BrokerConnectionService`, `BrokerConnection` | Yes | List safe broker connection summaries. |
| GET | `/api/broker-connections/angel/status` | `broker-connection.controller.getAngelConnectionStatus` | `BrokerConnectionService`, `BrokerConnection` | Yes | Safe Angel connection status. |
| POST | `/api/broker-connections/angel/reconnect` | `broker-connection.controller.reconnectAngelConnection` | `BrokerConnectionService`, Angel auth | Yes | Re-verify/update Angel connection. |
| DELETE | `/api/broker-connections/angel` | `broker-connection.controller.deleteAngelConnection` | `BrokerConnectionService`, `BrokerConnection` | Yes | Disable/delete Angel connection. |

## Scoring And Trade Lifecycle Routes

| Method | Path | Controller | Service / Models | Auth | Purpose |
|---|---|---|---|---|---|
| POST | `/api/score-checks` | `score-check.controller.createScoreCheck` | `ScoreCheckService`, `ScoringEngineService`, `ScoreCheck`, `TradeScoreSnapshot`, `Symbol` | Yes | Create deterministic pre-trade score. |
| GET | `/api/score-checks` | `score-check.controller.listScoreChecks` | `ScoreCheckService`, `ScoreCheck` | Yes | List user score checks. |
| GET | `/api/score-checks/:id` | `score-check.controller.getScoreCheck` | `ScoreCheckService`, `ScoreCheck` | Yes | Fetch one score check. |
| PATCH | `/api/score-checks/:id` | `score-check.controller.updateScoreCheck` | `ScoreCheckService`, `ScoreCheck`, `TradeScoreSnapshot` | Yes | Update score check if allowed. |
| DELETE | `/api/score-checks/:id` | `score-check.controller.deleteScoreCheck` | `ScoreCheckService`, `ScoreCheck`, linked setup/snapshot handling | Yes | Soft-delete score check. |
| POST | `/api/score-checks/:id/convert-to-trade-setup` | `trade-setup.controller.convertScoreCheckToTradeSetup` | `TradeSetupService`, `RiskGovernorService`, `ScoreCheck`, `TradePlan`, `TradePlanRiskState`, `UserDailyRiskState`, `TradeSetup` | Yes | Convert selected score into governed setup. |
| GET | `/api/scoring/realtime-context` | `scoring-context.controller.getRealtimeScoringContext` | `ScoringContextService`, `MarketSnapshotService` | Yes | Real-time context for scoring UI/templates. |

## TradePlan Routes

| Method | Path | Controller | Service / Models | Auth | Purpose |
|---|---|---|---|---|---|
| POST | `/api/trade-plans` | `trade-plan.controller.createTradePlan` | `TradePlanService`, `TradePlan` | Yes | Create DRAFT plan. |
| GET | `/api/trade-plans` | `trade-plan.controller.listTradePlans` | `TradePlanService`, `TradePlan` | Yes | List user plans. |
| GET | `/api/trade-plans/:id/dashboard-summary` | `trade-plan.controller.getTradePlanDashboardSummary` | `TradePlanService`, `TradePlan`, `TradePlanRiskState`, `UserDailyRiskState`, `CapitalAdjustmentEvent`, `TradeResult`, `ActiveTrade` | Yes | Plan-scoped capital/risk/performance summary. |
| GET | `/api/trade-plans/:id` | `trade-plan.controller.getTradePlan` | `TradePlanService`, `TradePlan` | Yes | Fetch one plan. |
| PATCH | `/api/trade-plans/:id` | `trade-plan.controller.updateTradePlan` | `TradePlanService`, `TradePlan` | Yes | Update DRAFT or safe ACTIVE fields. |
| DELETE | `/api/trade-plans/:id` | `trade-plan.controller.deleteTradePlan` | `TradePlanService`, child trade models | Yes | Soft-delete plan when safe. |
| POST | `/api/trade-plans/:id/activate` | `trade-plan.controller.activateTradePlan` | `TradePlanService`, `TradePlan`, `TradePlanRiskState` | Yes | Activate DRAFT and initialize plan risk state. |
| POST | `/api/trade-plans/:id/pause` | `trade-plan.controller.pauseTradePlan` | `TradePlanService`, `TradePlan` | Yes | Pause active plan. |
| POST | `/api/trade-plans/:id/stop` | `trade-plan.controller.stopTradePlan` | `TradePlanService`, `TradePlan` | Yes | Stop active/paused plan. |
| POST | `/api/trade-plans/:id/complete` | `trade-plan.controller.completeTradePlan` | `TradePlanService`, `TradePlan` | Yes | Complete active/paused plan. |
| POST | `/api/trade-plans/:id/archive` | `trade-plan.controller.archiveTradePlan` | `TradePlanService`, `TradePlan` | Yes | Archive eligible plan. |
| POST | `/api/trade-plans/:id/reset-risk-lock` | `trade-plan.controller.resetTradePlanRiskLock` | `TradePlanService`, `TradePlanRiskState`, `UserDailyRiskState` | Yes | Audited risk-lock reset without deleting history. |
| POST | `/api/trade-plans/:id/restart` | `trade-plan.controller.restartTradePlan` | `TradePlanService`, `TradePlan`, `TradePlanRiskState` | Yes | Create fresh plan copy. |
| POST | `/api/trade-plans/:id/capital-adjustments` | `trade-plan.controller.createCapitalAdjustment` | `TradePlanService`, `CapitalAdjustmentEvent`, `TradePlan` | Yes | Adjust plan capital. |
| GET | `/api/trade-plans/:id/trade-setups` | `trade-setup.controller.listTradeSetupsForPlan` | `TradeSetupService`, `TradeSetup` | Yes | Plan-scoped setups. |
| GET | `/api/trade-plans/:id/active-trades` | `active-trade.controller.listActiveTradesForPlan` | `ActiveTradeService`, `ActiveTrade` | Yes | Plan-scoped active trades. |
| GET | `/api/trade-plans/:id/trade-events` | `trade-event.controller.listTradeEventsForPlan` | `TradeEventService`, `TradeEvent` | Yes | Plan-scoped events. |
| GET | `/api/trade-plans/:id/trade-results` | `trade-result.controller.listTradeResultsForPlan` | `TradeResultService`, `TradeResult` | Yes | Plan-scoped results. |
| GET | `/api/trade-plans/:id/trade-journals` | `trade-journal.controller.listTradeJournalsForPlan` | `TradeJournalService`, `TradeJournal` | Yes | Plan-scoped journals. |

## TradeSetup, ActiveTrade, Result, Journal, AI Review Routes

| Method | Path | Controller | Service / Models | Auth | Purpose |
|---|---|---|---|---|---|
| GET | `/api/trade-setups` | `trade-setup.controller.listTradeSetups` | `TradeSetupService`, `TradeSetup` | Yes | List user setups. |
| GET | `/api/trade-setups/:id` | `trade-setup.controller.getTradeSetup` | `TradeSetupService`, `TradeSetup` | Yes | Fetch one setup. |
| PATCH | `/api/trade-setups/:id` | `trade-setup.controller.updateTradeSetup` | `TradeSetupService`, `TradeSetup` | Yes | Update planned values before execution. |
| DELETE | `/api/trade-setups/:id` | `trade-setup.controller.deleteTradeSetup` | `TradeSetupService`, `TradeSetup`, `ScoreCheck` | Yes | Soft-delete setup. |
| POST | `/api/trade-setups/:id/cancel` | `trade-setup.controller.cancelTradeSetup` | `TradeSetupService`, `TradeSetup` | Yes | Cancel setup before execution. |
| POST | `/api/trade-setups/:id/retry-risk-check` | `trade-setup.controller.retryTradeSetupRiskCheck` | `TradeSetupService`, `RiskGovernorService`, `TradePlanRiskState` | Yes | Retry rejected setup after risk reset. |
| POST | `/api/trade-setups/:id/confirm-actual-trade` | `active-trade.controller.confirmActualTrade` | `ActiveTradeService`, `TradeSetup`, `ActiveTrade` | Yes | Confirm actual execution. |
| GET | `/api/active-trades` | `active-trade.controller.listActiveTrades` | `ActiveTradeService`, `ActiveTrade` | Yes | List user active trades. |
| GET | `/api/active-trades/:id` | `active-trade.controller.getActiveTrade` | `ActiveTradeService`, `ActiveTrade` | Yes | Fetch one active trade. |
| POST | `/api/active-trades/:id/evaluate` | `trade-monitoring.controller.evaluateActiveTrade` | `TradeMonitoringService`, `ActiveTrade`, `TradeEvent` | Yes | Manual/synthetic monitoring evaluation. |
| POST | `/api/active-trades/:id/close` | `trade-result.controller.closeActiveTrade` | `TradeResultService`, `RiskStateProjectionService`, `ActiveTrade`, `TradeResult`, risk states | Yes | Close trade and project risk state. |
| POST | `/api/active-trades/:id/cancel` | `active-trade.controller.cancelActiveTrade` | `ActiveTradeService`, `ActiveTrade` | Yes | Cancel ACTIVE trade. |
| GET | `/api/active-trades/:id/events` | `trade-event.controller.listActiveTradeEvents` | `TradeEventService`, `TradeEvent` | Yes | Events for active trade. |
| GET | `/api/active-trades/:id/result` | `trade-result.controller.getActiveTradeResult` | `TradeResultService`, `TradeResult` | Yes | Result for active trade. |
| GET | `/api/active-trades/:id/journal` | `trade-journal.controller.getActiveTradeJournal` | `TradeJournalService`, `TradeJournal` | Yes | Journal for active trade. |
| GET | `/api/trade-events` | `trade-event.controller.listTradeEvents` | `TradeEventService`, `TradeEvent` | Yes | List user trade events. |
| GET | `/api/trade-events/:id` | `trade-event.controller.getTradeEvent` | `TradeEventService`, `TradeEvent` | Yes | Fetch one event. |
| GET | `/api/trade-results` | `trade-result.controller.listTradeResults` | `TradeResultService`, `TradeResult` | Yes | List user results. |
| GET | `/api/trade-results/:id` | `trade-result.controller.getTradeResult` | `TradeResultService`, `TradeResult` | Yes | Fetch one result. |
| POST | `/api/trade-results/:id/journal` | `trade-journal.controller.createTradeJournal` | `TradeJournalService`, `TradeResult`, `TradeJournal` | Yes | Create journal from finalized result. |
| GET | `/api/trade-results/:id/journal` | `trade-journal.controller.getTradeResultJournal` | `TradeJournalService`, `TradeJournal` | Yes | Journal for result. |
| GET | `/api/trade-journals` | `trade-journal.controller.listTradeJournals` | `TradeJournalService`, `TradeJournal` | Yes | List user journals. |
| GET | `/api/trade-journals/:id` | `trade-journal.controller.getTradeJournal` | `TradeJournalService`, `TradeJournal` | Yes | Fetch journal. |
| PATCH | `/api/trade-journals/:id` | `trade-journal.controller.updateTradeJournal` | `TradeJournalService`, `TradeJournal` | Yes | Update reflection fields. |
| POST | `/api/trade-journals/:id/finalize` | `trade-journal.controller.finalizeTradeJournal` | `TradeJournalService`, `TradeJournal` | Yes | Finalize completed reflection. |
| POST | `/api/trade-journals/:id/archive` | `trade-journal.controller.archiveTradeJournal` | `TradeJournalService`, `TradeJournal` | Yes | Archive journal. |
| POST | `/api/trade-journals/:id/ai-review` | `ai-explanation.controller.generateTradeJournalAiReview` | `AiTradeReviewService`, `TradeJournal`, `AiExplanation` | Yes | Generate post-trade AI review. |
| GET | `/api/trade-journals/:id/ai-review` | `ai-explanation.controller.getTradeJournalAiReview` | `AiTradeReviewService`, `AiExplanation` | Yes | Fetch journal AI review. |
| GET | `/api/ai-explanations/:id` | `ai-explanation.controller.getAiExplanation` | `AiTradeReviewService`, `AiExplanation` | Yes | Fetch one AI explanation. |
