# Analyzer Engine

This document explains the YuJiDi analyzer engine: what it does, what data it consumes, what state it keeps, how it decides when to trigger alerts, and how it should be tested.

Primary implementation file:

```txt
src/services/analyzer.service.ts
```

Related files:

```txt
src/services/websocket.service.ts
src/services/news.service.ts
src/services/llm.service.ts
src/models/TripwireConfig.ts
src/models/Alert.ts
```

## 1. What The Analyzer Does

The analyzer engine converts live market data into user-facing AI alerts.

Its responsibility is to:

1. Receive live trade ticks from Binance.
2. Maintain rolling price history per symbol.
3. Maintain 60-second cumulative volume delta, also called CVD.
4. Maintain latest order-book snapshots per symbol.
5. Evaluate active user monitors against current market movement.
6. Detect threshold breaches.
7. Prevent repeated alerts with cooldowns.
8. Enrich triggered events with:
   - CVD
   - support/resistance walls
   - recent news headlines
   - Groq/Llama AI analysis
9. Save successful alerts to MongoDB.
10. Emit `NEW_ALERT` to the owning user's active WebSocket clients.

The analyzer is the heart of YuJiDi's backend because it turns raw Binance data into explainable market intelligence.

## 2. Inputs

The analyzer receives three main categories of input.

### 2.1 Binance aggTrade

Source:

```txt
Binance WebSocket stream: <symbol>@aggTrade
```

Handled by:

```txt
src/services/websocket.service.ts
```

Forwarded to:

```ts
AnalyzerEngine.processTick(symbol, currentPrice, timestamp, isBuyerMaker, quantity)
```

Important fields:

- `s`: symbol, for example `BTCUSDT`
- `p`: trade price
- `q`: trade quantity
- `E`: event timestamp
- `m`: buyer-maker flag

Used for:

- price buffer updates
- CVD updates
- monitor threshold evaluation

### 2.2 Binance depth

Source:

```txt
Binance WebSocket stream: <symbol>@depth20@100ms
```

Handled by:

```txt
src/services/websocket.service.ts
```

Forwarded to:

```ts
AnalyzerEngine.updateOrderBook(symbol, bids, asks)
```

Important fields:

- bids
- asks

Used for:

- current midpoint price
- support wall detection
- resistance wall detection
- copilot trade math
- AI alert context

### 2.3 Active Monitors

Source:

```txt
MongoDB TripwireConfig collection
```

Model:

```txt
src/models/TripwireConfig.ts
```

Fields used by the analyzer:

- `user`
- `symbol`
- `thresholdPercentage`
- `timeWindowMinutes`
- `trigger`
- `isActive`

Current behavior:

```txt
read active monitors from in-memory cache
  -> refresh from MongoDB on cache miss or expiry
  -> refresh cache on monitor create/update/delete
```

Used for:

- deciding which user-defined rules should be evaluated for each incoming tick

## 3. Analyzer State

The analyzer keeps state in memory. This makes it fast, but state is lost on server restart and is not shared across multiple backend instances.

### 3.1 priceBuffer

Type:

```ts
Map<string, PriceTick[]>
```

Shape:

```ts
interface PriceTick {
  price: number;
  timestamp: number;
}
```

Purpose:

Stores rolling price ticks per symbol.

Used to calculate price change across a monitor's configured time window.

Current max buffer window:

```txt
60 minutes
```

Important limitation:

Monitor creation allows time windows up to 24 hours, but the analyzer currently keeps only 60 minutes of price history.

### 3.2 CVD State

CVD means cumulative volume delta.

State maps:

```ts
cvdBuffer: Map<string, CvdTrade[]>
currentCVD: Map<string, number>
```

Shape:

```ts
interface CvdTrade {
  volumeDelta: number;
  timestamp: number;
}
```

Purpose:

Tracks recent aggressive buying/selling pressure.

Current CVD window:

```txt
60 seconds
```

Current trade filter:

```txt
WHALE_THRESHOLD_BTC = 0.1
```

Current direction rule:

- `isBuyerMaker === true`: negative delta, interpreted as sell pressure
- `isBuyerMaker === false`: positive delta, interpreted as buy pressure

Important limitation:

The threshold is named BTC-specific but is currently applied to all symbols. This may not be accurate for assets with very different units.

### 3.3 cooldowns

Type:

```ts
Map<string, number>
```

Key:

```txt
monitorId
```

Value:

```txt
last triggered timestamp
```

