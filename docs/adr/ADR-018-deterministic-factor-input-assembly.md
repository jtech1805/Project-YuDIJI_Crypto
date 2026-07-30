# ADR-018: Deterministic Factor Input Assembly

Status: Accepted

Date: 2026-07-30

Phase: Phase 2D

## Context

Lifecycle-aware Evidence reads and deterministic source resolution exist as separate internal boundaries. A future evaluator needs one safe value envelope assembled from those boundaries without receiving complete Evidence records or gaining authority to select a source.

## Decision

Add a narrow `FactorInputAssemblyService` for one requested factor and subject. It reads through Phase 1D, delegates selection exclusively to Phase 2C, recovers the selected active observation, and projects one immutable evaluator-ready input. Phase 2D supports only `MARKET.PRICE`.

## Request boundary

The caller supplies an exact factor key, subject type and key, explicit valid `asOf`, and optional boolean deprecated-factor allowance. Strings are non-empty and pre-trimmed; no value is coerced or normalized.

## Read-boundary delegation

All Evidence reads go through `EvidenceReadService.read` with the exact requested factor, subject, explicit time, and Phase 1D maximum base-history limit of 1,000. No repository is imported or queried directly, no pagination loop exists, and lifecycle resolution is not duplicated.

## Completeness behavior

`complete = false`, `baseTruncated = true`, or `relationshipTruncated = true` fails closed before Phase 2C. The service does not reinterpret counts or construct lifecycle conclusions.

## Resolution delegation

For a complete read, the exact active-observation array and completeness flags are supplied to Phase 2C once. Phase 2C exclusively determines the selected Evidence ID; Phase 2D does not sort, filter, rank, compare values, or independently select Evidence.

## Selected-observation recovery

The selected ID must occur exactly once in `activeObservations`. No match returns `SELECTED_EVIDENCE_NOT_FOUND`; multiple matches or a malformed/mismatched observation return `INVALID_SELECTED_EVIDENCE`.

## Safe value projection

`MARKET.PRICE` requires an Evidence `NUMBER` with a finite `numberValue` and non-empty pre-trimmed unit. It is copied without rounding, normalization, or currency conversion. A known non-number discriminator is unsupported; a malformed number is invalid selected Evidence.

## Input-envelope contract

The envelope contains factor identity and definition version, subject, selected Evidence ID, copied number and unit, safe selected-source identity and priority, cloned observation/evaluation times, confidence, and freshness metadata. It contains neither a complete Evidence document nor the Phase 2C trace.

## Failure taxonomy

Invalid invocation/time, unsupported factor, read failure, incomplete history, no compatible Evidence, source-resolution failure, missing/invalid selected Evidence, and unsupported value type are distinct safe codes. Raw thrown errors are never returned. An invalid `asOf` uses `evaluatedAt: null` because the system clock must not fabricate a replacement.

## Explicit-time policy

Only the caller’s `asOf` is used. `Date.now()` and `new Date()` are not used. Returned dates are defensive clones.

## Immutability

Requests, read results, observations, resolver inputs/results, registry definitions, and dates are not mutated. Returned objects are recursively frozen except that cloned `Date` instances remain independently mutable without affecting later results.

## Data minimization

Selected raw provider payloads, provenance beyond safe source identity, deduplication keys, schema and validity fields, lifecycle diagnostics, relationship history, unselected values, repository details, and full resolution traces are never returned.

## Relationship to Evidence reads

Phase 1D is the only Evidence read boundary and owns lifecycle-aware bounded loading and completeness metadata.

## Relationship to compatibility

Phase 2D does not call or duplicate Phase 2B compatibility or freshness decisions.

## Relationship to source resolution

Phase 2C exclusively selects the source and Evidence ID. Phase 2D only validates enough selected shape to project safely.

## Relationship to evaluators

No evaluator is imported, registered, or executed. The envelope is only a future evaluator input.

## Relationship to scoring

No score, permission, alert, or trade decision is calculated. Existing scoring remains authoritative, Evidence remains disconnected from production decisions, and `EVIDENCE_PIPELINE_ENABLED` remains OFF.

## Consequences

Factor input assembly is bounded, deterministic, explicit-time, and auditable without exposing complete Evidence. Incomplete history and contract inconsistencies fail closed.

## Deferred work

Additional registered factors and value projections, evaluator contracts and execution, multi-factor assembly, caching, APIs, scheduling, monitoring, and production activation.

## Rejected alternatives

Direct repository reads; duplicated lifecycle or compatibility logic; independent source selection; pagination loops; returning complete Evidence or full traces; provider fetching; system-clock reads; evaluator execution; scoring integration.
