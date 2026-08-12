# ADR-038: ASSET Subject and Crypto ETF Net-Flow Mocked-Evidence Proof

Status: Accepted

Date: 2026-08-02

Phase: Phase 3R-C

## Context

The reconciliation roadmap requested a `BTC_ETF_NET_FLOW` proof, but the Evidence subject vocabulary lacked an asset identity and Phase 2 source resolution/input assembly contained `MARKET.PRICE` literal gates. Phase 4 cannot compile reusable factor bindings while concept and subject identity are conflated or registered factors are rejected by generic boundaries.

## Factor identity reconciliation

The roadmap name `BTC_ETF_NET_FLOW` is represented canonically as `CRYPTO.ETF_NET_FLOW` with subject `ASSET/BTC`. The factor identifies the measurable concept; the subject identifies the asset. The same factor may later apply to `ASSET/ETH` without creating an asset-specific factor key.

## ASSET semantics

`ASSET` identifies an underlying economic or digital asset independently of a tradable venue/instrument. `ASSET/BTC` means Bitcoin; it does not imply exchange, pair, contract, provider token, or trading venue.

## INSTRUMENT versus ASSET

`INSTRUMENT/BTCUSDT` remains a tradable BTC/USDT instrument. `ASSET/BTC` is the underlying Bitcoin asset. `INSTRUMENT/BTC` was rejected because it would misrepresent asset-level ETF flow as instrument-specific data and make provider/instrument tokens part of concept identity.

## Canonical asset-key rules

Asset keys reuse existing Evidence subject-key validation: explicit, non-empty, bounded, and pre-trimmed. They are not silently uppercased, parsed, symbol-resolved, or converted to provider tokens. The proof uses exact `BTC`. No asset-master database or resolver is added.

## Universal Symbol relationship

The existing universal Symbol architecture describes tradable instruments. This ADR adds no Symbol record, lookup, or mapping for `ASSET`. A future explicit subject-binding contract may map an instrument to an underlying asset; Evidence ingestion does not infer that relationship.

## Factor meaning

`CRYPTO.ETF_NET_FLOW` is the net daily flow into exchange-traded funds for a crypto asset. Positive values mean net inflow, negative values mean net outflow, and zero means neutral daily flow.

## Value and unit semantics

The factor accepts only canonical numeric Evidence and requires the exact allow-listed unit `USD`. Native finite numeric precision is preserved. No currency conversion or scaling occurs.

## Freshness semantics

The factor uses `MAX_AGE` with `86_400_000` milliseconds. Compatibility uses caller-supplied `asOf`. Age exactly equal to the maximum is fresh; one millisecond over is stale. No system clock is read.

## Time semantics

`observedAt` is the canonical observation time used for lifecycle and freshness. `provenance.sourcePublishedAt` records publication time when supplied. Ingestion time is not added to the candidate contract. `asOf` remains explicit evaluation time.

## Mock-provider semantics

The proof uses test-only provider `MOCK_BTC_ETF_FLOW` and source `MOCK_BTC_ETF_FLOW_DAILY_V1`. Source authority is constructed only inside the test. No Phase 3 provider definition, default authority rule, adapter, runner registration, network client, scheduler, API, or credential exists.

## Evidence compatibility

Canonical Phase 1 ingestion accepts ASSET/BTC positive, negative, and zero numeric USD observations. Phase 2 compatibility rejects wrong factor, subject, value type, unit, future observation, and stale Evidence. Existing validity and lifecycle semantics remain unchanged.

## Source-authority direction

Source resolution now accepts any exact registered factor rather than only `MARKET.PRICE`. Ranking remains authority, recency, confidence, and stable identity in its existing order. Production authority configuration for ETF flow is deferred.

## Generic factor-input assembly

Phase 2D now accepts any exact Factor Registry definition rather than checking a literal factor key. It still supports the existing numeric input discriminator and delegates reads, compatibility, and selection to Phase 1D/Phase 2C. It does not infer factors, select Evidence itself, fetch providers, execute evaluators, or read time.

Before this ADR, a registered non-price factor would fail source resolution and assembly as `UNSUPPORTED_FACTOR`. After this ADR, exact registry membership controls support. Unknown factors still fail closed. Identical `MARKET.PRICE` inputs retain deep-equal output and failure semantics.

## Scoring eligibility

The factor is `ELIGIBLE`, meaning deterministic evaluators may support it. No evaluator or scoring activation is added in Phase 3R-C.

## Provider-resolution relationship

Provider binding, health, selection, and execution remain Phase 3 responsibilities. The mocked proof bypasses production provider resolution and adds no registration.

## Relationship-evaluator relationship

Relationship meaning and evaluation are deferred to ADR-039/ADR-040. This proof stops at canonical assembled factor input.

## Backward compatibility

Existing subject values retain identity and ordering. Evidence persistence shape is unchanged beyond accepting the new enum member. Lifecycle, deduplication, read bounds, source ranking, `MARKET.PRICE`, provider contracts, and evaluator contracts are unchanged.

## Immutability and determinism

The default definition, nested arrays/policies, compatibility outputs, source traces, and assembled inputs follow existing detached/frozen behavior. Fixed candidates and explicit time produce deep-equal identities and results.

## Testing strategy

Focused tests prove definition metadata; ASSET and INSTRUMENT compatibility; positive, negative, and zero ingestion; deduplication; lifecycle read; exact freshness boundary; wrong factor/subject/type/unit failures; deterministic test-local authority; source selection; ETF input assembly; and `MARKET.PRICE` compatibility.

## No production activation

There is no real ETF provider, external integration, scheduler, runtime registration, controller, ScoreCheck wiring, feature-flag change, or evaluator.

## Consequences

- Underlying assets and tradable instruments are no longer conflated.
- The Factor Registry remains a closed audited allow-list with two factors.
- Phase 2C/2D now honor the registry rather than a price literal.
- A non-price mocked Evidence path reaches canonical evaluator-ready input.

## Deferred work

Real ETF data providers, asset master/resolution, production authority, provider bindings, relationship evaluation, legacy compatibility, runtime orchestration, and compiled rulebooks remain deferred.

## Rejected alternatives

1. Keep roadmap identity `BTC_ETF_NET_FLOW` and duplicate it per asset.
2. Represent Bitcoin as `INSTRUMENT/BTC`.
3. Add a real or paid ETF-flow provider.
4. Add factor-key switches to source resolution or input assembly.
5. Change lifecycle, deduplication, ranking, or `MARKET.PRICE` semantics.
