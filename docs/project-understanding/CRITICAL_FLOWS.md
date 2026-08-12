# YuJiDi Critical Flows

This file is the top-level data-flow map for YuJiDi. It focuses on user journeys and event-driven architecture.

Detailed service-flow documents:

- [WebSocket Service Flow](./WEBSOCKET_SERVICE_FLOW.md)
- [Scoring Template Service Flow](./SCORING_TEMPLATE_SERVICE_FLOW.md)
- [Trade Monitoring Service Flow](./TRADE_MONITORING_SERVICE_FLOW.md)

Supporting maps:

- [Route Map](./ROUTE_MAP.md)
- [Domain Map](./DOMAIN_MAP.md)
- [Data Model Map](./DATA_MODEL_MAP.md)
- [Frontend Map](./FRONTEND_MAP.md)
- [Debug Playbook](./DEBUG_PLAYBOOK.md)
- [Architecture Guardrails](./ARCHITECTURE_GUARDRAILS.md)

## Mental Model

YuJiDi has two kinds of flows:

1. Request/response flows: user clicks a button, frontend calls an HTTP route, backend validates and writes/reads MongoDB.
2. Event-driven flows: exchange ticks arrive asynchronously, update runtime state, emit WebSocket payloads, generate alerts, and evaluate active trades.

```txt
HTTP user journey
  -> route
  -> controller
  -> service
  -> model
  -> response

Market event journey
  -> provider socket
  -> normalized tick
  -> snapshot/analyzer/monitoring
  -> persisted event or WebSocket payload
```

## Route-To-Service Flow

```mermaid
flowchart TD
  UI[Frontend] --> API[Express app.ts]
  API --> MW[Middleware: CORS, JSON, cookies, request logger]
  MW --> Auth[requireAuth where needed]
  Auth --> Route[Route file]
  Route --> Controller[Controller]
  Controller --> Service[Service]
  Service --> Model[Mongoose model]
  Service --> External[External provider if needed]
  Model --> Response[JSON response]
  External --> Response
```

## WebSocket And Market Data Overview

See [WebSocket Service Flow](./WEBSOCKET_SERVICE_FLOW.md) for the deep dive.

```mermaid
flowchart TD
  Browser[Browser WebSocket] --> WS[WebSocketManager]
  WS --> Resolver[MarketSubscriptionResolver]
  Resolver --> Router[MarketSubscriptionRouter]
  Router --> Binance[Binance master socket]
  Router --> Angel[Angel user market session]
  Binance --> WSB[WebSocketManager.handleBinanceMessage]
  Angel --> WSA[WebSocketManager.handleAngelMarketTick]
  WSB --> UI1[TICKER_UPDATE]
  WSA --> UI2[MARKET_TICK]
  WSB --> Snapshot[MarketSnapshotService]
  WSA --> Snapshot
  Snapshot --> TemplateHealth[TemplateMonitoringOrchestrator]
  WSB --> Analyzer[AnalyzerEngine]
  WSA --> Analyzer
  WSB --> LiveMonitor[ActiveTradeLiveMonitorService]
  WSA --> LiveMonitor
```

The frontend uses one YuJiDi WebSocket. The backend decides whether a subscription goes to Binance or Angel.

## Subscription Resolution Flow

```mermaid
sequenceDiagram
  participant UI as Frontend WebSocketContext
  participant WS as WebSocketManager
  participant R as MarketSubscriptionResolver
  participant B as BrokerConnectionService
  participant Router as MarketSubscriptionRouter
  participant Provider as Binance or Angel

  UI->>WS: UPDATE_SUBSCRIPTIONS(symbols)
  WS->>R: resolveSubscription(userId, symbol)
  R->>R: find Symbol by normalized symbol
  R->>R: validate ACTIVE/TRADING
  alt Symbol requires broker login
    R->>B: hasActiveBrokerConnection(userId, broker)
    B-->>R: true or BROKER_LOGIN_REQUIRED
  end
  R-->>WS: provider-aware subscription key
  WS->>WS: increment globalSubscriptionCounts
  WS->>Router: subscribe(userId, resolvedSubscription)
  Router->>Provider: route provider-specific subscribe
  WS-->>UI: SUBSCRIPTION_UPDATE_RESULT
  WS-->>UI: SUBSCRIPTION_ACK
```

Example keys:

```txt
BINANCE:BINANCE:BTCUSDT
ANGEL_ONE:<userId>:MCX:495213
ANGEL_ONE:<userId>:NSE:2885
```

## Binance Live Data Flow

