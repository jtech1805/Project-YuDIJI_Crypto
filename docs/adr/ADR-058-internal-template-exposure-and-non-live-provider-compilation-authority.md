# ADR-058: Internal Template Exposure and Non-Live Provider Compilation Authority

Status: ACCEPTED

Date: 2026-08-05

Phase: Phase A5.5-B1.5

## Context

The first real system-template compilation slice cannot be registered honestly under the current contracts. `ScoringTemplateRegistryService` stores only `ScoringTemplateDefinition`; every stored entry is returned by `list()`. `ScoringTemplateCrudService.listAvailableTemplates()` projects every such entry as an active public system template, `getSystemTemplate()` resolves it for scoring, `duplicateSystemTemplate()` permits copying it, and the closed system-template key list also makes it resolvable by ScoreCheck. The generic and compiled feature flags govern execution, not those exposure capabilities.

Compilation has a second independent constraint. Every compile-eligible template-rule mapping must resolve an exact versioned provider binding and provider-resolution policy, and the compiled rulebook must retain those identities. No real BTC ETF-flow provider is approved. A test-only provider cannot satisfy a default authority chain, while promoting a mock provider would falsely imply live availability.

ADR-055 requires explicit eligibility and preserves provider-attested lineage. ADR-057 separates provider key, runner identity, Evidence provenance, binding identity, policy identity, and historical attestation. This decision adds capability separation to those authorities without weakening exact lineage, changing existing template behavior, or granting runtime activation.

## Decision

### System-template registration envelope

One system-template registry remains the identity authority. It stores immutable registrations with the semantic contract:

```text
SystemTemplateRegistration
  template: ScoringTemplateDefinition
  capabilities:
    listable: boolean
    scoreCheckSelectable: boolean
    duplicable: boolean
    compileEligible: boolean
```

Template analytical content, lifecycle meaning, and rollout capabilities are separate. Capability fields are not inferred from `SYSTEM`, template version, lifecycle status, feature flags, presence in the registry, or compilation success.

Registration output is detached and immutable. Exact identity is the existing template key and version. Duplicate identities or malformed capability envelopes fail closed. No latest or insertion-order selection is introduced.

### Existing system templates

Migration must preserve the current seven registered system templates:

```text
listable = true
scoreCheckSelectable = true
duplicable = true
```

Their analytical definitions, versions, public summaries, resolution behavior, duplication behavior, and legacy scoring results remain unchanged. `compileEligible` is explicit and must satisfy the accepted compilation contracts; it is not granted merely to preserve public behavior.

### Internal compile-only system template

The future BTC ETF-flow characterization template may be registered as a real independently versioned system template with:

```text
listable = false
scoreCheckSelectable = false
duplicable = false
compileEligible = true
```

This registration proves system identity and compiler eligibility only. It does not make the template public, selectable, duplicable, live, or authoritative. The template is not created by this ADR.

### Capability-specific enforcement

Each owner enforces only its capability:

```text
public template listing       -> listable
ScoreCheck template resolution -> scoreCheckSelectable
public system duplication      -> duplicable
compiler template resolution   -> compileEligible
```

Public controllers must use capability-filtered service methods and must never return raw internal registrations. A non-listable template remains available through exact internal lookup only to explicitly authorized internal compilation, historical inspection, and test/replay composition boundaries. Internal lookup does not imply any public capability.

Failure is explicit at the owning boundary. No boundary falls back to another template, changes capability, checks a feature flag as a substitute, or treats absence from a public list as absence from exact historical identity.

### Provider authority registration envelope

Existing provider identity remains the authority, extended by an immutable capability envelope:

```text
ProviderAuthorityRegistration
  providerDefinition: ProviderDefinition
  capabilities:
    compileEligible: boolean
    liveExecutionEligible: boolean
    replayFixtureEligible: boolean
```

Provider identity and runtime availability are separate. No capability implies another. Provider binding and resolution-policy registrations referenced by compilation must carry compatible capability classification so validation can reject mixed or over-privileged lineage.

### Capability enforcement for providers

The compiler and template-mapping validator require exact provider, binding, and resolution-policy identities whose compilation capability is true. They do not require a live runner.

Phase 3 provider catalog construction, health participation, resolution, and runner execution accept only live-execution-eligible providers and bindings. Runner registration remains separately required for actual execution. A runner cannot grant live eligibility, and live eligibility without an exact runner cannot execute.

Internal replay accepts only exact replay-fixture-eligible provider lineage and explicit deterministic Evidence/attestation fixtures. Replay eligibility does not authorize Evidence production, persisted attestation backfill, provider resolution, runner calls, or network access.

### Internal characterization provider

A future implementation may add one clearly internal BTC ETF-flow characterization provider identity. Its exact identifier belongs to implementation, but its name and display description must not claim an external or live source.

Its capabilities are fixed as:

```text
compileEligible = true
liveExecutionEligible = false
replayFixtureEligible = true
```

It may have one exact immutable characterization-owned provider binding and one exact immutable resolution policy with the same capability restrictions. Their identities may be embedded in a compiled rulebook and used by deterministic internal replay.

It must have no production runner registration, network adapter, scheduler, health polling, Phase 3 catalog participation, fallback position, automatic Evidence production, or public product claim. It is not `MOCK_BTC_ETF_FLOW`, and existing mock fixtures are not promoted.

