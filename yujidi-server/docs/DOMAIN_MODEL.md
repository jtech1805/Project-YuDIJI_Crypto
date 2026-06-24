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
- `searchName`
- `searchSymbol`
- `searchDisplayName`
- `searchProviderSymbol`
- `searchTokens`
- `autocompleteTokens`
- `searchRank`
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
- Universal symbol search uses normalized token fields and indexed autocomplete tokens.
- Frontend symbol pickers should search `GET /api/symbols/search` instead of loading the full symbol collection.
- Search results should expose safe reference fields only and must not expose provider `raw` payloads.
- Monitor creation should prefer `symbolId` from search results so backend can store provider/exchange/instrument snapshots.
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

BrokerConnection is a user-owned broker connectivity record. For Angel One, it verifies the user's SmartAPI login, stores broker credentials encrypted at rest, stores session tokens encrypted at rest, and exposes safe connection status to the product.

Current fields:

- `user`
- `broker`
- `status`
- `clientCode`
- `encryptedApiKey`
- `encryptedPin`
- `encryptedTotpSecret`
- `session.encryptedJwtToken`
- `session.encryptedRefreshToken`
- `session.encryptedFeedToken`
- `session.expiresAt`
- `session.lastLoginAt`
- `session.lastRefreshAt`
- `permissions.marketData`
- `permissions.orderPlacement`
- `permissions.portfolioRead`
- `lastError`
- `lastVerifiedAt`

Important boundary:

BrokerConnection never stores raw API keys, PINs, TOTP secrets, feed tokens, JWTs, or refresh tokens. API responses never return encrypted fields. Order placement remains disabled.

Business rules:

- User owns BrokerConnection.
- Symbol is global reference data and is not user-owned.
- BrokerConnection enables future live provider access for symbols requiring login.
- Current permissions default to `marketData=true`, `orderPlacement=false`, and `portfolioRead=false`.
- `createdAt`
- `updatedAt`

Business rules:

- Instrument is additive and does not replace the current `Symbol` model.
- Existing Binance crypto monitor flows still use `Symbol`.
- Future Angel/Kite integrations should map provider-specific instrument masters into `Instrument`.
- Future analyzer bridges should consume `NormalizedMarketTick` rather than raw provider payloads.

### 2.2.3 MarketQuote / NormalizedMarketSnapshot

Implementation:

```txt
src/types/market-data.types.ts
src/services/market-quote.service.ts
src/integrations/market-data/angel/angel-quote.service.ts
src/integrations/market-data/angel/angel-quote.mapper.ts
```

Purpose:

MarketQuote is a read-only, on-demand market snapshot. In Angel Phase 4, YuJiDi can fetch a single Angel quote using the logged-in user's active BrokerConnection and normalize the provider payload into `NormalizedMarketSnapshot`.

Current fields:

- `provider`
- `marketType`
- `exchange`
- `symbolId`
- `symbol`
- `displayName`
- `providerSymbol`
- `instrumentToken`
- `mode`
- `ltp`
- `open`
- `high`
- `low`
- `close`
- `tradeVolume`
- `openInterest`
- `netChange`
- `percentChange`
- `depth`
- `raw`

Business rules:

- Quote access is read-only.
- Quote access requires authenticated YuJiDi user.
- Angel quote access requires an active user-owned Angel BrokerConnection.
- Global `Symbol` records provide reference identity only.
- Quote data is not persisted by default.
- Quote response must not include Angel API key, JWT, refresh token, feed token, PIN, TOTP, or encrypted fields.
- Binance quote support is not implemented in this endpoint yet.
- Quote API is not an order signal and is not connected to monitor/analyzer workflows yet.

### 2.2.4 MarketSubscription / AngelUserMarketDataSession

Implementation:

```txt
src/services/market-subscription-resolver.service.ts
src/services/market-subscription-router.service.ts
src/services/websocket.service.ts
src/services/angel-user-market-data-session.service.ts
src/integrations/market-data/angel/angel-market-data.provider.ts
src/integrations/market-data/angel/angel-ltp-packet.parser.ts
src/utils/market-subscription-key.ts
```

Purpose:

MarketSubscription represents a provider-aware live data subscription. In Angel Phase 6B, the existing frontend WebSocket subscription message can subscribe to Binance crypto symbols and Angel MCX commodity symbols using the same YuJiDi symbol-string contract.

