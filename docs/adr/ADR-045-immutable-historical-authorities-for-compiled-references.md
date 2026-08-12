# ADR-045: Immutable Historical Authorities for Compiled References

Status: Accepted

Date: 2026-08-03

Phase: Phase 4C0

## Context

ADRs 043 and 044 require exact versioned references. Configuration and provider-binding history exists, but factor, evaluator, resolution, aggregation, normalization, and decision-band definitions previously exposed only current lookup or caller-supplied validation.

## Compiled reference integrity

Every compiled identity/version must resolve to the same immutable definition. Exact historical authorities are introduced before template mapping or reference validation.

## Current-versus-historical lookup problem

Current lookup cannot prove a requested historical version. `getExact(identity, version)` is authoritative; no authority substitutes current or latest.

## Factor-definition authority

The existing `FactorDefinition.factorKey + version` is retained. Each registration is validated by constructing the canonical `StaticFactorRegistry` with that one definition, preserving all existing factor meaning, unit, subject, value, freshness, lifecycle, and scoring rules. Audited `MARKET.PRICE v1` and `CRYPTO.ETF_NET_FLOW v1` are default historical definitions.

## Evaluator-declaration authority

Historical evaluator content is a data-only declaration: evaluator ID/version, implementation key, factor support, relationship support, and compile eligibility. The audited default declaration is `GENERIC_RELATIONSHIP_FACTOR_EVALUATOR v1`, supporting `CRYPTO.ETF_NET_FLOW` with DIRECT and INVERSE.

## Runtime evaluator registry separation

The declaration authority stores no class instance, function, closure, service, configuration version, or `evaluate` method. The existing executable evaluator registry remains unchanged and empty by default. Future execution must independently verify runtime implementation against compiled declaration lineage.

## Provider-resolution-policy authority

Registrations contain a policy definition and immutable eligibility. Construction delegates all content validation to `ProviderResolutionPolicyService`; only its validated frozen result is stored. No health assessment, resolution, selection, or runner is invoked.

## Aggregation-policy authority

Registration supplies the definition plus its exact validated evaluator plan solely as canonical validation context. `FactorContributionAggregationPolicyService` owns validation. Only the validated aggregation definition and eligibility are stored; the plan context is not historical authority content.

## Normalization-policy authority

Registration supplies the definition plus exact validated aggregation policy as validation context. `FactorAggregateNormalizationPolicyService` remains authoritative. Only its validated definition and eligibility are stored.

## Decision-band-policy authority

Registration supplies the definition plus exact validated normalization policy as validation context. `FactorDecisionBandPolicyService` remains authoritative. Only its validated definition and eligibility are stored; classification never executes.

## Exact lookup semantics

All six authorities expose `getExact(identity, version)`. Malformed or unknown references return `null`. Exact lookup never calls latest and never coerces identity/version.

## Latest lookup semantics

`getLatest(identity)` returns the greatest registered numeric version as authoring/compilation convenience only. Compiled replay cannot use it.

## Version listing

`listVersions(identity)` returns detached deeply frozen envelopes in ascending numeric version order. Unknown identities return an empty frozen array.

## Historical retention

Authorities are closed constructor-built snapshots. Later versions coexist with earlier versions and cannot alter them during the authority lifecycle.

## Registration behavior

Definitions are validated in caller order. Registration accepts only dense arrays and exact family definitions. Policy validation contexts are constructor inputs, not stored definitions.

## Duplicate behavior

Repeated identity/version fails, including deep-equal repetition. Registration is not idempotent.

## Version conflict behavior

Same identity/version with different content is the same explicit duplicate-version conflict. No content comparison, overwrite, or generated increment occurs.

## Compile eligibility

Every stored historical value is an immutable `{ definition, compileEligible }` envelope. Eligibility changes require a new definition version; there is no mutable eligibility switch. Compile-eligible evaluator declarations may contain only currently executable relationship semantics.

## Runtime eligibility

Definition availability does not register implementations, activate providers or policies, enable ScoreCheck, or change feature flags. Runtime eligibility remains separately approved future behavior.

## Definition validation ownership

Existing canonical validators remain sole owners of factor and policy correctness. Historical authorities own identity/version uniqueness, eligibility, storage, and lookup. Evaluator declarations are new data-only contracts validated by their authority.

## Registry immutability

There are no post-construction register, update, replace, delete, or archive operations. Internal maps never escape.

## Determinism

Construction and reads are synchronous, explicit-input operations with numeric sorting and no clock, randomness, generated ID, I/O, database, execution, or runtime discovery.

## Deep immutability

Definitions are cloned with `structuredClone` and recursively frozen before storage. Every read returns another detached recursively frozen clone, including nested policy entries, ranges, bands, and arrays.

## Default definition behavior

Audited factor definitions and the generic evaluator declaration are safe defaults because metadata availability is not execution activation. No audited production resolution, aggregation, normalization, or band policies exist, so those default collections remain empty and frozen.

## Compatibility with existing services

No existing registry, validator, executor, formula, classification, provider behavior, or factor definition changes. Authorities call validators only during construction.

## Compatibility with Phase 4A

Every previously unresolved rulebook reference family now has an exact historical lookup shape matching ADR-043 lineage.

## Compatibility with Phase 4B

Operations match Phase 4B: exact lookup, greatest-version convenience, ascending version lists, duplicate rejection, detached frozen output, and closed construction.

## Phase 4D reference-validation requirements

Phase 4D can receive these authorities plus Phase 4B authorities and call only `getExact` for factor, evaluator, configuration, provider binding, resolution, aggregation, normalization, and decision-band references. It must also verify cross-definition lineage and compile eligibility.

## Persistence boundary

Authorities are in-memory metadata snapshots. No database model, repository, migration, API, or runtime registration endpoint is introduced.

## Runtime activation boundary

`COMPILED_RULEBOOK_EXECUTION` remains OFF. No compiler, mapping, rulebook, ScoreCheck, evaluator/provider execution, or module wiring imports these authorities.

## Migration strategy

Phase 4C may add test-local mappings using exact authority references. Phase 4D will validate the complete graph. Future audited versions must be added explicitly without changing existing versions.

## Deferred work

Template mappings; graph validation; compiler; persistence; shadow execution; production policy definitions; runtime declaration-to-implementation verification; database-backed historical retention.

## Rejected alternatives

Rejected: treating current as historical; storing executable instances; adding versions to protected contracts; copying policy formulas; storing validation context as definition content; mutable eligibility; overwrite/delete; automatic discovery; production policy invention; compiler or runtime wiring.

## Consequences

All compiled reference families now have honest exact immutable historical lookup within an authority lifecycle. Phase 4D can validate a complete reference graph without latest substitution, while legacy scoring and production execution remain unchanged.
