# ADR-011: Generic Evidence Provider Runner

Status: Accepted

Date:
2026-07-29

Phase:
Phase 1E

## Context

ADR-008 introduced the frozen generic `EvidenceProviderAdapter` contract with `adapterId` and `readCandidates()`, plus ingestion ownership of candidate normalization, deduplication, and persistence. A deterministic harness is needed to execute that existing adapter boundary without activating real providers or runtime workflows.

## Decision

Add a generic provider runner that validates `adapterId`, calls `readCandidates()` exactly once, validates and bounds the returned array, and delegates every candidate sequentially to `EvidenceIngestionService.ingest()`.

The runner uses neither `EvidenceIngestionService.ingestFrom()` nor lifecycle/read services.

## Provider adapter responsibility

The runner never understands provider-specific payload structure. The frozen Phase 1B adapter owns candidate production through `readCandidates()` and never persists Evidence. Payload-aware adapter contracts are deferred.

## Provider runner responsibility

The runner owns adapter identifier validation, one adapter invocation, returned-array validation, batch-size enforcement, sequential orchestration, exception isolation, stable indexing, outcome counting, and deterministic batch status.

## Ingestion service responsibility

The runner delegates every candidate to `EvidenceIngestionService.ingest()`. Candidate validation, normalization, canonical deduplication, duplicate-race handling, Evidence identifiers, and persistence remain ingestion responsibilities.

## Batch-size policy

The fixed maximum is 500 candidates. Empty batches are valid. A result of 501 or more fails before ingestion; it is neither truncated nor split.

## Sequential-processing policy

Candidates are awaited one at a time in original array order. Each candidate receives exactly one indexed result. No concurrency pool, parallel mapping, or `Promise.all` is used.

## Adapter-failure behavior

Invalid `adapterId`, thrown adapter execution, a non-array adapter result, or an oversized array causes batch-level `FAILED` before candidate processing. Raw exceptions are not returned.

## Candidate-failure isolation

`REJECTED`, `DUPLICATE`, and `FAILED` ingestion results do not stop later candidates. An unexpected exception thrown by `ingest()` becomes the existing safe `{ status: "FAILED", code: "PERSISTENCE_FAILED" }` result and processing continues.

## Batch-status derivation

- `COMPLETED`: the batch is empty or every result is `CREATED`/`DUPLICATE`.
- `PARTIAL`: a valid adapter batch contains at least one `REJECTED` or `FAILED`.
- `FAILED`: candidate processing never began due to an adapter-level validation or execution failure.

An all-failed candidate batch is `PARTIAL`, not batch-level `FAILED`. Duplicates count as successfully handled.

## Result ordering

Results preserve candidate order and carry the original zero-based index. Counts are derived only after the sequential loop.

## Logging and data minimization

The Phase 1E runner performs no logging. Raw payloads, candidate values, provider responses, credentials, exception messages, and stack traces are therefore neither returned nor logged.

## Retry policy

No adapter or ingestion retry is performed. Retry budgets, backoff, operational metrics, and multi-batch processing are deferred.

## Relationship to runtime providers

No concrete provider exists in Phase 1E. The runner does not fetch HTTP data, open WebSockets, access credentials, accept payloads, schedule work, or run in the background. Real providers, payload-aware adapters, schedulers, and streaming are deferred.

The existing Phase 1B `EvidenceIngestionService.ingestFrom()` method uses parallel `Promise.all` processing. Phase 1E does not call, modify, or remove it. Reconciliation with the sequential runner policy is deferred technical debt.

## Relationship to scoring

Legacy scoring remains authoritative. Scoring integration is deferred. `EVIDENCE_PIPELINE_ENABLED` remains OFF and unused. No controller, route, API, LLM, cache, frontend, lifecycle read, or runtime activation is added.

## Consequences

- Any existing adapter can be exercised deterministically by an internal caller.
- Candidate failures are isolated without hiding adapter-level failures.
- Batch bounds prevent uncontrolled ingestion fan-out.
- Sequential execution trades throughput for deterministic operational behavior.
- Phase 1B parallel `ingestFrom()` remains a separate, unused debt path.

## Deferred work

- Concrete providers and payload-aware adapter contracts.
- Scheduler, streaming, retry, and multi-batch policies.
- Runtime activation, metrics, and safe operational logging.
- Factor Registry, scoring, lifecycle-read, and API consumers.
- Reconciliation or deprecation of parallel `ingestFrom()`.

## Rejected alternatives

1. Modify the frozen Phase 1B adapter port.
2. Call `ingestFrom()` from the runner.
3. Process candidates concurrently.
4. Retry adapter or ingestion failures.
5. Truncate or split oversized batches silently.
6. Log raw payloads, candidates, or exception objects.
7. Add a concrete provider or runtime consumer.
