# YuJiDi Project Master Context

This file is the master context document for the YuJiDi project.

Purpose:

Give any AI coding agent, engineer, or reviewer enough project context to understand the product, architecture, domain, implementation state, risks, and development rules before making changes.

Use this file as the first-read document when starting work on YuJiDi.

Related detailed docs:

- `PROJECT_CONTEXT.md`: living project index and progress context.
- `../docs/DOMAIN_MODEL.md`: detailed domain model.
- `../docs/ANALYZER_ENGINE.md`: analyzer engine details.
- `../docs/ANGEL_SMARTAPI_PHASE0.md`: Angel SmartAPI read-only integration scaffold.
- `../docs/ANGEL_PHASE_2_SCRIP_MASTER_SYNC.md`: Angel Phase 2 Scrip Master sync.
- `../docs/ANGEL_PHASE_4_TO_10_DESIGN.md`: Legacy design note for the foundation now treated as Angel Phase 1.
- `../docs/TESTING_STRATEGY.md`: testing strategy.
- `../docs/RISK_REGISTER.md`: risk register.
- `BACKEND_ARCHITECTURE.md`: backend architecture reference.

## 0. Current Implementation Truth vs Future Direction

This section prevents confusion between what exists today and what is planned.

### Current Implementation Truth

These are true in the current codebase:

- Backend is an Express + TypeScript app.
- MongoDB is the main database.
- Auth uses email/password, JWTs, and HTTP-only cookies.
- Binance is the live market data source.
- Binance streams are managed through one shared backend WebSocket manager.
- MongoDB startup connection uses bounded retry/backoff.
- Binance symbol sync runs as a non-fatal background task with retry.
- Analyzer uses a short TTL active-monitor cache and refreshes it on monitor create/update/delete.
- Analyzer can store zero-monitor negative cache entries to prevent repeated MongoDB reads.
- Analyzer state is stored in memory.
- Analyzer supports both `drop` and `spike` trigger logic.
- Alerts now include direction-neutral movement fields:
  - `changePercentage`
  - `triggerType`
  - `direction`
- Alerts still keep legacy `dropPercentage` for backward compatibility.
- Groq is used for alert reports and copilot chat.
- CryptoCompare is used for news context.
- Angel BrokerConnection stores user broker credentials and session tokens encrypted at rest.
- Angel read-only quote snapshots are available through authenticated user BrokerConnection.
- A first analyzer rules unit-test foundation exists.
- Documentation exists, but docs must be kept aligned with implementation.

### Future Direction / Not Yet Implemented

These are desired or discussed, but should not be described as implemented unless code exists:

- Redis-backed analyzer state.
- Kafka or durable event streaming.
- pgvector or vector-search RAG.
- LangChain orchestration.
- Server-Sent Events replacing or supplementing WebSocket delivery.
- OAuth login.
- Encrypted user thresholds.
- Multi-instance-safe analyzer coordination.
- Explicit alert pipeline status such as `detected`, `analyzing`, `failed`.
- Full removal of legacy `dropPercentage`.
- Full automated test suite beyond analyzer rules.

Rule:

If a page, doc, prompt, or feature description mentions future architecture, label it clearly as future direction.

## 0.1 Exact Local Development Commands

Run commands from the correct app folder.

### Backend

Folder:

```txt
yujidi-server/
```

Install dependencies:

```bash
npm install
```

Run development server:

```bash
npm run dev
```

Run production-style start:

```bash
npm start
```

Typecheck:

```bash
npm run typecheck
```

Expected default local backend URL:

```txt
http://localhost:3006
```

Actual port depends on backend `.env` `PORT`.

### Frontend

Folder:

```txt
yujidi-client/
```

Install dependencies:

```bash
npm install
```

Run development server:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Lint:

```bash
npm run lint
```

Preview build:

```bash
npm run preview
```

Expected default local frontend URL:

```txt
http://localhost:5173
```

### Verification Expectations

For backend-only changes:

```bash
cd yujidi-server
npm run typecheck
```

For frontend changes:

```bash
cd yujidi-client
npm run build
```

For cross-stack changes:

Run both backend typecheck and frontend build.

Known frontend build warnings:

- CSS `@import` ordering warning may appear.
- Large chunk-size warning may appear.
- These warnings do not necessarily mean the build failed.

## 0.2 Environment Variable Contract

Do not put secret values in documentation.

### Backend Environment Variables

Backend `.env` lives in:

```txt
yujidi-server/.env
```

Required:

```txt
MONGO_URI
PORT
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
JWT_ACCESS_EXPIRY
JWT_REFRESH_EXPIRY
GROQ_API_KEY
```

Optional or environment-specific:

```txt
LLM_PROVIDER
GROQ_MODEL
CRYPTOCOMPARE_API_KEY
FRONTEND_URL
MEDO_URL
COOKIE_ACCESS_EXPIRY_MS
COOKIE_REFRESH_EXPIRY_MS
NODE_ENV
ANGEL_SMARTAPI_ENABLED
ANGEL_SYMBOL_SYNC_ENABLED
ANGEL_SYMBOL_SYNC_ON_STARTUP
ANGEL_SYMBOL_SYNC_MARKET_TYPES
ANGEL_SYMBOL_SYNC_EXCHANGES
ANGEL_SYMBOL_SYNC_NAMES
BROKER_CREDENTIAL_ENCRYPTION_KEY
ANGEL_CLIENT_LOCAL_IP
ANGEL_CLIENT_PUBLIC_IP
ANGEL_MAC_ADDRESS
ANGEL_API_KEY
ANGEL_CLIENT_CODE
ANGEL_PIN
ANGEL_TOTP_SECRET
ANGEL_DEBUG_ENABLED
ANGEL_DEBUG_EXCHANGE
ANGEL_DEBUG_SYMBOL_TOKEN
```

Meaning:

- `MONGO_URI`: MongoDB connection string.
- `PORT`: backend HTTP/WebSocket port.
- `JWT_ACCESS_SECRET`: secret for access tokens.
- `JWT_REFRESH_SECRET`: secret for refresh tokens.
- `JWT_ACCESS_EXPIRY`: access token lifetime.
- `JWT_REFRESH_EXPIRY`: refresh token lifetime.
- `GROQ_API_KEY`: Groq API key for LLM calls.
- `LLM_PROVIDER`: selected LLM adapter, defaults to `groq`.
- `GROQ_MODEL`: optional Groq model override.
- `CRYPTOCOMPARE_API_KEY`: optional key for news lookup.
- `FRONTEND_URL`: allowed frontend CORS origin.
- `MEDO_URL`: additional allowed CORS origin.
- `COOKIE_ACCESS_EXPIRY_MS`: cookie max age override.
- `COOKIE_REFRESH_EXPIRY_MS`: cookie max age override.
- `NODE_ENV`: runtime environment.
- `ANGEL_SMARTAPI_ENABLED`: future read-only Angel integration flag, defaults should remain disabled.
- `ANGEL_SYMBOL_SYNC_ENABLED`: must be `true` before running Angel symbol sync in apply mode; defaults should remain disabled.
- `ANGEL_SYMBOL_SYNC_ON_STARTUP`: enables non-fatal startup Angel symbol sync when `true`; defaults should remain disabled.
- `ANGEL_SYMBOL_SYNC_MARKET_TYPES`: future Angel sync market-type filter, currently `COMMODITY`.
- `ANGEL_SYMBOL_SYNC_EXCHANGES`: Angel sync exchange filter, currently defaults to `MCX`.
- `ANGEL_SYMBOL_SYNC_NAMES`: Angel sync commodity-name filter, defaults to `CRUDEOIL,GOLD,SILVER,NATURALGAS`.
- `BROKER_CREDENTIAL_ENCRYPTION_KEY`: required for encrypting broker credentials and session tokens at rest.
- `ANGEL_CLIENT_LOCAL_IP`: Angel SmartAPI request header value.
- `ANGEL_CLIENT_PUBLIC_IP`: Angel SmartAPI request header value.
- `ANGEL_MAC_ADDRESS`: Angel SmartAPI request header value.
- `ANGEL_API_KEY`: future Angel SmartAPI key placeholder.
- `ANGEL_CLIENT_CODE`: future Angel client code placeholder.
- `ANGEL_PIN`: future Angel PIN placeholder.
- `ANGEL_TOTP_SECRET`: future Angel TOTP secret placeholder.
- `ANGEL_DEBUG_ENABLED`: future Angel debug flag.
- `ANGEL_DEBUG_EXCHANGE`: future debug exchange, for example `MCX`.
- `ANGEL_DEBUG_SYMBOL_TOKEN`: future debug symbol token placeholder.

Security rules:

- Do not commit `.env`.
- Do not print `.env`.
- Do not paste secrets into docs.
- Do not log JWTs, cookies, passwords, full connection strings, Angel API keys, Angel PINs, Angel TOTP secrets, Angel JWTs, or Angel feed tokens.
- Use `.env.example` in the future with variable names only.

### Frontend Environment Variables

Frontend `.env` lives in:

```txt
yujidi-client/.env
```

Variables:

```txt
VITE_API_URL
VITE_WS_URL
```

Meaning:

- `VITE_API_URL`: backend API base URL, usually ending in `/api`.
- `VITE_WS_URL`: backend WebSocket URL.

Example shape without secrets:

```txt
VITE_API_URL=http://localhost:3006/api
VITE_WS_URL=ws://localhost:3006
```

## 0.3 Do Not Change Without Approval

The following changes require explicit user approval before implementation:

- Removing or renaming database fields.
- Removing legacy `dropPercentage`.
- Changing auth cookie security behavior.
- Changing JWT expiry semantics.
- Changing production CORS origins.
- Changing `.env` values.
- Printing or exposing secrets.
- Adding a new external service.
- Changing deployment workflows.
- Running destructive database operations.
- Deleting production records.
- Changing monitor trigger semantics.
- Changing LLM model/provider.
- Changing alert ownership rules.
- Changing WebSocket authentication behavior.
- Rewriting analyzer architecture from memory to Redis or another shared store.
- Performing destructive git operations.

Approval is also required before running commands that need elevated system or network access.

## 0.4 Modification Playbooks

Use these playbooks for common changes.

### Add Or Modify A Monitor Feature

1. Read `DOMAIN_MODEL.md`.
2. Read `ANALYZER_ENGINE.md`.
3. Identify model changes in `TripwireConfig`.
4. Update route validation in `monitor.routes.ts`.
5. Update service logic in `monitor.service.ts`.
6. Update frontend monitor UI if needed.
7. Update analyzer if trigger behavior changes.
8. Update docs.
9. Run backend typecheck and frontend build if touched.

### Add Or Modify Alert Fields

1. Decide if migration must be backward-compatible.
2. Update `Alert.ts`.
3. Update alert creation in `analyzer.service.ts`.
4. Update registration alert cloning in `auth.controller.ts`.
5. Update frontend alert types and fallback display.
6. Update API/WebSocket contracts in docs.
7. Run verification.

Rule:

Do not remove old alert fields without a migration plan.

### Modify Analyzer Logic

1. Read `ANALYZER_ENGINE.md`.
2. Identify input stream and state affected.
3. Check drop/spike behavior.
4. Check cooldown behavior.
5. Check failure behavior.
6. Update or add tests when test framework exists.
7. Update docs and risk register.
8. Run backend typecheck.

### Modify LLM Prompt Or Schema

1. Identify whether alert report or copilot is affected.
2. Keep JSON schema strict.
3. Update Zod schema if response fields change.
4. Update prompt with clear domain context.
5. Update parser/fallback behavior if needed.
6. Update docs.
7. Avoid logging sensitive user data or secrets.

### Modify Auth

1. Read auth flow section.
2. Check cookie behavior locally and in production.
3. Check `requireAuth` impact.
4. Check WebSocket upgrade auth impact.
5. Do not change token expiry or cookie security without approval.
6. Run backend typecheck.

### Modify WebSocket Behavior

1. Read WebSocket contracts.
2. Check client message schema.
3. Check server event shape.
4. Check subscription reference counting.
5. Check cleanup on socket close.
6. Check Binance subscription synchronization.
7. Update frontend context if event shape changes.

### Add Documentation

1. Put master/context docs in `document/`.
2. Put detailed topic docs in `docs/`.
3. Add links from `PROJECT_CONTEXT.md` if the doc is important.
4. Keep docs implementation-accurate.

## 0.5 Source Of Truth Hierarchy

When sources disagree, resolve in this order:

1. Current source code behavior.
2. Database schema/model definitions.
3. API/WebSocket contracts used by frontend.
4. `PROJECT_MASTER_CONTEXT.md`.
5. `PROJECT_CONTEXT.md`.
6. Detailed docs in `docs/`.
7. Older comments or commented-out code.
8. Marketing/landing/engine page copy.

Important:

Comments and marketing copy are not authoritative when they contradict running code.

If implementation and documentation disagree:

```txt
treat it as a documentation bug or implementation bug
  -> identify which is intended
  -> update code or docs accordingly
```

## 0.6 Current Known Mismatches

Known mismatches or drift to watch:

1. `dropPercentage` name is legacy.
   - Current new fields are `changePercentage`, `triggerType`, and `direction`.
   - Keep fallback until migration is complete.

2. Monitor time window validation allows up to 24 hours.
   - Analyzer price buffer keeps around 60 minutes.
   - These should be aligned.

3. Frontend `/engine` page mentions future stack pieces.
   - Redis, Kafka, pgvector, LangChain, SSE, OAuth, and encryption are not current backend features.

4. Alert detail ownership lookup may need correction.
   - Verify `getAlertById` uses `req.user.id` consistently.

5. There are multiple AddMonitorModal components in the client.
   - Dashboard uses `src/components/dashboard/AddMonitorModal.tsx`.
   - Older `src/components/AddMonitorModal.tsx` may be stale and does not currently send trigger in the same way.

6. Rate limiter mounting should be reviewed.
   - `alert.routes.ts` has route-specific limiter setup that may not cover all intended routes.

