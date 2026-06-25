# Trading Workflow Frontend

The protected `/trading-workflow` route exposes YuJiDi's risk-first trade lifecycle beside the existing monitoring dashboard.

## Supported Flow

```txt
TradePlan
  -> ScoreCheck
  -> governed TradeSetup
  -> manual actual trade confirmation
  -> ActiveTrade
  -> manual or live TradeEvent monitoring
  -> manual close
  -> TradeResult
  -> TradeJournal
  -> AI coaching review
```

The page includes a lifecycle stepper for:

- Plan
- Score
- Setup
- Active Trade
- Events
- Close
- Journal
- AI Review

Each step communicates whether it is completed, current, or blocked and identifies the next manual action.

## Safety Boundaries

The interface uses permission language only:

- `TAKE_TRADE`
- `TAKE_SMALL_RISK`
- `WAIT`
- `REJECT`
- `STOP_TRADING`

It does not place, modify, or cancel broker orders. Trade events do not automatically close a trade.

Confirming an actual trade records what the user already did outside YuJiDi. Manual close records the
result in YuJiDi and does not submit an exit order to a broker.

Trade events are alerts only. `TRADE_EVENT_CREATED` updates the in-memory feed but does not mutate the
ActiveTrade status, create a TradeResult, or perform an automatic close.

AI output is labelled as an AI coaching review. It does not change the recorded result, risk state, or
trade permission.

## UX And Contract Safety

- Backend validation messages are shown without exposing stack traces.
- Unauthorized responses trigger the existing authentication re-check.
- Network failures identify when the backend is unreachable.
- Empty lists and missing optional symbol metadata render safely.
- Active trade cards separate historical planned values from current actual values.
- Manual close requires an exit price and exit reason and shows an estimated gross P&L before charges.
- Journal system facts are read-only.
- Journal finalization requires entry quality, exit quality, outcome quality, followed-plan confirmation,
  and at least one mistake tag.
- WebSocket connection status is visible on the workflow page.

## MCX Commodity Baseline

Selecting an MCX commodity future prefers:

```txt
MCX Commodity Intraday — Baseline
```

The `COMMODITY_MCX_INTRADAY_V1` template uses direction-aware trade geometry, deterministic
reward/risk bands, and MCX contract sanity checks for lot size, tick size, expiry, and
Angel live-monitoring login requirements.

It does not claim to include inventory data, COT data, international commodity news,
dollar-index context, or other advanced commodity analytics.

Commodity swing scoring remains deferred.

## Data Boundaries

- HTTP API clients live under `src/api/`.
- Shared lifecycle types live in `src/types/trade.ts`.
- Focused UI components live in `src/components/trading/`.
- `WebSocketContext` stores new `TRADE_EVENT_CREATED` payloads in memory.
- Historical trade events are loaded from `/api/trade-events`.
- AI output is presented as coaching, never as the trade decision.

## Known Limitations

- No broker order placement, modification, cancellation, or fill reconciliation.
- No automatic close or automatic TradeResult creation from TradeEvents.
- MCX scoring remains a baseline rather than a full commodity analytics model.
- No portfolio analytics or RAG interface.
- Workflow state is refreshed from separate lifecycle APIs rather than one aggregate endpoint.
- The frontend bundle still has an existing large-chunk build warning.

## Verification

```bash
cd yujidi-client
npm run build
npm run lint
```

The repository currently has pre-existing lint failures outside the Phase 13A/13B files. New trade workflow files should pass targeted ESLint.
