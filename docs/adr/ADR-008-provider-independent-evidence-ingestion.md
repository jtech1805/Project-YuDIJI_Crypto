# ADR-008: Provider-Independent Evidence Ingestion

Status: Accepted

Date:
2026-07-29

Phase:
Phase 1B

## Context

ADR-007 established immutable Evidence persistence and deferred normalization, deterministic deduplication, and ingestion-level idempotency. Phase 1B needs one boundary that accepts provider-independent candidates without connecting Evidence to runtime consumers or implementing a concrete provider.

## Decision

Evidence ingestion consists of a generic provider-adapter port, strict candidate normalization, versioned canonical deduplication, and an ingestion service. It creates new Evidence records through the ADR-007 repository and never mutates existing records.

The boundary remains dormant: no controller, route, scheduler, WebSocket, scoring workflow, alert workflow, LLM, or provider adapter invokes it in Phase 1B.

## Candidate contract

Candidates preserve the exact ADR-007 observation/revocation union while omitting the persistence-owned `evidenceId` and `deduplicationKey`. They reuse the frozen Evidence record, source, subject, and value types.

Candidate validation accepts already-normalized values only. It rejects unknown fields, mixed value shapes, non-finite numbers, invalid confidence or validity intervals, untrimmed or empty bounded strings, invalid dates, unknown enums, and values of the wrong runtime type. It does not silently coerce strings, numbers, booleans, or dates.

## Provider adapter boundary

`EvidenceProviderAdapter` exposes a stable adapter identifier and asynchronously returns typed candidates. Phase 1B defines this generic port only. Binance, Angel One, NSE, news, macro-data, and other concrete adapters are deferred.

Adapters must translate provider-specific data before returning candidates. Raw provider payloads, authentication data, credentials, and arbitrary metadata cannot cross into persisted Evidence.

## Normalization

The deterministic normalizer validates the candidate and returns a detached clone. Equivalent accepted input remains semantically unchanged; the normalizer does not infer factor meaning, symbols, units, confidence, validity, or source identity.

## Canonical deduplication

Deduplication keys use a versioned canonical identity:

```text
evidence:v1:<lowercase SHA-256 hex digest>
```

The digest input contains the complete normalized candidate and the explicit deduplication version. Object keys are recursively sorted, dates are represented as UTC ISO-8601 strings, arrays retain order, and absent optional fields remain absent. Provider property ordering therefore cannot change identity, while a change to normalized identity produces a different key.

## Ingestion results

Each candidate produces one discriminated result:

- `CREATED` when a new append-only Evidence record is persisted.
- `DUPLICATE` when the canonical key already exists or the relevant deduplication unique index wins a concurrent race.
- `REJECTED` with `INVALID_CANDIDATE` when strict normalization fails.
- `FAILED` for persistence or adapter failure.

Results do not expose provider exception messages or raw data.

## Duplicate-key races

An initial lookup avoids an unnecessary create for known duplicates. The database unique index remains the concurrency authority. A MongoDB duplicate error maps to `DUPLICATE` only when structured error metadata identifies the `deduplicationKey_1` index or its `deduplicationKey` field, and the winning record can be read afterward.

An `evidenceId` collision, an unidentified duplicate-key error, a failed winner lookup, or another persistence error maps to `FAILED`. Message-string inspection is forbidden.

## Append-only and authority guarantees

Ingestion calls only `create` and approved repository reads. It adds no update, replace, delete, remove, upsert, bulk mutation, mark-revoked, or mark-superseded behavior. Revocations and supersessions remain new Evidence records.

Evidence still records observations rather than trade decisions. Legacy scoring remains authoritative and does not consume Evidence in Phase 1B. `EVIDENCE_PIPELINE_ENABLED` remains OFF and unused.

## Security and error handling

Malformed candidates are rejected before repository access. Adapter and persistence failures return bounded codes rather than propagating provider bodies, credentials, or exception text. Evidence IDs are generated at the ingestion boundary; deduplication keys are never accepted from adapters.

## Consequences

- Future provider adapters can target one stable contract.
- Canonical hashing provides deterministic, provider-independent identity.
- Strict validation makes normalization failures explicit.
- Unique-index race handling is narrow and does not hide unrelated persistence failures.
- Deduplication behavior is versioned so a future identity change requires an explicit new version and architecture decision.

## Deferred work

- Concrete provider adapters and provider-specific mappings.
- Schedulers, ingestion orchestration, retry policy, metrics, and APIs.
- Factor Registry membership validation.
- Resolver, evaluator, scoring, alert, and template integration.
- Deduplication-key version migration or compatibility handling.
- Retention, revocation resolution, and supersession resolution.

## Rejected alternatives

1. Hash raw provider payloads or property order.
2. Accept caller-supplied deduplication keys.
3. Coerce malformed candidates into apparently valid Evidence.
4. Treat every MongoDB duplicate error as an Evidence duplicate.
5. Update existing Evidence during correction or deduplication.
6. Add concrete provider or runtime integrations in Phase 1B.

These alternatives were rejected because they weaken provider independence, determinism, validation visibility, append-only history, or migration safety.