7. Analyzer state is in memory while deployment may run multiple processes.
   - Multi-instance behavior is not safe yet.

8. Backend startup is partially hardened against external DNS/API failures.
   - MongoDB connection now retries before failing startup.
   - Binance symbol sync failure no longer crashes startup and retries in background.
   - Groq, CryptoCompare, and runtime external calls still depend on network/DNS.

## 0.7 Main Data Flow Diagrams

### User Registration Flow

```txt
Frontend AuthCard
  -> POST /api/auth/register
  -> AuthController.register
  -> AuthService.registerUser
  -> UserModel.create
  -> TripwireConfigModel.insertMany default monitors
  -> AlertModel.find recent BTC/ETH alerts
  -> clone alerts for new user
  -> frontend logs in
  -> dashboard
```

### Login And Authenticated API Flow

```txt
Frontend login form
  -> POST /api/auth/login
  -> AuthService.loginUser
  -> bcrypt compare
  -> generate access token
  -> generate refresh token
  -> store refresh token on user
  -> set HTTP-only cookies
  -> frontend AuthContext stores user
```

Protected request:

```txt
Frontend apiClient request
  -> cookies sent automatically
  -> requireAuth middleware
  -> verify accessToken
  -> req.user.id
  -> controller/service
```

### Dashboard Load Flow

```txt
Dashboard mount
  -> GET /api/monitors
  -> GET /api/alerts
  -> render monitor sidebar
  -> render alert feed
  -> update WebSocket subscriptions for monitor symbols
```

### WebSocket Subscription Flow

```txt
User authenticated
  -> WebSocketContext opens socket
  -> browser sends accessToken cookie
  -> WebSocketManager authenticates upgrade
  -> client sends UPDATE_SUBSCRIPTIONS
  -> backend updates clientSubscriptions
  -> backend updates globalSymbolCounts
  -> backend sends Binance SUBSCRIBE if needed
  -> client receives SUBSCRIPTION_ACK
```

### Live Price Flow

```txt
Binance ticker stream
  -> WebSocketManager.handleBinanceMessage
  -> TICKER_UPDATE
  -> subscribed frontend sockets
  -> WebSocketContext updates livePrices
  -> Dashboard sidebar updates price/change
```

### Alert Generation Flow

```txt
Binance aggTrade stream
  -> WebSocketManager.handleBinanceMessage
  -> AnalyzerEngine.processTick
  -> update priceBuffer
  -> update CVD
  -> read active monitors from analyzer cache
  -> refresh cache from MongoDB on cache miss/expiry
  -> evaluate drop/spike threshold
  -> set cooldown
  -> fetch CryptoCompare headlines
  -> calculate order-book support/resistance
  -> call Groq generateAlertReport
  -> validate JSON report
  -> AlertModel.create
  -> emit NEW_ALERT to owning user sockets
  -> Dashboard alert feed updates
```

### Order Book Flow

```txt
Binance depth20@100ms stream
  -> WebSocketManager.handleBinanceMessage
  -> AnalyzerEngine.updateOrderBook
  -> orderBookSnapshot updated
  -> findStructuralSupportResistance used by alerts and copilot
```

### Copilot Chat Flow

```txt
Frontend chat prompt
  -> POST /api/chat
  -> validate payload
  -> sharedWebsocketManager.getSupportResistance
  -> calculate entry / stop loss / take profit / R:R / margin
  -> load ChatSession history
  -> Groq generateCopilotResponse
  -> save user and assistant messages
  -> return reply and tradeMath
```

### Alert Display Compatibility Flow

```txt
Alert arrives from API or WebSocket
  -> if changePercentage/triggerType/direction exist:
       display new movement semantics
  -> else:
       fallback to legacy dropPercentage as a drop
```

## 1. Project Identity

Project name: **YuJiDi**

Repository root:

```txt
YUDIJI_CRYPTO/
```

Main apps:

```txt
yujidi-server/
yujidi-client/
```

YuJiDi is a real-time crypto market monitoring and AI analysis platform.

It lets authenticated users create crypto monitoring rules, called **monitors** or **tripwires**, for Binance USDT trading pairs. The backend streams Binance market data, evaluates user-defined rules, enriches triggered events with market context and AI analysis, stores alerts, and pushes live alerts to the user dashboard.

## 2. Product Vision

YuJiDi is intended to be an intelligence layer over live crypto market data.

The product vision:

```txt
User defines market logic
  -> YuJiDi watches live exchange data
  -> Analyzer detects meaningful movement
  -> AI explains what happened
  -> User receives actionable context quickly
```

YuJiDi should help users answer:

- Which asset moved?
- How much did it move?
- Was it a drop or spike?
- Did it breach the user's configured threshold?
- What was recent buy/sell pressure?
- Where are visible support and resistance walls?
- Is there relevant news context?
- How severe is the event?
- What should a day trader understand from it?

Important product boundary:

YuJiDi should present itself as a technical market intelligence and research tool, not as guaranteed investment advice.

## 3. Current Tech Stack

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
- Binance REST API
- Binance WebSocket streams
- CryptoCompare news API

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

### External Systems

- MongoDB Atlas or Mongo-compatible database.
- Binance REST and WebSocket APIs.
- Groq LLM API.
- CryptoCompare news API.
- Deployment target currently appears to involve GitHub Actions and AWS/EC2-style runtime logs.

## 4. Repository Structure

```txt
YUDIJI_CRYPTO/
  yujidi-server/
    src/
      app.ts
      server.ts
      controllers/
      errors/
      middlewares/
      models/
      routes/
      services/
      types/
      utils/
    docs/
      ANALYZER_ENGINE.md
      DOMAIN_MODEL.md
      RISK_REGISTER.md
      TESTING_STRATEGY.md
    document/
      BACKEND_ARCHITECTURE.md
      PROJECT_CONTEXT.md
      PROJECT_MASTER_CONTEXT.md
    package.json
    tsconfig.json

  yujidi-client/
    src/
      api/
      assets/
      components/
      context/
      lib/
      pages/
      App.tsx
      main.tsx
    document/
      README.md
    package.json
    vite.config.ts
```

Documentation convention:

- Backend master/context docs live in `yujidi-server/document/`.
- Backend detailed topic docs live in `yujidi-server/docs/`.
- Client docs live in `yujidi-client/document/`.
- Do not scatter new Markdown files randomly.

## 5. Backend Architecture

Backend entry:

```txt
yujidi-server/src/server.ts
```

Express setup:

```txt
yujidi-server/src/app.ts
```

Startup flow:

```txt
load env
  -> validate MONGO_URI and PORT
  -> connect MongoDB with bounded retry/backoff
  -> start Express HTTP server
  -> initialize shared WebSocket manager
  -> sync Binance USDT symbols in non-fatal background retry loop
  -> listen for shutdown signals
```

Main backend responsibilities:

- Authenticate users.
- Manage monitors/tripwires.
- Sync Binance symbols.
- Maintain WebSocket connections.
- Subscribe to Binance market streams.
- Run analyzer engine on live trade data.
- Generate AI reports with Groq.
- Persist alerts in MongoDB.
- Serve alert history.
- Support copilot chat.

