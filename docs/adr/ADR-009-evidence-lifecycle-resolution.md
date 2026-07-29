# ADR-009: Evidence Lifecycle Resolution

Status: Accepted

Date:
2026-07-29

Phase:
Phase 1C

## Context

ADR-007 made Evidence append-only, and ADR-008 added provider-independent ingestion and deterministic deduplication. Consumers will eventually need to determine whether an observation is usable without rewriting immutable history or persisting derived lifecycle state.

## Decision

Lifecycle state is computed by a pure, deterministic, read-only resolver from a caller-supplied immutable Evidence collection and an explicit `asOf` date. Lifecycle state is never persisted back onto Evidence records. The resolver has no repository, MongoDB, logging, environment, feature-flag, system-clock, provider, or scoring dependency.

`resolveAll` returns resolutions for canonical observation records only. Revocation records contribute lifecycle instructions and diagnostics but never appear as active value observations.

## Lifecycle states

- `ACTIVE`: no higher-precedence relationship applies and the validity window contains `asOf`.
- `NOT_YET_VALID`: `asOf` is before `validFrom`.
- `EXPIRED`: `asOf` is after `validUntil`.
- `SUPERSEDED`: an applicable non-cycle observation names the record.
- `REVOKED`: an applicable revocation names the record.

## Resolution precedence

The resolver applies:

```text
REVOKED
then SUPERSEDED
then NOT_YET_VALID
then EXPIRED
then ACTIVE
```

Revocation has higher precedence than supersession. Supersession has higher precedence than validity windows.

## Validity-window semantics

The caller must provide a valid `asOf` `Date`; the resolver never reads the system clock. `validFrom` and `validUntil` are inclusive. A missing lower or upper bound is unbounded in that direction.

## Revocation semantics

A revocation applies when it targets an observation and its `observedAt` is at or before `asOf`. When several apply, the earliest `observedAt`, then lexically smallest `evidenceId`, wins deterministically.

Self-revocation is diagnosed and ignored. Revocations remain append-only records and never become active observations.

## Supersession semantics

A superseding observation applies when it names an observation and its `observedAt` is at or before `asOf`. When several apply, the earliest `observedAt`, then lexically smallest `evidenceId`, wins deterministically.

Self-supersession is diagnosed and ignored. Supersessions remain append-only records.

## Transitive supersession

Each observation is resolved independently. If B supersedes A and C supersedes B, both A and B are `SUPERSEDED` after C becomes applicable. The chain is not collapsed or rewritten. Revoking B does not automatically reactivate A.

## Missing-target behavior

A missing revocation or supersession target does not throw or affect known observations. It is tolerated and surfaced diagnostically with the relationship record and missing target identifiers.

## Cycle handling

Relationship cycles are invalid lifecycle data. Every observation involved receives a `SUPERSESSION_CYCLE` diagnostic. All edges inside the cycle are ignored for invalidation, validity resolution continues, no winner is selected, and the resolver does not recurse indefinitely.

Duplicate supplied Evidence IDs are diagnosed. The first input record is the canonical record for lookup and output, without mutating the supplied collection.

## Read-time computation

Resolver output is derived from a supplied immutable Evidence collection. No lifecycle field is stored, updated, cached, or written to Evidence. Resolutions are sorted by evidence ID; active observations are sorted by observation time then evidence ID; diagnostics use stable code and identifier ordering.

## Relationship to ingestion

The resolver consumes the existing frozen Evidence read shape produced after Phase 1B ingestion. It does not normalize candidates, calculate deduplication keys, ingest records, query repositories, or modify the ingestion boundary. Cache and query APIs are deferred.

## Relationship to scoring

Legacy scoring remains authoritative. Scoring remains disconnected from lifecycle resolution. No scoring, provider, controller, route, scheduler, WebSocket, LLM, or frontend integration occurs in Phase 1C. `EVIDENCE_PIPELINE_ENABLED` remains OFF and unused.

## Consequences

- Immutable Evidence history can be interpreted consistently at any supplied time.
- Relationship anomalies remain visible without making valid history unreadable.
- Callers control evaluation time, enabling deterministic tests and replay.
- Revoked replacements do not imply rollback or reactivation.
- Future consumers must supply the complete relevant history.

## Deferred work

- Repository query APIs and bounded history loading.
- Cache design and invalidation.
- Factor Registry and lifecycle consumer integration.
- Scoring, alert, template, and resolver orchestration.
- Retention and historical compaction.

## Rejected alternatives

1. Persist lifecycle state onto Evidence documents.
2. Update targets when revocations or supersessions arrive.
3. Read the system clock inside the resolver.
4. Pick an arbitrary winner inside a supersession cycle.
5. Throw on missing targets or duplicate supplied IDs.
6. Automatically reactivate an older observation when its replacement is revoked.
7. Connect lifecycle output to scoring during Phase 1C.

These alternatives were rejected because they weaken append-only history, deterministic replay, diagnostics, or migration isolation.