Current behavior:

- Frontend sends symbol strings such as `BTCUSDT` or `MCX:GOLD:05APR2027:FUTURE`.
- Backend resolves each symbol through the global universal `Symbol` collection.
- Resolver builds `ResolvedMarketSubscription` metadata and provider-aware subscription keys.
- Router sends Binance subscriptions to the shared Binance master socket.
- Router sends Angel MCX subscriptions to a user-specific Angel WebSocket session.
- Angel sessions are user-specific.
- Active Angel BrokerConnection is required.
- Broker credentials and tokens are decrypted only inside backend service code when opening the stream.
- Binance subscription key format is `BINANCE:BINANCE:<symbol>`.
- Subscription key format is `ANGEL_ONE:<userId>:MCX:<instrumentToken>`.
- MCX uses Angel `exchangeType = 5`.
- LTP mode uses Angel `mode = 1`.
- Heartbeat sends `ping` every 30 seconds.
- Incoming binary LTP packets are parsed and normalized into `NormalizedMarketTick`.
- Normal product flow returns `SUBSCRIPTION_UPDATE_RESULT` and forwards Angel ticks as `MARKET_TICK`.
- Protected debug subscribe/unsubscribe/status routes still exist for backend verification.
- Angel `NormalizedMarketTick` is also sent into the analyzer once per provider session tick.
- Analyzer processing is asynchronous and must not block frontend tick delivery.

Normalized tick fields:

- `provider`
- `scope`
- `userId`
- `marketType`
- `exchange`
- `symbol`
- `displayName`
- `providerSymbol`
- `instrumentToken`
- `price`
- `timestamp`
- `raw`

Important boundary:

The frontend must not connect directly to Angel and must not send Angel credentials, JWTs, feed tokens, exchange types, or modes. Angel WebSocket LTP streaming now feeds analyzer alert generation, but it does not place orders or provide trade execution.

### 2.2.5 Provider-Aware Analyzer Identity

Analyzer identity follows the market-data scope:

- Binance crypto ticks are global and use `BINANCE:BINANCE:<symbol>` for provider-aware subscription identity, while the legacy analyzer path still supports symbol-keyed processing for existing crypto monitors.
- Angel MCX ticks are user-session scoped and use `ANGEL_ONE:<userId>:MCX:<instrumentToken>` for analyzer price buffers, CVD buffers, and active-monitor cache.
- Angel monitor lookup uses user + provider + exchange + instrument token.
- Angel tick for user A must never evaluate user B's monitor.

Angel alert metadata:

- `monitor`
- `displayName`
- `provider`
- `marketType`
- `exchange`
- `instrumentToken`
- `providerSymbol`
- `currentPrice`
- `previousPrice`

The existing drop/spike rules are reused for Angel alerts. There is no separate Angel alert engine.

### 2.3 TripwireConfig / Monitor

Implementation:

```txt
src/models/TripwireConfig.ts
```

Purpose:

A monitor is a user-defined market detection rule.

Current fields:

- `user`
- `symbolId`
- `symbol`
- `provider`
- `marketType`
- `exchange`
- `displayName`
- `providerSymbol`
- `instrumentToken`
- `instrumentType`
- `requiresBrokerLogin`
- `supportedBroker`
- `thresholdPercentage`
- `timeWindowMinutes`
- `isActive`
- `trigger`
- `createdAt`
- `updatedAt`

Supported trigger values:

```txt
dropo
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

Universal symbol behavior:

- Old Binance monitor creation by `symbol` remains supported.
- New monitor creation can use `symbolId`.
- When `symbolId` is used, the monitor stores a snapshot of the selected global `Symbol`.
- Binance symbols do not require broker login.
- Angel MCX symbols require an active user-owned Angel BrokerConnection.
- Broker credentials are not decrypted during monitor creation.
- Analyzer still primarily uses the legacy `symbol` string until provider-aware monitor processing is implemented in a later phase.

Relationship:

```txt
User
  -> owns Monitor

Monitor
  -> stores Symbol snapshot

Symbol
  -> global reference data

BrokerConnection
  -> required for provider-gated symbols such as Angel MCX
