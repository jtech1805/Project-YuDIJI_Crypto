# YuJiDi Backend Architecture

This document explains the current backend architecture of the YuJiDi crypto monitoring server.

The backend is a TypeScript Express application that connects to MongoDB, streams live Binance market data, evaluates user-defined crypto monitors, generates AI analysis through Groq, stores alerts, and pushes real-time events to authenticated browser clients over WebSocket.

## 1. High-Level Purpose

The backend powers a real-time crypto anomaly monitoring system.

Users create monitors, also called tripwires, for Binance USDT trading pairs. Each monitor defines:

- `symbol`: the asset pair, for example `BTCUSDT`
- `thresholdPercentage`: how large a move should trigger an alert
- `timeWindowMinutes`: the rolling lookback window
- `trigger`: intended to be `drop` or `spike`
- `isActive`: whether the monitor is currently enabled

The backend watches live Binance market streams. When price movement breaches a monitor threshold, the backend enriches the event with:

- recent price movement
- 60-second cumulative volume delta, also called CVD
- order-book support and resistance walls
- recent CryptoCompare headlines
- Groq/Llama AI interpretation

It then stores an alert in MongoDB and emits it live to the user.

## 2. Runtime Startup

Entry file: `src/server.ts`

Startup sequence:

1. Load environment variables using `dotenv/config`.
2. Validate required environment variables with Zod:
   - `MONGO_URI`
   - `PORT`
3. Connect to MongoDB through Mongoose.
4. Start the Express HTTP server.
5. Initialize the shared WebSocket manager.
6. Sync Binance USDT trading symbols into MongoDB.
7. Register graceful shutdown handlers for `SIGINT` and `SIGTERM`.

Important point: WebSocket and analyzer state are held in memory. Restarting the backend resets rolling buffers, CVD state, order-book snapshots, and cooldown maps.

## 3. Express App Layer

Main file: `src/app.ts`

The Express app is responsible for:

- JSON/body parsing
- cookie parsing
- CORS setup
- request logging through Pino
- route mounting
- 404 handling
- centralized error handling

Mounted routes:

- `GET /health`
- `/api/auth`
- `/api/monitors`
- `/api/alerts`
- `/api/chat`

The backend allows credentials in CORS because auth uses HTTP-only cookies.

## 4. Authentication Architecture

Main files:

- `src/routes/auth.routes.ts`
- `src/controllers/auth.controller.ts`
- `src/services/auth.service.ts`
- `src/middlewares/requireAuth.ts`
- `src/utils/jwt.ts`
- `src/models/User.ts`

Authentication uses email/password with JWT cookies.

The user model stores:

- email
- name
- bcrypt-hashed password
- latest refresh token

Auth flow:

1. User registers with name, email, and password.
2. Password is hashed in a Mongoose `pre("save")` hook.
3. On login, backend compares the password with bcrypt.
4. Backend issues:
   - access token
   - refresh token
5. Tokens are sent as HTTP-only cookies.
6. Protected routes use `requireAuth`, which reads `accessToken` from cookies and attaches `req.user = { id }`.

Refresh-token rotation:

- The latest refresh token is stored on the user document.
- Refresh succeeds only if the incoming refresh token matches the stored token.
- Logout unsets the stored refresh token.

New-user seeding:

- Registration creates default BTCUSDT and ETHUSDT monitors.
- It also clones a few recent BTC/ETH alerts, if available, so the new dashboard has initial content.

## 5. MongoDB Data Model

### User

File: `src/models/User.ts`

Stores application accounts and refresh token state.

### Symbol

File: `src/models/Symbol.ts`

Stores Binance symbols synced from Binance exchange info.

The backend currently keeps only symbols where:

- `quoteAsset` is `USDT`
- `status` is `TRADING`

### TripwireConfig

File: `src/models/TripwireConfig.ts`

Stores user-created monitors.

Important fields:

- `user`
- `symbol`
- `thresholdPercentage`
- `timeWindowMinutes`
- `isActive`
- `trigger`

### Alert

File: `src/models/Alert.ts`

Stores triggered AI analysis reports.

Important fields:

- `user`
- `symbol`
- `triggerPrice`
- `dropPercentage`
- `catalyst`
- `threatLevel`
- `support`
- `resistance`
- `summary`
- `cvdAtTrigger`
- `createdAt`

### ChatSession

File: `src/models/chatSession.ts`

Stores per-user, per-symbol copilot conversations.

## 6. Monitor API

Main files:

- `src/routes/monitor.routes.ts`
- `src/controllers/monitor.controller.ts`
- `src/services/monitor.service.ts`

Endpoints:

- `GET /api/monitors/symbols`
  - Returns supported Binance USDT trading symbols.

- `GET /api/monitors`
  - Requires auth.
  - Returns the logged-in user's monitors with symbol metadata.

- `POST /api/monitors`
  - Requires auth.
  - Creates a monitor.
  - Validates symbol, threshold, time window, and trigger.

- `PATCH /api/monitors/:id`
  - Requires auth.
  - Updates monitor fields.

- `DELETE /api/monitors/:id`
  - Requires auth.
  - Deletes a monitor owned by the user.

- `GET /api/monitors/debug/engine-state`
  - Requires auth.
  - Returns current in-memory analyzer state.

Monitor creation checks that the selected symbol exists in the synced Binance symbol collection.

## 7. Binance Integration

Main file: `src/services/binance.service.ts`

Responsibilities:

- Sync supported symbols from Binance exchange info.
- Fetch latest ticker data for a symbol through Binance REST.

Symbol sync:

1. Call `https://api.binance.com/api/v3/exchangeInfo`.
2. Filter to `TRADING` + `USDT`.
3. Upsert symbols into MongoDB with `bulkWrite`.

LTP endpoint:

- `GET /api/alerts/ltp/:symbol`
- Fetches Binance 24-hour ticker data.
- Also acts as an ignition switch for authenticated HTTP clients by forcing the WebSocket manager to subscribe to that symbol.

## 8. WebSocket Architecture

Main file: `src/services/websocket.service.ts`

The backend has one shared WebSocket manager:

```ts
export const sharedWebsocketManager = new WebSocketManager();
```

It manages two kinds of WebSocket connections:

1. Browser clients connected to the YuJiDi backend.
2. One shared Binance master WebSocket connection.

### Client WebSocket Authentication

The backend authenticates WebSocket upgrades by reading the `accessToken` cookie from the upgrade request.

If the token is missing or invalid, the server rejects the upgrade with `401 Unauthorized`.

### Client Subscriptions

Browser clients send messages like:

```json
{
  "action": "UPDATE_SUBSCRIPTIONS",
  "subscribe": ["BTCUSDT"],
  "unsubscribe": []
}
```

The server tracks:

- `clientSubscriptions`: which symbols each browser socket wants
- `globalSymbolCounts`: how many clients want each symbol
- `clientUsers`: which user owns each browser socket
- `userSockets`: all open sockets for each user

This design avoids opening one Binance connection per user. Instead, all user subscriptions are merged into one global symbol set.

### Binance Stream Subscription

For each active symbol, the backend subscribes to:

- `${symbol}@aggTrade`
- `${symbol}@ticker`
- `${symbol}@depth20@100ms`

These streams serve different purposes:

- `ticker`: live UI price and percent change updates
- `aggTrade`: analyzer price ticks and CVD calculation
- `depth20@100ms`: order-book support and resistance calculation

### Outbound Events To Frontend

The backend sends:

- `TICKER_UPDATE`
- `SUBSCRIPTION_ACK`
- `ERROR`
- `NEW_ALERT`

`NEW_ALERT` is emitted only to sockets belonging to the user who owns the triggered monitor.

## 9. Analyzer Engine

Main file: `src/services/analyzer.service.ts`

The analyzer is the core market-event engine.

It maintains in-memory state:

- `priceBuffer`
  - Rolling price ticks per symbol.

- `cooldowns`
  - Per-monitor cooldowns to avoid repeated alert spam.

- `cvdBuffer`
  - Rolling trade deltas for 60-second CVD.

- `currentCVD`
  - Fast lookup for current 60-second cumulative volume delta.