Main route mounts:

```txt
GET /health
/api/auth
/api/monitors
/api/alerts
/api/chat
```

Core services:

```txt
auth.service.ts
binance.service.ts
websocket.service.ts
analyzer.service.ts
news.service.ts
llm.service.ts
monitor.service.ts
```

Important architecture decision:

Analyzer and WebSocket state are currently in memory. This is fast and simple for one backend instance, but it is not multi-instance safe.

## 6. Frontend Architecture

Frontend app entry:

```txt
yujidi-client/src/main.tsx
```

Route setup:

```txt
yujidi-client/src/App.tsx
```

Important frontend contexts:

```txt
src/context/AuthContext.tsx
src/context/WebSocketContext.tsx
```

Main pages:

```txt
LandingPage.tsx
Dashboard.tsx
SetupMonitor.tsx
DetailedReport.tsx
Engine.tsx
```

Main user-facing dashboard flow:

```txt
user logs in
  -> dashboard loads monitors and alerts
  -> WebSocket connects
  -> frontend subscribes to monitor symbols
  -> ticker updates show live prices
  -> NEW_ALERT messages prepend to activity feed
```

API client:

```txt
src/api/client.ts
```

Frontend env variables:

```txt
VITE_API_URL
VITE_WS_URL
```

Frontend alert display now supports compatibility migration:

- Prefer `changePercentage`, `triggerType`, and `direction`.
- Fall back to legacy `dropPercentage` for old alerts.

## 7. Domain Model

The YuJiDi domain centers on user-owned market surveillance.

Core domain chain:

```txt
User
  -> creates Monitor
  -> Monitor watches Symbol
  -> Binance stream produces market data
  -> Analyzer detects breach
  -> AI report explains event
  -> Alert is saved
  -> User receives alert
```

Domain ownership boundary:

```txt
User-owned records must be scoped by authenticated user id.
```

User-owned entities:

- monitors
- alerts
- chat sessions

## 8. Core Entities

### User

An authenticated account that owns monitors, alerts, and chat sessions.

### Symbol

A supported Binance trading pair, currently limited to `USDT` quote pairs with `TRADING` status.

### Monitor / Tripwire

A user-defined market rule.

Example:

```txt
Trigger if SOLUSDT spikes 2% within 5 minutes.
```

### Alert

An AI-enriched event generated after a monitor threshold breach.

### ChatSession

Conversation memory for user + symbol copilot interactions.

### PriceTick

In-memory price observation from live market data.

### CvdTrade

In-memory trade delta used to calculate recent buy/sell pressure.

### OrderBookSnapshot

Latest visible bid/ask depth for support and resistance detection.

## 9. Database Models

### User

File:

```txt
src/models/User.ts
```

Fields:

- `email`
- `name`
- `password`
- `refreshToken`
- timestamps

### Symbol

File:

```txt
src/models/Symbol.ts
```

Fields:

- `symbol`
- `baseAsset`
- `quoteAsset`
- `status`
- timestamps

### TripwireConfig

File:

```txt
src/models/TripwireConfig.ts
```

Fields:

- `user`
- `symbol`
- `thresholdPercentage`
- `timeWindowMinutes`
- `isActive`
- `trigger`
- timestamps

Valid trigger values:

```txt
drop
spike
```

### Alert

File:

```txt
src/models/Alert.ts
```

Fields:

- `user`
- `symbol`
- `triggerPrice`
- `dropPercentage`
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

Migration note:

`dropPercentage` is legacy and kept for backward compatibility. New code should prefer:

```txt
changePercentage
triggerType
direction
```

### ChatSession

File:

```txt
src/models/chatSession.ts
```

Fields:

- `user`
- `symbol`
- `messages`
- timestamps

## 10. API Contracts

### Auth

Base path:

```txt
/api/auth
```

Endpoints:

```txt
POST /register
POST /login
POST /refresh
POST /logout
GET  /me
```

Auth uses HTTP-only cookies:

```txt
accessToken
refreshToken
```

### Monitors

Base path:

```txt
/api/monitors
```

Endpoints:

```txt
GET    /symbols
GET    /
POST   /
PATCH  /:id
DELETE /:id
GET    /debug/engine-state
```

Create monitor payload:

```json
{
  "symbol": "BTCUSDT",
  "thresholdPercentage": 2.5,
  "timeWindowMinutes": 5,
  "trigger": "drop"
}
```

### Alerts

Base path:

```txt
/api/alerts
```

Endpoints:

```txt
GET /ltp/:symbol
GET /
GET /:id
```

Alert response should include legacy and new movement fields where available:

```json
{
  "symbol": "SOLUSDT",
  "triggerPrice": 65.78,
  "dropPercentage": 0.11,
  "changePercentage": 0.11,
  "triggerType": "spike",
  "direction": "up"
}
```

### Chat

Base path:

```txt
/api/chat
```

Endpoints:

```txt
POST /
GET /history/:symbol
```

Chat request includes:

- symbol
- direction
- wallet balance
- risk percentage
- leverage
- user prompt
- chat history

## 11. WebSocket Contracts

WebSocket URL:

```txt
VITE_WS_URL or ws://localhost:3006
```

Auth:

- Browser must send `accessToken` cookie.
- Backend verifies token during upgrade.
- Missing/invalid token rejects connection.

Client subscription message:

```json
{
  "action": "UPDATE_SUBSCRIPTIONS",
  "subscribe": ["BTCUSDT", "MCX:GOLD:05APR2027:FUTURE"],
  "unsubscribe": []
}
```

The frontend sends YuJiDi symbol strings only. It does not send provider credentials, Angel tokens, Angel exchange types, or instrument-token internals.

Server events:

### SUBSCRIPTION_UPDATE_RESULT

```json
{
  "type": "SUBSCRIPTION_UPDATE_RESULT",
  "data": {
    "subscribed": [
      {
        "symbol": "BTCUSDT",
        "displayName": "BTC / USDT",
        "provider": "BINANCE",
        "subscriptionKey": "BINANCE:BINANCE:BTCUSDT"
      }
    ],
    "unsubscribed": [],
    "failed": []
  }
}
```

### SUBSCRIPTION_ACK

```json
{
  "type": "SUBSCRIPTION_ACK",
  "subscriptions": ["BTCUSDT"]
}
```

`SUBSCRIPTION_ACK` is kept for frontend backward compatibility. New logic should prefer `SUBSCRIPTION_UPDATE_RESULT` because it can report per-symbol failures.

### TICKER_UPDATE

```json
{
  "type": "TICKER_UPDATE",
  "symbol": "BTCUSDT",
  "currentPrice": "65000.00",
  "previousClose": "64000.00",
  "priceChangePercent": "1.56"
}
```

### MARKET_TICK

