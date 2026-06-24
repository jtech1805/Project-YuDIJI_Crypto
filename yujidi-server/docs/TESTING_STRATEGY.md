# Testing Strategy

This document defines the testing strategy for the YuJiDi backend.

`PROJECT_CONTEXT.md` remains the high-level source of truth. This file is the detailed reference for what should be tested, why it matters, and how to prioritize test coverage.

## 1. Testing Goals

The backend handles auth, live market data, analyzer state, AI calls, MongoDB persistence, and real-time WebSocket delivery.

The testing goal is to protect the behavior that would hurt users most if broken:

- user ownership boundaries
- monitor creation and validation
- analyzer trigger correctness
- cooldown behavior
- alert persistence
- WebSocket delivery routing
- LLM response validation
- auth/session behavior

Testing should focus first on domain correctness, then integration reliability, then deployment confidence.

## 2. Current Test Status

Current `package.json` scripts include:

```txt
dev
start
test
test:analyzer
typecheck
```

There is now a first analyzer unit-test foundation using Node's built-in test runner with `tsx`.

Current automated tests:

- `src/services/analyzer.rules.test.ts`
- `src/services/analyzer.service.test.ts`
- `src/services/audit-sanitizer.service.test.ts`
- `src/services/symbol-resolver.service.test.ts`
- `src/services/trade-plan.service.test.ts`
- `src/services/score-check.service.test.ts`
- `src/services/trade-setup.service.test.ts`
- `src/integrations/market-data/angel/angel-symbol.mapper.test.ts`
- `src/integrations/market-data/angel/angel-symbol-sync.service.test.ts`
- `src/integrations/market-data/angel/angel-tick.normalizer.test.ts`
- `src/services/security/credential-encryption.service.test.ts`
- `src/services/broker-connection.service.test.ts`
- `src/integrations/market-data/angel/angel-quote.mapper.test.ts`
- `src/services/market-quote.service.test.ts`
- `src/services/monitor.service.test.ts`
- `src/utils/market-subscription-key.test.ts`
- `src/integrations/market-data/angel/angel-ltp-packet.parser.test.ts`
- `src/services/angel-user-market-data-session.service.test.ts`

Current commands:

```bash
npm test
npm run test:analyzer
```

Current recommendation:

- Continue domain/unit tests around analyzer logic first.
- Keep provider mappers covered with pure unit tests before live sync.
- Keep Angel symbol sync safety covered: disabled mode, dry-run mode, and batched write mode.
- Keep Angel Phase 2 sync filters covered: MCX rows pass, non-MCX rows skip, unsupported commodity names skip, and upsert identity uses provider + exchange + instrument token.
- Do not call the real Angel Scrip Master URL in automated tests.
- Keep normalized tick bridge covered so provider-specific ticks reuse production analyzer behavior.
- Keep broker connection tests focused on encryption/decryption, safe response mapping, mocked Angel login success/failure, and disabled order-placement permission.
- Keep Angel quote tests focused on mapper behavior, mocked quote service behavior, broker-connection requirements, and no secret leakage.
- Do not call the real Angel Quote API in automated tests.
- Keep universal monitor tests focused on `symbolId` creation, legacy Binance compatibility, broker-login validation, and snapshot persistence.
- Keep market subscription key tests focused on provider-aware key shape and Angel user scoping.
- Keep Angel LTP parser tests focused on binary offset parsing, token extraction, timestamp parsing, and price scaling.
- Keep Angel user market-data session tests mocked; automated tests must not open real Angel WebSocket connections.
- Add route integration tests for unauthenticated broker connection rejection when route-test tooling is introduced.
- Add integration tests for routes after core domain behavior is covered.

Suggested tools:

- Node's built-in test runner for low-dependency unit tests.
- Vitest or Jest if richer mocking/snapshot tooling becomes necessary.
- Supertest for Express route testing.
- mongodb-memory-server for MongoDB integration tests.
- Mock WebSocket/Groq/Binance dependencies for deterministic tests.