- `orderBookSnapshot`
  - Latest order-book bids/asks per symbol.

### Price Buffer

Each incoming aggTrade tick adds:

- price
- timestamp

Old ticks beyond one hour are removed.

For each active monitor on the symbol, the analyzer finds the base tick around the start of the monitor's configured window.

Example:

- Current time: now
- Monitor window: 5 minutes
- Base tick: tick at or before `now - 5 minutes`
- Percent change: `(currentPrice - basePrice) / basePrice * 100`

### CVD Calculation

CVD means cumulative volume delta.

The analyzer uses aggTrade fields:

- quantity
- buyer-maker flag

The current logic treats larger trades above `WHALE_THRESHOLD_BTC` as meaningful.

Direction logic:

- buyer maker means sell pressure, negative delta
- otherwise positive delta

Only the last 60 seconds remain in the CVD buffer.

### Order Book Support And Resistance

The analyzer receives latest depth snapshots and calculates structural liquidity walls.

The current logic:

1. Reads bids and asks.
2. Estimates current price from top bid/ask midpoint.
3. Ignores the first few book levels to avoid spread/spoof noise.
4. Calculates average bid/ask size.
5. Looks for bid/ask levels much larger than average.
6. Returns:
   - current price
   - support wall
   - resistance wall
   - raw numeric values
   - debug data

This is used both by alert reports and chat copilot trade math.

### Alert Trigger Pipeline

When a threshold breach is detected:

1. Set monitor cooldown.
2. Fetch recent CryptoCompare headlines for the symbol.
3. Calculate support/resistance walls.
4. Call Groq LLM for a structured report.
5. Save an `Alert` document in MongoDB.
6. Emit `NEW_ALERT` to the user's connected browser sockets.

Cooldown is currently 15 minutes per monitor.

Important current behavior: although monitor config has `trigger`, the analyzer currently checks only downside moves.

## 10. News Service

Main file: `src/services/news.service.ts`

The news service:

1. Converts symbols like `BTCUSDT` to `BTC`.
2. Calls CryptoCompare news API.
3. Extracts up to 10 headlines.
4. Returns joined headlines as LLM context.
5. Falls back to `No recent news available.` if the request fails or returns no usable data.

## 11. LLM Service

Main file: `src/services/llm.service.ts`

The backend uses Groq SDK and model:

```txt
llama-3.3-70b-versatile
```

### Alert Report Generation

Input context:

- symbol
- drop percentage
- time window
- news context
- CVD
- support wall
- resistance wall

Expected JSON response:

```json
{
  "catalyst": "string",
  "threatLevel": "string",
  "support": "string",
  "resistance": "string",
  "summary": "string"
}
```

The response is parsed and validated with Zod before being stored.

### Copilot Chat

The same LLM service also powers the trading copilot.

Expected JSON response:

```json
{
  "intent": "TRADE or GENERAL",
  "isApproved": true,
  "reply": "string"
}
```

The service includes a fallback JSON extractor if the model returns extra text around the JSON.

## 12. Alert API

Main files:

- `src/routes/alert.routes.ts`
- `src/controllers/alert.controller.ts`

Endpoints:

- `GET /api/alerts/ltp/:symbol`
  - Fetches latest ticker data from Binance.
  - Can also force backend subscription to that symbol.

- `GET /api/alerts`
  - Requires auth.
  - Returns latest alerts for the logged-in user.

- `GET /api/alerts/:id`
  - Requires auth.
  - Returns one alert report.

## 13. Chat Copilot Architecture

Main files:

- `src/routes/chat.routes.ts`
- `src/controllers/chat.controller.ts`
- `src/models/chatSession.ts`

The chat copilot is not just a normal chatbot. It uses current live engine state.

Request payload includes:

- symbol
- direction, `LONG` or `SHORT`
- wallet balance
- risk percentage
- leverage
- user prompt
- chat history

Backend flow:

1. Validate request body with Zod.
2. Fetch order-book support/resistance and current CVD from the shared WebSocket manager.
3. Calculate deterministic trade math:
   - entry
   - stop loss
   - take profit
   - risk/reward ratio
   - position size
   - required margin