```json
{
  "type": "MARKET_TICK",
  "provider": "ANGEL_ONE",
  "marketType": "COMMODITY",
  "exchange": "MCX",
  "symbol": "MCX:GOLD:05APR2027:FUTURE",
  "displayName": "MCX GOLD 05APR2027 FUTURE",
  "instrumentToken": "570027",
  "providerSymbol": "GOLD05APR27FUT",
  "price": 98765.5,
  "currentPrice": "98765.5",
  "previousClose": "98760",
  "priceChangePercent": "0.006",
  "timestamp": 1781495884000
}
```

### NEW_ALERT

```json
{
  "type": "NEW_ALERT",
  "payload": {
    "symbol": "SOLUSDT",
    "triggerType": "spike",
    "direction": "up",
    "changePercentage": 0.11
  }
}
```

### ERROR

```json
{
  "type": "ERROR",
  "message": "Invalid websocket payload"
}
```

## 12. External Services

### MongoDB

Used for users, symbols, monitors, alerts, and chat sessions.

Important:

MongoDB Atlas `mongodb+srv` depends on DNS SRV lookup. MongoDB startup connection now retries before failing the process.

### Binance REST

Used for:

- syncing exchange symbols
- fetching LTP/24-hour ticker

### Binance WebSocket

Used streams:

```txt
<symbol>@ticker
<symbol>@aggTrade
<symbol>@depth20@100ms
```

### CryptoCompare

Used for recent symbol-related headlines.

Failure behavior:

News service returns fallback text:

```txt
No recent news available.
```

### Groq

Used for:

- AI alert report generation.
- Copilot chat response generation.

Current model:

```txt
llama-3.3-70b-versatile
```

## Provider Abstraction Baseline

YuJiDi now isolates LLM providers behind an application-owned `LLMProvider` port.

Current provider:

- Groq

Future providers:

- OpenAI
- Gemini

Rules:

- Core alert/copilot logic should depend on `LLMProvider`, not Groq SDK.
- Provider-specific response formats must be parsed and validated inside adapters.
- LLM output remains schema-validated before use.

Current implementation files:

```txt
src/ports/llm-provider.port.ts
src/integrations/llm/llm-provider.factory.ts
src/integrations/llm/groq/groq-llm.provider.ts
src/services/llm.service.ts
```

## Universal Symbol Registry Baseline

YuJiDi's `Symbol` collection is being evolved from a Binance-only crypto symbol list into a universal market symbol registry.

A Symbol now represents any watchable market instrument, including:

- Binance crypto spot symbols
- Angel MCX commodity futures/options
- future NSE/BSE cash symbols
- future FNO contracts
- future Kite instruments

Universal symbol identity should include:

- provider
- marketType
- exchange
- symbol
- name
- displayName
- providerSymbol
- instrumentToken
- instrumentType
- expiry/strike/option metadata where applicable
- lotSize/tickSize
- requiresBrokerLogin
- supportedBroker

Important boundary:

- Platform/global sync may populate symbols.
- User-specific broker login is required later for live Angel monitoring.
- Angel order placement is out of scope.
- Existing Binance monitor flow still uses symbol strings such as `BTCUSDT`.
- During transition, Binance symbols may use legacy `TRADING` or universal `ACTIVE` status.

## Angel SmartAPI Integration Direction

Angel SmartAPI integration is planned as read-only market data first.

Phase 1 foundation status:

- Provider-neutral market-data types added.
- Instrument model scaffold added.
- MarketDataProvider and InstrumentProvider ports added.
- Angel integration folder scaffold added.
- Universal `Symbol` registry fields added.
- Binance symbol sync writes universal symbol fields.
- Angel Scrip Master MCX mapper added.
- Angel Scrip Master client and disabled-by-default sync service added.
- Manual Angel symbol sync job added as `npm run sync:angel-symbols`.
- Angel symbol sync supports dry-run, exchange selection, batched writes, and result logging.
- Universal symbol search API added at `GET /api/monitors/symbols/universal`.
- Dashboard monitor picker can display universal symbols.
- `BrokerConnection` scaffold added without credential storage.
- Monitors can store optional universal metadata.
- Angel tick normalizer added.
- Analyzer can process `NormalizedMarketTick` through `processNormalizedTick`.
- No live Angel connection yet.
- User-specific Angel login verification is available through BrokerConnection APIs.
- Broker credentials and session tokens are encrypted at rest.
- No public/admin Angel sync HTTP endpoint yet.
- No order placement.
- No portfolio sync.
- No auto trading.

## Angel Scrip Master Sync Baseline

YuJiDi syncs Angel MCX reference symbols from the Angel Scrip Master into the universal `Symbol` collection.

Source:

```txt
https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json
```

Current Phase 2 scope:

- MCX reference-data sync only.
- Commodity symbol normalization.
- Global `Symbol` collection upsert.
- Symbols marked `requiresBrokerLogin=true`.
- Supported broker marked `ANGEL_ONE`.
- Default synced commodity names:
  - `CRUDEOIL`
  - `GOLD`
  - `SILVER`
  - `NATURALGAS`

Out of scope:

- User Angel login.
- Live WebSocket streaming.
- Order placement.
- Option chain runtime.
- Broker credential storage.

Business rule:

Angel symbols may be visible to all users, but live monitoring requires user-specific Angel broker connection in a later phase.

Angel manual sync commands:

```bash
npm run sync:angel-symbols
npm run sync:angel-symbols -- --dry-run --exchanges=MCX --names=CRUDEOIL,GOLD
ANGEL_SYMBOL_SYNC_ENABLED=true npm run sync:angel-symbols -- --apply --exchanges=MCX
```

Angel sync safety boundary:

- The job is not called from server startup unless `ANGEL_SYMBOL_SYNC_ON_STARTUP=true`.
- Dry-run is the default.
- Apply mode requires `ANGEL_SYMBOL_SYNC_ENABLED=true`.
- There is no Angel broker login, WebSocket connection, or order placement.
- Broker-required instruments are visible but blocked from monitor creation until broker login/live data exists.

## BrokerConnection Baseline

YuJiDi supports user-specific broker connections for Angel One.

Purpose:

- Angel MCX symbols are global reference data.
- Live Angel monitoring requires the user to connect their own Angel account.
- Broker credentials are encrypted at rest.
- Only market-data permission is enabled in this phase.
- Order placement is explicitly disabled.

Current scope:

- Angel login verification using SmartAPI `loginByPassword`.
- Encrypted credential storage.
- Encrypted session token storage.
- Broker connection status APIs.
- Reconnect/delete connection APIs.

Out of scope:

- WebSocket streaming.
- Quote API.
- Order placement.
- Portfolio sync.
- Option chain.

BrokerConnection API:

```txt
POST   /api/broker-connections/angel
GET    /api/broker-connections
GET    /api/broker-connections/angel/status
POST   /api/broker-connections/angel/reconnect
DELETE /api/broker-connections/angel
```

Future phases:

- Analyzer-integrated Angel WebSocket processing.
- Broker-aware monitor activation.
- Provider-specific analyzer calibration.

Safety:

- Do not log Angel credentials, JWTs, feed tokens, TOTP secrets, PIN, or API keys.
- Do not implement trading/order APIs without explicit approval.

## Angel Quote API Baseline

