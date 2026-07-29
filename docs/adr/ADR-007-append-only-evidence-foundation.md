# ADR-007: Append-Only Evidence Foundation

Status: Accepted

Date:
2026-07-29

Phase:
Phase 1A

## Context

YUDIJI needs a provider-independent representation of normalized observations before future factor evaluators can interpret market, macroeconomic, news, broker, internal-calculation, or manual inputs. Existing scoring remains authoritative, so this foundation must be additive and must not alter current scoring behavior.

## Decision

Evidence records observations rather than decisions. It is an immutable, append-only persistence contract introduced beside the legacy scoring system. Evaluators may interpret Evidence later, but Phase 1A adds no runtime integration.

Evidence does not decide BUY, SELL, BLOCK, PARTIAL, IGNORE, position size, risk permission, or final score. It does not replace existing scoring inputs during Phase 1, and existing scoring remains authoritative.

## Evidence responsibilities

Evidence stores a normalized observation or an append-only revocation, its canonical subject, factor key, observation time, typed value where applicable, provenance, schema version, and caller-supplied deterministic deduplication key.

Provider payloads must be normalized before persistence. Raw provider responses are not stored by default.

## Append-only lifecycle

Existing Evidence documents are never updated or deleted in place. Corrections, supersession, and revocation are represented by new records:

- A corrected observation may reference `supersedesEvidenceId`.
- A revocation is a new `REVOCATION` record referencing `revokesEvidenceId`.
- Revocation and supersession are append-only operations and preserve history.

## Value contract

Observation values use a discriminated union:

- `NUMBER` contains one finite numeric value and an optional unit.
- `BOOLEAN` contains one boolean value, including `false`.
- `CATEGORY` contains one bounded category string.
- `EVENT` contains one event code and an optional bounded normalized summary.

Value shapes cannot be mixed. Revocations contain no value.

## Provenance contract

Every record identifies a source type and normalized provider name. It may include a bounded source name, opaque provider identifier or external reference, and source publication time.

Provenance must not contain request bodies, provider response bodies, access tokens, authorization values, cookies, API keys, secrets, or credentials.

## Deduplication contract

Every record has a caller-supplied deterministic `deduplicationKey` with a unique index. Phase 1A persists but does not calculate or reinterpret this key. Generation and ingestion-level idempotency are deferred to Phase 1B.

## Security and data-minimization rules

Evidence stores normalized facts only. Arbitrary raw payloads, authentication metadata, LLM prompts or output, chat history, trade decisions, permissions, position sizes, and final scores are forbidden.

## Relationship to scoring

Evidence is introduced beside the legacy scoring system. It does not replace existing scoring inputs during Phase 1. No Evidence consumer or evaluator is connected in Phase 1A, and legacy scoring remains authoritative.

## Relationship to LLMs

No LLM creates production-authoritative Evidence in Phase 1A. LLM output cannot become authoritative Evidence without deterministic validation and a future ADR.

## Consequences

- Provider integrations can later normalize observations into one stable contract.
- Immutable history supports provenance, correction, supersession, and auditability.
- Consumers must account for append-only supersession and revocation records.
- Unique identifiers and deduplication keys reject duplicate persistence.
- Storage grows over time because records are not mutated in place.
- `EVIDENCE_PIPELINE_ENABLED` remains OFF and unused.
- Phase 1A adds no runtime integration.

## Deferred work

- Deduplication-key generation and ingestion idempotency.
- Factor Registry ownership and membership validation.
- Evidence ingestion, source resolvers, schedulers, and provider adapters.
- Evaluator interpretation and scoring integration.
- Revocation/supersession resolution queries and retention policy.
- Any deterministically validated LLM-assisted Evidence proposal workflow.

## Rejected alternatives

1. Store provider-specific response bodies.
2. Update observations in place when sources change.
3. Merge Evidence with scoring decisions.
4. Let repositories calculate deduplication or factor meaning.
5. Allow LLM output to become authoritative Evidence immediately.

These alternatives were rejected because they weaken provider independence, historical auditability, deterministic ownership, security boundaries, or legacy-scoring compatibility.
