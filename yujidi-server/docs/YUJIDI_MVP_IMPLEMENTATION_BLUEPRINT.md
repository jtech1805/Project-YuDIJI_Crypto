# YuJiDi MVP Implementation Blueprint

This document is the implementation blueprint for adding YuJiDi's risk-first trade lifecycle.

It began as a documentation-only blueprint. Each phase is marked as implemented only after the corresponding code and tests exist.

## 0. Implementation Status

This blueprint now has a small Phase 1 foundation in code.

Implemented:

- Shared trade/risk/scoring/monitoring/audit TypeScript vocabularies.
- `AuditLog` Mongoose model.
- `AuditLogService` with sanitize-before-persist behavior.
- `AuditSanitizerService` for redacting secrets and provider tokens from audit payloads.
- `SymbolResolverService` for resolving provider/exchange/instrument data back to canonical `Symbol` records.
- `TradePlan` Mongoose model.
- `CapitalAdjustmentEvent` Mongoose model.
- `TradePlanRiskState` Mongoose model.
- `UserDailyRiskState` Mongoose model.
- TradePlan service/controller/routes for create, list, read, draft update, lifecycle transitions, and capital adjustments.
- Idempotent `TradePlanRiskState` initialization on TradePlan activation.
- Audit logging for TradePlan lifecycle and capital mutations.
- `ScoreCheck` Mongoose model.
- `TradeScoreSnapshot` Mongoose model.
- ScoreCheck service/controller/routes for standalone pre-trade scoring.
- Direction-aware LONG/SHORT geometry validation.
- Baseline deterministic scoring engine with template registry foundation.
- Deterministic `COMMODITY_MCX_INTRADAY_V1` baseline scoring for active MCX futures.
- MCX contract sanity checks for lot size, tick size, expiry, and Angel live-monitoring login requirements.
- Audit logging for ScoreCheck creation and score calculation.
- `TradeSetup` Mongoose model.
- TradeSetup service/controller/routes for list, read, cancel, and ScoreCheck conversion.
- RiskGovernor foundation with deterministic final managed permission.
- ScoreCheck-to-TradeSetup conversion with active TradePlan validation.
- Audit logging for ScoreCheck conversion, TradeSetup creation, cancellation, and RiskGovernor evaluation.
- `ActiveTrade` Mongoose model.
- ActiveTrade service/controller/routes for actual-trade confirmation, list, read, plan-scoped list, and cancellation.
- Direction-aware actual LONG/SHORT geometry and risk/reward/RR calculation.
- Planned-versus-actual execution quality and rule-violation detection.
- TradeSetup transition to `EXECUTED` after successful ActiveTrade creation.
- Audit logging for actual confirmation, ActiveTrade creation/cancellation, and TradeSetup execution.
- `TradeEvent` Mongoose model and user-owned query APIs.
- Deterministic ActiveTrade evaluation for stoploss, targets, +1R, and near-stop conditions.
- Manual/synthetic ActiveTrade price evaluation endpoint.
- Event idempotency using one `activeTradeId:eventType` key per event type.
- Audit logging for monitoring evaluation, event creation, and dedupe.
- `TradeResult` Mongoose model and manual ActiveTrade close APIs.
- Direction-aware gross P&L, net P&L basis, result type, and realized-R calculation.
- Idempotent `RiskStateProjectionService`.
- Finalized TradeResult projection into TradePlanRiskState and UserDailyRiskState.
- Consecutive-loss and daily-loss STOP_TRADING enforcement.
- Audit logging for TradeResult finalization and risk projection.
- `TradeJournal` Mongoose model and journal lifecycle APIs.
- Idempotent journal creation from finalized TradeResult.
- Immutable system facts copied from TradeResult, ActiveTrade, TradeSetup, ScoreCheck links, and TradeEvents.
- Whitelisted user reflection updates, completeness validation, finalization, and archive.
- Audit logging for journal creation, update, finalization, and archive.
- Unit tests for audit sanitization and symbol resolution.
- Unit tests for TradePlan lifecycle and risk-state initialization.
- Unit tests for ScoreCheck geometry, RR calculation, score bands, snapshots, and audit calls.
- Unit tests for TradeSetup conversion and RiskGovernor behavior.
- Unit tests for ActiveTrade confirmation, geometry, execution quality, setup execution, audit calls, and cancellation.
- Unit tests for ActiveTrade monitoring rules, event ownership, idempotency, and non-mutation boundaries.
- Unit tests for TradeResult calculations, close lifecycle, risk projection, and projection idempotency.
- Unit tests for structured journal copying, reflection-only updates, lifecycle, ownership, and non-mutation boundaries.