YuJiDi can fetch Angel quote snapshots using the logged-in user's Angel BrokerConnection.

Current scope:

- User-specific Angel BrokerConnection is required.
- Read-only Angel Quote API access is supported.
- Single-symbol `LTP`, `OHLC`, and `FULL` fetch is supported.
- Response is normalized into YuJiDi's `NormalizedMarketSnapshot`.
- Quote data is not persisted by default.
- Quote endpoint is mounted at `GET /api/market-quotes/:symbolId`.

Business rule:

Angel quote access uses the user's own Angel session. Global `Symbol` records are reference data only.

Out of scope:

- Angel WebSocket streaming is covered separately by Phase 6 LTP debug streaming.
- Order placement.
- Monitor/analyzer integration.
- Portfolio/RMS sync.
- Option chain runtime.

Safety boundary:

The quote service decrypts the user's Angel API key and JWT token only inside backend service code. API responses must never return API keys, JWTs, refresh tokens, feed tokens, PINs, TOTP values, or encrypted fields.

## Universal Symbol Monitor Baseline

Monitors can be created from universal `Symbol` records via `symbolId`.

Current behavior:

- Binance legacy monitor creation by `symbol` remains supported.
- New monitor creation by `symbolId` stores symbol snapshot fields.
- Legacy Binance monitor creation is enriched from `Symbol` when possible.
- Legacy Binance monitor creation falls back to safe Binance defaults if a symbol record is missing.
- Angel MCX symbols require active user Angel BrokerConnection.
- Broker credentials are not decrypted during monitor creation.
- Monitor stores provider, exchange, instrument token, display name, and broker requirement metadata for future provider-aware WebSocket subscription.

Snapshot fields stored on monitors:

- `symbolId`
- `provider`
- `marketType`
- `exchange`
- `displayName`
- `providerSymbol`
- `instrumentToken`
- `instrumentType`
- `requiresBrokerLogin`
- `supportedBroker`

Out of scope:

- Angel WebSocket.
- Order placement.
- Option chain.

## Angel WebSocket LTP Streaming Baseline

YuJiDi supports user-specific Angel WebSocket LTP streaming for Angel MCX monitors.

Current scope:

- User-specific Angel BrokerConnection is required.
- Angel WebSocket 2.0 connection uses the user's encrypted session after internal decryption.
- LTP mode only.
- MCX uses Angel `exchangeType = 5`.
- Heartbeat sends `ping` every 30 seconds.
- Binary LTP packet parsing is implemented.
- LTP ticks are normalized into `NormalizedMarketTick`.
- Protected debug routes can subscribe, unsubscribe, and inspect session status.

Debug routes:

```txt
POST /api/market-streams/angel/monitors/:monitorId/subscribe
POST /api/market-streams/angel/monitors/:monitorId/unsubscribe
GET  /api/market-streams/angel/status
```

Subscription key:

```txt
ANGEL_ONE:<userId>:MCX:<instrumentToken>
```

Out of scope:

- WebSocket FULL/SnapQuote mode.
- Option chain.
- Order placement.
- Portfolio sync.

## Provider-Aware WebSocket Subscription Routing

YuJiDi now routes normal frontend WebSocket subscriptions through a provider-aware backend path.

Current behavior:

- Frontend keeps using the existing backend WebSocket connection.
- Frontend sends YuJiDi symbol strings in `UPDATE_SUBSCRIPTIONS`.
- Backend resolves each symbol through the universal `Symbol` collection.
- Binance symbols route to the existing shared Binance master stream.
- Angel MCX symbols route to a user-specific Angel WebSocket session.
- Angel subscriptions require an active user Angel BrokerConnection.
- Backend tracks subscriptions by provider-aware subscription keys.
- Backend sends `SUBSCRIPTION_UPDATE_RESULT` with per-symbol subscribed, unsubscribed, and failed entries.
- Backend still sends legacy `SUBSCRIPTION_ACK` for compatibility.
- Binance ticks still use `TICKER_UPDATE`.
- Angel ticks use normalized `MARKET_TICK`.

Implementation files:

```txt
src/services/market-subscription-resolver.service.ts
src/services/market-subscription-router.service.ts
src/services/websocket.service.ts
src/services/angel-user-market-data-session.service.ts
```

Subscription keys:

```txt
BINANCE:BINANCE:<symbol>
ANGEL_ONE:<userId>:MCX:<instrumentToken>
```

Important boundary:

- Debug market-stream routes remain for backend verification.
- Normal product flow should use the existing frontend WebSocket subscription message.
- Frontend must not connect directly to Angel.
- Frontend must not send Angel JWT, feed token, API key, client code, exchange type, or mode.

## Angel Analyzer Integration Baseline

YuJiDi can process Angel `NormalizedMarketTick` events through the analyzer.

Angel analyzer behavior:

- Angel ticks are user-session scoped.
- Monitor lookup uses user + provider + exchange + instrument token.
- Price buffer and monitor cache keys use provider-aware subscription keys.
- Existing drop/spike analyzer rules are reused.
- Angel alerts include provider, market type, exchange, instrument token, provider symbol, display name, current price, and previous price metadata.
- Angel alerts emit through the existing `NEW_ALERT` flow.
- Analyzer failures are logged and do not block live `MARKET_TICK` delivery.

Angel analyzer key:

```txt
ANGEL_ONE:<userId>:MCX:<instrumentToken>
```

Out of scope:

- Order placement.
- Option chain.
- WebSocket FULL/SnapQuote mode.
- Portfolio sync.
- Advisory or trade recommendation logic.

Current Phase 0 files:

```txt
src/types/market-data.types.ts
src/models/Instrument.ts
src/ports/market-data-provider.port.ts
src/ports/instrument-provider.port.ts
src/integrations/market-data/angel/
```

## 13. Analyzer Engine Architecture

Analyzer file:

```txt
src/services/analyzer.service.ts
```

Inputs:

- Binance `aggTrade`
- Binance depth snapshots
- active MongoDB monitors

State:

```txt
priceBuffer
cvdBuffer
currentCVD
cooldowns
orderBookSnapshot
```

Drop trigger:

```txt
percentChange <= -thresholdPercentage
```

Spike trigger:

```txt
percentChange >= thresholdPercentage
```

Movement fields:

```txt
changePercentage = signed percent change
dropPercentage = legacy absolute magnitude
triggerType = drop or spike
direction = up or down
```

Cooldown:

```txt
15 minutes per monitor
```

Known analyzer limitations:

- In-memory state only.
- No multi-instance coordination.
- Active-monitor cache is process-local.
- Monitor window allows up to 24h, but price buffer keeps around 60m.
- Cooldown starts before alert pipeline fully succeeds.
- CVD threshold is not asset-normalized.

## 14. AI/LLM Pipeline

Alert generation pipeline:

```txt
threshold breach
  -> fetch news
  -> calculate support/resistance
  -> build movement-aware prompt
  -> call selected LLM provider
  -> parse JSON
  -> validate with Zod
  -> save alert
  -> emit NEW_ALERT
```

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

Important rule:

LLM output must be valid JSON and must match schema before storage.

