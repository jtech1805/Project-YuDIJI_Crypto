# ADR-057: Historical Provider-Resolution Attestation for Evidence

Status: ACCEPTED

Date: 2026-08-04

Phase: Phase A3.5

## Context

ADR-055 requires every `CompiledShadowObservation` to carry exact provider-binding and resolution-policy lineage, the selected provider key, and a closed resolution outcome. Phase A4 correctly stopped because canonical Evidence proves its Evidence ID, factor, subject, value, unit, `provenance.provider`, observation time, optional `provenance.sourcePublishedAt`, and persisted `createdAt`, but it does not preserve the historical provider-resolution decision that caused its provider to execute.

Phase 3D returns `ProviderResolutionExecutionResult`. A selected `ProviderResolutionSelectedResult` preserves factor key, policy ID/version, requested and selected provider keys, selected provider type/order, exact resolution status, confidence adjustment, warnings, and provider attempts. Its statuses are `RESOLVED`, `DEGRADED_PRIMARY_USED`, `FALLBACK_USED`, and `PROXY_USED`. Phase 3E `ProviderResolutionCompositionService` executes only that selected provider through `ProviderResolutionRunnerRegistry`, then exposes safe persisted Evidence IDs from `CREATED` and `DUPLICATE` ingestion outcomes.

The existing Phase 3D binding is an unversioned `FactorProviderBinding`; it does not carry `providerBindingId` or `providerBindingVersion`. The immutable compiled authority uses `VersionedProviderBindingDefinition`. Phase 3E also deliberately treats Phase 3A `providerKey`, registration `runnerId`, adapter `adapterId`, and Evidence provenance names as separate namespaces. Therefore exact binding lineage and provider-to-provenance correspondence cannot be inferred from the current composition result.

## Decision

### Separate immutable attestation authority

Introduce, in Phase A3.6, a dedicated historical authority with the semantic contract:

```text
attestation identity/version
Evidence ID
exact provider-binding identity/version
exact resolution-policy identity/version
selected provider key and type
exact Phase 3 resolution status
confidence adjustment and ordered warning codes
explicit resolution time
persistence creation time
```

The canonical name is `EvidenceProviderResolutionAttestation`. Exact TypeScript field names remain an implementation detail, but the contract must preserve the existing repository names `providerBindingId`, `providerBindingVersion`, `policyId`, `policyVersion`, `selectedProviderKey`, `selectedProviderType`, `resolutionStatus`, `confidenceAdjustment`, and `warningCodes` rather than introduce semantic aliases without need.

The attestation records the authoritative selected result; it does not copy provider-health snapshots or recompute health. Phase A4 needs the historical decision and lineage, not the telemetry calculation envelope.

### Origin and emission

Only the Phase 3E composition boundary may emit the initial attestation:

```text
exact Phase 3D selected result
  -> exact versioned provider-binding lineage validation
  -> exact runner registration and adapter execution
  -> canonical Evidence ingestion
  -> persisted Evidence identity
  -> append-only attestation insertion
```

Emission uses the same in-memory `ProviderResolutionSelectedResult` that caused the selected runner to execute. It must not rerun Phase 3D, inspect current health, load a current policy, reorder providers, or reconstruct a selection later.

Phase A3.6 must extend the composition/emission input narrowly enough to receive the exact `VersionedProviderBindingDefinition` that governed the run. Before insertion, it must validate its factor, selected-provider membership/order, and complete ordered provider lineage against the Phase 3D result and exact versioned authority. Binding identity cannot be inferred from factor key or current registry contents.

The Phase 3D result already carries exact resolution `policyId` and `policyVersion`. A3.6 must validate those values against the exact versioned resolution-policy authority and against the compiled binding lineage; it may not select a latest policy.

### Resolution and creation time

`resolvedAt` is the explicit caller-supplied UTC instant associated with the Phase 3 resolution invocation. Phase 3D and Phase 3E currently read no clock and preserve no resolution time, so A3.6 must require this value from the orchestration context; it must not manufacture it with the system clock after execution.