## 3. Testing Pyramid

Recommended test distribution:

```txt
Many unit tests
  -> analyzer, auth service, monitor service, validation

Some integration tests
  -> Express routes, MongoDB model behavior, auth cookies

Few end-to-end tests
  -> full happy-path flows with mocked external APIs
```

The analyzer should have the strongest unit coverage because it contains the highest-risk business logic.

## 4. Unit Tests

### 4.1 Analyzer Tests

Primary file:

```txt
src/services/analyzer.service.ts
```

Current foundation files:

```txt
src/services/analyzer.rules.ts
src/services/analyzer.rules.test.ts
src/services/analyzer.service.test.ts
```

Currently covered:

- drop monitor breaches only on negative threshold
- drop monitor does not breach on upward spike
- spike monitor breaches only on positive threshold
- spike monitor does not breach on downward drop
- invalid trigger never breaches
- display movement values round to two decimals
- zero-monitor cache snapshot is marked as negative cache
- active cache snapshot is marked as non-negative cache
- `processTick` creates drop alerts when threshold is breached
- `processTick` creates spike alerts when threshold is breached
- `processTick` does not create spike alerts on downward drops
- `processTick` skips alerts when price history is insufficient
- cooldown prevents duplicate `processTick` alerts
- LLM/report failure prevents alert persistence and emission
- negative active-monitor cache avoids repeated monitor fetch within TTL

Must test:

- valid tick updates price buffer
- invalid tick is rejected
- old price ticks are culled
- CVD positive delta
- CVD negative delta
- CVD ignores small trades
- CVD culls old trades
- cooldown expires and allows retrigger
- order-book snapshot updates
- unknown support/resistance when no book exists

Important mocking:

- `TripwireConfigModel.find`
- `AlertModel.create`
- `fetchRecentHeadlines`
- `sharedLlmService.generateAlertReport`
- alert emitter callback

### 4.2 Monitor Service Tests

Primary file:

```txt
src/services/monitor.service.ts
```

Must test:

- supported symbols are returned
- user monitors are scoped by user
- invalid user id is rejected
- invalid monitor id is rejected
- unsupported symbol is rejected
- monitor creation normalizes symbol
- legacy Binance monitor creation by `symbol`
- Binance monitor creation by `symbolId`
- Angel monitor creation by `symbolId` with active BrokerConnection
- Angel monitor rejection without active BrokerConnection
- symbol snapshot fields are stored on monitor
- broker credentials are not decrypted during monitor creation
- update strips `_id` and `user`
- delete requires ownership

### 4.3 Auth Service Tests

Primary file:

```txt
src/services/auth.service.ts
```

Must test:

- registration validates email/password/name
- duplicate email is rejected
- password is hashed
- login rejects missing user
- login rejects wrong password
- login stores refresh token
- refresh rejects missing token
- refresh rejects mismatched token
- refresh rotates token
- logout clears refresh token

### 4.4 LLM Service Tests

Primary file:

```txt
src/services/llm.service.ts
```

Must test:

- valid alert JSON is parsed
- malformed JSON is rejected
- schema mismatch is rejected
- empty Groq response is rejected
- copilot dirty JSON fallback works
- copilot schema mismatch is rejected

External Groq calls must be mocked. Tests should never call the real Groq API.

### 4.5 News Service Tests

Primary file:

```txt
src/services/news.service.ts
```

Must test:

- `BTCUSDT` strips to `BTC`
- headlines are joined correctly
- empty results return fallback
- request failure returns fallback

External CryptoCompare calls must be mocked.

### 4.6 Angel Quote Tests

Primary files:

```txt
src/integrations/market-data/angel/angel-quote.service.ts
src/integrations/market-data/angel/angel-quote.mapper.ts
src/services/market-quote.service.ts
```

Currently covered:

