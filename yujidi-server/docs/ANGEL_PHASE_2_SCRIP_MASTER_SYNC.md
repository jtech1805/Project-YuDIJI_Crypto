# Angel Integration Phase 2: Scrip Master Sync

## Purpose

Sync Angel One MCX reference symbols from the public Angel Scrip Master into YuJiDi's universal `Symbol` collection.

Source:

```txt
https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json
```

## Scope

Current Phase 2 scope:

- MCX reference-data sync only.
- Commodity symbol normalization.
- Global `Symbol` collection upsert.
- Symbols marked `requiresBrokerLogin=true`.
- Supported broker marked `ANGEL_ONE`.
- Default commodity filter:
  - `CRUDEOIL`
  - `GOLD`
  - `SILVER`
  - `NATURALGAS`

Out of scope:

- User Angel login.
- Live WebSocket streaming.
- Order placement.
- Option chain runtime.
- Broker credential storage.
- Frontend UI changes.
- Analyzer refactor.

## Configuration

Defaults are safe. Do not put secret values in documentation.

```env
ANGEL_SYMBOL_SYNC_ENABLED=false
ANGEL_SYMBOL_SYNC_ON_STARTUP=false
ANGEL_SYMBOL_SYNC_MARKET_TYPES=COMMODITY
ANGEL_SYMBOL_SYNC_EXCHANGES=MCX
ANGEL_SYMBOL_SYNC_NAMES=CRUDEOIL,GOLD,SILVER,NATURALGAS
```

Rules:

- Startup sync is disabled unless `ANGEL_SYMBOL_SYNC_ON_STARTUP=true`.
- Apply mode is disabled unless `ANGEL_SYMBOL_SYNC_ENABLED=true`.
- If names are not configured, sync defaults to the four core commodity names.
- TODO: allow full MCX sync after pagination, search, and performance are validated.

## Manual Sync

Default dry-run:

```bash
npm run sync:angel-symbols
```

Apply mode:

```bash
ANGEL_SYMBOL_SYNC_ENABLED=true npm run sync:angel-symbols -- --apply --exchanges=MCX --names=CRUDEOIL,GOLD,SILVER,NATURALGAS
```

## Upsert Identity

Angel symbols are upserted with:

```ts
{
  provider: "ANGEL_ONE",
  exchange: "MCX",
  instrumentToken: mapped.instrumentToken
}
```

Old Angel symbols are not deleted in this phase.

## Future Option Chain

Angel does not provide direct option-chain REST output. YuJiDi will later build option-chain matrices by grouping Scrip Master option tokens by name/expiry/strike and streaming FULL mode over WebSocket.
