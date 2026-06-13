# Angel SmartAPI Phase 0

This document describes the Phase 0 scaffold for future Angel SmartAPI read-only market-data integration.

## Status

Phase 0 is preparation only.

Implemented:

- Provider-neutral market-data types.
- `Instrument` model scaffold.
- `MarketDataProvider` port.
- `InstrumentProvider` port.
- Angel integration folder scaffold.
- Angel environment variable contract documentation.

Not implemented:

- No live Angel API calls.
- No Angel SDK dependency.
- No auth/session implementation.
- No instrument master sync implementation.
- No Angel WebSocket connection.
- No order placement.
- No portfolio sync.
- No auto trading.

## Environment Contract

Do not put real values in documentation.

Future variables:

```env
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

## Future Analyzer Bridge

Future path:

```txt
Angel raw tick
  -> AngelTickNormalizer
  -> NormalizedMarketTick
  -> AnalyzerEngine.processNormalizedTick
```

`processNormalizedTick` is not implemented in Phase 0.

## Next Phase

Angel Phase 1 should implement auth/session and instrument master sync only after official SmartAPI documentation and payload examples are provided.
