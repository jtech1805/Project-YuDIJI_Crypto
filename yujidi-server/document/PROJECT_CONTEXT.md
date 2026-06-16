# YuJiDi Project Context

This file is the living context document for the YuJiDi crypto monitoring project.

Its purpose is to preserve the full project understanding across development sessions: what the product is, why it exists, how the backend is shaped, what decisions have been made, what has already been implemented, what is still incomplete, and what risks or edge cases are known.

This document should be updated whenever the architecture, domain model, business rules, workflows, deployment strategy, or product direction changes.

## Documentation Index

`PROJECT_CONTEXT.md` is the index and source of truth for the project. It should explain the current project direction, progress, and decisions at a high level.

Detailed docs live separately:

- `../docs/DOMAIN_MODEL.md`: detailed domain entities, relationships, workflows, state machines, and business rules.
- `../docs/ANALYZER_ENGINE.md`: detailed analyzer inputs, state, trigger logic, cooldowns, failures, tests, and limitations.
- `../docs/ANGEL_SMARTAPI_PHASE0.md`: Angel SmartAPI Phase 0 scaffold and safety boundaries.
- `../docs/ANGEL_PHASE_2_SCRIP_MASTER_SYNC.md`: Angel Phase 2 MCX Scrip Master reference sync.
- `../docs/TESTING_STRATEGY.md`: recommended backend test strategy and priority order.
- `../docs/RISK_REGISTER.md`: known risks, impact, mitigation, and review cadence.

When detailed behavior changes, update the relevant detailed doc first, then update this file if the change affects project direction, progress, or major decisions.

## 1. Project Identity

Project name: **YuJiDi**

Primary backend folder: `yujidi-server`

Primary frontend folder: `yujidi-client`

YuJiDi is a real-time crypto market monitoring and AI analysis platform. The system lets authenticated users create monitoring rules, called tripwires or monitors, for Binance USDT crypto pairs. The backend watches live Binance streams and generates enriched AI alerts when market movement crosses user-defined thresholds.

At a product level, YuJiDi is not just a price tracker. It is intended to be an intelligence layer over live market data.

The core product promise is:

> A user defines market logic, YuJiDi watches live exchange data, and when an anomaly occurs, YuJiDi explains the event with quantitative and AI-generated context.

## 2. Product Purpose

The project exists to help users monitor crypto market volatility and understand sudden price movements.

The system tries to answer questions like:

- Which asset moved sharply?
- How large was the movement?
- Did the movement happen within the user's configured time window?
- Was there aggressive buying or selling pressure?
- Where are the nearest visible liquidity walls?
- Are there recent news headlines that may explain the event?
- How serious is the event?
- What should the user understand from the event?

The backend currently focuses on:

- user authentication
- monitor creation and management
- Binance symbol syncing
- Binance WebSocket ingestion
- live frontend price updates
- alert detection
- CVD calculation
- order-book support/resistance detection
- CryptoCompare news lookup
- Groq/Llama AI analysis
- alert persistence
- real-time alert delivery
- copilot chat with deterministic trade math

## 3. Current Technology Stack

### Backend

- Node.js
- TypeScript
- Express 5
- MongoDB
- Mongoose
- Zod
- JWT
- HTTP-only cookies
- bcrypt
- Pino logging
- `ws` WebSocket server/client
- Axios
- Groq SDK
- CryptoCompare news API
- Binance REST API
- Binance WebSocket streams

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Axios
- Framer Motion
- Lucide React
- Radix UI components

### External Services

- Binance API
- MongoDB database
- Groq LLM API
- CryptoCompare API

## 4. Repository Structure

The repository is split into two main applications:

```txt
YUDIJI_CRYPTO/
  yujidi-server/
    src/
      controllers/
      routes/
      services/
      models/
      middlewares/
      utils/
      errors/
      types/
    document/
      BACKEND_ARCHITECTURE.md
      PROJECT_CONTEXT.md
    docs/
      DOMAIN_MODEL.md
      ANALYZER_ENGINE.md
      TESTING_STRATEGY.md
      RISK_REGISTER.md

  yujidi-client/
    src/
      api/
      components/
      context/
      lib/
      pages/
    document/
      README.md
```

