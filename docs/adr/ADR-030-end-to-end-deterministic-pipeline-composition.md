# ADR-030: End-to-End Deterministic Pipeline Composition

Status: Accepted

Date: 2026-08-01

Phase: Phase 2P

## Context

Phase 2A–2O provide isolated deterministic input, execution, aggregation, normalization, and semantic classification boundaries. A caller-triggered application boundary is needed to compose the completed stages without moving their business rules into an orchestrator or activating them in production.

## Decision

Add one synchronous dependency-injected pipeline service. All inputs are already assembled or validated. The service performs defensive runtime-shape and exact lineage preflight checks, then delegates strictly to Phase 2I, 2K, 2M, and 2O in order.

## Pipeline input boundary

The request contains one assembled factor input and one validated evaluator plan, aggregation policy, normalization policy, and decision-band policy. It contains no raw policy, Evidence query, provider, evaluator implementation, registry, feature flag, persistence option, or runtime configuration.

## Validated-contract requirement

The pipeline checks enough runtime shape to orchestrate safely but calls no raw-contract validation service. Each completed stage retains ownership of evaluator execution, eligibility, arithmetic, normalization, and interval matching.

## Preflight identity validation

Input and plan factors must match. Aggregation policy must exactly match plan identity, factor, count, order, evaluator ID/version, and configuration version. Normalization policy must exactly match aggregation identity, factor, and bounds. Decision-band policy must exactly match normalization identity, factor, and target range.

## Sequential stage orchestration

Phase 2I runs exactly once. Phase 2K, 2M, and 2O each run at most once and only after the preceding stage succeeds. No retry, fallback, lookup, repair, parallelism, or alternate ordering exists.

## Failure short-circuiting and taxonomy

The first preflight or stage failure stops all later execution. Typed downstream codes are preserved only as sanitized `stageFailureCode` values. Unexpected throws become `UNEXPECTED_STAGE_EXCEPTION` without exposing the thrown value.

## Successful trace contract

Every result contains all five stages in fixed order: preflight, evaluator execution, contribution aggregation, normalization, and decision-band classification. Success marks all completed and retains the four already sanitized immutable downstream successes plus complete policy lineage.

## Data minimization

Failure contains only safe factor/evidence and policy identities, failure stage/code, downstream code, and categorical trace. Success omits raw policies, raw Evidence, provider payloads, implementations, registry state, legacy scores, and broker or risk actions.

## Immutability and determinism

New identity and trace structures and the outer result are frozen. Already frozen downstream successes may be retained by reference. Inputs and results are not mutated. No clock, randomness, generated pipeline ID, timestamp, duration, persistence, or external state is used.

## Shadow-only status and relationships

The boundary is explicit and caller-triggered only. It does not assemble input, read Evidence, execute providers or evaluators directly, access registries, validate raw policies, persist, expose an API, schedule work, emit WebSockets, or register in production runtime. Phase 2A–2O remain unchanged. Legacy scoring remains unchanged and authoritative, and `EVIDENCE_PIPELINE_ENABLED` remains OFF.

## Consequences

The full deterministic architecture can be exercised end to end with typed lineage and stage visibility while remaining isolated from production scoring and trading authority.

## Deferred work

Runtime activation, authority migration, persistence, monitoring, APIs, scheduling, frontend presentation, and operational comparison require separate approval.

## Rejected alternatives

Raw policy validation; Factor Input Assembly; evaluator or registry access; duplicated aggregation, normalization, or band logic; retry; fallback; partial continuation; persistence; API activation; legacy-score comparison; semantic-band-to-trade translation.