```

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
- Universal symbol search requires at least two query characters and caps results to prevent large accidental responses.
- Expired instruments are excluded from symbol search unless explicitly requested.
- Search ranking should favor exact matches, prefix matches, active contracts, spot/cash/future instruments, and configured `searchRank`.
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

## 7. Future Trade/Risk Domain Model

This section defines the accepted MVP trade/risk lifecycle domain. These entities are planned and should be implemented beside the existing Monitor/Tripwire system.

### 7.0 Phase 1 Foundation Status

Implemented foundation files:

- `src/types/trade.types.ts`
- `src/types/risk.types.ts`
- `src/types/scoring.types.ts`
- `src/types/monitoring.types.ts`
- `src/types/audit.types.ts`
- `src/models/audit-log.model.ts`
- `src/models/trade-plan.model.ts`
- `src/models/capital-adjustment-event.model.ts`
- `src/models/trade-plan-risk-state.model.ts`
- `src/models/user-daily-risk-state.model.ts`
- `src/models/score-check.model.ts`
- `src/models/trade-score-snapshot.model.ts`
- `src/models/trade-setup.model.ts`
- `src/services/audit-sanitizer.service.ts`
- `src/services/audit-log.service.ts`
- `src/services/symbol-resolver.service.ts`
- `src/services/trade-plan.service.ts`
- `src/services/scoring-engine.service.ts`
- `src/services/score-check.service.ts`
- `src/services/risk-governor.service.ts`
- `src/services/trade-setup.service.ts`
- `src/models/active-trade.model.ts`
- `src/services/active-trade.service.ts`
- `src/models/trade-event.model.ts`
- `src/services/trade-event.service.ts`
- `src/services/trade-monitoring.service.ts`
- `src/models/trade-result.model.ts`
- `src/services/trade-result.service.ts`
- `src/services/risk-state-projection.service.ts`
- `src/controllers/trade-plan.controller.ts`
- `src/controllers/score-check.controller.ts`
- `src/controllers/trade-setup.controller.ts`
- `src/controllers/active-trade.controller.ts`
- `src/controllers/trade-event.controller.ts`
- `src/controllers/trade-monitoring.controller.ts`
- `src/controllers/trade-result.controller.ts`
- `src/routes/trade-plan.routes.ts`
- `src/routes/score-check.routes.ts`
- `src/routes/trade-setup.routes.ts`
- `src/routes/active-trade.routes.ts`
- `src/routes/trade-event.routes.ts`
- `src/routes/trade-result.routes.ts`

Implemented behavior:

- Shared domain vocabularies exist for trade permission, direction, risk mode, P&L basis, score mode, monitoring severity, and audit actors/entities.
- `AuditLog` exists as the append-oriented persistence foundation for future critical trade/risk/provider/symbol/AI/RAG events.
- Audit payloads are sanitized before persistence.
- Canonical symbol resolution exists for provider/exchange/instrument data.
- TradePlan lifecycle foundation exists for DRAFT creation, DRAFT-only updates, activation, pause, stop, complete, archive, and capital adjustment.
- TradePlan activation initializes `TradePlanRiskState` idempotently.
- UserDailyRiskState persistence model exists, but daily projection behavior is still future work.
- Standalone ScoreCheck foundation exists for pre-trade scoring without a TradePlan.
- ScoreCheck uses canonical `Symbol` by `symbolId` and stores a symbol snapshot.
- ScoreCheck validates LONG/SHORT geometry and stores risk/reward/RR math.
- Baseline scoring maps reward/risk bands to score-level permission.
- TradeScoreSnapshot stores deterministic scoring output for replay/audit.
- TradeSetup foundation exists for converting ScoreCheck into managed planned trade setup.
- RiskGovernor foundation exists for final managed permission calculation.
- RiskGovernor reads risk state but does not mutate it.
- ActiveTrade foundation exists for user-confirmed actual executions from approved TradeSetup records.
- ActiveTrade stores actual/current values while preserving TradeSetup planned values.
- Actual LONG/SHORT geometry, risk, reward, risk amount, RR, execution quality, and rule violations are deterministic.
- Successful confirmation marks the TradeSetup `EXECUTED`.
- ActiveTrade confirmation and cancellation are audited.
- TradeEvent persistence and deterministic ActiveTrade monitoring foundation exist.
- Manual/synthetic prices can evaluate current stoploss, targets, +1R, and near-stop conditions.
- Event creation is idempotent per ActiveTrade and event type.
- Monitoring evaluations and event creation/dedupe are audited.
- TradeResult is the official finalized close outcome.
- Manual close calculates P&L, realized R, and result type from ActiveTrade actual values.
- Finalized TradeResult is the only Phase 7 input allowed to mutate risk state.
- Risk projection updates TradePlanRiskState and UserDailyRiskState idempotently.
- TradeJournal stores deterministic lifecycle facts separately from user reflection.
- Journal creation is idempotent per finalized TradeResult.
- Reflection updates are explicitly whitelisted.
- Journal finalization and archive are audited.

Not implemented yet:

- Live market-tick integration for TradeEvent monitoring.
- AI trade/risk review.
- RAG ingestion.
- Order placement/modification/cancellation.

Boundary:

The Phase 1/2/3/4/5/6/7/8 foundation is additive. It does not change existing monitor, analyzer, WebSocket, auth, Binance, or Angel live-data behavior.

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

Authority rules:

- RiskGovernor has final authority for managed trade permission.
- AI cannot decide, calculate, override, or mutate risk/trade decisions.
- Journal and AI cannot update risk state.
- TradeResult updates RiskState and Journal.
- Order placement is deferred in MVP.
- Existing `Symbol` is canonical market identity.
- Provider tokens are mapping fields only.
- Provider credentials/tokens never enter trade-domain models.

Permission values:

```txt
TAKE_TRADE
TAKE_SMALL_RISK
WAIT
REJECT
STOP_TRADING
```

Do not use final product permission labels such as `BUY`, `SELL`, `STRONG_BUY`, or `STRONG_SELL`.

### 7.1 TradePlan

Purpose:

A user-owned risk plan that defines the allowed trade lifecycle scope.

Key fields:

- `userId`
- `name`
- `description`
- `marketType`
- `tradeStyle`
- `instrumentType`
- `planMode`
- `status`
- `startingCapital`
- `currentCapital`
- `currency`
- `maxRiskPerTradePercent`
- `maxDailyLossPercent`
- `maxConsecutiveLosses`
- `maxTrades`
- template keys and versions for scoring, risk, and monitoring
- `createdAt`
- `updatedAt`

Rules:

- Managed trades require a TradePlan.
- TradePlan is dynamic and not fixed to a hardcoded number of trades.
- TradePlan should store risk template references and snapshots used for scoring/risk decisions.
- TradePlan starts in `DRAFT`.
- Only `DRAFT` TradePlans can be activated.
- Only `DRAFT` TradePlans can be updated in the current MVP foundation.
- Core risk fields are locked after activation.
- `ACTIVE` TradePlans can be paused.
- `ACTIVE` or `PAUSED` TradePlans can be stopped or completed.
- `DRAFT`, `STOPPED`, or `COMPLETED` TradePlans can be archived.
- Multiple active plans are allowed only when their risk bucket does not conflict.
- Risk bucket key is derived from `userId + marketType + tradeStyle + instrumentType`.

Current API:

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

### 7.2 CapitalAdjustmentEvent

Purpose:

Represents deposits, withdrawals, manual corrections, fees, and other capital changes that affect risk base.

Rules:

- Must be user-scoped.
- Must be auditable.
- Should use idempotency keys for broker/import sync.
- Current MVP capital adjustments create an event and update TradePlan `currentCapital`.
- `DEPOSIT` and `TRANSFER_IN` increase capital.
- `WITHDRAWAL` and `TRANSFER_OUT` decrease capital.
- `MANUAL_CORRECTION` applies the signed adjustment amount.

### 7.3 ScoreCheck

Purpose:

A deterministic evaluation of a trade idea.

Rules:

- Standalone ScoreCheck is allowed.
- Managed trade conversion requires a TradePlan.
- Scoring must be direction-aware.
- Separate scoring strategies should exist for intraday, swing, crypto spot, and crypto perpetual contexts.
- Providers supply raw data; YuJiDi owns scoring logic.
- Current Phase 3 ScoreCheck is standalone and does not require TradePlan.
- ScoreCheck cannot start monitoring.
- ScoreCheck cannot update `TradePlanRiskState` or `UserDailyRiskState`.
- ScoreCheck cannot create ActiveTrade.
- ScoreCheck does not call AI for decisions.
- ScoreCheck uses score-level permission only; RiskGovernor final permission comes later.
- Output permission language is `TAKE_TRADE`, `TAKE_SMALL_RISK`, `WAIT`, `REJECT`, or `STOP_TRADING`.
- Do not use `BUY`, `SELL`, `STRONG_BUY`, or `STRONG_SELL`.

Current geometry rules:

```txt
LONG:  stopLoss < entry < target1
SHORT: target1 < entry < stopLoss
```

Current trade math:

```txt
LONG:
  riskPerUnit = entry - stopLoss
  rewardPerUnit = target1 - entry