```mermaid
flowchart TD
  B[Binance combined websocket] --> WS[WebSocketManager.handleBinanceMessage]
  WS -->|24hrTicker| Ticker[TICKER_UPDATE to browser]
  WS -->|24hrTicker| Snap[MarketSnapshotService.recordTick]
  Snap --> TMO[TemplateMonitoringOrchestrator.recordSnapshot]
  WS -->|24hrTicker| ATM[ActiveTradeLiveMonitorService.handleTick]
  WS -->|aggTrade| Analyzer[AnalyzerEngine.processTick]
  WS -->|depth20@100ms| Depth[AnalyzerEngine.updateOrderBook]
  Analyzer --> Alert[AlertModel.create + NEW_ALERT]
  ATM --> TradeEvent[TradeMonitoringService + TradeEvent]
```

Binance stream usage:

- `ticker`: dashboard live rate, snapshot service, active-trade monitoring.
- `aggTrade`: analyzer price buffer and CVD.
- `depth20@100ms`: analyzer order book support/resistance.

## Angel Live Data Flow

See [WebSocket Service Flow](./WEBSOCKET_SERVICE_FLOW.md) for packet parsing and provider details.

```mermaid
flowchart TD
  AngelWS[Angel SmartAPI websocket] --> Provider[AngelMarketDataProvider]
  Provider --> Parser[parseAngelLtpPacket]
  Parser --> Tick[NormalizedMarketTick]
  Tick --> Session[AngelUserMarketDataSessionService]
  Session --> WS[WebSocketManager.handleAngelMarketTick]
  WS --> UI[MARKET_TICK to browser]
  WS --> Snap[MarketSnapshotService.recordTick]
  Snap --> TMO[TemplateMonitoringOrchestrator.recordSnapshot]
  WS --> Analyzer[AnalyzerEngine.processNormalizedTick]
  WS --> ATM[ActiveTradeLiveMonitorService.handleTick]
```

Angel live ticks are user-scoped. The analyzer and active-trade monitoring require `userId` for Angel data.

## Analyzer Alert Flow

```mermaid
sequenceDiagram
  participant Tick as Binance aggTrade / Angel normalized tick
  participant A as AnalyzerEngine
  participant Cache as Active monitor cache
  participant DB as MongoDB
  participant News as NewsService
  participant LLM as LlmService
  participant WS as WebSocketManager
  participant UI as User dashboard

  Tick->>A: processTick/processNormalizedTick
  A->>A: update priceBuffer
  A->>A: update CVD buffer/currentCVD
  A->>Cache: get active monitors for symbol/subscription key
  alt cache miss or expired
    Cache->>DB: TripwireConfig.find(active monitors)
  end
  A->>A: evaluate drop/spike threshold
  A->>A: check monitor cooldown
  A->>News: fetchRecentHeadlines(symbol)
  A->>A: findStructuralSupportResistance()
  A->>LLM: generateAlertReport()
  A->>DB: AlertModel.create()
  A->>WS: emitToUser(userId, NEW_ALERT)
  WS-->>UI: NEW_ALERT
```

Analyzer state:

- `priceBuffer`: sliding price history by stream key.
- `cvdBuffer`: recent buyer/seller delta.
- `currentCVD`: running CVD value.
- `cooldowns`: duplicate alert prevention per monitor.
- `orderBookSnapshot`: latest Binance depth snapshot.
- `activeMonitorCache`: short TTL active monitor cache.

Important provider difference:

```txt
Binance monitor lookup can be global by provider/exchange/token.
Angel monitor lookup is user-scoped by user/provider/exchange/instrumentToken.
```

## Market Snapshot And Template Resource Flow

See [Scoring Template Service Flow](./SCORING_TEMPLATE_SERVICE_FLOW.md) for template details.

```mermaid
flowchart TD
  Tick[Binance or Angel tick] --> Snap[MarketSnapshotService.recordTick]
  Snap --> Candles[1m/3m/5m/15m candles]
  Snap --> VWAP[VWAP calculation]
  Snap --> Volume[Volume/RVOL state]
  Snap --> Fresh[Freshness/data confidence]
  Snap --> TMO[TemplateMonitoringOrchestrator.recordSnapshot]
  ScoreCheck[ScoreCheck creation] --> Builder[ScoringContextBuilder]
  Builder --> SnapRead[MarketSnapshotService.getSnapshot]
  Builder --> TMOEnsure[TemplateMonitoringOrchestrator.ensure]
  Builder --> Summary[resourceSnapshotSummary]
```

The snapshot service turns raw ticks into reusable scoring context:

- latest price
- previous price
- spread
- candle summary
- VWAP
- volume/RVOL
- freshness
- data confidence

## Scoring Template Creation And Monitoring Flow