4. Build a strict system prompt for the LLM.
5. Load recent chat history from MongoDB.
6. Ask Groq to classify intent and approve or veto.
7. Save the new user and assistant messages.
8. Return response and trade math to the frontend.

The important design idea is that Node.js calculates the numbers, and the LLM explains or vetoes based on those numbers.

## 14. Error Handling And Rate Limiting

Error handling:

- `src/errors/AppError.ts`
- `src/middlewares/errorHandler.ts`

The app uses `AppError` for known operational errors and a central `errorHandler` for final responses.

Rate limiting:

- `src/middlewares/rateLimiter.ts`

There is a user/IP limiter configured for 10 requests per second. The current route mount in `alert.routes.ts` applies it to `/api` under the alert router, which may not cover all intended routes.

## 15. Current Architecture Diagram

```txt
React Client
  |
  | HTTP with cookies
  v
Express API
  |
  | MongoDB queries
  v
MongoDB

React Client
  |
  | Authenticated WebSocket using accessToken cookie
  v
WebSocketManager
  |
  | Merged symbol subscriptions
  v
Binance Master WebSocket
  |
  | ticker / aggTrade / depth20
  v
AnalyzerEngine
  |
  | threshold breach
  v
News Service + Order Book/CVD Context
  |
  v
Groq LLM Service
  |
  v
AlertModel in MongoDB
  |
  v
NEW_ALERT over WebSocket to user
```

## 16. Required Environment Variables

Backend requires:

- `MONGO_URI`
- `PORT`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_EXPIRY`
- `JWT_REFRESH_EXPIRY`
- `GROQ_API_KEY`

Optional or environment-dependent:

- `CRYPTOCOMPARE_API_KEY`
- `FRONTEND_URL`
- `MEDO_URL`
- `COOKIE_ACCESS_EXPIRY_MS`
- `COOKIE_REFRESH_EXPIRY_MS`
- `NODE_ENV`

## 17. Current Gaps And Risks

These are not criticisms of the idea. They are simply implementation notes from the current code.

1. Spike monitors are not fully implemented in the analyzer.
   - The monitor schema supports `spike` and `drop`.
   - The analyzer currently triggers only on downward movement.

2. Engine state is in memory.
   - This is simple and fast.
   - It does not survive restarts.
   - It does not automatically scale across multiple backend instances.

3. Some route/controller user-id handling is inconsistent.
   - Most code uses `req.user.id`.
   - A few places use `req.user`, `req.userId`, or `sub`.

4. Alert detail lookup may need correction.
   - `getUserAlerts` uses `userId.id`.
   - `getAlertById` uses `user: userId`, which may not match the same shape.

5. The `/engine` frontend page describes future architecture pieces that are not currently implemented.
   - Examples: Redis, Kafka, pgvector, LangChain, SSE, OAuth, encryption.
   - Current backend uses MongoDB, in-memory Maps, Binance WebSocket, CryptoCompare, and Groq.

6. CORS and secure cookie settings need environment-specific care.
   - Cookies are configured with `secure: true` and `sameSite: "none"` for auth attachment.
   - Local HTTP development may need matching browser/server setup.

7. There is no automated test suite visible in the backend package scripts.

## 18. Suggested Next Architecture Improvements

Near-term improvements:

- Implement true `spike` detection.
- Normalize `req.user.id` usage everywhere.
- Fix alert detail lookup.
- Add request validation to update monitor payload.
- Add backend tests for auth, monitors, alerts, and analyzer threshold logic.
- Add a short `.env.example` without secret values.

Scaling improvements:

- Move analyzer state to Redis if running multiple backend instances.
- Add persistent event logs if historical replay is needed.
- Split Binance ingestion from API server if ingestion grows.
- Add queueing around LLM calls to protect latency and rate limits.
- Add structured observability for alert pipeline failures.

Security improvements:

- Keep production secrets out of local `.env` where possible.
- Rotate any exposed keys.
- Avoid logging full LLM prompts if they may contain sensitive user data.
- Add strict cookie config for local vs production environments.
- Add API key permission restrictions at provider level.