- LTP quote mapping.
- OHLC quote mapping.
- FULL quote mapping with depth and open interest.
- Missing symbol rejection.
- Non-Angel provider rejection.
- Missing broker connection rejection.
- Successful normalized snapshot response.
- Safe handling of Angel `unfetched` quote response.
- No mocked API key/JWT/encrypted fields in normalized snapshot output.

Must test later:

- Auth-protected route integration for `GET /api/market-quotes/:symbolId`.
- Expired BrokerConnection session behavior.
- Invalid quote mode route validation.
- Angel Quote API HTTP client with mocked Axios.

External Angel Quote API calls must be mocked. Tests should never call the real Angel Quote endpoint.

### 4.7 Angel WebSocket LTP Tests

Primary files:

```txt
src/integrations/market-data/angel/angel-ltp-packet.parser.ts
src/integrations/market-data/angel/angel-market-data.provider.ts
src/services/angel-user-market-data-session.service.ts
```

Currently covered:

- LTP packet parses mode and exchange type.
- LTP packet parses null-terminated token.
- LTP packet parses sequence number and exchange timestamp.
- LTP packet scales MCX price by 100.
- Short packets are rejected safely.
- Session manager subscribes active Angel monitor with mocked provider.
- Session manager rejects missing BrokerConnection.
- Session manager rejects non-Angel monitors.
- Session manager unsubscribes and disconnects when no subscriptions remain.

Must test later:

- Protected debug route integration for subscribe/unsubscribe/status.
- Angel provider payload shape with mocked WebSocket client.
- Heartbeat behavior with fake timers.
- WebSocket close/error status transitions.

Automated tests must not call the real Angel WebSocket endpoint.

### 4.8 Provider-Aware Subscription Routing Tests

Primary files:

```txt
src/services/market-subscription-resolver.service.ts
src/services/market-subscription-router.service.ts
src/services/websocket.service.ts
```

Currently covered:

- Resolver maps Binance symbol to `BINANCE:BINANCE:<symbol>`.
- Resolver maps Angel MCX symbol to `ANGEL_ONE:<userId>:MCX:<instrumentToken>`.
- Resolver rejects unknown symbols.
- Resolver rejects Angel symbols when the user has no active BrokerConnection.
- Router sends Binance subscriptions to the Binance handler.
- Router sends Angel subscriptions to the Angel user market-data session service.
- Router rejects unsupported providers.

Must test later:

- WebSocket manager mixed subscription payload with Binance and Angel symbols.
- `SUBSCRIPTION_UPDATE_RESULT` partial success/failure contract.
- Angel `MARKET_TICK` delivery only to sockets subscribed to the exact user-specific key.
- Two users subscribed to the same Angel instrument do not receive each other's ticks.
- Cleanup on browser socket close routes provider unsubscribe correctly.

### 4.9 Angel Analyzer Tests

Primary files:

```txt
src/services/analyzer.service.ts
src/services/analyzer.rules.ts
src/types/market-data.types.ts
src/utils/market-subscription-key.ts
```

Currently covered:

- `processNormalizedTick` creates an Angel spike alert using existing analyzer rules.
- `processNormalizedTick` creates an Angel drop alert using existing analyzer rules.
- Angel alert payload includes provider/exchange/instrument metadata.
- Angel alert payload includes current and previous price.
- Angel tick for user A does not trigger user B's monitor.
- Angel analyzer cache and price buffer use `ANGEL_ONE:<userId>:MCX:<instrumentToken>`.
- Existing Binance `processTick` tests still pass.

Must test later:

- WebSocket manager live Angel tick invokes analyzer exactly once.
- Analyzer failure does not block frontend `MARKET_TICK` delivery.
- Duplicate tick de-duplication if provider repeats the same timestamp/sequence.
- Production DB query shape for provider-aware monitor lookup.

## 5. Integration Tests

### 5.1 Auth Routes

Primary files:

```txt
src/routes/auth.routes.ts
src/controllers/auth.controller.ts
```

Must test:

- register creates user
- register rejects invalid body
- login sets cookies
- login rejects invalid credentials
- `/auth/me` requires auth
- `/auth/me` returns current user
- logout clears cookies

