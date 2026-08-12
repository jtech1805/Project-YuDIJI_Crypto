# ADR-035: Provider Resolution Composition and Adversarial Proof

Status: Accepted

Date: 2026-08-01

Phase: Phase 3E

## Context

Phase 3D selects at most one provider without executing it. Phase 1 already supplies a generic adapter runner that reads candidates once and ingests them through the canonical Evidence boundary. A shadow-only composition boundary is needed to execute only the selected identity and prove that failures never trigger retry or another fallback.

## Decision

Add an immutable explicit runner registry and one asynchronous composition service. The service consumes only a successful, already-completed Phase 3D result, an explicit registry, and the existing Phase 1 runner input. It performs exact selected-provider lookup, validates the explicit runner/adapter identity, invokes at most one runner once, validates and safely projects its existing ingestion summary, and preserves resolution lineage unchanged.

## Phase boundaries

Phase 3A owns provider definitions and order, Phase 3B owns health, Phase 3C owns rules and adjustment metadata, Phase 3D owns selection, and Phase 3E only executes the selected runner. Phase 3E calls none of the earlier services and never recalculates, reorders, or reselects.

## Existing runner and ingestion boundary

The canonical callable boundary is `EvidenceProviderRunnerService.run({ adapter })`. The runner invokes `readCandidates()` once, applies the Phase 1 batch bound, and calls the canonical Evidence ingestion service sequentially. Phase 3E never calls ingestion again. Its `EVIDENCE_INGESTION` stage validates and projects the runner's already-completed ingestion outcomes.

## Explicit identity mapping

Registrations contain an exact Phase 3A `providerKey`, explicit `runnerId`, and narrow runner implementation. The request contains the explicit adapter. `runnerId` must exactly equal `adapter.adapterId`. Provider keys, adapter identities, and Evidence provenance names are separate namespaces and are never normalized or derived from one another.

## Registry

Construction validates a dense array, exact uppercase identifiers, callable runner boundary, unique provider keys, and globally unique runner identities. It snapshots and freezes registrations. Lookup is exact and returns null for unknown or differently cased keys. The default production registration array is frozen and empty; there is no discovery or runtime activation.

## No-provider behavior

An executed Phase 3D `MANUAL_REQUIRED` or `UNRESOLVED` result returns a composed no-provider projection. Runner lookup, provider execution, and Evidence ingestion stages are skipped, and no manual workflow starts.

## Selected-provider execution

Only `selectedProviderKey` is looked up. Rejected and `NOT_ATTEMPTED` providers are never consulted or invoked. The selected runner executes exactly once. No loop, retry, Phase 3D re-execution, alternate lookup, or second fallback exists.

## Failure behavior

Invalid boundaries, missing registration, identity mismatch, typed runner failure, runner exception, malformed runner result, and contained ingestion failure return typed sanitized failures with safe selection lineage. Later stages are skipped. Raw exceptions, payloads, credentials, headers, deduplication keys, and full Evidence documents are not returned.

## Partial and zero-candidate behavior

A rejected-only Phase 1 partial result remains `PARTIAL`. A contained failed ingestion maps to `EVIDENCE_INGESTION_FAILED`. A valid completed zero-candidate result succeeds with zero counts and no invented Evidence.

## Resolution lineage

Factor, requested provider, selected provider/type, resolution status, warning order, and confidence adjustment are copied unchanged. Successful execution cannot turn fallback, proxy, manual, or degraded-primary use into ordinary resolution. Adjustment metadata is not applied.

## Stage reporting

The fixed stages are resolution input, runner lookup, provider execution, and Evidence ingestion. Reached stages are completed or failed and all later stages are skipped. No raw exception is exposed as a stage code.

## Immutability and determinism

Registrations, warning arrays, stage arrays/objects, safe Evidence arrays, and composition results are detached and frozen. Phase 3E generates no ID, timestamp, duration, or random value. External provider behavior is not deterministic, but runner selection, invocation count, classification, stage projection, and lineage preservation are deterministic.

## Relationship to Phase 2 and legacy scoring

Phase 2 and legacy scoring are not imported or invoked. No confidence application, scoring mutation, decision, resolution persistence, API, controller, scheduler, frontend, MCP, dependency injection, or production registration is added. Legacy scoring remains authoritative and `EVIDENCE_PIPELINE_ENABLED` remains OFF.

## Consequences

- Selected-provider execution and ingestion outcomes can be proven in shadow tests.
- Provider execution failures remain explicit and cannot silently change selection truth.
- Existing Phase 1 normalization, deduplication, lifecycle, and persistence rules remain the sole Evidence path.

## Deferred work

Production registrations, runtime wiring, scheduling, persistence of resolution outcomes, adjustment application, APIs, and operational workflows remain deferred.

## Rejected alternatives

1. Infer adapter identity from provider key or Evidence provenance.
2. Re-run resolution or try the next provider after execution failure.
3. Add a second ingestion, normalization, deduplication, or lifecycle path.
4. Invoke Phase 2 or legacy scoring after ingestion.
5. Add production registrations or runtime activation.
