# Domain Model

This document captures the backend domain model for YuJiDi.

`PROJECT_CONTEXT.md` remains the high-level source of truth. This file is the detailed reference for entities, ownership boundaries, relationships, workflows, state machines, and business rules.

## 1. Domain Summary

YuJiDi is a real-time crypto monitoring and AI analysis system.

The core domain idea is:

```txt
User defines market logic
  -> YuJiDi watches live Binance data
  -> Analyzer detects threshold breach
  -> AI report explains the event
  -> Alert is delivered to the user
```

The domain is not simply "crypto prices." The domain is user-owned market surveillance.

## 2. Core Entities

### 2.1 User

Implementation:

```txt
src/models/User.ts
```

Purpose:

A user is an authenticated account that owns monitors, alerts, and chat sessions.

Current fields:

- `email`
- `name`
- `password`
- `refreshToken`
- `createdAt`
- `updatedAt`

Relationships:

```txt
User
  has many TripwireConfig
  has many Alert
  has many ChatSession
```

Business meaning:

```txt
User = owner of market-monitoring configuration and generated intelligence.
```

Important rules:

- Email must be unique.
- Password is hashed before storage.
- User can access only their own monitors, alerts, and chat sessions.
- Refresh token must match the latest stored token.

### 2.2 Symbol

Implementation:

```txt
src/models/Symbol.ts
```

Purpose:

A symbol represents a watchable market instrument in YuJiDi's universal symbol registry.

The registry started as a Binance-only crypto symbol list and is being evolved to support Binance crypto, Angel MCX commodities, future NSE/BSE cash equities, FNO contracts, Kite instruments, and other market symbols.

Current fields:

- `provider`
- `marketType`
- `exchange`
- `symbol`
- `name`
- `displayName`
- `providerSymbol`
- `instrumentToken`
- `baseAsset`
- `quoteAsset`
- `instrumentType`
- `expiry`
- `strikePrice`
- `optionType`
- `lotSize`
- `tickSize`
- `requiresBrokerLogin`
- `supportedBroker`
- `status`
- `raw`
- `createdAt`
- `updatedAt`

Business rules:

- Symbol is global reference data, not user-owned data.
- Existing Binance monitor flow still uses symbol strings such as `BTCUSDT`.
- Binance crypto symbols are globally visible and do not require broker login.
- Binance sync writes universal fields with provider `BINANCE`, exchange `BINANCE`, market type `CRYPTO`, and instrument type `SPOT`.
- Angel MCX Scrip Master sync writes universal fields with provider `ANGEL_ONE`, exchange `MCX`, market type `COMMODITY`, and `requiresBrokerLogin=true`.
- Angel Phase 2 defaults to core commodity names: `CRUDEOIL`, `GOLD`, `SILVER`, and `NATURALGAS`.
- Angel/Kite symbols should use provider/exchange/instrument token identity.
- Angel live market data will require user-specific broker login in a later phase.
- Universal symbol search is available for UI discovery.
- Broker-required instruments are visible but blocked from monitor creation until broker login/live market data is implemented.
- During transition, crypto monitor lookup accepts both legacy `TRADING` and universal `ACTIVE` status.

Business meaning:

```txt
Symbol = provider-aware, globally searchable market instrument.
```

Angel MCX sync source:

```txt
https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json
```

### 2.2.1 Instrument

Implementation:

```txt
src/models/Instrument.ts
```

Purpose:

Instrument is the provider-neutral representation of a watchable market object.

It is introduced to support Binance symbols, Angel SmartAPI instruments, and future Kite instruments without forcing provider-specific symbol structures into the analyzer.

Current fields:

- `provider`
- `marketType`
- `exchange`
- `symbol`
- `displayName`
- `instrumentToken`
- `baseAsset`
- `quoteAsset`
- `expiry`
- `lotSize`
- `tickSize`
- `status`
- `raw`

### 2.2.2 BrokerConnection

Implementation:

```txt
src/models/BrokerConnection.ts
```

Purpose:

BrokerConnection is a user-owned scaffold for future broker connectivity state.

Current fields:

- `user`
- `broker`
- `status`
- `scopes`
- `lastConnectedAt`
- `lastError`
- `metadata`

