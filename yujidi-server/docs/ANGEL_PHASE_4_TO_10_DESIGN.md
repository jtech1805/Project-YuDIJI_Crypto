# Angel Integration Phase 4 To 10 Design

## Feature Name

Angel Integration Phase 4 to 10 foundation.

## Business Goal

Allow YuJiDi to move from Binance-only crypto monitoring toward a universal market monitoring platform that can eventually support Angel MCX, NSE/BSE, FNO, and other provider instruments.

## Current Behavior

- Binance crypto symbols can be listed and monitored.
- Angel Scrip Master rows can be mapped and manually synced into the universal `Symbol` collection.
- Angel sync is explicit and operator-driven.
- No Angel broker login, live WebSocket, order placement, portfolio sync, or auto trading exists.

## Proposed Behavior

Phase 4 to 10 adds the safe foundation:

- Universal symbol search API.
- Frontend picker can show universal symbols.
- BrokerConnection scaffold without secrets.
- Monitor records can store universal symbol metadata.
- Angel auth/live data remain guarded until credentials and official payloads are approved.
- Angel raw ticks can normalize into `NormalizedMarketTick`.
- Analyzer can process normalized ticks through the existing `processTick` path.

## Affected Areas

- Backend models:
  - `Symbol`
  - `TripwireConfig`
  - `BrokerConnection`
- Backend services:
  - `MonitorService`
  - `AnalyzerEngine`
  - Angel auth/market-data/normalizer services
- Routes/controllers:
  - `GET /api/monitors/symbols/universal`
  - existing monitor create route accepts optional universal metadata
- Frontend pages/components:
  - dashboard add monitor modal
- WebSocket contracts:
  - no public WebSocket contract change in this phase
- LLM prompts/schema:
  - no schema change in this phase
- Docs:
  - Angel phase docs
  - project context
  - master context
  - risk/testing strategy
- Tests:
  - Angel tick normalizer tests
  - analyzer normalized tick bridge test

## Data Model Changes

`TripwireConfig` gains optional universal metadata:

- `provider`
- `marketType`
- `exchange`
- `instrumentToken`
- `displayName`
- `requiresBrokerLogin`

`BrokerConnection` scaffold is added with no secrets:

- `user`
- `broker`
- `status`
- `scopes`
- `lastConnectedAt`
- `lastError`
- `metadata`

Backward compatibility:

- Existing Binance monitors still use `symbol` such as `BTCUSDT`.
- Existing analyzer lookup by `symbol` still works.

## API/WebSocket Changes

New API:

```txt
GET /api/monitors/symbols/universal
```

Supported query params:

- `q`
- `provider`
- `marketType`
- `exchange`
- `includeBrokerRequired`
- `limit`

Monitor create remains backward-compatible.

No WebSocket contract change.

## Risks

- Users may assume Angel symbols are live before broker login/live feed is implemented.
- Incorrect tick normalization can produce wrong analyzer inputs.
- Universal monitor metadata can drift from `Symbol` registry records.
- BrokerConnection must never store raw secrets without an approved encryption plan.

## Rollout Plan

1. Add read-only symbol visibility.
2. Show universal instruments in UI.
3. Block broker-required instruments from monitor creation until live broker connection exists.
4. Add BrokerConnection scaffold without secrets.
5. Add guarded Angel runtime scaffolds.
6. Add normalized tick analyzer bridge.
7. Add tests and docs.

## Verification

```bash
cd yujidi-server
npm run typecheck
npm test

cd ../yujidi-client
npm run build
```