Not implemented yet:

- Live market-tick wiring for MonitoringRuleEngine.
- AI trade/risk review.
- RAG ingestion.
- Order placement, order modification, or order cancellation.

Boundary:

The implemented Phase 1/2/3/4/5/6/7/8 foundation does not alter existing analyzer, WebSocket, monitor, auth, Angel login, or Binance behavior.

### Phase 14: MCX Commodity Baseline Scoring

The commodity template preserves the existing direction-aware geometry and RR permission
bands while validating `COMMODITY` + `MCX` + `FUTURE` + `INTRADAY` scope.

It snapshots contract metadata and adds deterministic reason codes or warnings for:

- available or missing lot size
- available or missing tick size
- expiry within three calendar days
- Angel broker login required for live monitoring
- baseline-only commodity context

Advanced inventory, COT, international news, dollar-index, and other professional commodity
analytics remain deferred. RiskGovernor remains the final managed permission authority and
no broker execution was added. A commodity swing template is deferred until swing-specific
rules and trade-style contracts are defined.

## 1. Current System Summary

YuJiDi currently supports real-time market monitoring and AI-enriched alerting.

Existing flow:

```txt
User creates Monitor/Tripwire
  -> backend watches live market data
  -> AnalyzerEngine detects drop/spike threshold breach
  -> alert pipeline gathers context
  -> AI explains the event
  -> Alert is stored
  -> user receives real-time alert/report
```

Current implemented foundations:

- Express + TypeScript backend.
- MongoDB/Mongoose persistence.
- JWT + HTTP-only cookie authentication.
- Binance symbol sync and live WebSocket data.
- Universal `Symbol` registry.
- Angel MCX Scrip Master sync.
- Angel BrokerConnection with encrypted credentials/session tokens.
- Angel read-only quote and live LTP streaming.
- Provider-aware WebSocket subscription routing.
- Analyzer drop/spike logic for Binance and Angel normalized ticks.
- Alert persistence and real-time delivery.
- Groq-backed AI explanations.
- Scalable symbol search using tokenized symbol fields.

## 2. New MVP Trade/Risk Lifecycle

New lifecycle:

```txt
TradePlan
  -> ScoreCheck
  -> TradeSetup
  -> RiskGovernor
  -> ActiveTrade
  -> TradeEvent
  -> TradeResult
  -> RiskState update
  -> Structured Journal
  -> AI Review
```

Primary rule:

YuJiDi is risk-first trade management, not a signal-selling app.

Final permission values:

```txt
TAKE_TRADE
TAKE_SMALL_RISK
WAIT
REJECT
STOP_TRADING
```

Do not use `BUY`, `SELL`, `STRONG_BUY`, or `STRONG_SELL` as final permission language.

## 3. Core Product Rules

- AI explains only.
- AI cannot decide, calculate, override, or mutate risk/trade decisions.
- RiskGovernor has final authority for managed trades.
- Standalone ScoreCheck is allowed.
- Managed trade lifecycle requires TradePlan.
- TradeSetup stores planned trade values.
- ActiveTrade stores actual/current trade values.
- TradeResult updates RiskState and Journal.
- Journal and AI cannot update RiskState.
- Risk calculations use net P&L where available.
- Order placement is deferred in MVP.
- Broker login is allowed, but order placement/modification/cancellation is disabled.
- Provider credentials/tokens must never enter trade-domain models.
- Existing `Symbol` master is canonical.
- Provider token/symbol is mapping only.
- Audit log is mandatory for critical risk/trade/provider/symbol/AI/RAG events.
- RAG stores verified knowledge/summaries only, not raw ticks/candles/order book.
- India equity live monitoring requires user-authorized broker/live data.

## 4. New MVP Modules

### TradePlan Module

Owns user-defined trade plan scope and risk budget.

Responsibilities:

- create/update/list TradePlans
- validate risk template configuration
- define max daily risk, max trade risk, max open trades, and allowed markets
- expose current plan state

### ScoreCheck Module

Owns deterministic scoring for trade ideas.

Responsibilities:

- standalone ScoreCheck
- managed ScoreCheck under TradePlan
- direction-aware scoring
- template-based scoring strategy lookup
- score snapshot creation
- AI explanation request after deterministic score output

### TradeSetup Module

Owns planned trade values.

Responsibilities:

- validate planned long/short geometry
- store planned entry, stop, target, quantity, invalidation
- convert approved ScoreCheck into planned setup
- preserve planned values for later journal comparison

### RiskGovernor Module

Owns final permission.

Responsibilities:

- apply plan risk
- apply user daily risk
- apply market/session rules
- apply STOP_TRADING rules
- return permission vocabulary only

### ActiveTrade Module

Owns actual/current trade state.

Responsibilities:

- confirm actual execution from an approved TradeSetup
- store actual entry/quantity/current stop/current state
- keep planned values separate from actual/current values
- calculate actual risk, risk amount, reward, and RR
- detect execution quality and rule violations
- expose active trade status

Current Phase 5 does not place orders, consume broker fills, start monitoring, or mutate risk state.

### MonitoringRule Module

Owns rule-based ActiveTrade monitoring.

Responsibilities:

- evaluate active trades against templates
- create TradeEvents
- detect target/stop/invalidation/risk-reduction events
- reject stale market feeds

This module is separate from `AnalyzerEngine`.

### TradeResult Module

Owns outcome and closeout.

Responsibilities:

- create TradeResult from close/partial close
- calculate gross/net P&L distinction
- emit projection input for RiskState
- trigger journal update

### RiskState Module

Owns projected risk state.

Responsibilities:

- update TradePlanRiskState
- update UserDailyRiskState
- enforce idempotency
- prefer net P&L where available
- drive STOP_TRADING state

### Journal Module

Owns structured trade journal facts.

Responsibilities:

- create/update structured journal from TradeSetup, ActiveTrade, TradeEvents, and TradeResult
- request AI summary/review
- never mutate RiskState

### AI Orchestrator Module

Owns AI explanation/review coordination.

Responsibilities:

- explain ScoreCheck
- explain RiskGovernor decision
- explain TradeEvent
- summarize TradeResult and Journal
- validate AI output schema

AI cannot decide permission or mutate domain records.

### AuditLog Module

Owns append-only audit trail.

Responsibilities:

- record critical trade/risk/provider/symbol/AI/RAG events
- sanitize secrets and provider tokens
- support idempotent event creation

## 5. Proposed Service Boundaries

```txt
TradePlanService
ScoreCheckService
ScoringEngineService
TradeSetupService
RiskGovernorService
ActiveTradeService
TradeMonitoringService
TradeResultService
RiskStateProjectionService
TradeJournalService
AiOrchestratorService
AuditLogService
```

Pattern:

```txt
route
  -> controller
  -> focused service
  -> model / integration / port
```

Controllers should not contain scoring, risk, monitoring, or AI orchestration logic.

## 6. Proposed Model List

```txt
TradePlan
CapitalAdjustmentEvent
ScoreCheck
TradeSetup
TradeScoreSnapshot
TradePlanRiskState
UserDailyRiskState
ActiveTrade
TradeEvent
TradeResult
TradeJournal
AiExplanation
RagDocument
AuditLog
```

Recommended common fields:

- `user`
- `symbolId` where symbol-specific
- `tradePlanId` where managed
- `activeTradeId` where active-trade-specific
- `status`
- `createdAt`
- `updatedAt`
- `idempotencyKey` where retryable

Recommended indexes:

- `{ user: 1, createdAt: -1 }`
- `{ user: 1, status: 1 }`
- `{ user: 1, tradePlanId: 1, status: 1 }`
- `{ user: 1, activeTradeId: 1, createdAt: -1 }`
- `{ user: 1, symbolId: 1, createdAt: -1 }`
- unique idempotency indexes for retryable projections/sync events

## 7. Proposed Route List

```txt
POST   /api/trade-plans
GET    /api/trade-plans
GET    /api/trade-plans/:id
PATCH  /api/trade-plans/:id

POST   /api/score-checks
GET    /api/score-checks
GET    /api/score-checks/:id

POST   /api/trade-setups
GET    /api/trade-setups/:id
POST   /api/trade-setups/:id/activate

GET    /api/active-trades
GET    /api/active-trades/:id
POST   /api/active-trades/:id/events

POST   /api/trade-results
GET    /api/trade-results/:id

GET    /api/journal
GET    /api/journal/:id

GET    /api/audit
```

