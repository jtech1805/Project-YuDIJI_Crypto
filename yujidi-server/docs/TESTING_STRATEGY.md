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
- `src/integrations/market-data/angel/angel-symbol.mapper.test.ts`
- `src/integrations/market-data/angel/angel-symbol-sync.service.test.ts`
- `src/integrations/market-data/angel/angel-tick.normalizer.test.ts`
- `src/services/security/credential-encryption.service.test.ts`
- `src/services/broker-connection.service.test.ts`
- `src/integrations/market-data/angel/angel-quote.mapper.test.ts`
- `src/services/market-quote.service.test.ts`

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
- alert is emitted only to owning user's sockets
- Binance reconnect clears active symbols and resubscribes desired symbols

Binance WebSocket should be mocked.

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
