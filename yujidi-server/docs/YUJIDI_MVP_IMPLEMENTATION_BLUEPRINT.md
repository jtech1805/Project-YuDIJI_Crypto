# YuJiDi MVP Implementation Blueprint

This document is the implementation blueprint for adding YuJiDi's risk-first trade lifecycle.

It is intentionally documentation-only. It does not mean the modules described here already exist in code.

## 0. Implementation Status

This blueprint now has a small Phase 1 foundation in code.

Implemented:

- Shared trade/risk/scoring/monitoring/audit TypeScript vocabularies.
- `AuditLog` Mongoose model.
- `AuditLogService` with sanitize-before-persist behavior.
- `AuditSanitizerService` for redacting secrets and provider tokens from audit payloads.
- `SymbolResolverService` for resolving provider/exchange/instrument data back to canonical `Symbol` records.
- Unit tests for audit sanitization and symbol resolution.

Not implemented yet:

- TradePlan CRUD.
- ScoreCheck.
- TradeSetup.
- RiskGovernor.
- ActiveTrade.
- TradeResult.
- TradeJournal.
- MonitoringRuleEngine.
- AI trade/risk review.
- RAG ingestion.
- Order placement, order modification, or order cancellation.

Boundary:

The implemented Phase 1 foundation does not alter existing analyzer, WebSocket, monitor, auth, Angel login, or Binance behavior.

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

- activate approved TradeSetup
- store actual entry/quantity/current stop/current state
- keep planned values separate from actual/current values
- expose active trade status

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
Implemented as foundation only.
TradePlan, ScoreCheck, TradeSetup, RiskGovernor, ActiveTrade, TradeResult, Journal, AI review, and order flows are still pending.
```

### Phase 2: TradePlan And Risk State Foundation

- Implement TradePlan routes/controller/service.
- Implement TradePlanRiskState and UserDailyRiskState initialization.
- Add CapitalAdjustmentEvent.
- Add audit logging for plan/risk changes.

### Phase 3: ScoreCheck Foundation

- Implement standalone ScoreCheck.
- Add scoring strategy interfaces.
- Add intraday/swing/crypto strategy stubs.
- Add score snapshot.
- Add AI explanation only after deterministic scoring.

### Phase 4: TradeSetup And RiskGovernor

- Implement TradeSetup planned values.
- Add long/short geometry validation.
- Implement RiskGovernor permission output.
- Add STOP_TRADING behavior.
- Add tests for AI non-authority.

### Phase 5: ActiveTrade And Monitoring Rules

- Implement ActiveTrade activation.
- Add MonitoringRuleService interfaces and registry.
- Add market-specific monitoring templates.
- Consume normalized market data without rewriting AnalyzerEngine.

### Phase 6: TradeResult, Risk Projection, Journal

- Implement TradeResult.
- Implement idempotent RiskState projection.
- Prefer net P&L.
- Create structured Journal facts.
- Add AI review summary.

### Phase 7: Audit, RAG Restrictions, Hardening

- Add AuditLogService.
- Add audit routes if needed.
- Add RAG document restrictions.
- Add provider/security leak tests.
- Add idempotency tests.

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

Next recommended coding task:

```txt
Phase 2:
  add TradePlan model/service/controller/routes
  add TradePlanRiskState and UserDailyRiskState initialization
  add CapitalAdjustmentEvent if needed for risk base changes
  wire AuditLogService into plan/risk mutations
```