All routes must be authenticated unless explicitly documented otherwise.

## 8. Event Flow

### Standalone ScoreCheck

```txt
User submits trade idea
  -> ScoreCheckController
  -> ScoreCheckService
  -> Symbol resolver checks canonical Symbol
  -> ScoringEngineService selects strategy
  -> ScoreCheck saved with snapshot
  -> AI Orchestrator explains result
  -> AuditLog records score event
```

### Managed Trade

```txt
User selects TradePlan
  -> ScoreCheck created
  -> TradeSetup created from approved/planned values
  -> RiskGovernor evaluates final permission
  -> if TAKE_TRADE / TAKE_SMALL_RISK:
       ActiveTrade can be created
  -> if WAIT / REJECT:
       no ActiveTrade
  -> if STOP_TRADING:
       RiskState blocks further managed trade activation
```

### ActiveTrade Monitoring

```txt
Normalized market data
  -> TradeMonitoringService
  -> MonitoringRuleEngine
  -> TradeEvent
  -> optional TradeResult
  -> RiskStateProjectionService
  -> TradeJournalService
  -> AI review/explanation
  -> AuditLog
```

## 9. Implementation Phases

### Phase 1: Domain Types And Models

- Add trade/risk/scoring/monitoring/audit type files.
- Add `AuditLog` Mongoose model and indexes.
- Add audit sanitizer and audit logging service.
- Add canonical Symbol resolver helper.
- Add no provider credentials to trade models.
- Add model/service-level tests where practical.

Current status:

```txt
Implemented as Phase 1 foundation.
TradePlan, ScoreCheck, TradeSetup, RiskGovernor, and ActiveTrade are implemented in later phases.
TradeResult, Journal, AI review, and order flows are still pending.
```

### Phase 2: TradePlan And Risk State Foundation

- Implement TradePlan routes/controller/service.
- Implement TradePlanRiskState and UserDailyRiskState initialization.
- Add CapitalAdjustmentEvent.
- Add audit logging for plan/risk changes.

Current status:

```txt
Implemented.
TradePlan can be created, listed, read, updated while DRAFT, activated, paused, stopped, completed, archived, and capital-adjusted.
Activation initializes TradePlanRiskState idempotently.
ScoreCheck, TradeSetup conversion, and RiskGovernor foundation are now implemented.
```

### Phase 3: ScoreCheck Foundation

- Implement standalone ScoreCheck.
- Add scoring strategy interfaces.
- Add intraday/swing/crypto strategy stubs.
- Add score snapshot.
- Add AI explanation only after deterministic scoring.

Current status:

```txt
Implemented without AI decisioning.
ScoreCheck is standalone, uses canonical Symbol by symbolId, stores symbol snapshot, validates trade geometry, calculates risk/reward/RR, creates TradeScoreSnapshot, and returns score-level permission.
TradeSetup conversion and RiskGovernor final managed permission are now implemented.
```

Implemented API:

```txt
POST /api/score-checks
GET /api/score-checks
GET /api/score-checks/:id
```

### Phase 4: TradeSetup And RiskGovernor

- Implement TradeSetup planned values.
- Add long/short geometry validation.
- Implement RiskGovernor permission output.
- Add STOP_TRADING behavior.
- Add tests for AI non-authority.

Current status:

```txt
Implemented.
ScoreCheck can be converted into TradeSetup only under an ACTIVE matching TradePlan.
TradeSetup stores planned values only.
RiskGovernor reads TradePlan, TradePlanRiskState, optional UserDailyRiskState, score permission, and planned RR to produce final managed permission.
RiskGovernor does not mutate risk state.
ActiveTrade confirmation is implemented in Phase 5.
Monitoring, order placement, and result projection are still pending.
```

Implemented API:

```txt
POST /api/score-checks/:id/convert-to-trade-setup
GET /api/trade-setups
GET /api/trade-setups/:id
POST /api/trade-setups/:id/cancel
GET /api/trade-plans/:id/trade-setups
```

### Phase 5: ActiveTrade Foundation

- Implement actual-trade confirmation from approved TradeSetup.
- Preserve TradeSetup planned values.
- Store actual/current values in ActiveTrade.
- Validate actual LONG/SHORT geometry.
- Calculate actual risk, reward, risk amount, and RR.
- Detect execution quality and rule violations.
- Mark TradeSetup as `EXECUTED`.
- Add audit events and service-level tests.