### 5.2 Monitor Routes

Primary files:

```txt
src/routes/monitor.routes.ts
src/controllers/monitor.controller.ts
```

Must test:

- symbols endpoint returns supported symbols
- list monitors requires auth
- create monitor requires auth
- create monitor validates request
- create monitor rejects unsupported symbol
- update monitor requires ownership
- delete monitor requires ownership

### 5.3 Alert Routes

Primary files:

```txt
src/routes/alert.routes.ts
src/controllers/alert.controller.ts
```

Must test:

- alert list requires auth
- alert list returns only user's alerts
- alert detail returns only user's alert
- alert detail rejects other user's alert
- LTP handles invalid symbol response

Known issue to cover:

`getAlertById` likely needs user-id lookup correction before tests pass.

### 5.4 Chat Routes

Primary files:

```txt
src/routes/chat.routes.ts
src/controllers/chat.controller.ts
```

Must test:

- chat requires auth
- invalid payload is rejected
- general intent returns no trade math
- trade intent returns trade math
- missing order book creates system veto
- chat history is saved
- chat history loads by user and symbol

## 6. WebSocket Tests

Primary file:

```txt
src/services/websocket.service.ts
```

Must test:

- upgrade rejects missing token
- upgrade accepts valid token
- subscription message validates payload
- global symbol count increments on subscribe
- global symbol count decrements on unsubscribe
- duplicate subscription does not double count for same socket
- close cleanup decrements counts
- ticker update is sent only to subscribed clients
- mixed Binance/Angel subscription routes each provider correctly
- provider-aware subscription keys prevent Angel cross-user delivery
- `SUBSCRIPTION_UPDATE_RESULT` reports failed symbols without breaking successful symbols
- Angel `MARKET_TICK` is sent only to subscribed frontend sockets
- alert is emitted only to owning user's sockets
- Binance reconnect clears active symbols and resubscribes desired symbols

Binance and Angel WebSocket providers should be mocked.

## 7. Contract Tests

Contract tests should verify request/response shapes that frontend relies on.

Important contracts:

```txt
POST /api/auth/login
GET /api/auth/me
GET /api/monitors
POST /api/monitors
GET /api/alerts
POST /api/chat
WebSocket TICKER_UPDATE
WebSocket NEW_ALERT
```

These tests prevent backend changes from silently breaking the frontend.

## 8. External API Test Policy

Tests must not call:

- real Binance API
- real Binance WebSocket
- real Groq API
- real CryptoCompare API
- production MongoDB

All external systems should be mocked or replaced with local test doubles.

Reason:

- deterministic tests
- no secret exposure
- no rate-limit surprises
- no dependency on network availability

## 9. Security Test Cases

Must test:

- unauthenticated users cannot access protected routes
- User A cannot read User B monitors
- User A cannot update/delete User B monitors
- User A cannot read User B alerts
- User A cannot load User B chat session
- WebSocket upgrade requires valid cookie token
- alert emit goes only to owning user sockets
- invalid JWT is rejected
- expired JWT is rejected

## 10. Regression Tests For Known Bugs

When fixed, add regression tests for:

1. Spike monitors trigger on upward movement.
2. Alert detail lookup uses `req.user.id` correctly.
3. Monitor windows cannot exceed analyzer buffer unless buffer is expanded.
4. Failed alert pipeline does not create misleading successful state.
5. HTTP LTP ignition does not create permanent unmanaged subscriptions.
6. Symbol search does not call MongoDB for queries shorter than two characters.
7. Symbol search ranks common futures/spot results ahead of noisy option matches for generic queries.
8. Frontend add-monitor flows do not fetch the full symbol collection on open.

## 10.1 Symbol Search Tests

Phase 9 adds scalable symbol discovery through `GET /api/symbols/search`.

Current and future test coverage should include:

- tokenizer normalization for Binance symbols and Angel MCX symbols
- autocomplete prefix token generation
- search result ranking for exact, prefix, and generic queries
- provider, market type, exchange, and instrument type filters
- default expired-contract exclusion
- query limit validation
- short-query no-op behavior
- search cache behavior
- frontend debounce and request cancellation behavior

Real provider APIs should not be called in symbol search tests. Tests should use fake repositories or local fixtures.

## 10.2 Future Trade/Risk Lifecycle Tests

The risk-first trade lifecycle must be tested before implementation is considered safe.

Current Phase 1 foundation tests:

- Audit sanitizer redacts sensitive root-level keys.
- Audit sanitizer redacts nested sensitive keys.
- Audit sanitizer handles arrays.
- AuditLogService sanitizes metadata before persistence.
- SymbolResolverService returns unresolved when no mapping exists.
- SymbolResolverService resolves by provider/exchange/instrument token.
- SymbolResolverService blocks ambiguous provider-symbol mappings.
- SymbolResolverService detects requested instrument-type mismatch.

Current Phase 2 foundation tests:

- TradePlanService creates TradePlans in `DRAFT`.
- Invalid starting capital is rejected.
- `FIXED_TRADE_COUNT` plans require `maxTrades`.
- `DATE_RANGE` plans require a valid `endDate`.
- `DRAFT` plans can be activated.
- Activation initializes `TradePlanRiskState`.
- Activation is rejected from non-`DRAFT` statuses.
- Core fields cannot be updated after activation because updates are currently DRAFT-only.
- Active plans can be paused.
- Active or paused plans can be stopped.
- Active or paused plans can be completed.
- Draft, stopped, or completed plans can be archived.
- Capital adjustments create event records and update current capital.
- AuditLogService is called for lifecycle changes.
- Risk bucket key generation is deterministic.

Current Phase 3 foundation tests:

- LONG valid geometry passes.
- LONG invalid geometry rejects.
- SHORT valid geometry passes.
- SHORT invalid geometry rejects.
- Risk/reward/RR calculation works for LONG.
- Risk/reward/RR calculation works for SHORT.
- RR below 1 returns `REJECT`.
- RR from 1 to below 1.5 returns `WAIT`.
- RR from 1.5 to below 2 returns `TAKE_SMALL_RISK`.
- RR 2 or above returns `TAKE_TRADE`.
- ScoreCheck does not mutate risk state.
- ScoreCheck creates `TradeScoreSnapshot`.
- AuditLogService is called for `SCORE_CHECK_CREATED` and `SCORE_CALCULATED`.
- Missing symbol rejects safely.
- Inactive symbol rejects safely.

Current Phase 4 foundation tests:

- ScoreCheck cannot convert without an `ACTIVE` TradePlan.
- ScoreCheck from another user cannot convert.
- TradePlan from another user cannot receive conversion.
- TradePlan/ScoreCheck market scope mismatch rejects.
- Expired ScoreCheck rejects.
- Already-converted ScoreCheck rejects.
- Valid conversion creates TradeSetup.
- Valid conversion updates `ScoreCheck.convertedToTradeSetupId`.
- Valid conversion copies planned values.
- Valid conversion copies symbol snapshot.
- RiskGovernor returns `STOP_TRADING` when plan risk mode is `STOP_TRADING`.
- RiskGovernor returns `REJECT` when score permission is `REJECT`.
- RiskGovernor caps final permission to `TAKE_SMALL_RISK` in `REDUCED_RISK`.
- RiskGovernor caps final permission to `TAKE_SMALL_RISK` in `MICRO_RISK`.
- RiskGovernor rejects when `maxTrades` is reached.
- RiskGovernor returns `STOP_TRADING` when consecutive-loss limit is reached.
- AuditLogService is called for conversion, setup creation, and risk evaluation.
- TradeSetup cancellation works if not executed.
- TradeSetup cancellation rejects if already executed.

Current Phase 5 foundation tests:

- Non-`APPROVED` TradeSetup confirmation rejects.
- `WAIT`, `REJECT`, and `STOP_TRADING` final permissions reject.
- Already-executed TradeSetup rejects.
- Expired score validity rejects.
- Another user's TradeSetup cannot be confirmed.
- Valid LONG and SHORT confirmations create ActiveTrade.
- Invalid LONG and SHORT actual geometry rejects.
- LONG and SHORT actual risk/reward/RR math is verified.
- Actual RR below `1` rejects.
- LONG and SHORT stoploss widening is detected.
- Actual risk above planned risk is detected.
- Successful confirmation marks TradeSetup `EXECUTED`.
- Symbol snapshot is copied while planned values remain unchanged.
- AuditLogService receives actual-confirmation, ActiveTrade-creation, and TradeSetup-execution events.
- ACTIVE trade cancellation succeeds.
- CLOSED trade cancellation rejects.

Current Phase 6 foundation tests:

- LONG and SHORT stoploss-hit detection.
- LONG and SHORT target 1 detection.
- LONG and SHORT target 2 detection.
- LONG and SHORT current-R calculation.
- +1R detection.
- LONG and SHORT near-stop detection.
- Repeated stoploss events are deduplicated.
- Stoploss events do not mutate ActiveTrade status.
- Monitoring does not create TradeResult or mutate risk state.
- Closed/non-active trades reject evaluation.
- Monitoring evaluation and event creation are audited.
- TradeEvent listing is scoped by user ownership.
- Manual evaluation returns created events and current R.

Current Phase 7 foundation tests:

- User ownership and ActiveTrade status gates.
- Exit price and quantity validation.
- LONG and SHORT gross P&L calculation.
- Confirmed net, estimated net, and gross fallback behavior.
- Gross fallback warning.
- Realized-R calculation.
- WIN, LOSS, and BREAKEVEN classification.
- STOPLOSS produces `STOPPED_OUT`; other exits produce `CLOSED`.
- TradeResult is finalized and projection becomes applied.
- Plan and daily risk counts/P&L/R are projected.
- Loss increments and win resets consecutive losses.
- Duplicate projection does not double-count.
- Consecutive-loss and daily-loss limits trigger STOP_TRADING.
- Result finalization and risk projection are audited.
- Result listing and ActiveTrade lookup are user-scoped.

These tests cover the Phase 1/2/3/4/5/6/7 foundation. They do not yet prove live market-tick wiring, Journal, AI review, RAG, broker-fill linking, partial close, reversal, or order-flow behavior because those modules are intentionally not implemented yet.

### Geometry And Direction Tests

Must cover:

- long setup where entry, stop, and target geometry is valid
- long setup where stop is above entry and must be rejected
- short setup where entry, stop, and target geometry is valid
- short setup where stop is below entry and must be rejected
- risk/reward calculation for long and short
- planned values preserved in TradeSetup
- actual/current values stored separately in ActiveTrade

### RiskGovernor Tests

Currently covered:

- final permission values: `TAKE_TRADE`, `TAKE_SMALL_RISK`, `WAIT`, `REJECT`, `STOP_TRADING`
- RiskGovernor can downgrade scoring output
- RiskGovernor can reject a high-scoring trade
- RiskGovernor can force `STOP_TRADING`
- consecutive-loss limit

Must cover in later phases:

- AI cannot override RiskGovernor
- daily loss limit breach with projected TradeResult updates
- plan risk limit breach with projected open risk
- max open trades breach after ActiveTrade exists
- cooldown rule if added to plan/risk templates

### ScoreCheck Tests

Currently covered:

- standalone ScoreCheck allowed without TradePlan
- direction-aware scoring
- provider raw data does not decide score directly
- score snapshot is stored for audit/replay
- geometry validation for LONG and SHORT
- score-level permission bands for RR thresholds

Must cover in later phases:

- managed trade conversion requires TradePlan
- separate scoring templates for intraday, swing, crypto spot, and crypto perpetual beyond the baseline RR-only evaluator
- AI explanation after deterministic scoring without AI decision authority