```mermaid
sequenceDiagram
  participant UI as Template Editor UI
  participant API as /api/scoring-templates
  participant T as ScoringTemplateCrudService
  participant Registry as ScoringTemplateRegistryService
  participant DB as MongoDB
  participant Builder as ScoringContextBuilder
  participant TMO as TemplateMonitoringOrchestrator

  UI->>API: duplicate or update template
  API->>T: validate and persist template config
  T->>Registry: read system template baseline
  T->>DB: validate referenced Symbol ids exist
  T->>DB: create/update ScoringTemplate
  UI->>API: create ScoreCheck using template
  API->>Builder: build scoring context
  Builder->>Builder: resolve primary + configured resources
  Builder->>TMO: ensure resource health entries
  TMO-->>Builder: readiness state
```

Template parameters coordinate with monitoring like this:

```txt
resourceConfig
  -> tells builder which extra symbols to inspect

allowedTradableSymbols
  -> tells ScoreCheck which primary symbols are allowed

sectionOverrides
  -> tells scoring how section weight should be distributed

snapshotPolicy
  -> tells scoring how fresh the captured market context should be
```

## ScoreCheck Creation

```mermaid
sequenceDiagram
  participant UI as TradingWorkflow / ScoreCheckPanel
  participant API as POST /api/score-checks
  participant S as ScoreCheckService
  participant T as ScoringTemplateCrudService
  participant CB as ScoringContextBuilderService
  participant Engine as ScoringEngineService
  participant DB as MongoDB

  UI->>API: create score payload
  API->>S: createScoreCheck(userId, input)
  S->>DB: load Symbol
  S->>T: resolveForScoreCheck(template key/id)
  S->>S: validate symbol/template compatibility
  S->>S: validate allowedTradableSymbols
  S->>CB: build runtime + market snapshot context
  S->>CB: build template resource snapshot summary
  S->>Engine: deterministic score()
  S->>DB: create ScoreCheck
  S->>DB: create/update ScoreCheckSnapshot
  S->>DB: audit SCORE_CHECK_CREATED / SCORE_CALCULATED
  S->>T: markUsed(template)
  API-->>UI: ScoreCheck
```

## ScoreCheck To TradeSetup Conversion

```mermaid
sequenceDiagram
  participant UI as ScoreCheckPanel
  participant API as POST /api/score-checks/:id/convert-to-trade-setup
  participant TS as TradeSetupService
  participant RG as RiskGovernor
  participant DB as MongoDB
  UI->>API: scoreCheckId + selected tradePlanId
  API->>TS: convertScoreCheckToTradeSetup(userId, id, planId)
  TS->>DB: load ScoreCheck
  TS->>DB: load selected TradePlan
  TS->>DB: load TradePlanRiskState by tradePlanId
  TS->>DB: load UserDailyRiskState by bucket/date
  TS->>RG: evaluate(plan, riskState, dailyState, scorePermission, RR)
  TS->>DB: create TradeSetup APPROVED or REJECTED
  TS->>DB: set ScoreCheck.convertedToTradeSetupId
  TS->>DB: audit conversion/setup/risk
  API-->>UI: TradeSetup
```

RiskGovernor is deterministic final authority for trade permission. ScoreCheck does not mutate risk state.

## TradePlan Activation / Risk State

```mermaid
sequenceDiagram
  participant UI as TradePlanPanel
  participant API as POST /api/trade-plans/:id/activate
  participant PS as TradePlanService
  participant DB as MongoDB
  UI->>API: activate plan
  API->>PS: activateTradePlan(userId, planId)
  PS->>DB: load owned DRAFT TradePlan
  PS->>DB: update status ACTIVE
  PS->>DB: upsert TradePlanRiskState by userId + tradePlanId
  PS->>DB: audit TRADE_PLAN_RISK_STATE_INITIALIZED
  PS->>DB: audit TRADE_PLAN_ACTIVATED
  API-->>UI: active TradePlan
```

## ActiveTrade Confirmation

See [Trade Monitoring Service Flow](./TRADE_MONITORING_SERVICE_FLOW.md) for the live monitoring continuation.

```mermaid
sequenceDiagram
  participant UI as TradeSetupPanel
  participant API as POST /api/trade-setups/:id/confirm-actual-trade
  participant AS as ActiveTradeService
  participant SUB as ActiveTradeSubscriptionService
  participant WS as WebSocketManager
  participant DB as MongoDB
  UI->>API: actual entry/qty/stop/targets
  API->>AS: confirmActualTrade(userId, setupId, input)
  AS->>DB: load approved owned TradeSetup
  AS->>AS: validate actual geometry and rule violations
  AS->>DB: create ActiveTrade
  AS->>DB: mark TradeSetup EXECUTED
  AS->>SUB: register live monitoring interest
  SUB->>WS: subscribeActiveTradeStream()
  AS->>DB: audit confirmation/create/executed
  API-->>UI: ActiveTrade
```