Current status:

```txt
Implemented.
Only APPROVED TradeSetup records with TAKE_TRADE or TAKE_SMALL_RISK can execute.
Expired scores, invalid geometry, actual RR below 1, and repeated execution are rejected.
ActiveTrade starts as ACTIVE and can be manually cancelled only while ACTIVE.
Risk state is not mutated.
Live MonitoringRuleEngine wiring, broker fill linking, and order placement are not implemented.
TradeResult and risk projection are implemented in Phase 7.
```

Implemented API:

```txt
POST /api/trade-setups/:id/confirm-actual-trade
GET /api/active-trades
GET /api/active-trades/:id
POST /api/active-trades/:id/cancel
GET /api/trade-plans/:id/active-trades
```

### Phase 6: TradeEvent And Monitoring Foundation

- Implement append-oriented TradeEvent persistence.
- Evaluate actual/current ActiveTrade levels against manual or synthetic prices.
- Detect direction-aware stoploss, target 1, target 2, +1R, and near-stop events.
- Deduplicate each event type per ActiveTrade.
- Audit evaluations, created events, and dedupe.
- Do not close ActiveTrade or mutate risk state.

Current status:

```txt
Implemented.
Monitoring uses actual/current ActiveTrade values, not TradeSetup planned values.
The manual endpoint creates deterministic TradeEvents without AI.
MONITORING_EVALUATED is audited but not persisted for every evaluation.
New non-deduplicated TradeEvents are delivered to the owning user's YuJiDi WebSocket in Phase 10.
Live market ticks are not yet wired to automatic ActiveTrade evaluation.
No automatic close, TradeResult creation, risk-state mutation, or order action occurs from delivery.
```

Implemented API:

```txt
POST /api/active-trades/:id/evaluate
GET /api/trade-events
GET /api/trade-events/:id
GET /api/active-trades/:id/events
```

### Phase 7: TradeResult And Risk Projection

- Implement manual full close from ActiveTrade.
- Calculate direction-aware gross P&L and realized R.
- Prefer confirmed net P&L, then estimated net, then gross fallback.
- Finalize one TradeResult per ActiveTrade.
- Mark ActiveTrade `CLOSED` or `STOPPED_OUT`.
- Project finalized results into plan and daily risk state.
- Enforce consecutive-loss and daily-loss STOP_TRADING rules.
- Make duplicate projection calls idempotent.

Current status:

```txt
Implemented.
Only ACTIVE or PARTIALLY_EXITED trades can be manually closed.
Phase 7 supports full close only.
Risk state changes only from FINALIZED TradeResult projection.
TradeEvent, Journal, and AI cannot mutate risk state.
Journal, AI review, RAG, broker fill linking, and order actions remain unimplemented.
```

Implemented API:

```txt
POST /api/active-trades/:id/close
GET /api/trade-results
GET /api/trade-results/:id
GET /api/active-trades/:id/result
GET /api/trade-plans/:id/trade-results
```

### Phase 8: Structured TradeJournal

- Create one journal per finalized TradeResult.
- Copy deterministic lifecycle facts without mutating their sources.
- Keep user reflection fields separately editable.
- Require minimum reflection completeness before finalization.
- Support journal archive.
- Keep deterministic journal facts immutable after finalization.

Current status:

```txt
Implemented.
Journal creation is idempotent per TradeResult.
Only whitelisted reflection fields can be updated.
Finalized and archived journals cannot be edited.
Journal never mutates TradeResult or risk state.
AI review is implemented separately in Phase 9.
No RAG ingestion, analytics, or sharing exists.
```

Implemented API:

```txt
POST /api/trade-results/:id/journal
GET /api/trade-journals
GET /api/trade-journals/:id
GET /api/trade-results/:id/journal
GET /api/active-trades/:id/journal
PATCH /api/trade-journals/:id
POST /api/trade-journals/:id/finalize
POST /api/trade-journals/:id/archive
```

### Phase 9: Schema-Validated Post-Trade AI Review

- Generate AI review only for a user-owned `FINALIZED` TradeJournal.
- Build an explicit, backend-owned context projection from journal facts.
- Hash the exact context and version the prompt and output schema.
- Validate structure and reject recommendation, order, risk-mutation, and P&L-authority language.
- Persist a user-owned `AiExplanation`.
- Update only `TradeJournal.aiSummary`, `aiReviewId`, and `aiGeneratedAt`.
- Use a deterministic fallback if the provider fails or output is rejected.
- Audit request, validation/rejection, fallback, and storage.