### TradeSetup And ActiveTrade Tests

Currently covered:

- TradeSetup stores planned entry, stop, target, size, and invalidation
- planned values are not overwritten by actual values
- activation requires RiskGovernor permission
- ActiveTrade stores actual entry, actual quantity, current stop, and current state
- actual execution geometry is direction-aware
- actual risk, reward, risk amount, and RR are calculated deterministically
- actual RR below the minimum is rejected
- stoploss widening and excess actual risk are recorded
- TradeSetup is marked `EXECUTED` after successful ActiveTrade creation
- ActiveTrade cancellation is limited to `ACTIVE` status
- order placement remains disabled

Must cover in later phases:

- broker-sync-assisted fill reconciliation
- partial exits and remaining quantity changes
- automatic monitoring-driven status transitions
- TradeResult finalization and risk-state projection

### TradeEvent And Monitoring Tests

Currently covered:

- monitoring uses actual/current ActiveTrade values
- SL, target 1, target 2, +1R, and near-SL rules are direction-aware
- one event type per ActiveTrade is enforced by idempotency
- manual/synthetic evaluation is user-owned
- events are append-oriented and auditable
- evaluation does not close the trade
- evaluation does not create TradeResult
- evaluation does not mutate risk state

Must cover in later phases:

- normalized live market-tick integration
- repeating event windows and cooldown policy
- previous-price crossing semantics
- degraded/stale market-feed events
- partial-exit and current-stop updates

### TradeResult And Risk Projection Tests

Currently covered:

- TradeResult projection updates TradePlanRiskState
- TradeResult projection updates UserDailyRiskState
- duplicate projection is idempotent
- net P&L is preferred over gross P&L where available
- charges are handled in estimated net calculations
- realized R and result type are deterministic
- consecutive-loss and daily-loss STOP_TRADING behavior
- TradeResult is the only implemented risk-state mutation source

Must cover in later phases:

- projection reversal and adjusted results
- partial closes and multi-result aggregation
- broker-confirmed fees and slippage reconciliation
- Journal cannot update RiskState
- AI cannot update RiskState

### Symbol And Provider Guard Tests

Must cover:

- new trade lifecycle references canonical `Symbol` by `symbolId`
- provider token is mapping only, not domain identity
- wrong provider/exchange/token mapping is rejected
- India equity live monitoring requires user-authorized broker/live data
- provider credentials/tokens never appear in trade-domain records
- raw provider payloads are not copied into domain docs

### Audit, AI, And RAG Tests

Must cover:

- audit log created for critical TradePlan, ScoreCheck, RiskGovernor, ActiveTrade, TradeResult, provider, symbol, AI, and RAG events
- audit entries are sanitized
- provider credentials and session tokens are redacted
- AI output schema validation
- AI explanations cannot mutate trade/risk state
- RAG ingestion rejects raw ticks, candles, order book, provider payloads, and secrets
- RAG stores verified knowledge/summaries only

## 11. Suggested Test Script

Recommended package scripts:

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "typecheck": "tsc --noEmit"
}
```

This is a recommendation only. Add dependencies and scripts in a dedicated implementation task.

## 12. Minimum Definition Of Done

For backend behavior changes:

- TypeScript typecheck passes.
- Relevant unit tests are added or updated.
- Route changes include integration coverage where practical.
- External APIs are mocked.
- User ownership boundary is tested if touched.
- Documentation is updated if domain behavior changes.

For analyzer behavior changes:

- Drop and spike tests cover trigger and non-trigger paths.
- Cooldown behavior is tested.
- Insufficient-history behavior is tested.
- LLM failure behavior is tested.
- Alert emitter behavior is tested.

## 13. Priority Order

Add tests in this order:

1. Analyzer unit tests.
2. Monitor service tests.
3. Auth route/service tests.
4. Alert route tests.
5. WebSocket manager tests.
6. Chat copilot tests.
7. Contract tests for frontend API shapes.