Copilot pipeline:

```txt
user prompt
  -> get live CVD and order book
  -> backend calculates deterministic trade math
  -> load recent chat history
  -> call selected LLM provider
  -> validate JSON
  -> save messages
  -> return response
```

Copilot response schema:

```json
{
  "intent": "TRADE or GENERAL",
  "isApproved": true,
  "reply": "string"
}
```

## 15. Authentication Flow

Auth files:

```txt
src/routes/auth.routes.ts
src/controllers/auth.controller.ts
src/services/auth.service.ts
src/middlewares/requireAuth.ts
src/utils/jwt.ts
```

Registration:

```txt
validate request
  -> create user
  -> hash password
  -> seed default monitors
  -> clone recent alerts if available
```

Login:

```txt
validate credentials
  -> compare password
  -> issue access token
  -> issue refresh token
  -> store refresh token
  -> set cookies
```

Protected route:

```txt
read accessToken cookie
  -> verify JWT
  -> attach req.user.id
```

Logout:

```txt
read refresh token
  -> clear stored refresh token
  -> clear cookies
```

Security improvement pending:

Store refresh token hash instead of raw refresh token.

## 16. Business Rules

User rules:

- User must authenticate before accessing protected resources.
- User can access only their own monitors, alerts, and chats.

Symbol rules:

- Only supported Binance `USDT` trading symbols can be monitored.

Monitor rules:

- Monitor belongs to one user.
- Monitor watches one symbol.
- Trigger must be `drop` or `spike`.
- Threshold must be positive.
- Time window must be positive.
- New monitor is active by default.

Analyzer rules:

- Invalid price ticks are rejected.
- Monitor is skipped if there is not enough history.
- Monitor is skipped during cooldown.
- Drop triggers on negative threshold breach.
- Spike triggers on positive threshold breach.

Alert rules:

- Alert belongs to one user.
- Alert must include AI report fields.
- New alerts should include direction-neutral movement fields.
- Alert is emitted only to owning user's sockets.

Copilot rules:

- Backend calculates trade math.
- LLM explains or vetoes.
- Deterministic veto conditions should eventually override any LLM approval.

## 17. State Machines

### User Session

```txt
Unauthenticated
  -> login/register
Authenticated
  -> access token expires
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
  -> cooldown expires
Active / Watching
```

### Alert

Current implicit state:

```txt
Detected
  -> Analyzing
  -> Stored
  -> Delivered if user online
```

Suggested future explicit state:

```txt
detected
analyzing
ready
delivered
failed
```

### WebSocket

```txt
Disconnected
  -> authenticated user opens socket
Connected
  -> UPDATE_SUBSCRIPTIONS
Subscribed
  -> logout/close/error
Disconnected
```

### Binance Master Socket

```txt
Not Connected
  -> connect
Connecting
  -> open
Streaming
  -> close/error
Reconnect Scheduled
  -> reconnect
```

## 18. Testing Strategy

Detailed strategy:

```txt
../docs/TESTING_STRATEGY.md
```

Current status:

- Backend has `typecheck`.
- Backend has analyzer rules and `processTick` tests.
- Full route/database/WebSocket test coverage is still pending.

Recommended priority:

1. Expand analyzer edge-case tests.
2. Monitor service tests.
3. Auth service/route tests.
4. Alert route ownership tests.
5. WebSocket manager tests.
6. Chat copilot tests.
7. API contract tests.

Highest-priority analyzer tests:

- Drop trigger fires.
- Drop trigger does not fire.
- Spike trigger fires.
- Spike trigger does not fire.
- Cooldown prevents duplicate trigger.
- Insufficient history skips monitor.
- LLM failure does not save alert.

## 19. Known Risks

Detailed risk register:

```txt
../docs/RISK_REGISTER.md
```

Current major risks:

- Monitor window can exceed analyzer price buffer.
- Analyzer state is in memory.
- Multi-instance deployment is not safe.
- Active-monitor cache is process-local and not multi-instance safe.
- Cooldown starts before alert pipeline success.
- Alert detail user lookup may need correction.
- Refresh token is stored directly.
- No automated backend tests yet.
- HTTP LTP ignition can create unmanaged subscriptions.
- External DNS/API failures can still affect runtime providers. MongoDB startup retry and non-fatal Binance symbol sync are implemented, but broader provider health handling remains pending.

## 20. Current Progress

Implemented:

- Express backend.
- MongoDB models.
- Auth registration/login/logout/refresh.
- Cookie-based JWT auth.
- Binance symbol sync.
- MongoDB startup retry/backoff.
- Non-fatal Binance symbol sync retry loop.
- Analyzer active-monitor TTL cache.
- Analyzer monitor cache refresh on monitor create/update/delete.
- Monitor CRUD.
- WebSocket manager.
- Binance master WebSocket.
- Ticker forwarding.
- Analyzer price buffer.
- CVD calculation.
- Order-book snapshot and support/resistance detection.
- Drop and spike monitor detection.
- Alert persistence.
- Groq alert report generation.
- Real-time `NEW_ALERT`.
- Copilot chat.
- Frontend landing/auth.
- Frontend protected dashboard.
- Frontend add monitor modal.
- Frontend alert feed and full analysis modal.
- Backend documentation suite.
- Angel universal symbol registry foundation.
- Angel MCX Scrip Master sync.
- Angel BrokerConnection login verification with encrypted credentials/session tokens.
- Angel read-only quote snapshots through `GET /api/market-quotes/:symbolId`.
- Universal Symbol monitor creation through `symbolId` with monitor snapshot metadata.
- User-specific Angel WebSocket LTP debug streaming for Angel MCX monitors.
- Provider-aware frontend WebSocket subscription routing for Binance and Angel MCX.
- Angel normalized tick analyzer alert generation for Angel MCX monitors.

Partially implemented:

- Alert movement migration.
  - New fields exist.
  - Legacy `dropPercentage` remains.
- Testing strategy.
  - Documented but not implemented.
- Risk register.
  - Documented and should be maintained.

## 21. Pending Work

High priority:

1. Add analyzer tests for drop/spike behavior.
2. Align monitor max window with analyzer buffer.
3. Fix alert detail ownership lookup if still inconsistent.
4. Add monitor update validation.
5. Add `.env.example`.
6. Add broader runtime health handling for Groq, CryptoCompare, Binance REST, and DNS failures.
7. Add shared monitor-cache refresh/invalidation before multi-instance deployment.
8. Add failed alert tracking or adjust cooldown placement.
9. Normalize `req.user.id` usage everywhere.
10. Complete alert movement migration later.

Medium priority:

- Add frontend architecture doc.
- Add pagination for alerts.
- Add duplicate monitor rules.
- Add WebSocket reconnect UX.
- Add health checks for external dependencies.

## 22. Development Standards

General rules:

- Keep changes scoped.
- Prefer existing project patterns.
- Validate route input with Zod.
- Protect user ownership boundaries.
- Do not expose secrets.
- Do not log raw passwords, JWTs, cookies, or env values.
- Keep LLM output schema-validated.
- Keep deterministic calculations outside the LLM.
- Update docs when changing domain behavior.