Current status:

```txt
Implemented.
AI explains finalized facts only.
AI cannot score, grant permission, mutate TradeResult, or mutate risk state.
No RAG, live AI monitoring, order placement, or plan-level review exists.
```

Implemented API:

```txt
POST /api/trade-journals/:id/ai-review
GET /api/trade-journals/:id/ai-review
GET /api/ai-explanations/:id
```

### Phase 10: Real-Time TradeEvent Delivery

- Add a second user-scoped real-time lane beside existing market monitor alerts.
- Build a safe `TRADE_EVENT_CREATED` payload from persisted TradeEvent fields.
- Deliver only newly created, non-deduplicated events to the owning user.
- Reuse the existing authenticated YuJiDi WebSocket connection and user socket registry.
- Audit delivery attempts, successful dispatch, and failures.
- Keep persistence authoritative when delivery fails.

Real-time lanes:

```txt
Lane 1:
Monitor/Tripwire
  -> AnalyzerEngine
  -> Alert
  -> NEW_ALERT

Lane 2:
ActiveTrade
  -> TradeMonitoringService
  -> TradeEvent
  -> TRADE_EVENT_CREATED
```

Current status:

```txt
Implemented.
TradeEvent delivery is additive and user-scoped.
Existing NEW_ALERT, ticker, market tick, authentication, and subscription behavior is unchanged.
Delivery does not close trades, create TradeResult, mutate risk state, call AI, or execute orders.
Live normalized tick wiring into TradeMonitoringService remains future work.
```

### Phase 11: Live ActiveTrade Monitoring

- Route Binance ticker and normalized Angel user-session ticks into a dedicated `ActiveTradeLiveMonitorService`.
- Resolve canonical Symbol identity before matching ActiveTrades whenever possible.
- Restrict Angel matching by the tick's authenticated user-session id.
- Match only `ACTIVE` and `PARTIALLY_EXITED` trades.
- Reuse deterministic `TradeMonitoringService`, `TradeEventService`, and `TradeEventDeliveryService`.
- Reject stale ticks older than 10 seconds by default.
- Limit each ActiveTrade to one evaluation per second by default.
- Limit evaluation workload to 100 matching trades per tick.
- Bound the in-memory cooldown map with cleanup and a maximum entry count.

Current status:

```txt
Implemented.
Binance public ticker events can evaluate matching active crypto trades.
Angel ticks evaluate only the owning user's matching active trades.
Live ticks may create and deliver deterministic TradeEvents.
Live ticks cannot close trades, create TradeResult, update RiskState, call AI, or execute orders.
AnalyzerEngine and NEW_ALERT behavior remain unchanged.
```

Live trade lane:

```txt
Normalized market tick
  -> ActiveTradeLiveMonitorService
  -> canonical symbol / safe snapshot matching
  -> freshness, cooldown, and workload controls
  -> TradeMonitoringService
  -> TradeEventService
  -> TradeEventDeliveryService
  -> TRADE_EVENT_CREATED
```

### Phase 12: Live Monitoring Reliability And Subscription Orchestration

- Register provider stream interest when an ActiveTrade becomes active.
- Remove stream interest when a trade is cancelled, closed, or stopped out.
- Warm existing active-trade subscriptions in a bounded non-blocking startup task.
- Resolve live ticks through a process-local provider-aware route cache before querying MongoDB.
- Cache only the projected ActiveTrade fields required for monitoring.
- Use a five-second cache TTL, bounded key count, and deterministic eviction.
- Track lightweight in-memory monitoring health counters per subscription key.

Subscription keys:

```txt
Binance:
BINANCE:BINANCE:BTCUSDT

Angel:
ANGEL_ONE:<userId>:MCX:<instrumentToken>
```

Current status:

```txt
Implemented for single-instance MVP.
ActiveTrade creation attempts monitoring registration without making trade creation depend on provider availability.
Cancellation and close invalidate monitoring cache/subscription interest.
Cache misses and expiry lazily refresh from MongoDB.
Startup warm-up is bounded and does not block server startup.
No Redis, AI, RAG, automatic close, risk mutation, or order execution is included.
```

## 10. Verification Gates

Backend gates:

```bash
cd yujidi-server
npm run typecheck
npm test
```

Required test themes:

