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
- Delete buttons call backend APIs and refresh workflow data after success.
- TradePlan delete requires typing `DELETE` before submitting the cascade request.
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

## Delete And Update Behavior

Dashboard delete is persistent, not a local hide:

- ScoreCheck delete calls `DELETE /api/score-checks/:id`.
- TradeSetup delete calls `DELETE /api/trade-setups/:id`.
- TradePlan delete calls `DELETE /api/trade-plans/:id` with cascade intent.

The backend blocks unsafe deletes:

- executed setups cannot be deleted
- setups with ActiveTrades cannot be deleted
- plans with open ActiveTrades cannot be deleted
- plans with finalized trade results or journals must be archived instead

After a successful delete, the workflow reloads from backend APIs so cascaded state is not stale.

## Selected TradePlan Context

The selected TradePlan is the owner context for the Trading Workflow dashboard.

When a user selects a plan, the UI should load:

- governed setups from `/api/trade-plans/:id/trade-setups`
- active trades from `/api/trade-plans/:id/active-trades`
- trade events from `/api/trade-plans/:id/trade-events`
- trade results from `/api/trade-plans/:id/trade-results`
- journals from `/api/trade-plans/:id/trade-journals`
- summary from `/api/trade-plans/:id/dashboard-summary`

ScoreChecks may remain global because they are pre-plan candidates, but conversion uses
the selected TradePlan.

## Risk Lock Recovery

If a selected plan is blocked by STOP_TRADING, the UI shows the risk lock instead of hiding it.

Recovery actions:

- `Reset Risk Lock`: clears plan/daily risk lock fields only after a reason is provided.
- `Retry rejected setup`: re-runs RiskGovernor for an existing rejected setup after reset.
- `Restart Plan`: creates a fresh plan copy with new starting capital and preserves old history.
- `Edit Plan`: opens safe TradePlan edit controls.

Reset does not delete losses, results, journals, or realized P&L. Restart does not move old
records to the new plan. These actions are explicit, audited recovery/testing flows.

If a ScoreCheck was already converted to a rejected governed setup, the UI should show retry
instead of leaving the Convert button permanently disabled. Retry updates the same setup; it
does not create a duplicate ScoreCheck or TradeSetup.

## Scoring Templates

The Trading Workflow screen includes a production-oriented Scoring Templates manager.

User flow:

- System templates are listed as readonly.
- A user can create a private custom template by choosing a readonly system base model.
- A user can duplicate a system template directly from the list.
- Custom templates appear in the Score Check template dropdown.
- Score Check submits either a system `scoringTemplateKey` or a user `scoringTemplateId`.
- A user can edit, rename, archive, or use their custom templates from the workflow screen.
- `Use in ScoreCheck` selects the custom template and moves the user back to the Score Check panel.

Template configuration supports:

- basic name and description
- market regime resources
- sector name and sector index resource
- related symbols
- allowed tradable symbols
- section override weights
- snapshot policy toggles and TTL

Backend rules still own validation:

- section/evaluator weights must total 100
- only registered evaluator keys can run
- unsafe executable config is rejected
- used template edits create a new version
- user template ScoreChecks can only use symbols from `allowedTradableSymbols`
- user templates with no allowed symbols cannot be used for ScoreCheck
- RiskGovernor remains final authority after conversion

When a selected custom template has allowed symbols, the ScoreCheck symbol picker filters to
those symbols and clears an invalid selected symbol. This filtering is UX only; backend
validation remains authoritative.

Custom template ScoreCheck responses can include a compact Resource Snapshot section. This
shows the primary symbol and configured market/sector/related resources with readiness and
latest price when available. It is response-level context only; persistent TTL score snapshots
are temporary explanation/debugging records.

ScoreCheck responses can also include:

- `scoreCheckSnapshotId`
- `scoreCheckSnapshotCreatedAt`
- `scoreCheckSnapshotExpiresAt`

The latest score card includes a compact Score Explanation panel. It prefers the temporary
`ScoreCheckSnapshot` fetched from `/api/score-checks/:id/snapshot` and falls back to inline
resource summary data when the snapshot is unavailable.

The panel shows:

- score, permission, confidence, and score status
- template identity and selected symbol context
- resource readiness and resource-level freshness
- compact section breakdown
- warnings and blockers
- snapshot id and expiry information

This is explanation/debugging UI only. It does not recalibrate scoring, place trades, mutate
RiskGovernor state, or create permanent audit copies.

When the user converts a ScoreCheck to a governed TradeSetup, the backend requires the temporary
`ScoreCheckSnapshot` to still be available. Conversion creates or reuses the permanent
`TradeScoreSnapshot` audit record and the latest score card shows "Permanent score snapshot saved"
once the linked setup includes `tradeScoreSnapshotId`.

## India Symbol Selection

Phase 18C-0 extends the Trading Workflow symbol picker for Angel Indian markets.

Picker presets:

- Crypto
- India Cash
- India Futures
- India Options
- MCX

Search results show exchange/instrument badges plus expiry, strike, CE/PE, and broker-login
requirements when available.

ScoreCheck behavior:

- NSE cash symbols default to the India equity intraday template.
- NFO futures default to the India F&O future intraday template.
- NFO options default to the India F&O option intraday template.
- MCX futures still default to the MCX commodity template.

Live-rate boundary:

Angel NSE/NFO/MCX live data requires the user's active Angel broker session. The frontend uses
the same backend WebSocket connection; the backend routes provider-specific subscriptions and
emits frontend-compatible live-rate payloads.

## Verification

```bash
cd yujidi-client
npm run build
npm run lint
```

The repository currently has pre-existing lint failures outside the Phase 13A/13B files. New trade workflow files should pass targeted ESLint.
