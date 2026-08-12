# Angel Market Data Integration

This folder owns YuJiDi's read-only Angel One market-data integration.

Current scope:

- Angel Scrip Master reference-data sync.
- MCX commodity symbol support.
- NSE equity cash symbol support.
- NFO futures/options symbol support.
- Angel quote normalization.
- Angel WebSocket tick normalization.
- User-scoped live-rate routing through existing backend WebSocket infrastructure.

Out of scope:

- Order placement.
- Broker reconciliation.
- Option-chain analytics.
- Greeks.
- Margin calculation.
- Strategy recommendations.
- AI scoring.

## Symbol Sync Flow

```txt
AngelScripMasterClient.fetchScripMaster
  -> AngelSymbolSyncService.filterRows
  -> mapAngelScripToUniversalSymbol
  -> SymbolModel.bulkWrite upsert
```

Stable upsert identity:

```txt
provider + exchange + instrumentToken
```

MCX defaults remain restricted to core commodities unless configured. NSE/NFO sync can be
run through script options or npm scripts. F&O sync is expiry-aware by default and skips
expired/too-far NFO/BFO contracts unless `--include-expired` is used.

## Mapping Rules

MCX:

- `exch_seg=MCX`
- `marketType=COMMODITY`
- `instrumentType=FUTURE` or `OPTION`

NSE:

- `exch_seg=NSE`
- `marketType=EQUITY`
- `instrumentType=CASH` for equity rows

NFO:

- `exch_seg=NFO`
- `marketType=FNO`
- `instrumentType=FUTURE` for `FUTSTK` / `FUTIDX`
- `instrumentType=OPTION` for `OPTSTK` / `OPTIDX`
- option rows include `strikePrice` and `optionType`

All Angel symbols store:

- `provider=ANGEL_ONE`
- `providerSymbol`
- `instrumentToken`
- `underlyingSymbol` when inferable
- `expiry` for derivative contracts
- `lotSize` and `tickSize` when available
- `requiresBrokerLogin=true`
- `supportedBroker=ANGEL_ONE`

## Quote Flow

```txt
GET /api/market-quotes/:symbolId
  -> MarketQuoteService
  -> active user Angel session
  -> AngelQuoteService.fetchAngelQuote
  -> mapAngelQuoteToMarketSnapshot
```

Quote requests use `symbol.exchange` and `symbol.instrumentToken`, so the same path supports
MCX, NSE, and NFO. API responses do not expose Angel credentials or raw provider payloads.

## WebSocket Tick Flow

```txt
Angel raw tick
  -> normalizeAngelTick
  -> WebSocketManager.handleAngelMarketTick
  -> MarketSnapshotService.recordTick
  -> ActiveTradeLiveMonitorService.handleTick
  -> frontend TICKER_UPDATE-compatible payload
```

Angel subscription keys are user-scoped:

```txt
ANGEL_ONE:<userId>:NSE:<token>
ANGEL_ONE:<userId>:NFO:<token>
ANGEL_ONE:<userId>:MCX:<token>
```

User scoping prevents one user's Angel session, feed token, or subscription from leaking to
another user.

## Safety Rules

- Do not log Angel API keys, client codes, PINs, TOTP secrets, JWTs, refresh tokens, or feed tokens.
- Do not expose raw Angel payloads to frontend APIs unless a future explicit debug endpoint sanitizes them.
- Do not implement order APIs without explicit approval.
- Keep market-data integration read-only.