### Provenance and attestation boundary

Exact provider lineage remains mandatory. Characterization replay must explicitly supply Evidence provenance and an exact attestation matching the characterization provider, provider binding, and resolution policy. No provider status, provenance name, resolution outcome, timestamp, or confidence adjustment is inferred.

The absence of a production runner does not authorize weakening ADR-057. Production attestation emission remains owned by Phase 3E. Characterization Evidence and attestations are deterministic test/replay fixtures only and are never inserted into production persistence. Any test-local provenance lookup used by A4 must be explicit, immutable, injected, and incapable of provider execution.

### Compiler eligibility is not runtime eligibility

The following separation is authoritative:

```text
compile eligibility != live provider eligibility
compile eligibility != ScoreCheck selection
replay fixture eligibility != production Evidence authority
```

A rulebook referencing non-live characterization lineage may be compiled and historically stored. It may execute only when an authorized internal caller explicitly supplies observations with matching replay lineage. Compilation must not call a provider, create Evidence, register A5, create an execution binding, or activate compiled execution.

### Feature flags

`GENERIC_EVALUATOR_ENABLED` and `COMPILED_RULEBOOK_EXECUTION` remain default OFF. They control execution only. Template listing, ScoreCheck selection, duplication, compilation eligibility, live provider eligibility, and replay fixture eligibility are governed by their explicit capabilities rather than feature flags.

No new flag is required for representing the capability envelopes.

### Future real-provider migration

Approval of a real ETF-flow provider creates new immutable lineage:

```text
new provider definition
  -> new versioned provider binding
  -> new provider-resolution policy
  -> new compiled rulebook version
  -> new explicit execution binding
```

The characterization provider, binding, policy, compiled rulebook, and replay remain unchanged. No capability is mutated and no automatic promotion occurs.

## Validation and migration requirements

The implementation phase must characterize current template listing, selection, and duplication before changing registry representation. Existing behavior is preserved through explicit migrated capabilities. Public services must test capability denial independently; compiler tests must prove that public invisibility does not prevent exact compile lookup.

Provider validation must prove that a compile-only provider can satisfy compiled lineage without appearing in the live Phase 3 catalog or runner registry. It must also prove that attempting live resolution or execution with that authority fails closed.

All registrations and returned projections remain immutable, version-exact, detached, and deterministic. No system time, latest lookup, recency selection, persistence mutation, or implicit default capability is authorized.

## Alternatives considered

1. **Register the ETF template publicly and rely on the generic flag — rejected.** Execution flags do not govern listing, duplication, or ScoreCheck selection and would expose a template that cannot execute normally.
2. **Use lifecycle status for visibility — rejected.** Lifecycle and four independent rollout capabilities have different meanings; overloading status would recreate implicit authority.
3. **Create a second internal-template registry — rejected.** Two identity authorities could diverge and complicate exact historical lookup.
4. **Add explicit capabilities to one template registry — accepted.** It preserves one identity authority while enforcing each use independently.
5. **Use test-only provider fixtures in a default mapping — rejected.** Default compilation would reference an incomplete authority chain.
6. **Promote `MOCK_BTC_ETF_FLOW` — rejected.** A mock is not an approved external or internal production authority.
7. **Remove provider lineage from compiled rulebooks — rejected.** This violates immutable compiled binding and observation-attestation contracts.
8. **Allow compile-eligible but non-live provider authority — accepted.** It preserves exact lineage without claiming runtime availability.
9. **Wait for a real provider before any proof — deferred, not required.** Capability separation permits honest compilation and replay while preventing live use.
10. **Reuse one feature flag for every concern — rejected.** Flags control execution and cannot substitute for stable identity capabilities.

## Consequences

- A real system-template identity can exist without public exposure or ScoreCheck eligibility.
- Existing system-template behavior remains unchanged.
- Exact provider lineage remains present in every compiled binding.
- Compilation and deterministic replay can use an honestly labelled non-live characterization authority.
- Phase 3 live resolution cannot select or execute that authority.
- A5 remains unregistered, generic and compiled flags remain OFF, and legacy scoring remains authoritative.
- Implementation must add capability-aware registries and boundary enforcement before the ETF template itself is created.
- A real provider later produces new immutable versions rather than mutating characterization history.

## Related artifacts

- ADR-031: Provider definition and factor binding contract
- ADR-034: Deterministic provider resolution execution
- ADR-035: Provider resolution composition and adversarial proof
- ADR-043: Compiled rulebook contract
- ADR-044: Immutable evaluator configuration and provider-binding authorities
- ADR-046: Template-to-factor mapping authority
- ADR-047: Compilation compatibility validation
- ADR-055: Compiled shadow execution and parity boundary
- ADR-057: Historical provider-resolution attestation
- `yujidi-server/src/services/scoring-template-registry.service.ts`
- `yujidi-server/src/services/scoring-template-crud.service.ts`
- `yujidi-server/src/services/score-check.service.ts`
- `yujidi-server/src/registries/versioned-provider-binding.registry.ts`
- `yujidi-server/src/registries/versioned-provider-resolution-policy.registry.ts`
- `yujidi-server/src/registries/provider-resolution-runner.registry.ts`