`createdAt` is the attestation persistence creation instant assigned by the dedicated persistence boundary. It proves when YUDIJI stored the attestation. It is distinct from `resolvedAt`, Evidence `observedAt`, Evidence `provenance.sourcePublishedAt`, and Evidence `createdAt`.

For system-known replay, Phase A4 requires all three storage/publication conditions:

```text
Evidence provenance.sourcePublishedAt <= request.asOf
Evidence createdAt <= request.asOf
attestation createdAt <= request.asOf
```

`resolvedAt` remains diagnostic historical lineage and must be valid and no later than attestation `createdAt`; it does not replace the attestation-created check. All comparisons use exact finite UTC instants with equality accepted and no rounding.

### Evidence correlation and cardinality

Each attestation correlates to exactly one persisted `evidenceId`:

```text
one Evidence ID -> zero or one attestation
```

Zero means the Evidence remains canonical but is ineligible for compiled shadow assembly. More than one is a storage invariant violation. Lookup is exact by Evidence ID and returns zero or one record; no recency, timestamp, version, insertion-order, latest, or most-recent selection exists.

Phase 3E may emit for persisted IDs returned by its canonical `CREATED` or `DUPLICATE` outcomes. An exact duplicate attestation is idempotent. A duplicate Evidence outcome with an existing different attestation, or a reused attestation identity with different content, is a conflict and fails closed. Attestation `createdAt` prevents a later duplicate run from making the record eligible before the attestation actually existed.

No manual or retrospective backfill mechanism is approved. Evidence without an attestation emitted by this approved path remains unattested.

### Append-only persistence

Attestations are persisted in a dedicated collection with:

- unique exact attestation identity/version;
- unique `evidenceId`;
- immutable detached records;
- append-only insertion;
- exact Evidence-ID read;
- deterministic duplicate and conflict outcomes;
- cloned Dates and deeply frozen service outputs.

There is no update, delete, replacement, upsert, activation, supersession, latest lookup, most-recent lookup, or automatic backfill. Attestation data is not embedded as mutable Evidence state and does not change Evidence creation contracts.

### Explicit provider namespace mapping

ADR-035 already freezes that provider key, runner ID, adapter ID, and Evidence provenance are separate namespaces. Existing registrations prove:

```text
selected providerKey -> runnerId
runnerId == adapter.adapterId
```

They do not prove the adapter's emitted `Evidence.provenance.provider`. Phase A3.6 must add an explicit immutable registration mapping from the exact runner registration to the expected Evidence provenance identity, using semantic equivalents of:

```text
providerKey
runnerId / adapterId
evidenceProvenanceProvider
```

Every Evidence ID being attested must be read through the canonical exact Evidence boundary and its `provenance.provider` must match that registered value exactly. The mapping is case-sensitive, immutable, and explicit. No normalization or equality between namespaces is assumed. `sourceName` may remain diagnostic but cannot substitute for this mapping.

### Resolution-status projection

Phase A4 projects the preserved exact Phase 3 status into the existing coarse compiled vocabulary only as follows:

| Phase 3 resolution status | Compiled observation outcome |
| --- | --- |
| `RESOLVED` | `RESOLVED` |
| `DEGRADED_PRIMARY_USED` | `RESOLVED` |
| `FALLBACK_USED` | `FALLBACK` |
| `PROXY_USED` | `PROXY` |

The `DEGRADED_PRIMARY_USED -> RESOLVED` conversion is an explicit lossy projection, not an inference that the provider was healthy. The attestation and Phase A4 trace retain `DEGRADED_PRIMARY_USED`, its exact non-positive confidence adjustment, and ordered warning codes. `CompiledShadowObservation` remains unchanged.

Manual-required and unresolved results have no selected provider, execute no runner, create no attestation, and cannot project an observation.

### Phase A4 eligibility

An Evidence record may proceed to compiled observation projection only when:

