# Angel SmartAPI Phase 0

This document describes the Phase 0 scaffold for future Angel SmartAPI read-only market-data integration.

Phase 1 update:

YuJiDi now has a universal `Symbol` registry scaffold and an offline Angel Scrip Master mapper for MCX rows. Live Angel sync is still not implemented.

Phase 2 update:

YuJiDi now has a read-only Angel Scrip Master client and symbol sync service. The sync is disabled by default and is not wired into server startup.

Phase 3 update:

YuJiDi now has an explicit backend job trigger for Angel Scrip Master symbol sync. It is an npm script, not a public API route. It supports dry-run, exchange selection, batched writes, and operational result logging.

Phase 4 to 10 update:

YuJiDi now has the safe foundation for universal symbol visibility, frontend universal symbol selection, broker connection metadata, guarded Angel runtime scaffolds, Angel tick normalization, and analyzer normalized tick processing. Live Angel broker login and WebSocket data remain intentionally disabled until credentials and official payloads are approved.

## Status

Phase 0 is preparation only.

Implemented:

- Provider-neutral market-data types.
- `Instrument` model scaffold.
- `MarketDataProvider` port.
- `InstrumentProvider` port.
- Angel integration folder scaffold.
- Angel environment variable contract documentation.
- Universal `Symbol` fields.
- Offline Angel Scrip Master mapper.
- Angel Scrip Master client.
- Angel symbol sync service.
- Manual Angel symbol sync job script.
- Angel symbol sync dry-run mode.
- Angel symbol sync batched writes.
- Universal symbol search API.
- Frontend universal symbol picker support.
- BrokerConnection scaffold without secrets.
- Optional universal monitor metadata.
- Guarded Angel auth/session service.
- Guarded Angel market-data provider scaffold.
- Angel tick normalizer.
- Analyzer normalized tick bridge.

Not implemented:

- No automatic/live Angel API calls during startup.
- No Angel SDK dependency.
- No live auth/session implementation.
- No public/admin HTTP endpoint for instrument master sync.
- No live Angel WebSocket connection.
- No broker credential storage.
- No order placement.
- No portfolio sync.
- No auto trading.

## Environment Contract

Do not put real values in documentation.

Future variables:

```env
ANGEL_SCRIP_MASTER_SYNC_ENABLED=false
ANGEL_SMARTAPI_ENABLED=false
ANGEL_API_KEY=
ANGEL_CLIENT_CODE=
ANGEL_PIN=
ANGEL_TOTP_SECRET=
ANGEL_DEBUG_ENABLED=false
ANGEL_DEBUG_EXCHANGE=MCX
ANGEL_DEBUG_SYMBOL_TOKEN=
```

Security rules:

- Do not read or print `.env` for Angel work.
- Do not log Angel credentials, JWTs, feed tokens, TOTP secrets, PIN, or API keys.
- Do not commit broker credentials.

## Manual Symbol Sync Job

The Angel Scrip Master job is explicit and operator-driven.

Default dry-run for MCX:

```bash
npm run sync:angel-symbols
```

Dry-run for selected exchanges:

```bash
npm run sync:angel-symbols -- --dry-run --exchanges=MCX,NSE
```

Apply mode:

```bash
ANGEL_SCRIP_MASTER_SYNC_ENABLED=true npm run sync:angel-symbols -- --apply --exchanges=MCX
```

Optional batch size:

```bash
ANGEL_SCRIP_MASTER_SYNC_ENABLED=true npm run sync:angel-symbols -- --apply --exchanges=MCX --batch-size=1000
```

Safety rules:

- Dry-run fetches and maps Angel rows but does not write to MongoDB.
- Apply mode requires `ANGEL_SCRIP_MASTER_SYNC_ENABLED=true`.
- The job is not called from server startup.
- The job does not require Angel broker login.
- The job does not place orders or open WebSocket connections.

## Future Analyzer Bridge

Implemented foundation path:

```txt
Angel raw tick
  -> AngelTickNormalizer
  -> NormalizedMarketTick
  -> AnalyzerEngine.processNormalizedTick
```

`processNormalizedTick` reuses the production analyzer `processTick` path. Live Angel WebSocket ingestion is not implemented yet.

## Next Phase

Next work should focus on a real broker credential design with encryption, explicit user consent, and official SmartAPI login/feed-token payload validation. Angel order placement remains out of scope.
