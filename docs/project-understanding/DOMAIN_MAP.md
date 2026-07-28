# YuJiDi Domain Map

## Auth

Auth is email/password with JWT access and refresh tokens stored in HTTP-only cookies. `AuthService` owns password hashing, login, refresh, and logout. `requireAuth` verifies the access cookie and attaches `req.user.id`. User-owned routes must scope all queries by that id.

Key files: `auth.routes.ts`, `auth.controller.ts`, `auth.service.ts`, `User.ts`, `jwt.ts`, `cookieUtils.ts`.

## Symbol

`Symbol` is the global universal market symbol registry. It started as Binance-only but now represents Binance crypto, Angel MCX contracts, and future provider instruments. Symbols are global reference data, not user-owned. Monitors and trade workflows snapshot symbol metadata to preserve historical meaning.

Key files: `Symbol.ts`, `symbol.controller.ts`, `symbol-search.service.ts`, `symbol-resolver.service.ts`, Angel symbol mapper/sync files.

## Market Data

Market data has public Binance streams and user-scoped Angel streams. Binance can stream without broker login. Angel MCX reference data can be synced globally, but live Angel ticks require an active user broker connection. Market ticks feed monitor alerts and active-trade monitoring through provider-aware subscription keys.

Key files: `websocket.service.ts`, `market-subscription-router.service.ts`, `angel-user-market-data-session.service.ts`, `market-quote.service.ts`, `market-snapshot.service.ts`, `active-trade-live-monitor.service.ts`.

## Analyzer / Monitor

Monitors are user-owned tripwires for symbol movement. `AnalyzerEngine` consumes ticks, keeps price/CVD/order-book state, loads active monitors through a cache, applies drop/spike rules, calls news/LLM context, persists `Alert`, and emits live alerts.

Key files: `TripwireConfig.ts`, `Alert.ts`, `monitor.service.ts`, `analyzer.service.ts`, `analyzer.rules.ts`, `llm.service.ts`, `news.service.ts`.

## Scoring

ScoreCheck is deterministic pre-trade scoring. It validates geometry, resolves symbol context, builds scoring context, runs scoring rules/templates, stores score output, and writes `TradeScoreSnapshot`. It does not mutate risk state and does not approve actual trading.

Key files: `score-check.service.ts`, `scoring-engine.service.ts`, `scoring-context.service.ts`, `scoring-context-builder.service.ts`, `scoring-template-registry.service.ts`, `ScoreCheck`, `TradeScoreSnapshot`.

## TradePlan

TradePlan is the user-owned risk container for trading. It defines market scope, capital, max risk, trade limits, review cadence, and lifecycle status. The Trading Workflow selected plan controls conversion and display. Plan summary is plan-scoped.

Key files: `trade-plan.service.ts`, `trade-plan.model.ts`, `capital-adjustment-event.model.ts`.

## RiskGovernor

RiskGovernor is deterministic final authority for managed trade permission. It reads TradePlan status, TradePlanRiskState, optional UserDailyRiskState, ScoreCheck permission, and planned reward/risk. It outputs final permission and risk mode. It does not mutate state.

Key files: `risk-governor.service.ts`, `trade-setup.service.ts`, `risk-state-projection.service.ts`.

## TradeSetup

TradeSetup is a governed planned trade created from a ScoreCheck under a selected ACTIVE TradePlan. It copies planned values and symbol snapshot, records RiskGovernor output, and can be approved, rejected, cancelled, executed, retried, or soft-deleted. It is not an actual trade until confirmed.

Key files: `trade-setup.service.ts`, `trade-setup.model.ts`.

## ActiveTrade

ActiveTrade is user confirmation that the planned setup was actually entered. It preserves planned setup values and stores actual entry, quantity, initial stop, targets, execution quality, and rule violations. It drives monitoring and eventual close.

Key files: `active-trade.service.ts`, `active-trade.model.ts`.

## TradeEvent

TradeEvent is append-oriented monitoring output for ActiveTrade. It records deterministic events such as stop hit, target hit, +1R, or near stop. Events do not close trades or mutate risk state.

Key files: `trade-monitoring.service.ts`, `trade-event.service.ts`, `trade-event-delivery.service.ts`, `trade-event.model.ts`.

## TradeResult

TradeResult is the official finalized close outcome. Closing an ActiveTrade creates one finalized result, calculates P&L/R, marks the ActiveTrade closed/stopped, and projects the result into plan/daily risk state.

Key files: `trade-result.service.ts`, `risk-state-projection.service.ts`, `trade-result.model.ts`.

## Journal

TradeJournal is post-trade reflection created from a finalized TradeResult. It copies deterministic lifecycle facts and keeps user reflection fields separately editable until finalized. Journal never mutates TradeResult or risk state.

Key files: `trade-journal.service.ts`, `trade-journal.model.ts`.

## AI Review

AI Review is post-trade coaching over finalized journal context. The backend builds sanitized context and validates model output. AI cannot score, approve, execute, mutate risk, or calculate final P&L.

Key files: `ai-trade-review.service.ts`, `ai-trade-review-context.service.ts`, `ai-explanation.model.ts`, `llm-provider` integrations.

