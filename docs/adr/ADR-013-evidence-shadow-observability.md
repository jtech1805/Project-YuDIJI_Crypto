# ADR-013: Evidence Shadow Observability

Status: Accepted

Date:
2026-07-30

Phase:
Phase 1G

## Context

The generic provider runner and first shadow adapter can now produce safe run results, but automatic execution remains disabled. Explicit shadow callers need bounded operational health metadata without turning health into Evidence or hiding side effects inside ingestion.

## Decision

Add an explicit, in-memory `EvidenceObservabilityService`. A caller records a completed provider-run result with supplied start and completion times. The recorder validates the safe result, updates bounded per-adapter counters, derives health, and returns cloned snapshots.

## Operational metadata boundary

Health metadata is operational state, not Evidence. It contains adapter identifiers, safe statuses and failure codes, aggregate counts, durations, and dates only.

No payload, candidate value, candidate result object, credential, Evidence document, exception, stack trace, or provider response is retained.

## Health state model

Each adapter snapshot stores aggregate run and candidate counters, consecutive batch failures, last run/success dates, last status, last safe batch failure code, and last duration. Unknown adapters return `null`; reads do not create synthetic state.

## Health classification

- `UNKNOWN`: no run exists; represented by absence from the store.
- `HEALTHY`: the last run is `COMPLETED`.
- `DEGRADED`: the last run is `PARTIAL`, or exactly one consecutive batch-level `FAILED` run exists.
- `UNHEALTHY`: at least two consecutive batch-level `FAILED` runs exist.

`COMPLETED` resets consecutive failure count. `PARTIAL` also resets the batch-level count because adapter execution reached candidate processing, while remaining degraded.

## Counter semantics

Every valid record increments exactly one run-status counter and adds the supplied candidate outcome counts. Candidate-level failure counts do not increment consecutive batch-level failures.

`lastSuccessAt` updates only for `COMPLETED`. Partial and failed runs preserve the previous full-success time.

## Duration semantics

Duration is exactly `completedAt - startedAt` in milliseconds. Zero is valid; negative, non-Date, and invalid Date values are rejected. Supplied and returned dates are cloned.

## Failure-code semantics

Only frozen generic provider-run failure codes are retained, and only for batch-level `FAILED` runs. Completed and partial snapshots expose `lastFailureCode: null`.

## Bounded-state policy

At most 100 unique adapter IDs are tracked. A 101st new adapter fails with `ADAPTER_LIMIT_EXCEEDED`. Existing adapters remain updateable. There is no silent eviction or unbounded growth.

## Clock semantics

Run timing is explicitly supplied. Pipeline snapshot generation uses an injected `Clock`, called exactly once per snapshot. The recorder does not read the system clock directly.

## Logging and privacy

The Phase 1G service performs no logging and adds no logger dependency. Therefore raw payloads, candidates, values, errors, secrets, and credentials cannot enter logs through this boundary.

## Process-restart behavior

Health data is in-memory only. Process restart clears it. Persistence and recovery are deferred.

## Relationship to provider runner

All updates are explicit and occur after a caller receives `EvidenceProviderRunResult`. The runner is unchanged and contains no hidden observability side effect. No provider is scheduled or automatically registered.

## Relationship to Evidence

Operational health is never persisted in Evidence documents and is not part of Evidence lifecycle, ingestion, normalization, deduplication, or read history.

## Relationship to scoring

No scoring consumer reads adapter health. Legacy scoring remains authoritative. `EVIDENCE_PIPELINE_ENABLED` remains OFF and unused. No API, controller, scheduler, WebSocket, provider executor, frontend, or LLM integration is added.

## Consequences

- Explicit shadow executions can be assessed consistently.
- Health classifications are deterministic and bounded.
- Candidate and run reliability remain distinguishable.
- Process-local state is simple but disappears on restart.
- External monitoring cannot consume these metrics until a future integration.

## Deferred work

- Persistence and distributed aggregation.
- External metrics exporters and alerting.
- Retention windows, rates, percentiles, and latency histograms.
- Explicit shadow executor and scheduler policy.
- API, operational dashboard, and scoring consumption.

## Rejected alternatives

1. Persist health inside Evidence records.
2. Modify the runner to hide recording side effects.
3. Retain candidate results, values, payloads, or exception objects.
4. Allow unbounded adapter state or silent eviction.
5. Schedule providers automatically.
6. Add an external metrics dependency in Phase 1G.
