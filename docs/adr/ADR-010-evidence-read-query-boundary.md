# ADR-010: Evidence Read and Query Boundary

Status: Accepted

Date:
2026-07-29

Phase:
Phase 1D

## Context

ADR-009 defines pure lifecycle resolution over supplied Evidence history. An internal application boundary is needed to validate a query, load the relevant persisted history safely, include lifecycle relationships, and invoke that resolver without adding a runtime consumer.

## Decision

Add a read-only Evidence repository extension and application service. Evidence history reads are always bounded, `asOf` is required, and repository queries never return future Evidence relative to `asOf`.

Base history is limited to 1,000 records and relationships are limited to 2,000 records. Both result sets are counted independently. If either result is truncated, lifecycle resolution is incomplete and the service returns no active observations or resolutions.

## Internal query contract

Queries identify one exact factor, subject type, canonical subject key, explicit `asOf`, and optional base limit. Strings must already be normalized. Runtime types are validated without coercion.

## Bounded history rules

The default base limit is 200 and the maximum is 1,000. The relationship limit is fixed at 2,000. Fractional, non-finite, non-positive, and excessive caller limits are rejected rather than clamped.

## Relationship-loading strategy

The repository first loads and counts the bounded factor/subject history through `observedAt <= asOf`. It then loads and counts revocations or superseding observations targeting the unique base IDs, also through `observedAt <= asOf`.

Empty target IDs return empty reads and a zero count without issuing a broad query.

## Truncation semantics

Base truncation is `baseCount > returnedBaseLength`. Relationship truncation is `relationshipCount > returnedRelationshipLength`. Overall truncation is true when either is true.

Truncated history is surfaced explicitly and must not be silently treated as complete. Incomplete results retain bounded history and count metadata but return empty `activeObservations`, `resolutions`, and diagnostics because lifecycle conclusions would be unsafe.

`historyCount` counts only base factor/subject matches. `relationshipCount` counts relationship-query matches.

## Ordering rules

Repository reads and merged history sort by `observedAt` ascending, then `evidenceId` ascending. Duplicate IDs are merged deterministically with the bounded base record taking precedence over a relationship-query duplicate.

## Read-service responsibilities

The service validates and normalizes query limits, coordinates both bounded reads and counts, merges history without mutation, fails closed on truncation, invokes the Phase 1C resolver for complete history, and scopes outputs to base IDs.

## Repository responsibilities

Repository methods fetch and count only. They apply exact filters, explicit bounds, and deterministic ordering. They do not calculate lifecycle state.

Three query-specific indexes support:

- factor, subject, observation time, and evidence ID;
- revocation target, observation time, and evidence ID;
- supersession target, observation time, and evidence ID.

## Lifecycle-resolver integration

Lifecycle rules remain owned by the Phase 1C resolver. The read service does not duplicate precedence, validity, cycle, revocation, or supersession logic and does not persist or mutate lifecycle state.

## Error handling

Invalid queries throw typed bounded error codes. Repository infrastructure errors and unexpected resolver contract errors propagate unchanged. They are never converted to empty or truncated results.

## Data minimization

The boundary returns normalized Evidence fields only. It adds no provider payloads, authentication data, arbitrary metadata, or public transport shape.

## Relationship to scoring

Legacy scoring remains authoritative and disconnected. `EVIDENCE_PIPELINE_ENABLED` remains OFF and unused. No API, controller, scoring, provider, scheduler, WebSocket, LLM, or frontend integration occurs.

## Relationship to future Factor Registry

Factor keys are exact query identifiers but are not validated against a registry. Factor Registry integration is deferred.

## Consequences

- Internal callers can obtain deterministic, lifecycle-aware Evidence reads.
- Counts distinguish exact-limit completeness from truncation.
- Relationship truncation cannot silently produce authoritative lifecycle conclusions.
- Query-specific indexes support bounded deterministic access.
- Consumers must explicitly handle `complete: false`.

## Deferred work

- Cache and pagination APIs.
- Factor Registry integration.
- Public APIs and authorization.
- Scoring and other runtime consumers.
- Multi-page complete lifecycle assembly.

## Rejected alternatives

1. Unbounded base or relationship reads.
2. Inferring truncation only from returned length equaling the limit.
3. Returning lifecycle conclusions from incomplete history.
4. Reimplementing lifecycle rules in the read service or repository.
5. Returning externally fetched superseders as active observations outside query scope.
6. Adding a controller, cache, provider, or scoring integration in Phase 1D.
