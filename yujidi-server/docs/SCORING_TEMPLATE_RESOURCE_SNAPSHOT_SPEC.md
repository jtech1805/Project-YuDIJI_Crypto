# Scoring Template Resource Snapshot Spec

This document tracks the template resource configuration work for YuJiDi scoring.

## Phase 18C-1 Implemented Scope

Scoring templates can now store resource configuration that defines which symbols should be available to a future score snapshot.

Stored fields:

- `resourceConfig.marketRegime.marketIndexSymbolId`
- `resourceConfig.marketRegime.bankIndexSymbolId`
- `resourceConfig.marketRegime.volatilitySymbolId`
- `resourceConfig.sectorContext.sectorName`
- `resourceConfig.sectorContext.sectorIndexSymbolId`
- `resourceConfig.relatedSymbols`
- `allowedTradableSymbols`
- `sectionOverrides`
- `snapshotPolicy`

Validation rules:

- Resource symbol ids must exist in the global `Symbol` registry.
- Allowed tradable symbol ids must exist in the global `Symbol` registry.
- `allowedTradableSymbols` must be unique.
- Enabled `sectionOverrides` weights must total 100.
- Existing editable scoring sections must continue to pass section/evaluator weight validation.
- Only the owning user can edit a user template.
- System templates remain readonly and must be duplicated before editing.

Frontend:

- Custom scoring templates expose a minimal configuration modal.
- The modal supports market regime symbol selectors, sector index selector, allowed symbol selection, and section override weights.

## Explicitly Out Of Scope

Phase 18C-1 does not implement ScoreCheck snapshot capture.

Not implemented yet:

- ScoreCheck snapshot persistence from template resources.
- Runtime template resource resolver integration for score creation.
- UI explanation panel for snapshot freshness or missing resources.
- AI usage of resource snapshots.

## Future Phase 18C-2 Direction

The next phase should capture the configured resources at ScoreCheck creation time and persist a deterministic snapshot so historical score decisions remain explainable even if market data changes later.

## Phase 18C-2 Implemented Scope

ScoreCheck now validates selected symbols against a user template's allowed tradable universe.

Rules:

- System templates keep broad existing behavior.
- User templates must have at least one `allowedTradableSymbols` entry before they can be used for ScoreCheck.
- When a user template has `allowedTradableSymbols`, the selected ScoreCheck `symbolId` must be included.
- Backend enforcement is authoritative.
- Frontend filtering is only UX support and must not be treated as a security boundary.

Failure messages:

- `TEMPLATE_HAS_NO_ALLOWED_SYMBOLS`
- `Selected symbol is not allowed for this scoring template.`

Out of scope remains unchanged:

- No ScoreCheck resource snapshot persistence yet.
- No score explanation panel yet.
- No template monitoring warmup yet.

## Phase 18C-3 Implemented Scope

ScoreCheck now builds a lightweight template resource snapshot summary for user templates.

Resolved resource roles:

- `PRIMARY_SYMBOL`
- `MARKET_INDEX`
- `BANK_INDEX`
- `VOLATILITY_INDEX`
- `SECTOR_INDEX`
- `RELATED_SYMBOL`

Response shape:

- `resolvedResources`
- `resourceSnapshots`
- `resourceReadinessSummary`
- `warnings`
- `blockers`

Rules:

- `PRIMARY_SYMBOL` comes from the selected ScoreCheck symbol.
- Market, bank, volatility, and sector resources come from `template.resourceConfig`.
- Related symbols come from `template.resourceConfig.relatedSymbols`.
- Missing related symbols warn but do not block.
- Missing required configured resources add blockers and `BLOCKING_MISSING` readiness.
- Returned snapshots are compact summaries only.
- Raw provider payloads, raw ticks, full order books, and candle arrays are not returned.

Persistence boundary:

Phase 18C-3 is response-level only. Persistent TTL `ScoreCheckSnapshot` storage is deferred to Phase 18C-4.

## Phase 18C-3.5 Implemented Scope

The Trading Workflow frontend now has a clearer scoring template create/edit flow.

Supported UI behavior:

- Create custom templates from readonly system base templates.
- Show template name, scope, version, market type, trade style, instrument type, status, base template key, sector context, resource summary, allowed-symbol count, and section weight summary.
- Edit custom template name and description.
- Configure market regime resources, sector context, related symbols, allowed tradable symbols, section overrides, and snapshot policy.
- Disable save when enabled section weights do not total 100.
- Warn when no allowed tradable symbols are configured.
- Archive custom templates through the existing backend API.
- Select `Use in ScoreCheck` to preselect a custom template and restrict the symbol picker to its allowed tradable symbols.

