# ADR-034: Deterministic Provider Resolution Execution

Status: Accepted

Date: 2026-08-01

Phase: Phase 3D

## Context

Phase 3A provides immutable provider definitions and exact provider order, Phase 3B provides immutable health assessments, and Phase 3C provides immutable health-acceptance and outcome rules. One deterministic boundary is needed to verify their lineage and select at most one provider without executing it.

## Decision

Add one synchronous pure executor accepting already validated catalog, one exact catalog binding, one successful health assessment per bound provider, and one validated resolution policy. It defensively validates boundaries, evaluates providers strictly in binding order, stops at the first usable provider, and returns a deeply frozen selected or no-provider result with attempts, typed warnings, and an unapplied confidence adjustment.

## Resolution request

The request contains only the validated catalog, exact binding, successful health assessments, and validated policy. It contains no telemetry, `asOf`, raw health policy, adapter, Evidence, retry, timeout, or persistence option.

## Catalog boundary

The catalog must be a defensive valid Phase 3A-shaped snapshot with unique provider keys and bindings. Providers must be enabled and support every factor for which they are bound. No catalog validation service is called.

## Binding boundary

The supplied binding must be structurally valid, non-empty, duplicate-free, and exactly equal by factor, provider count, provider keys, and provider order to one catalog binding.

## Health-assessment boundary

Every item must be a successful Phase 3B-shaped assessment with a valid provider key, policy identity/version, state, typed reason list, and finite/null metrics. Health is never recomputed.

## Policy boundary

The policy must be a valid Phase 3C-shaped snapshot with explicit factor, usable health rules, consistent degraded-primary permission, no-provider outcome, and finite non-positive confidence adjustments with resolved exactly zero. No policy validation service is called.

## Exact factor lineage

Policy factor must exactly equal binding factor before catalog-binding membership or health coverage is evaluated.

## Exact provider lineage

Every bound provider must exist in the catalog. Health keys must correspond exactly to bound providers; identity is case-sensitive and never normalized.

## Health coverage completeness

Exactly one health assessment is required per bound provider. Duplicate assessments fail before missing coverage; missing coverage fails before unexpected extra assessments. Extra assessments never influence resolution.

## Provider evaluation order

Provider order comes only from Phase 3A `orderedProviderKeys`. The executor does not sort or rank by authority, cost, type, health severity, latency, confidence, or health-policy identity.

## Preferred-provider evaluation

Position zero uses the preferred health rule. A healthy accepted direct provider resolves normally. Rejected degraded, unavailable, or unknown preferred health emits its exact typed warning before fallback evaluation. A rejected healthy preferred state is inconsistent validated input and fails closed.

## Fallback-provider evaluation

Positions after zero use the fallback health rule in exact order. The first accepted provider is selected; all later providers are projected `NOT_ATTEMPTED`. Rejected fallbacks receive `REJECTED_HEALTH` without additional preferred warnings.

## Degraded-primary behavior

An accepted degraded preferred provider additionally requires the explicit Phase 3C flag and maps to `DEGRADED_PRIMARY_USED`, with preferred-degraded and degraded-selected warnings. It never maps to ordinary `RESOLVED`.

## Direct-provider behavior

An accepted healthy preferred direct provider maps to `RESOLVED`. An accepted non-preferred direct provider maps to `FALLBACK_USED`.

## Manual-provider behavior

An accepted manual provider maps to `FALLBACK_USED`. A preferred manual provider requires `MANUAL_PROVIDER_SELECTED` but not the positional fallback warning. A non-preferred manual provider requires both fallback and manual warnings. Manual use is never hidden.

## Proxy-provider behavior

An accepted proxy in any position maps to `PROXY_USED`. It always requires the proxy warning; a non-preferred proxy also requires the fallback warning. Proxy use is never hidden.

## Warning-code derivation

Only Phase 3C typed codes are returned, without strings or duplicates, in this frozen order: preferred degraded, preferred unavailable, preferred unknown, fallback, proxy, manual, degraded selected, no usable provider, manual intervention.

## Confidence-adjustment selection

The result copies exactly one policy field based on status: resolved, degraded primary, fallback, proxy, manual required, or unresolved. Confidence adjustment is metadata only and is never applied.

## No-provider behavior

When every provider is rejected, all attempts are `REJECTED_HEALTH`, selection fields are null, and `NO_USABLE_PROVIDER` is required alongside any preferred-health warning.

## Manual-required behavior

Configured `MANUAL_REQUIRED` adds `MANUAL_INTERVENTION_REQUIRED` and copies `manualRequired`. It starts no workflow.

## Unresolved behavior

Configured `UNRESOLVED` copies `unresolved` and returns no manual-intervention warning.

## Failure behavior

Boundary or lineage failures return only `executed: false`, a typed code, and safe factor/policy identity. Raw inputs, health details, exceptions, payloads, and credentials are excluded.

## First-failure order

Request, catalog, binding, policy, health array, factor lineage, binding membership, catalog provider coverage, duplicate health, missing health, unexpected health, health identity, execution, and derived-result integrity are evaluated in that order.

## Immutability

Inputs are not mutated. Attempt objects, attempt array, warning array, result, execution wrapper, and failures are newly created and deeply frozen.

## Determinism

The executor uses no clock, randomness, generated IDs, timestamps, duration, I/O, persistence, or external state. Equal logical inputs produce deep-equal results.

## Relationship to Phase 3A

Provider order comes only from Phase 3A. Phase 3D validates lineage and duplicates none of its definition or ordering responsibility.

## Relationship to Phase 3B

Health comes only from Phase 3B successful assessments. Phase 3D neither reads telemetry nor recalculates health.

## Relationship to Phase 3C

Selection rules, statuses, warning vocabulary, no-provider outcome, and adjustments come only from Phase 3C. Phase 3D applies rather than redefines them.

## Relationship to Phase 3E

Adapter composition and adversarial fallback proof are deferred to Phase 3E.

## Relationship to provider runner

No provider runner or adapter is imported, invoked, retried, or fetched. Selection is metadata only.

## Relationship to Evidence

No Evidence is created, read, modified, or assigned confidence.

## Relationship to Phase 2

No Phase 2 service is invoked and no score, normalization, or band is changed.

## Relationship to legacy scoring

Legacy scoring remains authoritative and unchanged. `EVIDENCE_PIPELINE_ENABLED` remains OFF. No API, controller, scheduler, frontend, MCP, or runtime activation is added.

## Consequences

- Provider choice is deterministic, lineage-checked, and transparent.
- Rejected and unvisited providers remain auditable through bounded attempts.
- Exceptional provider use cannot masquerade as normal resolution.
- No provider data is fetched by the resolver.

## Deferred work

Adapter execution, data fetching, retry, Evidence ingestion, runtime composition, persistence, adjustment application, monitoring, APIs, and adversarial integration proof are deferred.

## Rejected alternatives

1. Reorder by health, authority, cost, latency, or confidence.
2. Revalidate through Phase 3A–3C services or recompute health.
3. Hide fallback, proxy, manual, or degraded-primary usage.
4. Execute or retry the selected provider.
5. Apply confidence adjustment or create Evidence.