Documentation convention:

- All backend documentation should live in `yujidi-server/document/`.
- All frontend documentation should live in `yujidi-client/document/`.
- Markdown files should not be scattered at project roots unless there is a specific reason.

## 5. Backend Entry And Startup

Backend entry file:

```txt
src/server.ts
```

Startup sequence:

1. Load environment variables with `dotenv/config`.
2. Validate required environment variables using Zod.
3. Connect to MongoDB.
4. Start the Express HTTP server on `PORT`.
5. Initialize the shared WebSocket manager.
6. Sync Binance USDT symbols into MongoDB.
7. Register graceful shutdown handlers for `SIGINT` and `SIGTERM`.

Required environment variables currently include:

- `MONGO_URI`
- `PORT`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_EXPIRY`
- `JWT_REFRESH_EXPIRY`
- `GROQ_API_KEY`

Optional or environment-specific variables include:

- `CRYPTOCOMPARE_API_KEY`
- `FRONTEND_URL`
- `MEDO_URL`
- `COOKIE_ACCESS_EXPIRY_MS`
- `COOKIE_REFRESH_EXPIRY_MS`
- `NODE_ENV`

Important security note:

Secrets should not be committed to git. `.env` files should remain local and should not be printed into chat, logs, or documentation.

## 6. Express App Context

Main Express setup file:

```txt
src/app.ts
```

Responsibilities:

- Configure JSON and URL-encoded body parsing.
- Configure cookie parsing.
- Configure CORS for frontend origins.
- Log incoming requests through Pino.
- Mount API routers.
- Provide a health route.
- Provide 404 fallback.
- Use centralized error handling.

Mounted backend routes:

```txt
GET /health
/api/auth
/api/monitors
/api/alerts
/api/chat
```

CORS is configured with credentials enabled because JWTs are stored in HTTP-only cookies.

## 7. Domain Overview

The domain is centered on these concepts:

```txt
User
  creates Monitor / Tripwire
  watches Symbol
  receives Alert
  chats with Copilot

Symbol
  represents a Binance USDT trading pair

Monitor / Tripwire
  defines a user-owned market detection rule

Market Data
  comes from Binance ticker, aggTrade, and depth streams

Analyzer
  turns live market data into threshold decisions

Alert
  persists an AI-enriched market event

Copilot
  combines live engine state, deterministic risk math, and LLM explanation
```

The most important project chain is:

```txt
User creates monitor
  -> frontend subscribes symbol
  -> backend subscribes Binance streams
  -> analyzer receives live ticks/order book
  -> threshold is breached
  -> news and LLM enrichment runs
  -> alert is saved
  -> user receives NEW_ALERT