- long/short geometry validation
- RiskGovernor final permission
- STOP_TRADING
- ScoreCheck conversion
- planned vs actual values
- TradeResult risk projection
- net P&L preference
- symbol resolver guard
- order placement disabled
- provider credentials not leaking
- audit sanitization
- AI validator
- RAG ingestion restrictions

Security gates:

- no provider credentials in trade models
- no provider tokens in AI prompts unless explicitly safe mapping
- no raw provider payloads in RAG
- no order placement code

## 11. Conflicts To Avoid

- Do not rewrite `analyzer.service.ts`.
- Do not rewrite `websocket.service.ts`.
- Do not replace existing Monitor/Tripwire system.
- Do not change auth cookie/JWT behavior.
- Do not change `.env`.
- Do not store provider credentials/tokens in trade-domain models.
- Do not use provider token as domain symbol identity.
- Do not make AI decide final trade permission.
- Do not store raw market ticks in RAG.

## 12. Recommended First Coding Task

The smallest safe foundation has started:

```txt
Phase 1A:
  add trade/risk/scoring/audit TypeScript types
  add AuditLog model
  add AuditLogService
  add AuditSanitizerService
  add SymbolResolverService
  add focused model/service tests
```

This creates the persistence, vocabulary, audit, and canonical symbol-resolution foundation without touching market data, analyzer, WebSocket, AI, or broker behavior.

Implemented Phase 2 API:

```txt
POST /api/trade-plans
GET /api/trade-plans
GET /api/trade-plans/:id
PATCH /api/trade-plans/:id
POST /api/trade-plans/:id/activate
POST /api/trade-plans/:id/pause
POST /api/trade-plans/:id/stop
POST /api/trade-plans/:id/complete
POST /api/trade-plans/:id/archive
POST /api/trade-plans/:id/capital-adjustments
```

Next recommended coding task:

```txt
Next phase:
  define previous-price crossing semantics and repeating-event windows
  design shared subscription/cache ownership before multi-instance scale
  keep automatic close, risk mutation, AI, and orders separately scoped
```

## 13. Phase 15 Template-Driven Scoring Foundation

ADR-010 scoring-side foundations are implemented with versioned template and evaluator
registries, weighted sections, explicit missing-data policies, evaluator execution statuses,
and detailed TradeScoreSnapshot breakdowns.

Current deterministic evaluators cover reward/risk, symbol metadata sanity, and MCX contract
sanity. Price-buffer, CVD, and order-book evaluators expose safe availability context but do
not yet invent directional scores. Index, sector, VWAP, volume, funding, and open-interest
evaluators remain honest stubs.

`GET /api/scoring/realtime-context` is authenticated, read-only, sanitized, and bounded.
Buffer items are omitted by default and capped at 100 when explicitly requested.

## 14. Phase 16 Market Snapshot Engine Foundation

Phase 16 adds a deterministic, process-local market context layer beside the existing
AnalyzerEngine and ActiveTrade monitoring lanes.

```txt
normalized Binance/Angel tick
  -> MarketSnapshotService
  -> provider-aware resource snapshot
  -> rolling 1m/3m/5m/15m candles
  -> basic VWAP and volume context
  -> freshness/readiness
  -> scoring context and deterministic evaluators
```

Implemented:

- public Binance resources use `BINANCE:<exchange>:<instrumentToken>`
- Angel resources include the owning user:
  `ANGEL_ONE:<userId>:<exchange>:<instrumentToken>`
- snapshots are capped at 5,000 resources by default
- each timeframe retains at most 100 candles by default
- returned snapshots and candle arrays are defensive copies
- `GET /api/scoring/realtime-context` includes summarized snapshot, candle, VWAP,
  volume, freshness, and template-resource readiness data
- ScoreCheck reads the current snapshot and registers template resource interest
- VWAP position/distance, freshness, RVOL, and index VWAP alignment evaluators now
  have deterministic implementations

Boundaries:

- no raw tick persistence
- no AnalyzerEngine behavior change
- no ActiveTrade or risk-state mutation
- no AI scoring
- no broker execution
- no new provider WebSocket ownership
- no Redis or cross-instance coordination

Current limitations:

- process restart clears snapshots
- template resource registration does not yet guarantee a provider subscription
- RVOL requires enough in-process one-minute candle history
- index/sector/VIX resource resolution is not yet automated
- the calculations are an MVP context foundation, not a historical market-data system