## Live Tick To TradeEvent

```mermaid
sequenceDiagram
  participant P as Binance/Angel Provider
  participant WS as WebSocketManager
  participant SUB as ActiveTradeSubscriptionService
  participant LM as ActiveTradeLiveMonitorService
  participant TM as TradeMonitoringService
  participant ES as TradeEventService
  participant ED as TradeEventDeliveryService
  participant DB as MongoDB
  participant UI as Browser

  P-->>WS: market tick
  WS->>LM: normalized LiveTradeTickInput
  LM->>SUB: resolveTradesForTick(tick)
  SUB->>DB: find active trades on cache miss
  SUB-->>LM: matching active trades
  LM->>LM: validate stale/cooldown/workload cap
  LM->>TM: evaluateActiveTrade(userId, activeTradeId, price)
  TM->>TM: calculate currentR / stop distance / target distance
  TM->>ES: createIdempotently(event input)
  ES->>DB: create TradeEvent if not duplicate
  ES->>ED: deliver new TradeEvent
  ED-->>UI: TRADE_EVENT_CREATED
```

## Trade Close To TradeResult

```mermaid
sequenceDiagram
  participant UI as ActiveTradePanel
  participant API as POST /api/active-trades/:id/close
  participant RS as TradeResultService
  participant RP as RiskStateProjectionService
  participant SUB as ActiveTradeSubscriptionService
  participant DB as MongoDB
  UI->>API: exit price/qty/reason/costs
  API->>RS: closeActiveTrade(userId, activeTradeId, input)
  RS->>DB: load owned ActiveTrade
  RS->>RS: calculate P&L, basis, realizedR, result type
  RS->>DB: create FINALIZED TradeResult
  RS->>DB: mark ActiveTrade CLOSED or STOPPED_OUT
  RS->>RP: project finalized result
  RP->>DB: update TradePlanRiskState by tradePlanId
  RP->>DB: update UserDailyRiskState by bucket/date
  RS->>SUB: unregister active trade monitoring
  RP->>DB: audit result/projection
  API-->>UI: TradeResult
```

## TradeResult To Journal / AI Review

```mermaid
sequenceDiagram
  participant UI as TradeReviewPanel
  participant JR as Journal API/Service
  participant AI as AiTradeReviewService
  participant LLM as LLM Provider
  participant DB as MongoDB
  UI->>JR: POST /api/trade-results/:id/journal
  JR->>DB: load finalized TradeResult and related lifecycle facts
  JR->>DB: create or return TradeJournal
  UI->>JR: PATCH /api/trade-journals/:id
  JR->>DB: update reflection fields
  UI->>JR: POST /api/trade-journals/:id/finalize
  JR->>DB: validate required reflection and finalize
  UI->>AI: POST /api/trade-journals/:id/ai-review
  AI->>DB: load finalized journal context
  AI->>AI: sanitize and validate context
  AI->>LLM: request coaching review
  AI->>DB: create AiExplanation and link journal
  AI-->>UI: AI review
```

AI review is post-trade coaching only. It cannot score, approve, execute, close, or mutate risk.

## End-To-End Event-Driven View

```mermaid
flowchart LR
  subgraph Input
    Browser[Browser subscriptions]
    Binance[Binance streams]
    Angel[Angel streams]
  end

  subgraph Runtime
    WS[WebSocketManager]
    MSS[MarketSnapshotService]
    Analyzer[AnalyzerEngine]
    TMO[TemplateMonitoringOrchestrator]
    ATM[ActiveTradeLiveMonitorService]
  end

  subgraph Persistence
    Monitors[TripwireConfig]
    Alerts[Alert]
    Score[ScoreCheck/Snapshot]
    Events[TradeEvent]
  end

  subgraph Output
    UIPrices[TICKER_UPDATE / MARKET_TICK]
    UIAlerts[NEW_ALERT]
    UIEvents[TRADE_EVENT_CREATED]
  end

  Browser --> WS
  Binance --> WS
  Angel --> WS
  WS --> UIPrices
  WS --> MSS
  MSS --> TMO
  WS --> Analyzer
  Analyzer --> Monitors
  Analyzer --> Alerts
  Alerts --> UIAlerts
  WS --> ATM
  ATM --> Events
  Events --> UIEvents
  TMO --> Score
```

This is the core YuJiDi event-driven architecture:

```txt
market data is not a single feature
market data is shared runtime fuel for
  dashboard live rates
  analyzer alerts
  scoring template snapshots
  active-trade monitoring
  trade-event delivery
```