```

## 8. Core Entities

### User

File:

```txt
src/models/User.ts
```

Represents an authenticated account.

Current fields:

- `email`
- `name`
- `password`
- `refreshToken`
- timestamps

User owns:

- monitors
- alerts
- chat sessions

### Symbol

File:

```txt
src/models/Symbol.ts
```

Represents a Binance trading pair supported by YuJiDi.

Current fields:

- `symbol`
- `baseAsset`
- `quoteAsset`
- `status`

Only `USDT` quote pairs with `TRADING` status are synced.

### TripwireConfig / Monitor

File:

```txt
src/models/TripwireConfig.ts
```

Represents a user-defined market monitoring rule.

Current fields:

- `user`
- `symbol`
- `thresholdPercentage`
- `timeWindowMinutes`
- `isActive`
- `trigger`
- timestamps

The current model supports:

- `drop`
- `spike`

Important current implementation gap:

The analyzer now implements trigger-aware threshold checks for both downside drops and upside spikes.

### Alert

File:

```txt
src/models/Alert.ts
```

Represents a generated AI-enriched market event.

Current fields:

- `user`
- `symbol`
- `triggerPrice`
- `dropPercentage` as a legacy absolute movement field
- `changePercentage`
- `triggerType`
- `direction`
- `catalyst`
- `threatLevel`
- `support`
- `resistance`
- `summary`
- `cvdAtTrigger`
- `createdAt`

An alert is created only after a monitor threshold breach and successful AI report generation.

### ChatSession

File:

```txt
src/models/chatSession.ts
```

Represents a per-user, per-symbol conversation with the YuJiDi copilot.

Current fields:

- `user`
- `symbol`
- `messages`
- timestamps

Messages contain:

- `role`
- `content`
- `timestamp`

## 9. Authentication Context

Auth files:

```txt
src/routes/auth.routes.ts
src/controllers/auth.controller.ts
src/services/auth.service.ts
src/middlewares/requireAuth.ts
src/utils/jwt.ts
src/models/User.ts
```

Authentication uses:

- email/password login
- bcrypt password hashing
- JWT access tokens
- JWT refresh tokens
- HTTP-only cookies
- refresh-token rotation

Auth flow:

```txt
register/login
  -> validate request
  -> create/fetch user
  -> issue access token
  -> issue refresh token
  -> store refresh token on user
  -> attach cookies
  -> protected routes read accessToken
```

New user registration currently seeds:

- one BTCUSDT monitor
- one ETHUSDT monitor
- cloned recent BTC/ETH alerts if available

This means registration is also an onboarding workflow.

Current decision:

The backend uses cookie-based auth instead of storing tokens in frontend local storage.

Reason:

HTTP-only cookies reduce the chance of frontend JavaScript directly leaking tokens.

## 10. Monitor Context

Monitor files:

```txt
src/routes/monitor.routes.ts
src/controllers/monitor.controller.ts
src/services/monitor.service.ts
src/models/TripwireConfig.ts
```

Monitor API:

```txt
GET    /api/monitors/symbols
GET    /api/monitors
POST   /api/monitors
PATCH  /api/monitors/:id
DELETE /api/monitors/:id
GET    /api/monitors/debug/engine-state
```

Monitor creation rules:

- User must be authenticated.
- Symbol must exist in synced Binance symbol collection.
- Threshold must be positive and at most 100.
- Time window must be positive and at most 24 hours.
- Trigger must be present.
- New monitor is active by default.

Current important mismatch:

The route allows time windows up to 24 hours, but the analyzer price buffer currently keeps one hour of ticks. Therefore, windows above 60 minutes are not effectively supported by the analyzer.

## 11. Binance Data Context

Binance service file:

```txt
src/services/binance.service.ts
```

Responsibilities:

- Sync Binance supported symbols through REST.
- Fetch latest ticker/24-hour data for LTP endpoint.

WebSocket manager file:

```txt
src/services/websocket.service.ts
```

Binance stream types currently used:

- `ticker`
- `aggTrade`
- `depth20@100ms`

Purpose:

- `ticker`: frontend live price and percent-change display
- `aggTrade`: analyzer price ticks and CVD calculation
- `depth20@100ms`: support/resistance wall calculation

Current architectural decision:

The backend maintains one shared Binance master WebSocket and merges all frontend symbol subscriptions into one global symbol set. This avoids one Binance connection per browser client.

## 12. WebSocket Context

The shared WebSocket manager tracks:

- authenticated browser sockets
- user-to-socket mappings
- socket-to-symbol subscriptions
- global symbol reference counts
- active Binance subscriptions
- the analyzer engine instance

Important maps/sets:

```txt
clientSubscriptions
globalSymbolCounts
activeBinanceSymbols
clientUsers
userSockets
```

Client WebSocket upgrade authentication:

- Backend reads `accessToken` from cookies.
- Backend verifies the token.
- Invalid upgrade requests are rejected with 401.

Client messages:

```json
{
  "action": "UPDATE_SUBSCRIPTIONS",
  "subscribe": ["BTCUSDT"],
  "unsubscribe": []
}
```

Outbound messages:

- `TICKER_UPDATE`
- `SUBSCRIPTION_ACK`
- `ERROR`
- `NEW_ALERT`

Alert delivery rule:

`NEW_ALERT` is emitted only to sockets owned by the alert's user.

## 13. Analyzer Engine Context

Analyzer file:

```txt
src/services/analyzer.service.ts
```

The analyzer is the core market-event engine.

It maintains in-memory state:

```txt
priceBuffer
cooldowns
cvdBuffer
currentCVD
orderBookSnapshot
```

### Price Buffer

The analyzer stores price ticks per symbol.

Each price tick contains:

- price
- timestamp

Current max price-buffer window:

```txt
60 minutes
```

The price buffer is used to find a base price for the monitor's configured time window.

### CVD

CVD means cumulative volume delta.

The analyzer stores recent volume deltas for a 60-second window.

Current CVD rule:

- buyer-maker trade means sell pressure, negative delta
- non-buyer-maker trade means buy pressure, positive delta
- only trades above `WHALE_THRESHOLD_BTC` are counted

Current threshold:

```txt
0.1
```

Important domain note:

This threshold is named as BTC-specific but is used for all symbols. That may be inaccurate for assets with very different unit sizes.

### Order Book

The analyzer stores the latest order-book bids and asks per symbol.

Support/resistance logic:

- Estimate current price from top bid/ask midpoint.
- Ignore the first few levels.
- Calculate average bid and ask size.
- Find unusually large walls using a multiplier.

Current wall multiplier:

```txt
2.5
```

### Alert Trigger Pipeline

Current alert trigger flow:

```txt
aggTrade tick received
  -> validate price
  -> update price buffer
  -> update CVD
  -> find active monitors for symbol
  -> skip cooldown monitors
  -> find base tick for time window
  -> calculate percent change
  -> check threshold breach
  -> set cooldown
  -> fetch news
  -> calculate support/resistance
  -> call Groq
  -> save alert
  -> emit NEW_ALERT to user
