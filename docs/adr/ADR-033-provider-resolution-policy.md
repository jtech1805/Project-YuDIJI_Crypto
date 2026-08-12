# ADR-033: Provider Resolution Policy

Status: Accepted

Date: 2026-08-01

Phase: Phase 3C

## Context

ADR-031 defines provider identity, type, factor support, enabled status, and exact preferred/fallback order. ADR-032 deterministically assesses one provider as `HEALTHY`, `DEGRADED`, `UNAVAILABLE`, or `UNKNOWN`. Phase 3D will need explicit rules for deciding which assessed states are usable and how exceptional outcomes remain visible. Phase 3C must define those rules without receiving health, selecting a provider, or executing fallback.

## Decision

Add one synchronous pure validation service for a code-defined, single-factor provider-resolution policy. The policy defines preferred and fallback health acceptance, explicit degraded-primary permission, the no-usable-provider outcome, and confidence-adjustment metadata. A successful policy is a detached deeply frozen snapshot. Provider order remains owned by Phase 3A.

## Policy identity

`policyId` is a stable pre-trimmed 1–120 character identifier matching `^[A-Z0-9_]+$`.

## Policy versioning

`policyVersion` is a positive integer. Policy semantic changes require an explicitly supplied version change; no latest-version lookup or registry is added.

## Factor identity

Each policy targets exactly one canonical `FactorKey`. Phase 3C currently accepts only the registered `MARKET.PRICE` and does not add factors.

## Binding identity

The policy governs the validated Phase 3A binding for its exact factor. It does not embed a binding ID or provider keys because one binding per factor is already enforced. Phase 3D must receive and match the validated binding separately.

## Preferred-provider semantics

The first provider in the Phase 3A binding remains preferred. The policy declares allowed health states but contains no provider order or preferred provider key.

## Fallback-provider semantics

All remaining Phase 3A provider positions remain fallbacks in exact declared order. The fallback rule may independently allow `HEALTHY` and optionally `DEGRADED`; it never reorders or selects them.

## Allowed health states

Every rule has a non-empty duplicate-free array. Only `HEALTHY` and `DEGRADED` are usable. `UNKNOWN` and `UNAVAILABLE` are never usable and fail closed.

## Healthy-provider semantics

`HEALTHY` may be accepted by preferred and fallback rules. A healthy preferred direct provider may later produce `RESOLVED`; Phase 3C produces no result.

## Degraded-provider semantics

`DEGRADED` is usable only when explicitly included. Preferred use additionally requires `allowDegradedPreferredProvider: true`. Fallback rules may include it independently.

## Unavailable-provider semantics

`UNAVAILABLE` is forbidden from both rules and can never be usable.

## Unknown-provider semantics

`UNKNOWN` is forbidden from both rules and always fails closed; the policy cannot opt into unknown health.

## Resolution statuses

The frozen future result statuses are `RESOLVED`, `DEGRADED_PRIMARY_USED`, `FALLBACK_USED`, `PROXY_USED`, `MANUAL_REQUIRED`, and `UNRESOLVED`. They describe Phase 3D outcomes; no provider selection or resolution result occurs here.

## Direct-provider outcomes

A normally accepted preferred direct provider maps to `RESOLVED`. A non-preferred direct provider maps to `FALLBACK_USED`. A degraded preferred direct provider maps to `DEGRADED_PRIMARY_USED`, never ordinary `RESOLVED`.

## Fallback outcomes

Any non-preferred direct or manual provider use maps to `FALLBACK_USED` and requires `FALLBACK_PROVIDER_SELECTED`. Fallback use is always visible and never maps to ordinary `RESOLVED`.

## Proxy outcomes

Any selected provider explicitly typed `PROXY`, in any position, maps to `PROXY_USED` and requires `PROXY_PROVIDER_SELECTED`. Proxy substitution cannot be hidden as `RESOLVED`.

## Manual-provider outcomes

