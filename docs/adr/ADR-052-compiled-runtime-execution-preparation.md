# ADR-052: Compiled Runtime Execution Preparation

Status: Accepted

## Context

ADR-051 freezes provider-attested shadow observations and rulebook aggregation but intentionally does not resolve subjects or prepare evaluator input. The compiled runtime is independent of the Evidence ingestion runtime: it consumes caller-supplied, provider-attested observations directly and must not manufacture Evidence identity or provenance.

## Decision

Phase 4G1 adds a pure per-binding preparation boundary. It validates one immutable execution request, resolves the compiled binding's subject, selects exactly one observation by exact lineage, validates its attestation, resolves the exact historical factor definition, applies existing factor compatibility and freshness semantics, and returns one detached `ResolvedExecutionInput`. It does not execute an evaluator.

## Execution request

`CompiledExecutionRequest` contains exact rulebook identity, an explicit valid `asOf`, subject context, and a dense collection of at most 100 shadow observations. Subject context has explicit nullable `tradedInstrument` and `underlyingAsset` entries. Caller values may be mutable; services never mutate them and successful outputs are detached and deeply frozen.

The request rulebook identity is lineage only in Phase 4G1. Loading or validating a compiled rulebook belongs to later orchestration.

## Subject resolution

Canonical subjects use the existing closed subject-type vocabulary and bounded canonical key contract.

- `FIXED` returns the compiled subject and ignores both request-context entries.
- `TRADED_INSTRUMENT` requires a valid `INSTRUMENT` subject in `tradedInstrument`; `underlyingAsset` is irrelevant and ignored.
- `UNDERLYING_ASSET` requires a valid `ASSET` subject in `underlyingAsset`; `tradedInstrument` is irrelevant and ignored.

Missing relevant context and invalid relevant context are distinct failures. Irrelevant context is neither inspected nor rejected. There is no symbol inference, market lookup, or conversion between subject variants.

## Observation collection and matching

The collection must be an array, dense, non-empty, and bounded to 100 values. Every value must satisfy the structural shadow-observation contract before matching.

The exact binding match tuple is:

1. factor key,
2. factor version,
3. resolved subject type,
4. resolved subject key,
5. provider-binding ID,
6. provider-binding version,
7. resolution-policy ID,
8. resolution-policy version.

Selected-provider key and resolution outcome are attested properties, not compiled match coordinates, and therefore do not participate in matching. Zero matches returns `OBSERVATION_NOT_FOUND`. More than one match is rejected without selection: byte-for-semantic-value identical matches return `DUPLICATE_OBSERVATION`; differing matches return `AMBIGUOUS_OBSERVATION`. Unmatched extra observations are allowed so one request can prepare multiple bindings. First, last, newest, oldest, insertion-order, and latest-version selection are forbidden.

## Exact factor compatibility and freshness

Preparation resolves the binding's factor definition only through `getExact(factorKey, factorVersion)`. Missing or compile-ineligible definitions fail closed. Numeric value, allowed subject type, and unit policy are validated from that exact definition.

`evaluatedAt` is a clone of `request.asOf`. Age is exactly `asOf.getTime() - observedAt.getTime()`. A negative age is `OBSERVATION_IN_FUTURE`. For `MAX_AGE`, equality is fresh and a greater age is stale. `VALIDITY_INTERVAL` and `NON_EXPIRING` produce `NOT_APPLICABLE`. Malformed freshness policy fails closed. No system clock is read.

## Compiled factor input and provenance

`CompiledFactorInput` contains exact factor lineage, resolved canonical subject, numeric value and unit, cloned observation and evaluation times, confidence, freshness, and the validated provider attestation. Provider attestation is its sole provenance.

It is a new compiled-runtime contract. It does not inherit from `AssembledFactorInput` and contains no Evidence ID, source ID, source type, source priority, lifecycle state, or storage metadata.

## Resolved input and lineage

A successful `ResolvedExecutionInput` contains detached copies of the request rulebook identity, compiled binding, resolved subject, selected validated observation, freshness, compiled factor input, and exact factor/evaluator/provider/execution-policy lineage already carried by the binding.

## Deterministic failure order

Preparation returns the first failure in this order:

1. request envelope, rulebook identity, `asOf`, subject-context envelope, and observation collection constraints;
2. relevant subject resolution;
3. structural observation validation and exact matching cardinality;
4. selected-observation provider attestation;
5. exact factor-definition existence and compile eligibility;
6. factor subject and unit compatibility;
7. observation time and freshness;
8. immutable result projection.

The closed failure vocabulary is defined in `resolved-execution-input.types.ts`. Lower-level attestation failures are preserved as a closed nested code, not converted to fabricated preparation outcomes.

## Immutability and boundaries

Successful values are cloned, detached, and recursively frozen; dates are cloned before freezing. Failures are frozen. No input is mutated.

There are no Evidence imports, reads, writes, provider calls, evaluator calls, aggregation, normalization, classification, persistence, controller, route, API, ScoreCheck integration, template/compiler/repository mutation, feature-flag change, production registration, or runtime activation. No `getLatest()` call is permitted. Legacy scoring remains authoritative and compiled execution remains OFF.

## Consequences

Phase 4G2 can receive an exact, provider-attested, freshness-checked compiled input without coupling the compiled runtime to Evidence. How evaluator implementations consume this new input remains a separate ADR-053 decision.