```

Current cooldown:

```txt
15 minutes
```

Important current behavior:

Cooldown is set before the news/LLM/database pipeline completes. If the pipeline fails, the monitor can still remain in cooldown.

## 14. AI And News Context

News service file:

```txt
src/services/news.service.ts
```

LLM service file:

```txt
src/services/llm.service.ts
```

LLM provider port:

```txt
src/ports/llm-provider.port.ts
```

Current LLM adapter:

```txt
src/integrations/llm/groq/groq-llm.provider.ts
```

News provider:

```txt
CryptoCompare
```

LLM provider:

```txt
Groq
```

Current model:

```txt
llama-3.3-70b-versatile
```

Provider abstraction baseline:

- Core alert/copilot logic depends on the app-owned `LLMProvider` port.
- Groq SDK usage is isolated inside the Groq adapter.
- Provider-specific response formats are parsed and validated inside adapters.
- Future OpenAI/Gemini adapters should implement the same port without changing analyzer/chat domain logic.

Alert report schema:

```json
{
  "catalyst": "string",
  "threatLevel": "string",
  "support": "string",
  "resistance": "string",
  "summary": "string"
}
```

Copilot response schema:

```json
{
  "intent": "string",
  "isApproved": true,
  "reply": "string"
}
```

Decision:

AI output must be structured JSON and validated before use.

Reason:

The backend should not store arbitrary unstructured model output as an alert.

## 15. Alert Context

Alert files:

```txt
src/routes/alert.routes.ts
src/controllers/alert.controller.ts
src/models/Alert.ts
```

Alert API:

```txt
GET /api/alerts/ltp/:symbol
GET /api/alerts
GET /api/alerts/:id
```

Alert list behavior:

- Requires auth except LTP.
- Returns latest alerts for the logged-in user.
- Sorts newest first.
- Limits to 50 alerts.

Important known issue:

`getAlertById` appears to use a different user shape than `getUserAlerts`. This may prevent valid alert details from being found.

## 16. Copilot Chat Context

Chat files:

```txt
src/routes/chat.routes.ts
src/controllers/chat.controller.ts
src/models/chatSession.ts
src/services/llm.service.ts
```

Copilot purpose:

The copilot helps the user reason about trades or ask general questions. It uses live engine state when a trade-style question is asked.

Request includes:

- symbol
- direction
- wallet balance
- risk percentage
- leverage
- user prompt
- chat history

Backend calculates:

- entry
- stop loss
- take profit
- risk/reward ratio
- position size
- required margin
- system veto reason

Then the LLM classifies:

- `GENERAL`
- `TRADE`

Decision:

The backend calculates deterministic trade math. The LLM explains, approves, or vetoes, but should not be the source of the numeric calculations.

Known risk:

The backend currently still trusts the LLM's final `isApproved` boolean. Stronger enforcement could override approval if deterministic veto conditions exist.

## 17. Main Workflows

### Registration

```txt
user submits details
  -> validate
  -> create user
  -> seed default monitors
  -> clone recent alerts
  -> frontend logs in