Important boundary:

BrokerConnection currently stores no API keys, PINs, TOTP secrets, feed tokens, JWTs, refresh tokens, or order permissions.
- `createdAt`
- `updatedAt`

Business rules:

- Instrument is additive and does not replace the current `Symbol` model.
- Existing Binance crypto monitor flows still use `Symbol`.
- Future Angel/Kite integrations should map provider-specific instrument masters into `Instrument`.
- Future analyzer bridges should consume `NormalizedMarketTick` rather than raw provider payloads.

### 2.3 TripwireConfig / Monitor

Implementation:

```txt
src/models/TripwireConfig.ts
```

Purpose:

A monitor is a user-defined market detection rule.

Current fields:

- `user`
- `symbol`
- `thresholdPercentage`
- `timeWindowMinutes`
- `isActive`
- `trigger`
- `createdAt`
- `updatedAt`

Supported trigger values:

```txt
drop
spike
```

Business meaning:

```txt
Monitor = user-owned rule that decides when a market movement matters.
```

Example:

```txt
If BTCUSDT drops 2.5% in 5 minutes, create an alert.
```

Current behavior:

The schema, UI, and analyzer support both `drop` and `spike` monitors.

### 2.4 Alert

Implementation:

```txt
src/models/Alert.ts
```

Purpose:

An alert is a persisted AI-enriched record of a triggered monitor event.

Current fields:

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

Business meaning:

```txt
Alert = generated market intelligence created after a monitor breach.
```

Important current limitation:

The alert model keeps `dropPercentage` for backward compatibility, but new alerts also store direction-neutral movement fields:

```txt
changePercentage
triggerType
direction
```

### 2.5 ChatSession

Implementation:

```txt
src/models/chatSession.ts
```

Purpose:

A chat session stores a user's copilot conversation for a specific symbol.

Current fields:

- `user`
- `symbol`
- `messages`
- `createdAt`
- `updatedAt`

Message fields:

- `role`
- `content`
- `timestamp`

Business meaning:

```txt
ChatSession = symbol-specific memory for the AI copilot.
```

### 2.6 PriceTick

Implementation:

```txt
src/services/analyzer.service.ts
```

Purpose:

An in-memory market price observation.

Current shape:

```ts
{
  price: number;
  timestamp: number;
}
```

Business meaning:

```txt
PriceTick = one point in live market history.
```

### 2.7 CvdTrade

Implementation:

```txt
src/services/analyzer.service.ts
```

Purpose:

An in-memory trade delta used for cumulative volume delta.

Current shape:

```ts
{
  volumeDelta: number;
  timestamp: number;
}
```

Business meaning:

```txt
CvdTrade = one trade's contribution to recent buy/sell pressure.
```

### 2.8 OrderBookSnapshot

Implementation:

```txt
src/services/analyzer.service.ts
```

Purpose:

The latest visible order-book levels for a symbol.

Current shape:

```ts
{
  bids: string[][];
  asks: string[][];
}
```

Business meaning:

```txt
OrderBookSnapshot = visible liquidity context for support/resistance detection.
```

## 3. Relationships

```txt
User 1 -> many TripwireConfig
User 1 -> many Alert
User 1 -> many ChatSession

Symbol 1 -> many TripwireConfig
Symbol 1 -> many Alert
Symbol 1 -> many ChatSession

TripwireConfig 1 -> many possible Alert over time
```

Important ownership boundary:

```txt
User-owned records must always be queried with user identity.
```

This applies to:

- monitors
- alerts
- chat sessions

## 4. Main Workflows

### 4.1 Registration

```txt
user submits name/email/password
  -> validate
  -> hash password
  -> create user
  -> seed default monitors
  -> clone recent alerts if available
```

### 4.2 Login

```txt
user submits email/password
  -> compare password hash
  -> issue access token
  -> issue refresh token
  -> store refresh token
  -> set HTTP-only cookies
```

### 4.3 Create Monitor

```txt
user selects symbol, trigger, threshold, window
  -> validate request
  -> verify supported symbol
  -> create TripwireConfig
  -> frontend subscribes to symbol
```

### 4.4 Alert Generation

