# Angel SmartAPI Phase 0 Scaffold

This folder is a scaffold for future Angel SmartAPI read-only market-data integration.

Current status:

- No live Angel API calls.
- No Angel SDK dependency.
- No order placement.
- No portfolio sync.
- No auto trading.
- Placeholder classes throw explicit Phase 0 not-implemented errors.

Required before implementation:

- Official SmartAPI authentication/session documentation.
- Official instrument master format documentation.
- Official WebSocket/feed-token documentation.
- Tick payload examples for target exchanges, especially MCX.
- Rate-limit and reconnect guidance.

Planned future flow:

```txt
Angel raw tick
  -> AngelTickNormalizer
  -> NormalizedMarketTick
  -> AnalyzerEngine processNormalizedTick bridge
```

Safety rules:

- Do not log Angel API keys, client codes, PINs, TOTP secrets, JWTs, refresh tokens, or feed tokens.
- Do not implement order APIs without explicit approval.
- Keep Phase 1 read-only: auth/session and instrument sync only.