```

### Login

```txt
user submits email/password
  -> validate
  -> compare password
  -> issue tokens
  -> set cookies
  -> frontend stores user
```

### Dashboard Load

```txt
frontend checks auth
  -> fetch monitors
  -> fetch alerts
  -> open WebSocket
  -> subscribe monitor symbols
```

### Create Monitor

```txt
user selects symbol/trigger/threshold/window
  -> POST /api/monitors
  -> validate
  -> create TripwireConfig
  -> refresh dashboard
  -> subscribe symbol
```

### Live Price Update

```txt
Binance ticker
  -> backend TICKER_UPDATE
  -> frontend live price state updates
```

### Alert Generation

```txt
Binance aggTrade
  -> analyzer updates buffer/CVD
  -> monitor threshold breach
  -> fetch news
  -> calculate walls
  -> Groq report
  -> Mongo alert
  -> WebSocket NEW_ALERT
```

### Full Alert Analysis

```txt
user clicks alert
  -> frontend opens modal
  -> display catalyst/threat/support/resistance/CVD/summary
```

### Copilot Chat

```txt
user sends prompt
  -> backend validates
  -> fetch live engine state
  -> calculate trade math
  -> load chat history
  -> Groq response
  -> save messages
  -> return reply and trade math
```

## 18. State Machines

### User Session

```txt
Unauthenticated
  -> login/register
Authenticated
  -> token expires
Needs Refresh
  -> refresh succeeds
Authenticated
  -> logout
Logged Out
```

### Monitor

```txt
Active / Watching
  -> threshold breached
Triggered
  -> cooldown set
Cooling Down
  -> cooldown ends
Active / Watching
```

### WebSocket Client

```txt
Disconnected
  -> user authenticated
Connecting
  -> upgrade accepted
Connected
  -> subscriptions sent
Subscribed
  -> close/logout
Disconnected
```

### Binance Master Socket

```txt
Not Connected
  -> connect
Connecting
  -> open
Connected / Streaming
  -> close/error
Reconnect Scheduled
  -> reconnect
Connecting
```

### Alert

Current implicit states:

```txt
Detected
  -> Analyzing
  -> Stored
  -> Delivered if user online