```txt
Binance aggTrade arrives
  -> analyzer updates price buffer and CVD
  -> active monitors are evaluated
  -> threshold breach detected
  -> cooldown starts
  -> news fetched
  -> support/resistance calculated
  -> Groq report generated
  -> alert saved
  -> NEW_ALERT emitted to owning user
```

### 4.5 Copilot Chat

```txt
user prompt arrives
  -> backend fetches live CVD and order book
  -> backend calculates deterministic trade math
  -> recent chat history is loaded
  -> LLM classifies general/trade intent
  -> response is saved and returned
```

## 5. State Machines

### 5.1 User Session

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

### 5.2 Monitor

Current persisted state:

```txt
isActive = true | false
```

Domain state:

```txt
Active / Watching
  -> threshold breached
Triggered
  -> cooldown set
Cooling Down
  -> cooldown expires
Active / Watching
```

Suggested future persisted state:

```txt
active
paused
deleted
```

### 5.3 Alert

Current implicit state:

```txt
Detected
  -> Analyzing
  -> Stored
  -> Delivered if user online
```

Current implementation stores successful alerts only.

Suggested future state:

```txt
detected
analyzing
ready
delivered
failed
```

### 5.4 WebSocket Subscription

```txt
Disconnected
  -> authenticated user opens socket
Connected
  -> UPDATE_SUBSCRIPTIONS
Subscribed
  -> client closes/logout
Disconnected
```

### 5.5 Binance Symbol Tracking

```txt
Untracked
  -> first user subscribes
Wanted
  -> Binance SUBSCRIBE sent
Active
  -> last user unsubscribes
No Longer Wanted
  -> Binance UNSUBSCRIBE sent
Untracked
```

## 6. Business Rules

### 6.1 User Rules

- A user must authenticate before accessing protected routes.
- A user can access only records they own.
- Refresh token rotation requires token equality with the stored refresh token.

### 6.2 Symbol Rules

- Synced Binance `USDT` symbols with legacy `TRADING` or universal `ACTIVE` status can be monitored.
- Universal symbols can be searched by provider, market type, exchange, and text query.
- Broker-required symbols cannot be monitored until broker login/live data support exists.
- Symbol input should be normalized to uppercase.

### 6.3 Monitor Rules

- Monitor must belong to one user.
- Monitor must reference one supported symbol.
- Monitor may store universal metadata such as provider, market type, exchange, instrument token, display name, and broker requirement.
- Threshold must be positive.
- Time window must be positive.
- Trigger must be `drop` or `spike`.
- New monitors are active by default.
- Active monitors are eligible for analyzer evaluation.

### 6.4 Analyzer Rules

- Invalid prices are rejected.
- A monitor cannot trigger without enough historical price data.
- A monitor in cooldown is skipped.
- Drop trigger should fire on movement below negative threshold.
- Spike trigger should fire on movement above positive threshold.

### 6.5 Alert Rules

- Alert belongs to one user.
- Alert should be generated only after a monitor breach.
- AI report must be valid structured JSON before storage.
- Alert is emitted only to the owning user.

### 6.6 Copilot Rules

- Backend calculates trade math.
- LLM explains, approves, or vetoes.
- Deterministic veto conditions should not be overridden by the LLM in future hardening.

## 7. Domain Gaps

High-priority gaps:

1. Add automated regression tests for spike and drop analyzer behavior.
2. Complete the alert-field migration by eventually removing legacy `dropPercentage`.
3. Monitor max window should match analyzer buffer length.
4. User ID access should be normalized as `req.user.id`.
5. Failed alert attempts are not represented in the domain.
6. Monitor lifecycle is currently reduced to `isActive`.
7. Refresh token is stored directly instead of hashed.

## 8. Glossary

### Monitor / Tripwire

A user-defined rule that watches one symbol for one movement condition.

### Symbol

A Binance market pair, such as `BTCUSDT`.

### CVD

Cumulative volume delta, a recent measure of aggressive buy/sell pressure.

### Support Wall

A large visible bid-side liquidity level detected from the order book.

### Resistance Wall

A large visible ask-side liquidity level detected from the order book.

### Alert

An AI-enriched record created when a monitor condition is triggered.

### Copilot

The chat feature that combines live engine data, deterministic risk math, and LLM explanation.