Purpose:

Prevents repeated alerts from the same monitor during the cooldown window.

Current cooldown:

```txt
15 minutes
```

### 3.4 orderBookSnapshot

Type:

```ts
Map<string, { bids: string[][]; asks: string[][] }>
```

Purpose:

Stores the latest Binance depth snapshot per symbol.

Used by:

- alert report generation
- support/resistance calculation
- copilot trade math

### 3.5 activeMonitorCache

Type:

```ts
Map<string, { monitors: ActiveMonitorDocument[]; expiresAt: number; loadedAt: number }>
```

Purpose:

Caches active monitors by symbol so the analyzer does not query MongoDB on every high-frequency `aggTrade` tick.

Current TTL:

```txt
5 seconds
```

Refresh behavior:

```txt
cache miss or expiry
  -> query MongoDB for active monitors
  -> cache result for 5 seconds
```

Invalidation behavior:

```txt
monitor create/update/delete
  -> refresh cache for that monitor symbol from MongoDB
```

Delete behavior:

```txt
delete last active monitor for a symbol
  -> refresh cache
  -> store activeMonitorCount = 0 as a negative cache entry
```

The zero-monitor cache entry prevents repeated MongoDB reads if ticks are still arriving for a symbol that no longer has active monitors.

Verification logs:

```txt
ANALYZER_MONITOR_CACHE_REFRESH_REQUESTED
ANALYZER_MONITOR_CACHE_REFRESH
ANALYZER_MONITOR_CACHE_REFRESHED
ANALYZER_MONITOR_CACHE_INVALIDATED
ANALYZER_MONITOR_CACHE_HIT  // debug level
```

Debug endpoint:

`GET /api/monitors/debug/engine-state` includes `activeMonitorCache` metadata with monitor count, negative-cache status, loaded time, expiry time, and TTL remaining.

## 4. Trigger Logic For Drop And Spike

The analyzer should support both drop and spike monitors.

The monitor model supports:

```ts
trigger: "drop" | "spike"
```

### 4.1 Shared Price Change Formula

For a monitor:

```txt
windowStart = currentTimestamp - monitor.timeWindowMinutes * 60 * 1000
baseTick = latest tick at or before windowStart
percentChange = ((currentPrice - baseTick.price) / baseTick.price) * 100
```

Example:

```txt
base price: 100
current price: 95
percentChange: -5%
```

Example:

```txt
base price: 100
current price: 105
percentChange: +5%
```

### 4.2 Drop Trigger

Intended rule:

```txt
If trigger is "drop", alert when percentChange <= -thresholdPercentage.
```

Example:

```txt
trigger: drop
thresholdPercentage: 3
percentChange: -3.2
result: trigger
```

Non-trigger example:

```txt
trigger: drop
thresholdPercentage: 3
percentChange: -2.5
result: do not trigger
```

### 4.3 Spike Trigger

Intended rule:

```txt
If trigger is "spike", alert when percentChange >= thresholdPercentage.
```

Example:

```txt
trigger: spike
thresholdPercentage: 3
percentChange: +3.2
result: trigger
```

Non-trigger example:

```txt
trigger: spike
thresholdPercentage: 3
percentChange: +2.5
result: do not trigger
```

### 4.4 Current Implementation Status

Current analyzer code is trigger-aware:

```ts
const thresholdBreached =
  triggerType === "drop"
    ? percentChange <= -monitor.thresholdPercentage
    : triggerType === "spike"
      ? percentChange >= monitor.thresholdPercentage
      : false;
```

Current behavior:

- `drop` monitors can trigger.
- `spike` monitors can trigger.
- invalid legacy trigger values are skipped.

Compatibility migration:

- New alerts store `changePercentage`, `triggerType`, and `direction`.
- New alerts also continue storing legacy `dropPercentage` as an absolute magnitude.
- Frontend displays new movement fields when present and falls back to `dropPercentage` for old alerts.
- `dropPercentage` should be removed only in a later deliberate migration.

## 5. Cooldown Behavior

Cooldown prevents a monitor from repeatedly firing during the same market move.

Current cooldown duration:

```txt
15 minutes
```

Current behavior:

1. Analyzer detects threshold breach.
2. Analyzer immediately stores the current timestamp in `cooldowns`.
3. News/LLM/DB alert pipeline starts.
4. If another tick arrives for the same monitor before cooldown expires, the monitor is skipped.

Pseudo-flow:

