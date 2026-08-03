# ADR-044: Immutable Evaluator-Configuration and Provider-Binding Lineage Authorities

Status: Accepted

Date: 2026-08-03

Phase: Phase 4B

## Context

ADR-043 defines compiled rulebooks that reference exact evaluator configurations and provider bindings. Factor definitions, evaluators, provider-resolution policies, and Phase 2 execution policies already expose versions, but evaluator configurations lack identity/history and Phase 3 factor-provider bindings lack identity/version.

## Problem statement

Without immutable authorities, the same compiled reference could later resolve to changed thresholds, contributions, factor support, or provider order. Referential integrity must exist before compilation begins.

## Compiled-rulebook referential integrity

Compiled references resolve by exact identity and version. Phase 4B supplies closed in-memory authorities for configuration and provider-binding history. It does not change ADR-043 structural validation or implement complete rulebook reference validation.

## Evaluator-configuration identity

Identity is `configurationId`, an exact uppercase `^[A-Z0-9_]+$` identifier of 1–120 characters. It is separate from evaluator identity.

## Evaluator-configuration version

`configurationVersion` is a positive safe integer. Content changes and compile-eligibility changes require a new version. Registered versions cannot be replaced.

## Evaluator ownership

Every definition freezes exact `evaluatorId + evaluatorVersion`. The initial closed definition variant supports only `GENERIC_RELATIONSHIP_FACTOR_EVALUATOR` v1 because it is the only evaluator with a reusable pure content validator. Arbitrary evaluator/configuration payloads are rejected.

## Configuration content ownership

The evaluator-specific configuration type owns relationship, unit, thresholds, contributions, and contribution bounds. The authority stores a detached frozen copy; it does not interpret values during lookup or execution.

## Configuration validation ownership

The registry validates identity, lineage, closed factors/relationships, duplicates, and immutable storage. A compile-eligible generic relationship definition delegates content validation to the existing `validateGenericRelationshipConfiguration`; formulas are not duplicated. Deferred relationships may be retained only with `compileEligible: false`.

## Configuration historical lookup

`getExact(id, version)` is authoritative. `listVersions(id)` returns all versions in ascending numeric order. Registering later versions never removes or changes earlier versions.

## Provider-binding identity

Identity is `providerBindingId`, using the same exact bounded identifier convention. It is distinct from factor, provider, and resolution-policy identity.

## Provider-binding version

`providerBindingVersion` is a positive safe integer. Any candidate order, factor lineage, or eligibility change requires a new version.

## Provider-binding factor ownership

A definition freezes exact `factorKey + factorVersion`. Construction verifies the key and exact current definition version through a supplied Factor Registry lookup. Historical multi-version factor lookup remains a separate future registry concern.

## Provider-order ownership

The binding owns a non-empty ordered provider-key list, bounded to 20 entries. Order is preserved exactly; the first entry remains preferred and subsequent entries remain fallbacks. No cost, authority, or health data reorders it.

## Provider-definition references

Bindings contain provider keys only. Construction validates each key against a supplied already-validated Phase 3 catalog, including existence, enabled state, and factor support. Provider definitions are not duplicated into binding content.

## Provider-binding historical lookup

`getExact(id, version)` is authoritative. `listVersions(id)` returns ascending versions. All stored versions remain retrievable after later registration.

## Registry immutability

Both authorities are constructor-built closed snapshots. Source collections and nested content are copied; stored records and arrays are frozen; every lookup returns a new detached deeply frozen copy. No register-after-construction, update, delete, or overwrite operation exists.

## Registration rules

Construction validates dense arrays in caller order and fails on the first invalid definition. Configuration definitions require exact supported evaluator lineage, closed non-empty factor and relationship support, unique support members, boolean eligibility, and compatible content. Provider bindings require exact factor version, bounded unique provider order, catalog compatibility, and boolean eligibility.

## Lookup rules

Malformed or unknown exact/latest lookup returns `null`; malformed or unknown version listing returns an empty frozen array. Lookup never normalizes identity, substitutes another version, executes content, or consults external state.