A manual provider selected from a fallback position maps to `FALLBACK_USED` and requires both `FALLBACK_PROVIDER_SELECTED` and `MANUAL_PROVIDER_SELECTED`. Manual sourcing remains visible.

## Degraded-primary outcomes

Accepted degraded preferred use maps to `DEGRADED_PRIMARY_USED` and requires `PREFERRED_PROVIDER_DEGRADED` plus `DEGRADED_PROVIDER_SELECTED`. Explicit permission and health acceptance must agree.

## Confidence adjustment

The policy declares finite raw scalars for every resolution outcome. `resolved` is exactly zero; degraded-primary, fallback, proxy, manual-required, and unresolved adjustments are non-positive. They have no assumed percentage unit and are defined but not applied to Evidence confidence, factors, normalized scores, bands, or legacy scores.

## Warning requirements

Frozen typed codes define requirements for Phase 3D: preferred degraded/unavailable/unknown, fallback/proxy/manual/degraded selection, no usable provider, and manual intervention. Phase 3C generates no runtime warnings or warning strings.

## Manual-required behavior

`MANUAL_REQUIRED` declares that no automated provider is usable and a later human workflow is required. Phase 3C does not trigger that workflow. Its confidence adjustment must be finite and non-positive.

## Unresolved behavior

`UNRESOLVED` declares fail-closed resolution with no manual path. Phase 3C does not produce this outcome; it only validates the configured choice and adjustment.

## Validation order

Validation checks request, policy object, ID, version, factor, preferred rule/states, fallback rule/states, degraded flag/consistency, no-usable outcome, confidence object, resolved zero, and remaining non-positive adjustments. Only the deterministic first failure is returned.

## Immutability

Allowed-state arrays, rules, confidence adjustments, and the validated policy are defensively copied and deeply frozen. Caller mutation cannot change results, and result mutation cannot affect later validation.

## Determinism

Validation uses no clock, randomness, generated ID, hash, persistence, I/O, health input, binding input, or external state. Equivalent inputs produce deep-equal outputs.

## Relationship to Phase 3A

Provider definitions, types, and ordering remain unchanged. Phase 3A owns the exact ordered binding, which is not duplicated or inspected in Phase 3C.

## Relationship to Phase 3B

The policy reuses the `ProviderHealthState` type but receives no health assessment, telemetry, or `asOf` and performs no health calculation.

## Relationship to Phase 3D

Phase 3D will match a validated binding, provider definitions, health assessments, and this policy; it will select at most one provider and copy the required status, adjustment, and warning codes. All execution is deferred.

## Relationship to Evidence

No Evidence is created, read, modified, or assigned confidence. No Evidence service is imported.

## Relationship to Phase 2

No Phase 2 service is invoked and no factor score, normalization, band, or decision is changed.

## Relationship to legacy scoring

Legacy scoring remains authoritative and unchanged. `EVIDENCE_PIPELINE_ENABLED` remains OFF. No API, controller, scheduler, frontend, MCP, or runtime activation is added.

## Consequences

- Health usability and exceptional outcomes become explicit and replayable.
- Fallback, proxy, manual, and degraded-primary use cannot be hidden.
- Confidence adjustment values remain caller-owned metadata.
- Phase 3D receives a deterministic validated policy without policy interpretation ambiguity.

## Deferred work

Binding and health matching, provider selection, fallback execution, runtime warnings, adjustment application, manual workflow, persistence, APIs, monitoring, and runtime activation are deferred.

## Rejected alternatives

1. Duplicate or infer provider order inside the policy.
2. Permit `UNKNOWN` or `UNAVAILABLE` health.
3. Map fallback, proxy, or degraded-primary use to ordinary `RESOLVED`.
4. Inspect or recompute provider health during policy validation.
5. Apply adjustments to Evidence or scoring in Phase 3C.
6. Select providers, execute adapters, persist policies, or generate runtime warnings.