```txt
monitor not in cooldown
  -> threshold breached
  -> cooldown set
  -> alert pipeline starts

monitor in cooldown
  -> skip evaluation
```

Important consequence:

Cooldown is set before the alert is successfully saved. If news, Groq, or MongoDB fails, the monitor can still be cooled down even though no alert was created.

Possible future improvement:

- Set cooldown only after alert save succeeds.
- Or store a failed-alert record and keep cooldown to prevent retry storms.
- Or use a shorter failure cooldown and full cooldown only on success.

## 6. Failure Cases

### 6.1 Invalid Tick

Failure:

- price is `NaN`
- price is `Infinity`
- price is `0`
- price is negative

Current behavior:

- tick is rejected
- analyzer does not update buffers
- no monitor evaluation happens

### 6.2 Not Enough Price History

Failure:

- monitor requires a window that does not yet exist in `priceBuffer`

Example:

```txt
monitor window: 15 minutes
server started: 2 minutes ago
```

Current behavior:

- monitor is skipped
- no alert is created

### 6.3 Monitor In Cooldown

Failure/skip case:

- monitor triggered recently and cooldown has not expired

Current behavior:

- monitor is skipped

### 6.4 No Active Monitors

Failure/skip case:

- no active monitors exist for the tick's symbol

Current behavior:

- analyzer updates state
- no alert pipeline starts

### 6.5 No Order Book Snapshot

Failure:

- depth data has not arrived for the symbol

Current behavior:

- support/resistance may be returned as `Unknown`
- alert generation can still continue

### 6.6 News Fetch Failure

Failure:

- CryptoCompare request fails
- API key missing or invalid
- no usable headlines returned

Current behavior:

- news service returns `No recent news available.`
- alert pipeline continues

### 6.7 Groq Failure

Failure:

- API request fails
- API key missing
- empty response
- malformed JSON
- schema mismatch

Current behavior:

- alert pipeline fails
- no alert is saved
- monitor may already be in cooldown

### 6.8 MongoDB Save Failure

Failure:

- MongoDB unavailable
- validation error
- network issue

Current behavior:

- alert pipeline fails
- no alert is emitted
- monitor may already be in cooldown

### 6.9 User Has No Active Sockets

Failure/skip case:

- alert is generated for a user who is not currently connected

Current behavior:

- alert is saved
- live WebSocket emit is skipped
- user can still see the alert later through the alerts API

### 6.10 Multi-Instance Backend

Failure/risk:

- multiple backend instances run at the same time

Current behavior:

- analyzer state is not shared
- cooldowns are not shared
- price buffers are not shared
- order books are not shared
- users connected to different instances may see inconsistent real-time behavior

## 7. Test Cases

These test cases should guide future automated tests for the analyzer.

### 7.1 Valid Tick Updates Price Buffer

Given:

- symbol `BTCUSDT`
- price `100000`
- timestamp `T`

Expected:

- `priceBuffer.get("BTCUSDT")` contains the tick

### 7.2 Invalid Tick Is Rejected

Given:

- price `0`, `NaN`, `Infinity`, or negative

Expected:

- no price buffer update
- no monitor evaluation

### 7.3 Old Price Ticks Are Culled

Given:

- price ticks older than max buffer window
- a new tick arrives

Expected:

- old ticks are removed
- only ticks within the rolling window remain

### 7.4 CVD Positive Delta

Given:

- `isBuyerMaker = false`
- quantity greater than threshold

Expected:

- `currentCVD` increases

### 7.5 CVD Negative Delta

Given:

- `isBuyerMaker = true`
- quantity greater than threshold

Expected:

- `currentCVD` decreases

### 7.6 CVD Ignores Small Trades

Given:

- quantity below whale threshold

Expected:

- `currentCVD` does not change

### 7.7 CVD Window Culls Old Trades

Given:

- old CVD trades outside 60 seconds
- new tick arrives

Expected:

- old deltas are removed from running CVD

### 7.8 Drop Monitor Triggers

Given:

- monitor trigger `drop`
- threshold `3%`
- base price `100`
- current price `96`

Expected:

- percent change is `-4%`
- monitor triggers
- alert pipeline starts

### 7.9 Drop Monitor Does Not Trigger

Given:

- monitor trigger `drop`
- threshold `3%`
- base price `100`
- current price `98`

Expected:

- percent change is `-2%`
- monitor does not trigger

### 7.10 Spike Monitor Triggers

Given:

- monitor trigger `spike`
- threshold `3%`
- base price `100`
- current price `104`

Expected:

- percent change is `+4%`
- monitor triggers

Current status:

- Implemented in analyzer logic.

### 7.11 Spike Monitor Does Not Trigger

Given:

- monitor trigger `spike`
- threshold `3%`
- base price `100`
- current price `102`

Expected:

- percent change is `+2%`
- monitor does not trigger

Current status:

- Implemented in analyzer logic.

### 7.12 Monitor Skips Without Base Tick

Given:

- monitor window is 15 minutes
- price buffer contains only 2 minutes of ticks

Expected:

- monitor is skipped
- no alert pipeline starts

### 7.13 Monitor Cooldown Prevents Repeat Trigger

Given:

- monitor triggered at time `T`
- another threshold breach occurs before `T + 15 minutes`

Expected:

- monitor is skipped
- no duplicate alert is created

### 7.14 Cooldown Expires

Given:

- monitor triggered at time `T`
- another threshold breach occurs after `T + 15 minutes`

Expected:

- monitor can trigger again

### 7.15 Order Book Snapshot Updates

Given:

- depth update with bids and asks

Expected:

- `orderBookSnapshot` stores latest bids/asks for the symbol

### 7.16 Support And Resistance Unknown

Given:

- no order book exists for symbol

Expected:

- support/resistance result is `Unknown`

### 7.17 News Failure Falls Back

Given:

- CryptoCompare request fails

Expected:

- alert pipeline receives fallback news text
- pipeline can continue

### 7.18 Groq Failure Stops Alert Save

Given:

- threshold breach occurs
- Groq returns malformed JSON

Expected:

- no alert is saved
- no `NEW_ALERT` is emitted
- failure is logged

### 7.19 Alert Save Emits To User

Given:

- alert is successfully saved
- user has active sockets

Expected:

- `NEW_ALERT` is sent only to that user

### 7.20 User Offline Still Gets Stored Alert

Given:

- alert is successfully saved
- user has no active sockets

Expected:

- alert remains in MongoDB
- live emit is skipped

## 8. Known Limitations

### 8.1 Spike Logic Is Newly Implemented

The analyzer now supports trigger-aware drop and spike detection.

Remaining work:

- Add automated regression tests for spike trigger and non-trigger paths.
- Monitor production behavior after deployment.

### 8.2 Alert Model Is Drop-Centric

The alert model uses:

```txt
dropPercentage
```

For spike alerts, this naming is legacy-only. New alerts also store direction-neutral fields:

Current migration fields:

```txt
dropPercentage  // legacy absolute magnitude
changePercentage
triggerType
direction
```

### 8.3 Price Buffer Is Shorter Than Allowed Monitor Window

The analyzer keeps 60 minutes of price history, but monitor validation allows up to 24 hours.

Either:

- reduce max allowed monitor window to 60 minutes
- or increase analyzer storage strategy beyond memory

### 8.4 Analyzer State Is In Memory

State is lost on restart and not shared across instances.

Affected state:

- price buffer
- CVD
- cooldowns
- order book

### 8.5 Active Monitor Cache Is In Memory

The analyzer now uses a short TTL in-memory cache for active monitors by symbol.

This reduces MongoDB read load on high-frequency market data.

Remaining limitations:

- Cache is local to one backend process.
- Multi-instance deployments still need shared cache refresh/invalidation.
- Very recent monitor mutations rely on explicit cache refresh plus short TTL fallback.

### 8.6 Cooldown Starts Before Alert Success

If the alert pipeline fails after cooldown starts, the monitor can be suppressed even though no alert was created.

### 8.7 CVD Threshold Is Not Asset-Normalized

`WHALE_THRESHOLD_BTC = 0.1` is applied globally.

This may not make sense for:

- low-price assets
- high-supply assets
- non-BTC symbols

### 8.8 Order Book Wall Detection Is Heuristic

Support and resistance are derived from visible depth and simple average/multiplier logic.

Limitations:

- spoof orders can still distort results
- thin books may produce unreliable walls
- large walls far away from price may be selected

### 8.9 Failed Alert Attempts Are Not Persisted

If LLM or database work fails, no failed alert record is stored.

This makes later debugging harder.

### 8.10 Multi-Instance Deployment Is Not Safe Yet

Because analyzer state is local memory, multiple backend instances can produce inconsistent behavior.

Scaling safely would require shared state or a separate ingestion/analyzer service.