Boundary:

- Backend validation remains authoritative.
- System templates remain readonly and must be duplicated before editing.
- No scoring calculation changes were made.
- No persistent `ScoreCheckSnapshot` TTL storage was added.
- No template monitoring warmup or RiskGovernor change was added.

## Phase 18C-4 Implemented Scope

ScoreCheck now creates a temporary expirable `ScoreCheckSnapshot`.

Purpose:

- short-term explanation/debugging context for a ScoreCheck
- compact resource and scoring summary
- automatic cleanup through MongoDB TTL

Stored snapshot content:

- user and ScoreCheck ids
- scoring template identity
- selected symbol summary
- resolved template resources
- compact resource snapshots and readiness summary
- compact section breakdown
- final score, permission, score status, and data confidence
- warnings and blockers
- `expiresAt`

TTL rules:

- `INTRADAY` defaults to 24 hours.
- `SWING` defaults to 7 days.
- Future `snapshotPolicy.ttlHours` is honored when present.
- Existing `snapshotPolicy.maxSnapshotAgeSeconds` is honored only when it is at least 1 hour.
- TTL is bounded between 1 hour and 7 days.
- Infinite TTL is not allowed for `ScoreCheckSnapshot`.

Endpoint:

```txt
GET /api/score-checks/:id/snapshot
```

Rules:

- Auth is required.
- Users can read only their own snapshot.
- Missing or expired snapshots return `SCORE_CHECK_SNAPSHOT_EXPIRED_OR_NOT_FOUND`.

Boundary:

- `ScoreCheckSnapshot` is temporary explanation/debugging data.
- `TradeScoreSnapshot` remains the permanent audit snapshot path.
- Raw ticks, raw order books, raw candles, raw provider payloads, broker tokens, and secrets are not stored.

## Phase 18C-5 Implemented Scope

The Trading Workflow latest score card now includes a compact Score Explanation panel.

Panel content:

- final score
- permission
- data confidence
- score status
- template name, version, and scope
- selected symbol context
- snapshot expiry text
- resource readiness summary
- resource cards with role, symbol, readiness, price, change, VWAP position, freshness age, and warnings
- compact section breakdown cards
- warnings and blockers
- snapshot id and created time for debugging

Data source behavior:

- The UI prefers the temporary `ScoreCheckSnapshot` fetched from `GET /api/score-checks/:id/snapshot`.
- If the snapshot is unavailable or expired, the UI still shows inline `resourceSnapshotSummary` when present.
- Snapshot fetch failures are shown as compact non-blocking messages.

Boundary:

- This is an explanation/debug panel, not an analytics or calibration dashboard.
- No scoring formulas changed.
- RiskGovernor remains unchanged.
- Template monitoring warmup remains deferred.

## Phase 18C-6 Implemented Scope

ScoreCheck conversion now creates the permanent audit snapshot.

Lifecycle:

```txt
ScoreCheck
  -> temporary ScoreCheckSnapshot exists and is not expired
  -> user converts ScoreCheck to TradeSetup
  -> compact TradeScoreSnapshot is created or reused
  -> RiskGovernor evaluates final permission
  -> TradeSetup is created as approved or rejected
  -> TradeScoreSnapshot is linked to TradeSetup
```

Rules:

- `ScoreCheckSnapshot` remains temporary and TTL-backed.
- `TradeScoreSnapshot` is permanent and has no TTL.
- Conversion requires a non-expired `ScoreCheckSnapshot`.
- Missing or expired temporary snapshots return `SCORE_CHECK_SNAPSHOT_EXPIRED_RERUN_REQUIRED`.
- The permanent snapshot copies compact audit-safe template identity, selected symbol, resolved resources, resource snapshots, readiness summary, section breakdown, final score, permission, status, confidence, warnings, blockers, and source snapshot metadata.
- Raw ticks, raw order books, raw candles, raw provider payloads, broker tokens, and secrets are not copied.
- RiskGovernor remains final authority.
- If RiskGovernor rejects but creates a rejected TradeSetup, the permanent `TradeScoreSnapshot` is still kept and linked.
- The frontend only shows a compact "Permanent score snapshot saved" confirmation when a converted setup has `tradeScoreSnapshotId`.
