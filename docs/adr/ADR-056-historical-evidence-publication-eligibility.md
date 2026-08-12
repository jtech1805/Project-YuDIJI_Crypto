# ADR-056: Historical Evidence Publication Eligibility for Compiled Shadow Execution

Status: ACCEPTED

Date: 2026-08-04

Phase: A3

## Context

ADR-052 starts at a caller-supplied `CompiledShadowObservation` and evaluates freshness from `observedAt` against `request.asOf`. ADR-055 requires a future canonical-Evidence assembly boundary but does not define when an Evidence record was historically available. Observation time alone cannot answer that question: an event observed at 09:00 but published at 10:00 was unavailable to a 09:30 execution.

Canonical Evidence already carries optional source publication time as `provenance.sourcePublishedAt`. MongoDB automatically persists `createdAt` on the Evidence model, but `CreateEvidenceInput`, `EvidenceReadRecord`, repository read filters, and lifecycle result contracts do not currently expose or enforce that database creation time. Current history reads filter only `observedAt <= asOf`, and current lifecycle resolution applies revocations and supersessions using their `observedAt`. Therefore the current Evidence read result is not, by itself, a system-known historical replay boundary.

## Decision

### Ownership and ordering

Historical availability belongs to the future canonical-Evidence-to-shadow-observation assembly boundary. It is evaluated before Evidence lifecycle resolution and before provider lineage, freshness, or observation projection:

```text
bounded canonical Evidence history
  -> validate historical timestamps
  -> system-known availability filter
  -> lifecycle resolution over eligible history only
  -> provider and exact lineage validation
  -> freshness validation
  -> CompiledShadowObservation projection
```

Every Evidence record capable of influencing the result must pass availability checks. This includes the candidate observation and any revocation or superseding observation. A record unavailable at `asOf` cannot alter lifecycle state at that historical instant.

This decision does not belong to the evaluator, Phase 4G2 binding execution, aggregation, normalization, decision classification, or parity comparison. An unavailable record is not projected into evaluator input.

### Initial replay mode: system-known replay

Phase A4 uses one conservative mode, `SYSTEM_KNOWN_REPLAY`, as an architectural name. It is not a new runtime enum in this phase. A canonical Evidence record is historically available only when both conditions are true:

```text
evidence.provenance.sourcePublishedAt <= request.asOf
and
evidence.createdAt <= request.asOf
```

`provenance.sourcePublishedAt` is the effective publication time. `createdAt` is the persisted Evidence creation time and the initial authoritative proxy for when YUDIJI had stored the record. Neither field substitutes for the other.

The comparison uses exact UTC instants through finite `Date.getTime()` values. Equality is eligible. No rounding, locale conversion, current time, tolerance, or timestamp ordering fallback is permitted.

`SOURCE_AVAILABLE_REPLAY`, which checks only `provenance.sourcePublishedAt`, is deferred as a distinct research or backtesting mode. It requires a later explicit policy and may not be inferred from the caller, environment, provider, factor, or market.

### Missing and invalid timestamps

Missing `provenance.sourcePublishedAt` is ineligible. No existing exact provider timestamp policy declares `observedAt` to be publication time. A future exception requires a versioned, exact, approved provider timestamp-policy authority; provider name, factor key, market type, ingestion speed, or current date cannot imply it.

Missing `createdAt` is also ineligible for `SYSTEM_KNOWN_REPLAY`. Although the Evidence model persists it, the current typed read boundary does not reliably expose it. Phase A4 must close that read-projection gap before canonical Evidence can be assembled.

An invalid or non-finite `provenance.sourcePublishedAt`, `createdAt`, or `request.asOf` fails closed as invalid temporal lineage. Dates used in diagnostics and successful outputs are cloned. No invalid value is coerced or repaired.

Future assembly diagnostics must distinguish semantic equivalents of:

- `ELIGIBLE`;
- `NOT_YET_PUBLISHED`;
- `NOT_YET_INGESTED`;
- `PUBLICATION_TIME_MISSING`;
- `PUBLICATION_POLICY_MISSING` when a caller requests a substitution that has no exact policy;
- `INGESTION_TIME_MISSING`;
- `INVALID_PUBLICATION_TIME`;
- `INVALID_INGESTION_TIME`;
- `INVALID_AS_OF`.

Exact TypeScript names and closed result shapes belong to Phase A4. These outcomes are assembly diagnostics, not evaluator contributions, score penalties, parity mismatches, infrastructure exceptions, or public API errors.

### Temporal meanings remain separate

