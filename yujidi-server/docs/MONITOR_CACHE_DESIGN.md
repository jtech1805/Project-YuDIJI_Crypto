# Monitor Cache Design

## Feature Name

Active monitor cache for analyzer tick processing.

## Business Goal

Reduce MongoDB reads in the real-time analyzer hot path.

The analyzer receives high-frequency Binance `aggTrade` events. Monitor configuration changes much less frequently than market ticks, so querying MongoDB for active monitors on every tick is wasteful and can delay alerts during high-volume periods.

## Current Behavior

Current analyzer behavior:

```txt
Every aggTrade tick
  -> update price buffer
  -> update CVD
  -> query MongoDB for active monitors by symbol
  -> evaluate thresholds
```

Current query:

```ts
TripwireConfigModel.find({
  symbol: normalizedSymbol,
  isActive: true,
})
```

Pain point:

```txt
high-frequency market ticks
  -> high-frequency database reads
```

## Proposed Behavior

Add a short TTL cache inside `AnalyzerEngine`.

```txt
Every aggTrade tick
  -> update price buffer
  -> update CVD
  -> read active monitors from in-memory cache
  -> refresh from MongoDB only on cache miss/expiry
  -> evaluate thresholds
```

Also refresh the cache immediately when monitor mutations happen:

```txt
create monitor
update monitor
delete monitor
  -> refresh analyzer monitor cache for that symbol from MongoDB
```

Delete can refresh the symbol into a zero-monitor cache entry. This is intentional and should be treated as a negative cache entry: it tells the analyzer that MongoDB was checked recently and there are no active monitors for that symbol.

## Affected Areas

Backend models:

- None.

Backend services:

- `src/services/trading/analyzer.service.ts`
- `src/services/trading/websocket.service.ts`
- `src/services/trading/monitor.service.ts`

Routes/controllers:

- `src/controllers/monitor.controller.ts`

Frontend pages/components:

- None.

WebSocket contracts:

- None.

LLM prompts/schema:

- None.

Docs:

- `ANALYZER_ENGINE.md`
- `RISK_REGISTER.md`
- `PROJECT_CONTEXT.md`
- `PROJECT_MASTER_CONTEXT.md`

Tests:

- No automated test suite exists yet.
- Verify with logs and backend typecheck.

## Data Model Changes

None.

## API/WebSocket Changes

None.

## Risks

Data freshness:

- A TTL cache can briefly serve stale monitor data.

Mitigation:

- Use short TTL.
- Explicitly refresh cache on create/update/delete.

Performance:

- Cache should reduce MongoDB read load significantly.

Operational:

- Logs should make cache behavior visible without flooding production logs.

## Rollout Plan

1. Add cache state and TTL in `AnalyzerEngine`.
2. Replace per-tick MongoDB query with cache lookup.
3. Add cache refresh method in `AnalyzerEngine`.
4. Expose refresh through `WebSocketManager`.
5. Call refresh after monitor create/update/delete.
6. Add structured logs for miss, refresh, hit, and negative cache entries.
7. Add cache metadata to engine debug snapshot.
8. Run `npm run typecheck`.

## Verification

Run:

```bash
cd yujidi-server
npm run typecheck
```

Manual verification:

1. Start backend.
2. Subscribe to a monitored symbol.
3. Watch logs for `ANALYZER_MONITOR_CACHE_REFRESH`.
4. Confirm repeated ticks do not produce Mongo refresh logs every tick.
5. Create/update/delete a monitor.
6. Confirm `ANALYZER_MONITOR_CACHE_INVALIDATED` appears.
7. Call `/api/monitors/debug/engine-state`.
8. Confirm monitor cache metadata appears in the snapshot.
9. Confirm deleted symbols either disappear from WebSocket subscriptions or show `activeMonitorCount: 0` with `isNegativeCache: true`.