1. exact Evidence-ID lookup returns one attestation;
2. its Evidence ID matches exactly;
3. attestation creation time is at or before request `asOf`;
4. exact provider-binding identity/version matches the compiled binding;
5. exact resolution-policy identity/version matches the compiled binding;
6. selected provider is a member of the exact binding and corresponds through the explicit registration mapping to Evidence provenance;
7. the preserved status has the frozen projection above;
8. no duplicate, corruption, or identity conflict exists;
9. ADR-056 Evidence publication and ingestion eligibility also passes.

Missing, future, invalid, duplicate, mismatched, or unsupported attestation is a typed assembly ineligibility outcome. It is not a score, confidence penalty, parity mismatch, infrastructure retry, or public API error.

### Evidence persistence without attestation

Evidence ingestion remains authoritative and append-only even if attestation persistence fails. The system must not delete or roll back canonical Evidence. Instead:

- Phase 3E returns an explicit partial or failed attestation-emission result;
- the affected Evidence IDs remain readable for existing Evidence consumers;
- those IDs remain ineligible for compiled shadow assembly;
- the failure is operationally visible without exposing raw exceptions;
- Phase 3E must not report full attested success.

Transaction, outbox, retry, reconciliation, and durable backfill are deferred. No later process may fabricate the missing attestation without another accepted architecture decision.

## Alternatives considered

1. **Persist resolution fields directly inside Evidence — rejected.** It would couple mutable rollout provenance to canonical Evidence creation and change existing ingestion contracts.
2. **Rerun provider resolution during A4 — rejected.** Current health and policy state cannot reproduce the historical decision.
3. **Infer status from provider order — rejected.** Position does not prove health, degraded-primary, proxy, or actual selection history.
4. **Treat every matching provider as `RESOLVED` — rejected.** It would hide fallback, proxy, and degraded-primary use.
5. **Make `DEGRADED_PRIMARY_USED` ineligible — rejected.** The selected provider produced canonical Evidence under an explicitly accepted policy; detailed degradation remains preserved in trace.
6. **Expand `CompiledShadowObservation` with a degraded outcome — rejected.** The existing coarse observation vocabulary is sufficient when exact status remains in attestation and assembly diagnostics.
7. **Use the explicit coarse mapping while preserving detailed trace — accepted.** It preserves current compiled contracts without erasing historical detail.
8. **Keep attestations only in memory — rejected.** Process restart and historical replay would lose authority.
9. **Persist a separate append-only attestation — accepted.** It preserves independent immutable lineage without changing canonical Evidence semantics.
10. **Allow unattested legacy Evidence — rejected initially.** Raw provider strings cannot prove historical resolution; manual or migration backfill requires a later ADR.

## Consequences

- Phase A4 can consume one exact historical provider-selection proof per Evidence ID without reconstructing current state.
- Canonical Evidence and compiled observation contracts remain unchanged.
- Provider namespace correspondence becomes explicit rather than assumed.
- Exact binding lineage must be added to the Phase 3E emission boundary because Phase 3D currently carries only an unversioned binding.
- Provider-resolution time must become caller-supplied lineage because the current Phase 3 boundaries intentionally have no clock.
- Evidence may persist successfully while remaining compiled-shadow-ineligible after attestation failure.
- A3.6 must implement the authority and Phase 3E emission before A4 resumes.

## Related artifacts

- ADR-031: Provider definition and factor binding contract
- ADR-032: Provider health state and assessment
- ADR-033: Provider resolution policy
- ADR-034: Deterministic provider resolution execution
- ADR-035: Provider resolution composition and adversarial proof
- ADR-051: Compiled rulebook runtime aggregation and observation attestation
- ADR-052: Compiled runtime execution preparation
- ADR-055: Compiled shadow execution and parity boundary
- ADR-056: Historical Evidence publication eligibility
- `src/types/provider-resolution-execution.types.ts`
- `src/types/provider-resolution-composition.types.ts`
- `src/registries/provider-resolution-runner.registry.ts`
- `src/types/versioned-provider-binding.types.ts`
- `src/types/evidence.types.ts`
- `src/types/compiled-shadow-observation.types.ts`