SHORT:
  riskPerUnit = stopLoss - entry
  rewardPerUnit = entry - target1

rewardRiskRatio = rewardPerUnit / riskPerUnit
```

Current baseline scoring:

```txt
RR < 1        -> score 30, permission REJECT
RR >= 1 <1.5 -> score 50, permission WAIT
RR >= 1.5 <2 -> score 70, permission TAKE_SMALL_RISK
RR >= 2      -> score 80, permission TAKE_TRADE
```

Current API:

```txt
POST /api/score-checks
GET /api/score-checks
GET /api/score-checks/:id
```

### 7.4 TradeSetup

Purpose:

Stores planned trade values before activation.

Examples:

- planned direction
- planned entry
- planned stop
- planned targets
- planned quantity/risk
- planned invalidation

Rules:

- TradeSetup is not the same as ActiveTrade.
- TradeSetup values are planned values and must be preserved for review.
- TradeSetup requires an `ACTIVE` TradePlan.
- TradeSetup may be created from one ScoreCheck.
- TradeSetup stores the referenced TradeScoreSnapshot.
- TradeSetup stores RiskGovernor final managed decision.
- TradeSetup cannot mutate risk state.
- TradeSetup cannot start monitoring.
- TradeSetup cannot place orders.
- Current Phase 4 conversion rejects already-converted ScoreChecks.
- Current Phase 4 conversion rejects expired ScoreChecks.
- Current Phase 4 conversion requires TradePlan `marketType`, `tradeStyle`, and `instrumentType` to match ScoreCheck.
- Current Phase 4 `APPROVED` means final permission is `TAKE_TRADE` or `TAKE_SMALL_RISK`.
- Current Phase 4 `REJECTED` covers `WAIT`, `REJECT`, and `STOP_TRADING`.

Current API:

```txt
POST /api/score-checks/:id/convert-to-trade-setup
GET /api/trade-setups
GET /api/trade-setups/:id
POST /api/trade-setups/:id/cancel
GET /api/trade-plans/:id/trade-setups
```

Current RiskGovernor baseline:

```txt
TradePlan not ACTIVE -> REJECT
TradePlanRiskState STOP_TRADING -> STOP_TRADING
UserDailyRiskState stopTradingTriggered -> STOP_TRADING
Score permission REJECT -> REJECT
planned RR < 1 -> REJECT
MICRO_RISK or REDUCED_RISK -> cap TAKE_TRADE to TAKE_SMALL_RISK
NORMAL_RISK + TAKE_TRADE -> TAKE_TRADE
TAKE_SMALL_RISK -> TAKE_SMALL_RISK
WAIT -> WAIT
maxTrades reached -> REJECT
consecutive loss limit reached -> STOP_TRADING
```

### 7.5 TradeScoreSnapshot

Purpose:

Immutable snapshot of scoring context used for a ScoreCheck or TradeSetup.

Rules:

- Store score inputs/outputs needed for audit and replay.
- Do not store large raw provider payloads.
- Store references to heavy data when needed.
- Current Phase 3 snapshots are created from standalone ScoreCheck.
- Snapshot stores score, permission, score status, data confidence, breakdown, reason codes, warnings, input hash, calculated time, and validity time.

### 7.6 TradePlanRiskState

Purpose:

Current risk state for one TradePlan.

Examples:

- realized net P&L
- open risk
- remaining daily risk
- number of active trades
- loss streak
- STOP_TRADING state

Rules:

- Updated by RiskStateProjectionService from TradeResult and risk events.
- Must prefer net P&L when available.
- Current Phase 2 behavior initializes this state on TradePlan activation.
- Initialization is idempotent using unique `{ userId, tradePlanId }`.
- Initial risk mode is `NORMAL_RISK`.
- Initial counters and P&L values are zero.

### 7.7 UserDailyRiskState

Purpose:

Aggregated per-user, per-day risk state across plans and markets.

Rules:

- Can place user into STOP_TRADING.
- Must be idempotently projected.
- Must not be updated by AI or journal code.
- Current Phase 2 behavior adds the persistence model and unique `{ userId, riskBucketKey, dateKey }` index.
- Daily projection updates are still future work.

### 7.8 ActiveTrade

Purpose:

Stores actual/current trade values after activation.

Examples:

- actual entry
- actual quantity
- current stop
- current targets
- current mark price
- current risk
- status

Rules:

- ActiveTrade stores actual/current values, separate from planned TradeSetup values.
- ActiveTrade is created only from a user-owned `APPROVED` TradeSetup.
- Final permission must be `TAKE_TRADE` or `TAKE_SMALL_RISK`.
- `WAIT`, `REJECT`, and `STOP_TRADING` cannot execute.
- Expired score validity rejects confirmation.
- Actual LONG geometry requires `initialStopLoss < actualEntry < actualTarget1`.
- Actual SHORT geometry requires `actualTarget1 < actualEntry < initialStopLoss`.
- Actual RR below `1` rejects confirmation.
- Stop widening, degraded RR, and actual risk above planned risk are recorded without mutating planned values.
- ActiveTrade starts with status `ACTIVE`.
- `currentStopLoss` starts from the confirmed `initialStopLoss`.
- `remainingQuantity` starts from the confirmed `actualQuantity`.
- ActiveTrade can be cancelled only while status is `ACTIVE`.
- ActiveTrade does not update TradePlanRiskState or UserDailyRiskState.
- Later ActiveTrade monitoring must use deterministic rules, not AI.
- Order placement is not part of MVP.

Execution sources:

```txt
MANUAL_CONFIRMATION
BROKER_SYNC_ASSISTED
```

Execution-quality vocabulary:

```txt
AS_PLANNED
LATE_ENTRY
EARLY_ENTRY
DEGRADED_RR
EXCEEDED_APPROVED_RISK
STOPLOSS_CHANGED
QUANTITY_CHANGED
MANUAL_OVERRIDE
```

Current API:

```txt
POST /api/trade-setups/:id/confirm-actual-trade
GET /api/active-trades
GET /api/active-trades/:id
POST /api/active-trades/:id/cancel
GET /api/trade-plans/:id/active-trades
```

Current boundary:

- No broker fill auto-linking.
- No live MonitoringRuleEngine WebSocket hook.
- No TradeResult.
- No risk-state projection.
- No order placement, modification, or cancellation.

### 7.9 TradeEvent

Purpose:

Structured lifecycle event for an ActiveTrade.

Examples:

- activated
- stop moved
- target reached
- risk reduced
- invalidation warning
- manual note
- closed

Rules:

- Must be append-oriented.
- Must be auditable.
- Is user-owned and linked to ActiveTrade, TradePlan, canonical symbol, and symbol snapshot.
- Uses actual entry, current stoploss, actual targets, and actual risk per unit.
- Evaluates LONG and SHORT rules direction-aware.
- Uses `${activeTradeId}:${eventType}` idempotency for the Phase 6 baseline.
- Audits `MONITORING_EVALUATED` rather than persisting it for every price.
- Does not close ActiveTrade.
- Does not create TradeResult or mutate risk state.
- Does not use AI for event detection.

Current detected events:

```txt
PRICE_NEAR_SL
SL_HIT
PLUS_ONE_R_HIT
TARGET_1_HIT
TARGET_2_HIT
```

Current API:

```txt
POST /api/active-trades/:id/evaluate
GET /api/trade-events
GET /api/trade-events/:id
GET /api/active-trades/:id/events
```

### 7.10 TradeResult

Purpose:

Represents the outcome of a trade or partial close.

Rules:

- Is the official source of closed trade outcome.
- Is finalized only through manual confirmation in Phase 7.
- Uses ActiveTrade actual entry, remaining quantity, and actual risk amount.
- Supports full close only in Phase 7.
- Uses `CONFIRMED_NET` when net P&L is supplied.
- Uses `ESTIMATED_NET` when charges can be deducted from gross P&L.
- Uses `GROSS_FALLBACK` with a warning when net P&L and charges are unavailable.
- Marks STOPLOSS exits `STOPPED_OUT`; other exits become `CLOSED`.
- Updates RiskState only through RiskStateProjectionService.
- Projection increments trade/result counts, P&L, realized R, and consecutive losses.
- Projection can trigger plan STOP_TRADING from consecutive losses.
- Projection can trigger daily STOP_TRADING from daily loss limit.
- Duplicate projection does not double-count.
- Does not create TradeJournal or call AI.

Current API:

```txt
POST /api/active-trades/:id/close
GET /api/trade-results
GET /api/trade-results/:id
GET /api/active-trades/:id/result
GET /api/trade-plans/:id/trade-results
```

### 7.11 TradeJournal

Purpose:

Structured journal record for trade review.

Rules:

- Store structured facts first.
- AI summary is derived second.
- Journal cannot mutate RiskState.
- One journal exists per finalized TradeResult.
- System facts are copied from TradeResult, ActiveTrade, TradeSetup, and TradeEvents.
- System facts and linked IDs are not user-editable.
- User reflection fields are updated through a strict allowlist.
- Finalization requires entry quality, exit quality, outcome quality, followed-plan choice, and mistake tags.
- Phase 9 may populate only `aiSummary`, `aiReviewId`, and `aiGeneratedAt`.
- Journal cannot mutate TradeResult.

Current API:

```txt
POST /api/trade-results/:id/journal
GET /api/trade-journals
GET /api/trade-journals/:id
GET /api/trade-results/:id/journal
GET /api/active-trades/:id/journal
PATCH /api/trade-journals/:id
POST /api/trade-journals/:id/finalize
POST /api/trade-journals/:id/archive
POST /api/trade-journals/:id/ai-review
GET /api/trade-journals/:id/ai-review
```

### 7.12 AiExplanation

Purpose:

Stores AI explanations, coaching notes, and reviews.

Rules:

- Phase 9 implements `POST_TRADE_REVIEW` for finalized TradeJournal records.
- AiExplanation is user-owned and linked to its source.
- The exact backend-prepared context is SHA-256 hashed.
- Prompt and schema versions are persisted.
- Context is an explicit allowlist of journal facts; it excludes credentials, tokens, raw provider payloads, raw ticks, candles, and order books.
- AI output is stored only after structural and semantic validation.
- Invalid or unavailable model output produces a deterministic fallback explanation.
- TradeJournal receives only the explanation reference, summary, and generated timestamp.
- AI cannot decide permission.
- AI cannot score a trade or change deterministic P&L.
- AI cannot mutate TradeResult, journal facts, or risk state.
- Recommendation terms and order instructions are rejected.

Current API:

```txt
GET /api/ai-explanations/:id
```

### 7.13 RagDocument

Purpose:

Verified knowledge/summaries used for AI context.

Rules:

- Store verified knowledge, playbook summaries, and curated lessons.
- Do not store raw ticks, candles, order book snapshots, provider payloads, or secrets.

### 7.14 AuditLog

Purpose:

Append-only record of critical system decisions and state changes.

Must cover:

- risk permission decisions
- STOP_TRADING transitions
- TradePlan changes
- TradeSetup activation
- ActiveTrade lifecycle events
- TradeResult projection
- Broker/provider sync
- symbol resolution
- AI/RAG events

Rules:

- Must sanitize secrets and provider tokens.
- Must be idempotent where triggered from retryable workers.
- Must include actor/source where possible.

### 7.15 Symbol And BrokerConnection Notes

Symbol:

- Existing `Symbol` collection is canonical market identity.
- New trade/risk models should reference `symbolId`.
- Provider token/symbol fields are mapping fields only.
- Do not use provider token as domain identity.

BrokerConnection:

- User-owned BrokerConnection remains the provider login/session boundary.
- Broker login is allowed.
- Order placement/modification/cancellation remains disabled in MVP.
- Provider credentials/tokens must not be copied into trade-domain records.

## 8. Domain Gaps

High-priority gaps:

1. Add automated regression tests for spike and drop analyzer behavior.
2. Complete the alert-field migration by eventually removing legacy `dropPercentage`.
3. Monitor max window should match analyzer buffer length.
4. User ID access should be normalized as `req.user.id`.
5. Failed alert attempts are not represented in the domain.
6. Monitor lifecycle is currently reduced to `isActive`.
7. Refresh token is stored directly instead of hashed.

## 9. Glossary

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
