# ADR-012: Binance Public Price Evidence Adapter

Status: Accepted

Date:
2026-07-30

Phase:
Phase 1F

## Context

ADR-011 provides a generic shadow runner for the frozen Phase 1B pull-adapter contract. Phase 1F needs one narrow concrete adapter to prove that public provider data can be translated into normalized Evidence without activating the pipeline or affecting legacy behavior.

## Decision

Implement `BINANCE_PUBLIC_MARKET_PRICE_V1` for bounded Binance spot-USDT ticker prices. The implementation consists of an injected public client, injected clock, strict provider adapter, and shadow-only tests through the existing generic runner.

## Provider scope

One adapter handles one observation category: public market price. The initial configured examples are `BTCUSDT` and `ETHUSDT`. Symbols are explicitly constructor-injected; arbitrary runtime user input is not accepted.

## Public-data-only rule

Only public Binance market-price data is used. No API key, secret, authorization header, cookie, account, balance, position, order, trade, or user data is accessed.

## Client/adapter separation

Provider HTTP concerns belong to `AxiosBinancePublicMarketClient`. It calls the public `/api/v3/ticker/price` endpoint with the established 5-second Binance ticker timeout and returns an unknown payload.

Provider-to-Evidence translation belongs to `BinancePublicPriceEvidenceAdapter`. The client does not understand Evidence, factors, subjects, or persistence.

## Supported symbols

Configuration requires 1–20 unique, already-trimmed uppercase Binance USDT symbols. Invalid, duplicate, lowercase, malformed, non-string, or excessive configurations fail in the constructor before any provider request.

## Provider-response validation

Each response must be a non-array object containing string `symbol` and `price`. The symbol must be normalized, match the approved USDT-symbol pattern, and exactly equal the request.

Price translation accepts a strict positive, non-exponent decimal string. Whitespace, suffixes, empty values, zero, negatives, `NaN`, infinity, exponent notation, and non-string values are rejected. Unknown response fields are allowed but ignored and never copied into Evidence.

## Timestamp semantics

The adapter calls an injected `Clock` exactly once per `readCandidates()` execution. The result must be a valid `Date`. Its millisecond value is captured, and each candidate receives a separate cloned `Date`. The adapter never reads the system clock directly or mutates the clock value.

## Canonical subject mapping

Each symbol maps to:

```text
type: INSTRUMENT
key: CRYPTO:BINANCE:<symbol>
symbol: <symbol>
exchange: BINANCE
marketType: CRYPTO
```

This is a narrow Phase 1F mapping, not a global symbol registry.

## Factor mapping

The frozen narrow factor key is:

```text
MARKET.PRICE
```

No Factor Registry is implemented.

## Unit mapping

Supported symbols are USDT-quoted and numeric Evidence values use unit `USDT`. Prices are not rounded beyond normal JavaScript numeric representation.

## Source identity

Provenance uses source type `MARKET_DATA`, provider `BINANCE`, and source name `BINANCE_PUBLIC_MARKET_PRICE_V1`.

Because the frozen Evidence contract has no `sourceId` field, its bounded `externalReference` carries:

```text
BINANCE_PUBLIC_MARKET_PRICE_V1:<symbol>:<UTC observation timestamp>
```

Price is not included. Phase 1B canonical deduplication already includes normalized value identity.

## Adapter ID and versioning

The adapter ID is exactly `BINANCE_PUBLIC_MARKET_PRICE_V1`. Mapping or identity changes require an explicit version change and architecture review.

## Error behavior

Typed safe adapter codes cover invalid configuration, clock, provider request, response, symbol, and price failures. Errors contain no raw response, URL query, provider error body, credentials, or secret-bearing stack data.

Any symbol failure fails the entire coherent snapshot. The adapter returns no partial candidate array.

## Batch behavior

The clock is captured once and configured symbols are fetched sequentially in original order. Candidate order matches configuration order. Parallel requests and partial snapshots are deferred.

## Shadow-mode restrictions

The adapter is instantiated only in unit/integration tests or a separately approved future manual shadow command. It is not registered at application startup and no manual script is added.

No scheduler, WebSocket connection, controller, route, API, or automatic runtime path exists.

## Relationship to provider runner

Batch execution remains owned by `EvidenceProviderRunnerService`. The adapter implements the unchanged frozen `adapterId`/`readCandidates()` port.

## Relationship to ingestion

Persistence remains owned by `EvidenceIngestionService`. The adapter does not call MongoDB, generate Evidence IDs, calculate deduplication keys, or persist records.

## Relationship to scoring

The adapter does not calculate scores, permissions, BUY/SELL conclusions, or risk decisions. Legacy scoring remains authoritative and disconnected.

## Security and data minimization

No credentials are configured or sent. Neither client nor adapter logs raw payloads. Only allow-listed normalized Evidence fields cross the adapter boundary. No LLM, RAG, vector store, or MCP is used.

`EVIDENCE_PIPELINE_ENABLED` remains OFF and unused.

## Consequences

- The generic Evidence pipeline is proven with one real public-provider mapping.
- Strict validation prevents malformed or mismatched snapshots from becoming candidates.
- Deterministic timestamps support stable replay and deduplication.
- Coherent-snapshot failure avoids silently incomplete market-price batches.
- Sequential requests limit provider pressure but reduce throughput.

## Deferred work

- Automatic runtime registration and shadow orchestration.
- Scheduler, streaming, WebSocket, retries, and partial snapshots.
- More symbols, quote assets, observation categories, and providers.
- Factor Registry and global symbol registry integration.
- Scoring, alert, API, and frontend consumers.
- Operational metrics and safe logging.

## Rejected alternatives

1. Reuse the coercive legacy 24-hour ticker helper.
2. Access authenticated Binance endpoints.
3. Read the system clock directly.
4. Accept arbitrary or silently normalized symbols.
5. Return partial candidates after one symbol fails.
6. Fetch configured symbols concurrently.
7. Copy raw provider fields into Evidence.
8. Register the adapter into startup, scoring, alerts, or WebSockets.
