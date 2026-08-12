# ADR-016: Evidence-to-Factor Compatibility and Freshness

Status: Accepted

Date:
2026-07-30

Phase:
Phase 2B

## Context

Phase 2A defines immutable factor metadata. A separate pure boundary is needed to determine whether one caller-supplied, lifecycle-eligible Evidence observation matches that metadata and remains temporally valid and fresh at an explicit evaluation time.

## Decision

Add `EvidenceFactorCompatibilityService`. It validates one supplied observation, delegates structural policy to the Factor Registry, evaluates the observation’s inclusive validity interval, evaluates factor freshness, and returns a minimized typed result.

## Input boundary

The boundary accepts one `unknown` Evidence value and an explicit `asOf`. It performs enough runtime validation for safe evaluation but does not duplicate the complete Evidence model validator.

## Observation-only rule

Only `OBSERVATION` records are compatible. Revocations return `REVOCATION_NOT_SUPPORTED` before registry compatibility is invoked.

## Registry compatibility delegation

Factor existence, lifecycle status, value type, subject type, and unit policy remain authoritative in Phase 2A’s registry. Phase 2B calls `validateCompatibility` exactly once for structurally valid observations and maps its safe failure codes unchanged.

## Temporal-validity semantics

`validFrom` and `validUntil` are optional inclusive bounds. Missing bounds are unbounded. `asOf < validFrom` returns `NOT_YET_VALID`; `asOf > validUntil` returns `EXPIRED`. Interval validity does not imply freshness.

## Freshness semantics

For `MAX_AGE`, age is the exact integer millisecond difference `asOf - observedAt`. Negative age returns `OBSERVED_IN_FUTURE`; equality with `maxAgeMs` is fresh; a greater age returns `STALE_EVIDENCE`.

`VALIDITY_INTERVAL` and `NON_EXPIRING` return `NOT_APPLICABLE` because no independent age rule applies. Malformed runtime registry policies fail closed with `INVALID_FRESHNESS_POLICY`.

## Evaluation order

The deterministic first-failure order is:

1. Validate common Evidence shape and explicit `asOf`.
2. Reject revocations.
3. Validate observation-only shape.
4. Look up the factor and delegate structural compatibility.
5. Evaluate `validFrom`, then `validUntil`.
6. Reject observations recorded after `asOf`.
7. Evaluate freshness.
8. Return compatibility.

## Failure taxonomy

Failures distinguish invalid invocation, revocation input, registry compatibility, temporal validity, future observation, staleness, and malformed freshness metadata. Only the first deterministic failure is returned.

## Result contract

Compatible results expose Evidence ID, registered factor key, definition version, scoring-eligibility metadata, cloned evaluation time, and safe freshness metadata.

Incompatible results expose only safe identity, failure code, definition version when known, a cloned evaluation time, and optional stale age metadata. For `INVALID_AS_OF`, `evaluatedAt` is `null` because no valid caller time exists and the service cannot fabricate one.

No full Evidence value, deduplication key, provider payload, provenance, source metadata, or raw validation error is returned.

## Clock policy

The service never reads the system clock. All temporal and freshness decisions use the caller’s explicit valid `asOf`.

## Immutability

Evidence, nested Evidence values, caller dates, and registry definitions are not mutated. Every returned evaluation date is a defensive clone.

## Relationship to lifecycle resolution

The service performs no revocation, supersession, lifecycle graph, diagnostic, or history-completeness work. The caller must supply an observation already considered lifecycle-active or otherwise explicitly eligible.

## Relationship to Evidence reads

No repository or Evidence-read service is imported or invoked. Future orchestration may pass active observations from the read/lifecycle boundary into this service.

## Relationship to source resolution

No provider is selected, ranked, preferred, or assigned a trust score. Source resolution is deferred.

## Relationship to scoring

Scoring eligibility is returned as metadata only. No evaluator runs and no score, permission, alert, or trade decision is calculated. Existing scoring remains authoritative, and Evidence remains disconnected from production decision-making. `EVIDENCE_PIPELINE_ENABLED` remains OFF.

## Consequences

- Compatibility, temporal validity, and freshness are deterministic and independently observable.
- Unknown, inactive, malformed, future, and stale observations fail closed.
- The boundary remains reusable without persistence or runtime activation.
- Selection among several compatible observations remains unresolved.

## Deferred work

- Evidence-read orchestration.
- Source priority and trust policy.
- Multi-observation resolution and conflict handling.
- Evaluator and scoring integration.
- APIs, scheduling, monitoring, and runtime activation.

## Rejected alternatives

1. Query Evidence directly from the compatibility service.
2. Reimplement lifecycle resolution.
3. Read the system clock.
4. Duplicate Factor Registry structural policy.
5. Treat temporal validity and freshness as the same rule.
6. Select providers or calculate scores in Phase 2B.