```

Current implementation stores only successful alerts.

## 19. Business Rules

Important current business rules:

- Only authenticated users can create monitors.
- Users can only access their own monitors, alerts, and chats.
- Only Binance `USDT` + `TRADING` symbols are supported.
- A monitor must have a symbol, threshold, time window, and trigger.
- New monitors are active by default.
- Analyzer evaluates only active monitors.
- A monitor can trigger only if enough historical price data exists.
- A monitor in cooldown is skipped.
- Current implemented alert trigger is downside movement.
- Alert generation requires successful structured LLM output.
- Alerts are emitted only to the owning user.
- Chat trade math is calculated by the backend before the LLM responds.

Most important unresolved business rule:

```txt
Should legacy `dropPercentage` be removed after all old alerts and frontend paths have migrated?
```

The schema and UI say yes. The analyzer currently needs implementation alignment.

## 20. Edge Cases And Known Risks

High-priority edge cases:

1. Monitor windows above 60 minutes are allowed but not supported by the one-hour analyzer buffer.
2. Secure cookies may fail in local HTTP development.
3. Alert detail lookup may have a user-id mismatch.
4. HTTP LTP ignition may create symbol subscriptions that never decrement.
5. Analyzer active-monitor cache is process-local and not multi-instance safe.
6. Failed LLM pipeline still puts monitor into cooldown.
7. Multiple backend instances would not share in-memory analyzer/WebSocket state.
8. CVD whale threshold is not normalized per asset.
9. Spike/drop analyzer behavior needs automated regression tests.
10. The frontend `/engine` page describes future architecture elements not currently implemented.
11. Symbol search must stay indexed and paginated as the universal registry grows.

## 21. Current Progress

### Implemented

- Backend Express app.
- MongoDB connection.
- Central route mounting.
- Auth registration/login/logout/refresh.
- JWT utility.
- Cookie-based auth.
- User model.
- Universal Symbol model.
- Instrument model scaffold.
- Provider-neutral market-data types.
- MarketDataProvider and InstrumentProvider ports.
- Binance symbol sync.
- Binance universal symbol sync fields.
- Angel Scrip Master MCX mapper.
- Angel Scrip Master client.
- Disabled-by-default Angel symbol sync service.
- Manual Angel symbol sync job script with dry-run, exchange selection, and batched writes.
- MongoDB startup retry/backoff.
- Non-fatal Binance symbol sync retry loop.
- Analyzer active-monitor TTL cache.
- Analyzer monitor cache refresh on monitor create/update/delete.
- Analyzer zero-monitor negative cache entries.
- Monitor model and CRUD routes.
- Alert model.
- Alert list route.
- WebSocket manager.
- Authenticated WebSocket upgrades.
- Frontend subscription handling.
- Binance master WebSocket.
- Binance ticker forwarding to frontend.
- Binance aggTrade processing.
- CVD calculation.
- Order-book snapshot storage.
- Support/resistance calculation.
- Analyzer threshold detection for drops and spikes.
- Direction-neutral alert movement fields: `changePercentage`, `triggerType`, and `direction`.
- Alert cooldowns.
- CryptoCompare news lookup.
- Groq alert report generation.
- Alert persistence.
- Real-time `NEW_ALERT` delivery.
- Copilot chat endpoint.
- Chat history persistence.
- Deterministic trade math in copilot.
- Frontend landing/auth flow.
- Frontend protected dashboard.
- Frontend add monitor modal.
- Frontend live price state.
- Frontend alert feed.
- Frontend full analysis modal.
- Backend architecture documentation.
- Angel Integration Phase 1 foundation:
  - universal symbol search API
  - frontend universal symbol picker support
  - BrokerConnection scaffold without secrets
  - optional universal monitor metadata
  - guarded Angel auth/live-data scaffolds
  - Angel tick normalizer
  - analyzer normalized tick bridge
- Angel Integration Phase 2 MCX Scrip Master sync:
  - downloads Angel Scrip Master JSON
  - filters MCX core commodity rows
  - maps rows into universal `Symbol` records
  - upserts by provider + exchange + instrument token
  - supports manual script and optional non-fatal startup sync
- Angel Integration Phase 3 BrokerConnection domain:
  - encrypted Angel credential storage
  - encrypted Angel session token storage
  - Angel `loginByPassword` verification service
  - broker connection status/reconnect/delete APIs
  - order placement remains disabled
- Angel Integration Phase 4 Angel Quote API:
  - uses active user Angel BrokerConnection
  - decrypts API key and JWT only inside backend service logic
  - calls Angel read-only Quote API
  - supports single-symbol `LTP`, `OHLC`, and `FULL` modes
  - returns normalized `NormalizedMarketSnapshot`
  - does not persist quote snapshots
- Angel Integration Phase 5 Universal Symbol Monitor support:
  - monitor creation accepts universal `symbolId`
  - legacy Binance monitor creation by `symbol` remains supported
  - monitor stores symbol snapshot fields for provider/exchange/instrument metadata
  - Angel MCX monitor creation requires active user Angel BrokerConnection
  - market subscription key helper exists for future provider-aware WebSocket phase
- Angel Integration Phase 6 Angel WebSocket LTP streaming:
  - user-specific Angel WebSocket session manager exists
  - active Angel BrokerConnection is required
  - Angel MCX monitor can be subscribed through protected debug route
  - LTP mode uses Angel `mode=1`
  - MCX uses Angel `exchangeType=5`
  - heartbeat ping is implemented
  - binary LTP packets are parsed and normalized into `NormalizedMarketTick`
  - normalized ticks are logged safely and are not persisted
- Angel Integration Phase 6B Provider-Aware WebSocket subscription routing:
  - frontend keeps using the existing backend WebSocket connection
  - frontend sends YuJiDi symbol strings only
  - backend resolves symbols from the universal `Symbol` collection
  - Binance symbols route to the shared Binance master socket
  - Angel MCX symbols route to user-specific Angel WebSocket sessions
  - per-symbol subscription results are returned through `SUBSCRIPTION_UPDATE_RESULT`
  - Angel ticks are forwarded to subscribed frontend sockets as `MARKET_TICK`
- Angel Integration Phase 7 Angel Analyzer Alerts:
  - Angel `NormalizedMarketTick` reaches the analyzer
  - Angel monitor lookup uses user + provider + exchange + instrument token
  - Angel price buffers and monitor cache use user-specific provider-aware keys
  - existing drop/spike analyzer rules are reused
  - Angel threshold breaches create alerts with provider/exchange/instrument metadata
  - Angel alerts emit through the existing `NEW_ALERT` flow
- Angel Integration Phase 9 Scalable Symbol Search:
  - `Symbol` records now include normalized search and autocomplete token fields
  - Binance sync and Angel mapper populate search fields
  - `GET /api/symbols/search` provides indexed, filtered, ranked symbol discovery
  - search has minimum query length, result caps, LRU cache, and route rate limiting
  - `npm run symbols:backfill-search` backfills search fields for existing records
  - frontend add-monitor flows use debounced backend search with request cancellation
  - frontend no longer loads the full symbol universe on monitor modal/page open

### Partially Implemented

- Alert movement field migration.
  - New fields exist: `changePercentage`, `triggerType`, and `direction`.
  - Legacy `dropPercentage` is still kept for backward compatibility.

- Angel SmartAPI integration.
  - Phase 1 foundation exists.
  - Phase 2 MCX Scrip Master sync exists.
  - Phase 3 BrokerConnection login verification exists.
  - Phase 4 read-only Angel Quote API exists.
  - Phase 5 universal Symbol monitor creation exists.
  - Phase 6 user-specific Angel WebSocket LTP debug streaming exists.
  - Phase 6B provider-aware frontend WebSocket routing exists.
  - Phase 7 Angel normalized tick analyzer alert generation exists.
  - Broker credentials are encrypted at rest.
  - Angel WebSocket is connected to the frontend subscription path for live `MARKET_TICK` delivery.
  - No public/admin Angel sync HTTP endpoint exists.
  - No order placement, portfolio sync, or auto trading exists.

- Alert detail endpoint.
  - Route exists.
  - User ownership lookup likely needs correction.

- Monitor update validation.
  - Update endpoint exists.
  - Validation is weaker than create.

- Copilot risk approval.
  - Math is deterministic.
  - Final approval still depends on LLM response.

- Rate limiting.
  - Middleware exists.
  - Route mounting should be reviewed.

### Not Yet Implemented

- Full automated backend test suite beyond analyzer rules and `processTick` tests.
- Redis/shared state for scaling.
- Queueing for LLM calls.
- Persistent failed alert records.
- Pagination for alerts.
- Admin tools.
- Device/session management.
- Refresh token hashing.
- `.env.example`.
- CI checks beyond existing workflow configuration.
- Production observability dashboards.
- Multi-instance WebSocket coordination.

## 22. Development Decisions So Far

### Decision: Use MongoDB/Mongoose

Reason:

The project uses document-shaped entities such as users, monitors, alerts, and chat sessions. Mongoose schemas provide structure while keeping iteration fast.

### Decision: Use HTTP-only Cookies

Reason:

Tokens are not directly exposed to frontend JavaScript, which is safer than local storage for auth tokens.

### Decision: Use One Shared Binance WebSocket

Reason:

The backend can merge subscriptions across users and avoid unnecessary Binance connections.

### Decision: Keep Analyzer State In Memory For Now

Reason:

It is simpler and fast for a single backend instance.

Tradeoff:

State is lost on restart and not shared across instances.

### Decision: Use LLM Provider Structured JSON

Reason:

The frontend and database expect structured alert/report fields.

Tradeoff:

Malformed provider JSON causes the pipeline to fail. Groq is currently the only implemented adapter.

### Decision: Backend Calculates Trade Math

Reason:

Risk math should be deterministic and auditable. The LLM should explain or veto, not invent the numbers.

## 23. Recommended Next Tasks

Best next fixes:

1. Harden Angel streaming/analyzer reliability: reconnect strategy, token refresh, session expiry handling, subscription cleanup, and production-safe observability.
2. Expand analyzer edge-case tests for invalid ticks, CVD, order-book snapshots, and cooldown expiry.
3. Align max monitor window with analyzer buffer, either both 60 minutes or both 24 hours.
4. Fix `getAlertById` user lookup.
5. Add validation to monitor update payload.
6. Add `.env.example` with variable names only.
7. Complete the alert movement field migration and eventually remove legacy `dropPercentage`.
8. Move cooldown setting after successful alert creation or track failed alert attempts.
9. Normalize user id access as `req.user.id` everywhere.
10. Add reconnect behavior on frontend WebSocket.
11. Document frontend architecture in `yujidi-client/document/`.

## 24. Working Notes For Future Development

When changing backend behavior, preserve these principles:

- Keep user ownership boundaries strict.
- Do not expose secrets in logs, docs, or chat.
- Prefer Zod validation at route boundaries.
- Keep LLM output schema-validated.
- Keep deterministic calculations outside the LLM.
- Treat WebSocket state carefully because it is in memory.
- Keep documentation updated when domain behavior changes.

When debugging alert generation, inspect:

1. Is the user authenticated?
2. Is the frontend subscribed to the symbol?
3. Is Binance master socket connected?
4. Is the symbol in `globalSymbolCounts`?
5. Is the monitor active?
6. Is there enough price history for the time window?
7. Is the monitor in cooldown?
8. Did the threshold breach?
9. Did news fetch return or fallback?
10. Did Groq return valid JSON?
11. Did MongoDB save the alert?
12. Does the user have active sockets?

## 25. Current Project Summary

YuJiDi is currently a working prototype of a real-time AI crypto monitoring system.

The backend already contains the essential backbone:

```txt
Auth
  -> Monitors
  -> Binance streams
  -> Analyzer
  -> AI report
  -> Alerts
  -> Dashboard delivery
```

The most important next phase is hardening:

- add regression tests for spike/drop behavior
- fix ownership lookup inconsistencies
- improve validation
- add tests
- document frontend context
- prepare for production deployment constraints

This file should remain the main source of truth for project context and progress.
