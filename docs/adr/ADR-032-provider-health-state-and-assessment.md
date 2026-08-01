# ADR-032: Provider Health State and Assessment

Status: Accepted

Date: 2026-08-01

Phase: Phase 3B

## Context

ADR-031 defines immutable providers and explicit factor-provider ordering. Later resolution phases need a deterministic operational-health assessment, but Phase 3B must not fetch telemetry, inspect bindings, select providers, execute fallbacks, or activate runtime behavior. Existing Phase 1 observability is a bounded process-local view of Evidence adapter runs; it is not the threshold-policy contract required here.

## Decision

Add a synchronous pure service that assesses one valid enabled Phase 3A provider from one caller-supplied bounded telemetry snapshot, one caller-supplied threshold policy, and an explicit `asOf`. It returns an immutable typed health result or the deterministic first validation failure. Thresholds are explicit and caller-supplied; no production policy is invented.

## Provider-health states

The states are `HEALTHY`, `DEGRADED`, `UNAVAILABLE`, and `UNKNOWN`. They describe current operational assessment only. Phase 1's historical `UNHEALTHY` adapter snapshot remains unchanged and separate.

## Health-assessment input

Input contains a defensively validated enabled provider definition, telemetry or `null`, an explicit threshold policy, and `asOf`. Provider type, authority, and cost must be valid but do not influence health.

## Explicit asOf

`asOf` is a valid finite `Date` and the sole assessment time. The service reads no system clock and generates no assessment timestamp.

## Telemetry window

Telemetry is one bounded aggregate, not an event array. Its window start must not follow its end, and its end must not follow `asOf`. Success and failure timestamps, when present, must lie within the window.

## Telemetry freshness

Telemetry age is `asOf - windowEndedAt`. Age equal to `maximumTelemetryAgeMs` remains current; greater age produces `UNKNOWN / TELEMETRY_STALE`. Old rates are not evaluated as current health.

## Success and failure counts

Counts are non-negative integers, success plus failure equals total, and consecutive failures cannot exceed failures. Zero attempts require null latency and operation timestamps and assess as `UNKNOWN / NO_TELEMETRY`.

## Error-rate calculation

For a non-empty window, error rate is exactly `failedAttempts / totalAttempts` using native precision and no rounding or percentage conversion. It is null for zero attempts.

## Consecutive failures

Consecutive failures are compared inclusively with explicit degraded and unavailable thresholds. An unavailable breach takes precedence. A degraded-only breach is represented by `RECENT_FAILURES_PRESENT`.

## Latency assessment

Average and maximum latency are null or finite non-negative milliseconds, and average cannot exceed maximum. Empty windows require both null. Health thresholds use average latency only; maximum latency remains validated telemetry context.

## Latest successful operation

Success count zero requires null `lastSuccessAt`; a positive count requires it. When recent success is required, absence or age greater than the explicit maximum produces `NO_RECENT_SUCCESS` and makes the provider unavailable. The exact age boundary remains valid.

## Operator disablement

Caller-supplied runtime `operatorDisabled` is separate from Phase 3A `enabled`. After complete input validation, operator disablement has highest assessment precedence and returns only `UNAVAILABLE / OPERATOR_DISABLED`. A Phase 3A provider with `enabled: false` is an invalid provider boundary rather than a health state.

## Threshold policy

The policy has an uppercase stable ID, positive integer version, positive telemetry age, strictly ordered degraded/unavailable error-rate, consecutive-failure, and average-latency thresholds, plus internally consistent recent-success settings. It is caller-owned and not persisted or globally registered.

## State precedence

Assessment precedence is operator disabled, missing/empty telemetry, stale telemetry, unavailable conditions, degraded conditions, then healthy. Provider ordering, commercial metadata, and provider type do not participate.

## Reason-code precedence

The frozen vocabulary order is authoritative. Operator-disabled, missing, stale, and healthy states each have one reason. Unavailable reasons are ordered `NO_RECENT_SUCCESS`, consecutive failures, unavailable error rate, unavailable latency. Degraded reasons are ordered degraded error rate, degraded latency, and recent failures. All applicable reasons at the selected severity are returned; degraded variants are omitted when the same metric is unavailable.

## Unknown-health semantics

Null telemetry or a zero-attempt snapshot produces `NO_TELEMETRY`. Stale telemetry produces `TELEMETRY_STALE`. Unknown does not imply a fallback or a provider decision.

## Healthy semantics

Fresh non-empty telemetry with a valid recent success when required, no failures, and no threshold breach produces `HEALTHY / WITHIN_HEALTHY_THRESHOLDS`.

## Degraded semantics

With no unavailable condition, a degraded error-rate or latency breach, a degraded consecutive-failure breach, or any recent failures produces `DEGRADED` with ordered applicable reasons.

## Unavailable semantics

Operator disablement, missing required recent success, or any unavailable consecutive-failure, error-rate, or average-latency breach produces `UNAVAILABLE`.

## Validation order

The service validates request, provider, policy, `asOf`, telemetry shape, and provider-key equality in that order. Only after all validation succeeds does assessment precedence apply. Only the first validation failure is returned.

## Immutability

Inputs are never mutated. Success and failure results, metrics, and reason arrays are newly created and deeply frozen. Dates are read only by epoch value and are never retained in output.

## Determinism

The service uses no I/O, clock, randomness, generated ID, timestamp, duration measurement, persistence, or external state. Equal logical inputs produce deep-equal results.

## Relationship to Phase 3A

The provider definition is caller-supplied and defensively shape-validated without invoking `ProviderCatalogService`. Phase 3A definitions, bindings, and tests remain unchanged; bindings are never inspected.

## Relationship to Phase 3C

Resolution policy and interpretation of health alongside provider order are deferred. Provider health is not provider selection.

## Relationship to Phase 3D

No fallback is executed and no provider or adapter is invoked. Resolution execution is deferred.

## Relationship to provider execution

Telemetry may eventually be composed from approved operational sources, but this service neither fetches nor records it and imports no runner, adapter, or observability service.

## Relationship to Evidence freshness

Provider operational recency is not Evidence freshness. No Evidence compatibility, lifecycle, or freshness service is called.

## Relationship to persistence

No telemetry, policy, or assessment is persisted.

## Relationship to monitoring

No monitoring infrastructure, exporter, alert, dashboard, scheduler, or runtime registration is added.

## Relationship to legacy scoring

Legacy scoring remains unchanged and authoritative. No confidence adjustment is calculated, no resolution status or fallback warning is generated, and `EVIDENCE_PIPELINE_ENABLED` remains OFF.

## Consequences

- Health is replayable from explicit telemetry, policy, and time.
- Multiple operational problems receive bounded ordered reasons.
- Threshold ownership stays outside the assessment mechanism.
- Provider selection and execution remain cleanly deferred.

## Deferred work

Production thresholds, telemetry collection and composition, persistence, monitoring, provider resolution policy, selection, fallback execution, confidence behavior, APIs, scheduling, and runtime activation are deferred.

## Rejected alternatives

1. Read the system clock or fetch telemetry inside assessment.
2. Reuse Evidence freshness as provider health.
3. Infer health from provider type, authority, cost, or binding order.
4. Select or invoke a fallback from the health service.
5. Modify Phase 1 observability or Phase 3A definitions.
6. Persist telemetry or assessments in Phase 3B.