Backend standards:

- Use services for domain logic.
- Use controllers for HTTP request/response handling.
- Use models for persistence schema.
- Use middleware for auth, errors, rate limits.
- Prefer typed DTOs where practical.

Frontend standards:

- Use `apiClient` for HTTP.
- Use contexts for auth and WebSocket state.
- Keep UI backward-compatible during data migrations.
- Prefer optional fields when supporting old records.

## 23. AI Coding Agent Instructions

Before coding:

1. Read this file.
2. Read `PROJECT_CONTEXT.md`.
3. Read the relevant detailed doc:
   - domain changes: `DOMAIN_MODEL.md`
   - analyzer changes: `ANALYZER_ENGINE.md`
   - testing changes: `TESTING_STRATEGY.md`
   - risk changes: `RISK_REGISTER.md`
4. Inspect the relevant source files.
5. Explain the plan if the change affects domain behavior.

While coding:

- Do not read or print `.env` unless explicitly required and approved by the user.
- Do not commit secrets.
- Do not remove backward-compatible fields without a migration plan.
- Do not make destructive git changes.
- Do not rewrite unrelated code.
- Do not silently change product/domain semantics.

After coding:

- Run backend `npm run typecheck` for backend changes.
- Run frontend `npm run build` for frontend changes when touched.
- Update docs if behavior changed.
- Summarize changed files and verification.

## 24. How To Add New Features

Recommended workflow:

1. Define the feature in domain terms.
2. Identify affected entities and workflows.
3. Check ownership/security implications.
4. Update or add API/WebSocket contract if needed.
5. Add backend model/service/controller changes.
6. Add frontend state/UI changes.
7. Add tests or update testing docs if tests are not yet available.
8. Update detailed docs.
9. Update `PROJECT_CONTEXT.md` if project direction/progress changed.
10. Run verification.

Feature checklist:

- Does it require auth?
- Which user owns the data?
- Does it affect analyzer state?
- Does it affect old records?
- Does it need migration/backward compatibility?
- Does frontend need fallback behavior?
- Does LLM prompt/schema need adjustment?
- Does WebSocket contract change?
- Does risk register need updating?

## 24.1 Feature Design Template

Before implementing any medium or large feature, create a short design note using this template.

The design note can live in chat for small planning discussions. For larger work, add it as a Markdown file under `document/` or `docs/`, depending on whether it is broad project context or detailed feature context.

### Feature Name

What is being added?

Example:

```txt
Spike monitor regression tests
```

### Business Goal

What user problem does it solve?

Explain the user-facing reason, not only the technical change.

### Current Behavior

How does the system work today?

Mention relevant current limitations, mismatches, or legacy behavior.

### Proposed Behavior

How should it work after the change?

Be explicit about expected behavior and non-goals.

### Affected Areas

List every area that may need a code or documentation change:

```txt
Backend models:
Backend services:
Routes/controllers:
Frontend pages/components:
WebSocket contracts:
LLM prompts/schema:
Docs:
Tests:
```

### Data Model Changes

List:

- new fields
- removed fields
- renamed fields
- optional vs required fields
- backward compatibility
- migration concerns
- old-record behavior

If data model changes are destructive or production-impacting, get explicit approval first.

### API/WebSocket Changes

List request/response changes.

Include:

- endpoint paths
- request body changes
- response body changes
- WebSocket message changes
- frontend compatibility fallback

### Risks

List security, data, performance, and product risks.

Minimum categories to consider:

- user ownership/security
- data migration
- old records
- production compatibility
- performance
- external API failure
- WebSocket behavior
- LLM schema/prompt risk
- frontend display risk

### Rollout Plan

How to implement safely in small steps.

Prefer compatibility-first migrations:

```txt
add new field
  -> write both old and new fields
  -> frontend reads new field with old fallback
  -> verify production data
  -> remove old field later with explicit migration
```

### Verification

Commands/tests to run.

Minimum examples:

```bash
cd yujidi-server
npm run typecheck
```

```bash
cd yujidi-client
npm run build
```

Also list any manual verification steps, such as:

- create monitor
- trigger alert
- inspect MongoDB record
- confirm WebSocket payload
- confirm frontend display

## Phase 9: Scalable Symbol Search Baseline

YuJiDi no longer expects frontend symbol pickers to load the full global `Symbol` collection and filter locally.

Backend search:

- Route: `GET /api/symbols/search`
- Minimum query length: 2 characters.
- Default limit: 20.
- Maximum limit: 50.
- Supported filters: `provider`, `marketType`, `exchange`, `instrumentType`, `includeExpired`, and `limit`.
- Expired instruments are excluded by default.
- Response excludes `raw` provider payloads.
- Search uses normalized token fields instead of unbounded collection-wide regex scans.
- A short in-memory LRU cache protects repeated searches.
- Route-level rate limiting protects the search API from request bursts.

Symbol search fields:

- `searchName`
- `searchSymbol`
- `searchDisplayName`
- `searchProviderSymbol`
- `searchTokens`
- `autocompleteTokens`
- `searchRank`

Search field population:

- Binance sync writes search fields for crypto symbols.
- Angel symbol mapper writes search fields for MCX symbols.
- Existing records can be repaired with:

```bash
cd yujidi-server
npm run symbols:backfill-search
```

Frontend behavior:

- Add-monitor flows search symbols through the backend API with debounce and request cancellation.
- Frontend should not call `/api/monitors/symbols` or `/api/monitors/symbols/universal` on modal/page open for symbol discovery.
- Monitor creation should prefer `symbolId` from search results.

Important boundary:

Search is reference-data discovery only. It does not grant live market-data permission, broker login, or order capability.

## 25. Commit And Documentation Rules

Commit rules:

- Commit only intended files.
- Check `git status --short` before staging.
- Do not commit `.env`, secrets, build artifacts, or unrelated changes.
- Use clear behavior-focused commit messages.

Good commit examples:

```txt
feat: support spike monitor alerts
fix: scope alert detail lookup by user id
docs: add analyzer engine context
test: cover monitor threshold evaluation
```

Documentation rules:

- `PROJECT_MASTER_CONTEXT.md` is the broad onboarding context for AI and engineers.
- `PROJECT_CONTEXT.md` is the living index/source of truth for current direction and progress.
- Detailed behavior belongs in the topic docs under `docs/`.
- If implementation and docs disagree, treat it as a bug and resolve the mismatch.
- When a risk is fixed, update `RISK_REGISTER.md`.
- When testing direction changes, update `TESTING_STRATEGY.md`.
- When domain behavior changes, update `DOMAIN_MODEL.md`.
- When analyzer behavior changes, update `ANALYZER_ENGINE.md`.

Current documentation map:

```txt
document/PROJECT_MASTER_CONTEXT.md
document/PROJECT_CONTEXT.md
document/BACKEND_ARCHITECTURE.md
docs/DOMAIN_MODEL.md
docs/ANALYZER_ENGINE.md
docs/TESTING_STRATEGY.md
docs/RISK_REGISTER.md
```

End of master context.
