# ADR-031: Provider Definition and Factor Binding Contract

Status: Accepted

Date: 2026-08-01

Phase: Phase 3A

## Context

Phase 1 established provider-independent Evidence ingestion, a generic provider runner, and a Binance public-price adapter. Phase 2 established the canonical Factor Registry and deterministic single-factor architecture. Phase 3 needs an explicit configuration contract describing which providers exist and their declared order for a factor before later phases add health, selection, or execution.

Provider identity, factor support, enabled status, direct/proxy/manual transparency, and human-approved authority and cost metadata must be immutable and deterministic. This phase must not infer commercial terms or activate any runtime path.

## Decision

Add code-defined provider definitions, code-defined factor-provider bindings, and one synchronous pure validation service. Validation returns the first failure in the frozen validation order or a defensive immutable catalog snapshot. Provider order is explicitly configured; no provider health is calculated, no provider selection occurs, no adapter executes, and no Evidence is written.

## Provider identity

`ProviderKey` is the stable provider identity. It is a pre-trimmed string of 1–120 uppercase ASCII letters, digits, or underscores matching `^[A-Z0-9_]+$`. A definition key must be unique. The contract can preserve existing identities such as `BINANCE_PUBLIC_MARKET_PRICE_V1`; Phase 3A does not rename an adapter or alter the Phase 1 runner.

## Provider definition

A provider definition contains only `providerKey`, `displayName`, `providerType`, `authorityLevel`, `costTier`, non-empty `supportedFactorKeys`, and `enabled`. It contains no health, latency, error, credential, endpoint, adapter, confidence, selection, warning, or resolution fields.

## Provider types

The bounded types are `DIRECT`, `PROXY`, and `MANUAL`. Direct means the requested observation is supplied directly; proxy means an explicitly approved substitute signal is supplied; manual means a reviewed manual process supplies it. No automatic interpretation follows from the type.

## Provider authority metadata

The bounded descriptive levels are `PRIMARY_SOURCE`, `LICENSED_VENDOR`, `PUBLIC_AGENCY`, `EXCHANGE`, `APPROVED_PROXY`, and `MANUAL_REVIEWED`. The existing Phase 2 source-authority registry uses explicit numeric resolution priorities and remains unchanged. Phase 3A authority levels neither replace that registry nor alter provider order.

## Provider cost metadata

The bounded descriptive tiers are `FREE`, `PAID`, `INTERNAL`, and `MANUAL`. Cost is not calculated and does not automatically prefer, reject, or reorder a provider. Credentials and subscription plans are outside this contract.

## Human ownership of commercial decisions

Authority, proxy approval, licensing suitability, production-use rights, cost tier, and the adequacy of manual review are supplied and approved by humans. Codex and runtime code must not infer vendor authority or commercial terms. Production provider definitions require human-approved values; tests may use fictional definitions.

## Supported factors

Every provider declares one or more unique keys from the canonical `FactorKey` runtime set. Unknown strings are rejected. Phase 3A does not add or alter Factor Registry definitions.

## Enabled status

An explicit boolean records whether a provider is available for an active binding. Disabled providers may remain defined for documentation but cannot appear in an ordered binding.

## Proxy transparency

A proxy is always visibly declared with `providerType: "PROXY"` and an explicitly approved authority level. Proxy use is never hidden or inferred from other metadata.

## Manual-provider transparency

A manual provider is always visibly declared with `providerType: "MANUAL"`. Manual-provider use is never hidden or inferred from cost, name, or authority metadata.

## Factor binding

Each factor may have at most one binding. A binding contains a canonical `factorKey` and a non-empty `orderedProviderKeys` array. Provider keys must be unique within the binding, defined, enabled, and explicitly support that factor.

## Preferred provider semantics

`orderedProviderKeys[0]` is the configured preferred provider. Phase 3A records that semantic but does not select, inspect, or invoke the provider.

## Fallback order semantics

All remaining keys are fallback candidates in their exact declared order. No fallback executes in Phase 3A. Authority, cost, input order elsewhere, health, or implementation details never infer or reorder fallback precedence.

## Provider registry validation