- `observedAt` is when the represented fact or event was observed. It continues to govern Evidence history ordering, lifecycle applicability after availability filtering, and freshness age.
- `provenance.sourcePublishedAt` is when the source made the information available. It governs publication eligibility.
- `createdAt` is assigned by Mongoose when the canonical Evidence record is persisted. For the initial replay mode it governs whether YUDIJI had stored the record.
- `validFrom` and `validUntil` are optional inclusive lifecycle validity bounds evaluated after availability filtering.
- Evidence read `asOf` is an explicit caller time. Existing repository filtering currently applies it only to `observedAt`; Phase A4 must not treat that as complete availability enforcement.
- ADR-052 freshness uses `request.asOf - observedAt` and remains separate from publication and ingestion eligibility.
- Provider runner and Evidence shadow `startedAt`/`completedAt` values are operational execution timing. They are not Evidence publication or ingestion lineage and cannot be substituted.
- `CompiledShadowObservation.observedAt` remains the compiled observation time. That contract has no publication, ingestion, lifecycle, or Evidence storage fields.

### Assembly trace and compiled observation boundary

`CompiledShadowObservation` remains unchanged. Publication and ingestion fields are assembly provenance, not evaluator input. The immutable Phase A4 trace must preserve detached semantic equivalents of:

- Evidence identity;
- factor and subject identity;
- `observedAt`;
- effective publication time from `provenance.sourcePublishedAt`;
- ingestion time from `createdAt`;
- request `asOf`;
- eligibility decision and reason;
- provider identity;
- exact provider-binding identity;
- exact resolution-policy identity.

The trace must be sufficient to reproduce why a record was or was not projected without copying the full canonical Evidence document into `CompiledShadowObservation`.

## Existing-contract gap for Phase A4

The Evidence model preserves `createdAt`, but the current `EvidenceReadRecord` alias is `CreateEvidenceInput` and therefore omits it. Repository history filters also use only `observedAt <= asOf`, and lifecycle resolution can consume records without publication or ingestion checks. Phase A4 must introduce the narrow typed read/projection support required to expose `createdAt` and must apply availability before lifecycle resolution. Until then, canonical Evidence observation assembly is not authorized to claim system-known historical correctness.

This is an implementation prerequisite and known limitation, not a reason to modify source contracts during this documentation phase.

## Alternatives considered

1. **Check publication inside the evaluator — rejected.** It would mix source availability with factor arithmetic and allow unavailable Evidence to enter compiled input.
2. **Add publication time to every `CompiledShadowObservation` — rejected.** Downstream execution does not need it; immutable assembly trace retains the eligibility proof without duplicating Evidence storage metadata.
3. **Use `observedAt` as publication time — rejected.** The instants have different meanings and may differ materially.
4. **Use `createdAt` as publication time — rejected.** Database creation proves storage timing, not when the source published the information.
5. **Allow missing publication time — rejected for Phase A4.** No exact provider timestamp policy exists, so substitution would invent provenance.
6. **Select the newest Evidence before `asOf` — rejected.** Recency selection cannot prove publication or ingestion availability and would reintroduce implicit ordering semantics.
7. **Apply a freshness penalty to future publication — rejected.** Information unavailable at `asOf` must be excluded, not scored.
8. **Source-available replay — deferred.** It is useful for research but does not prove what YUDIJI actually knew.
9. **System-known replay — accepted.** Requiring both source publication and persisted creation at or before `asOf` prevents look-ahead from late publication or late ingestion.

## Consequences

- Historical compiled shadow execution cannot consume facts before their source publication or YUDIJI persistence time.
- Late-ingested revocations and supersessions cannot rewrite earlier lifecycle state.
- Freshness remains unchanged and cannot compensate for unavailable temporal lineage.
- Missing publication or typed ingestion lineage fails closed.
- `CompiledShadowObservation` stays Evidence-independent and evaluator-focused.
- Phase A4 must close the typed `createdAt` read gap and implement immutable diagnostics before observation projection.
- Legacy scoring, production behavior, persistence schema, and feature flags remain unchanged.

## Related artifacts

- ADR-007: Append-only Evidence foundation
- ADR-009: Evidence lifecycle resolution
- ADR-010: Evidence read and query boundary
- ADR-016: Evidence-to-Factor compatibility and freshness
- ADR-052: Compiled runtime execution preparation
- ADR-055: Compiled shadow execution and parity boundary
- `src/types/evidence.types.ts`
- `src/types/evidence-lifecycle.types.ts`
- `src/models/evidence.model.ts`
- `src/repositories/evidence.repository.ts`
- `src/types/compiled-shadow-observation.types.ts`