## Latest-version semantics

`getLatest(id)` selects the greatest registered numeric version only as authoring/compilation metadata convenience. Historical execution and compiled rulebooks must use `getExact`; latest is never an implicit fallback.

## Compile eligibility

`compileEligible` belongs inside immutable versioned content. A change therefore creates a new version while old rulebooks remain historically resolvable. Compile-eligible configuration content must pass its existing evaluator-specific validator and use only executable relationships. Provider-binding eligibility does not bypass catalog compatibility.

## Runtime eligibility

Definition availability and compile eligibility do not activate runtime execution. Feature flags, evaluator/provider registries, ScoreCheck, and legacy scoring remain unchanged. Runtime eligibility requires later approved wiring and policy.

## Duplicate handling

Any repeated exact identity/version fails, including deep-equal repetition. Duplicate supported factors, relationships, and ordered provider keys also fail with typed errors.

## Version-conflict handling

Same identity/version with different content is the same forbidden duplicate-version conflict. The registry never compares content to choose an overwrite and never silently increments a version.

## Content equality

Deep equality does not make duplicate registration idempotent. It is a bootstrap error. Separately constructed registries with equivalent inputs return deep-equal deterministic snapshots.

## Determinism

Construction and lookup are synchronous and use no clock, randomness, hash, generated ID, I/O, database, provider health, selection, runner, or evaluator execution. Version output is numerically sorted with an explicit comparator.

## Deep immutability

Nested support arrays, provider order, thresholds, contributions, configuration records, definitions, and returned lists are frozen. Returned objects are detached from sources and internal state.

## Failure semantics

Invalid construction throws typed bounded registry errors carrying only safe identity/version/provider metadata. Lookup is fail-closed with `null` or an empty array and exposes no raw exception or mutable internal value.

## Compatibility with Phase 2

Evaluator identity/version and the existing generic configuration/content validator are reused without changing evaluator ports, registry behavior, or execution. The default deterministic evaluator registry remains empty.

## Compatibility with Phase 3

The existing `FactorProviderBinding` and catalog remain unchanged and authoritative for provider-order compatibility. The new wrapper adds identity/version/factor-version/eligibility and validates against a supplied Phase 3 catalog. Health, resolution policy, selection, and runner execution remain separate.

## Compatibility with Phase 4A

The new authorities satisfy the shape of ADR-043 configuration and provider-binding references. ADR-043 remains structural only. Full exact reference validation also needs version-aware evaluator, factor, resolution-policy, aggregation, normalization, and decision-band lookup authorities and is deferred to Phase 4C.

## Persistence boundary

Authorities are static in-memory snapshots. No database model, repository, migration, controller, route, API, mutable latest pointer, or deletion lifecycle exists.

## Compiler boundary

No template mapping, compilation, rulebook creation, hash generation, or compiler service exists. Latest lookup does not compile.

## Migration strategy

Phase 4C should define complete exact reference validation and close remaining historical lookup gaps. Later compiler work may use only compile-eligible exact definitions, report unsupported references, and never substitute latest. Existing Phase 3 bindings need not be migrated or mutated.

## Default production registry behavior

Both default definition collections are explicitly empty and frozen. The BTC ETF flow examples are test-local proofs. Availability never implies production activation.

## Deferred work

Additional evaluator-specific configuration variants; audited production definitions; version-aware evaluator/factor/policy authorities; full rulebook reference validation; template eligibility/mapping; compiler; persistence; APIs; subject resolution; runtime wiring and activation.

## Rejected alternatives

Rejected: unrestricted `unknown` configuration content; mutable registration; overwrite or delete; deep-equal idempotent duplicates; implicit latest substitution; embedding provider definitions or resolution policy; validating health; executing providers/evaluators; production example registration; changing Phase 3 bindings; mixing registry dependencies into Phase 4A structural validation.

## Consequences

Evaluator configurations and provider bindings now have exact immutable historical identities suitable for future compiled references. Missing wider historical authorities remain explicit, production remains inactive, and Phase 4C can add referential validation without weakening structural purity.