The service validates the request, provider array, and provider definitions in caller order. It rejects invalid keys, duplicate keys, invalid display names, unknown enum values, invalid or duplicate factor support, and non-boolean enabled flags. It reports only the deterministic first failure.

## Binding validation

After all provider definitions pass, the service validates the binding array and each binding in caller order. It rejects malformed or duplicate factor bindings, invalid factor keys, empty orders, duplicate bound providers, unknown providers, disabled providers, and unsupported factor-provider combinations.

## Unknown-provider rejection

A binding cannot reference a key absent from the validated provider definitions. The first such reference returns `UNKNOWN_BOUND_PROVIDER` without lookup, registration, or execution side effects.

## Duplicate rejection

Duplicate provider definitions, duplicate supported factors, duplicate bindings for a factor, and duplicate providers within a binding are rejected with distinct bounded failure codes.

## Factor-support validation

Every bound provider must list the binding factor in `supportedFactorKeys`. Failure returns `PROVIDER_FACTOR_UNSUPPORTED`; support is never inferred from provider name, type, adapter, Evidence, or runtime behavior.

## Disabled-provider rejection

Every bound provider must have `enabled: true`. Disabled definitions remain valid catalog inputs but are unavailable for active selection and therefore invalid in a binding.

## Immutability

Successful validation creates detached provider and binding records, freezes every record and nested array, and freezes the containing arrays and catalog. Mutating source inputs cannot change a result, and attempted output mutation cannot affect later validation.

## Determinism

Validation is synchronous and dependency-free. It preserves caller order, returns only the first failure, and uses no clock, randomness, generated ID, hash, persistence, or external state. Equivalent inputs produce deep-equal outputs.

## Relationship to Phase 1 provider runner

The Phase 1 `EvidenceProviderAdapter` and `EvidenceProviderRunnerService` remain unchanged. Phase 3A neither registers adapters nor invokes the runner. Provider definitions are configuration contracts, not executable adapters.

## Relationship to Phase 2 factor registry

Provider support and binding keys reuse the canonical `FactorKey` type and runtime set. No Phase 2 registry service or evaluator is invoked, and no Factor Registry definition changes.

## Relationship to Phase 3B provider health

Health status, success/failure history, latency, and error rate are deferred to Phase 3B. No provider health is calculated or represented here.

## Relationship to Phase 3C resolution policy

Selection rules and use of health are deferred to Phase 3C. Phase 3A supplies explicit preferred and fallback ordering only; it returns no selected provider or resolution status.

## Relationship to Phase 3D resolution execution

Provider fetching, adapter execution, fallback execution, retry, and resolution orchestration are deferred to Phase 3D.

## Relationship to Evidence

Phase 3A creates no Evidence, performs no Evidence read or write, and imports no Evidence repository, ingestion service, provider runner, or adapter.

## Relationship to legacy scoring

Legacy scoring remains unchanged and authoritative. `EVIDENCE_PIPELINE_ENABLED` remains OFF, and the catalog has no controller, route, scheduler, frontend, MCP, or runtime activation.

## Consequences

- Provider inventory and factor ordering become explicit, bounded, testable, and immutable.
- Proxy and manual sources remain transparent.
- Human commercial ownership is recorded rather than inferred.
- Later health and resolution phases receive a deterministic configuration boundary.
- Configuration remains code-defined and requires deployment to change.

## Deferred work

Provider health, resolution policy, provider selection, adapter registration, fetching, fallback execution, confidence adjustment, warnings, Evidence creation, persistence, credentials, APIs, administrative configuration, scheduling, monitoring, and runtime activation are deferred.

## Rejected alternatives

1. Infer order from authority, cost, provider type, health, or registration order.
2. Hide proxy or manual sourcing behind a direct-provider label.
3. Permit unknown, disabled, or factor-incompatible providers in active bindings.
4. Persist or dynamically administer configuration in Phase 3A.
5. Attach adapters, credentials, endpoints, health, or selection results to definitions.
6. Add a second preferred-provider field that could disagree with ordered position zero.
7. Modify Phase 1 provider identities or Phase 2 Factor Registry definitions.
