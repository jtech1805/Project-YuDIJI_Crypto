# ADR-043: Compiled Rulebook Contract, Identity, and Version Lineage

Status: Accepted

Date: 2026-08-03

Phase: Phase 4A

## Context

Editable scoring templates describe authoring intent. Phase 1 provides append-only Evidence, Phase 2 provides versioned deterministic single-factor execution policies, Phase 3 provides provider selection, and Phase 3R freezes subjects, relationship semantics, and ScoreCheck orchestration. A separate immutable artifact must identify one exact executable projection without activating that execution.

## Problem statement

Existing templates are evaluator-key-centered, may be edited in place before first use, and do not contain complete factor, subject, evaluator-configuration, provider-binding, or policy lineage. A reproducible execution contract cannot mean “latest template” or depend on mutable authoring state.

## Template versus compiled rulebook

A template remains an editable strategy-authoring model answering what to monitor. A compiled rulebook is an immutable, version-frozen instruction and lineage artifact answering exactly what a future runtime would execute. Phase 4A validates already-created artifacts; it does not compile templates or assert that current templates are compile-eligible.

## Rulebook identity

Identity is `rulebookId + rulebookVersion`. IDs are exact uppercase `A-Z`, digit, or underscore identifiers, pre-trimmed, non-empty, and at most 120 characters. IDs are not assumed to be UUIDs. Versions are positive safe integers.

## Rulebook version

No update operation exists. Any content change produces a new rulebook version or, when strategy identity changes, a new rulebook ID. Activation, latest selection, and invalidation belong to future repository metadata, not mutable compiled content.

## Source-template lineage

Every rulebook contains one exact `{ templateId, templateVersion }`. It never stores or resolves a mutable “latest” pointer. A system template uses its stable key as `templateId`; a user template compiler must later choose and document whether the persistent `_id` or stable `templateKey` is canonical before compilation is enabled.

## Compilation identity

Compilation stores exact `compilerId`, positive `compilerVersion`, `compilationInputHash`, and `compiledAt`. Compiler identity is a bounded reference; no compiler registry or compiler implementation is introduced here.

## Factor-binding identity

Each binding has its own `bindingId` and zero-based `order`. IDs and orders are unique; orders must be contiguous from zero. Binding identity is distinct from factor identity, allowing one factor to appear for different subjects or roles.

## Factor-definition lineage

The repository has real `FactorDefinition.version` values. Compiled lineage is exact `FactorKey + factorVersion`. Phase 4A closes factor keys to the current `FACTOR_KEYS` vocabulary and validates positive versions. It does not query a registry and therefore cannot prove historical retrieval or equality with the currently registered version. A future version-aware lookup must do so before compilation or execution.

## Subject-binding lineage

The initial closed vocabulary is `FIXED`, `TRADED_INSTRUMENT`, and `UNDERLYING_ASSET`. `FIXED` embeds only an Evidence subject type and exact bounded key. Dynamic bindings contain no resolved live subject. `TRADED_INSTRUMENT` and `UNDERLYING_ASSET` resolution is deferred. Sector, benchmark, option-chain, and expiry-series shortcuts are rejected until separately defined.

## Evaluator lineage

Each binding stores `evaluatorId`, `evaluatorVersion`, `configurationId`, and `configurationVersion`. Evaluator and configuration versions are positive. Phase 2 has real evaluator/version/configuration-version identity, but no configuration ID registry or historical configuration store. `configurationId` is therefore a validated future reference, not a current retrieval guarantee.

## Evaluator-configuration lineage

Phase 4A stores identity/version only and no arbitrary configuration body. Deterministic replay requires configurations to become immutable and permanently retrievable by this pair, or for a later phase to add a canonical configuration snapshot/hash. Compiled execution remains unavailable until that prerequisite is satisfied.

## Relationship semantics lineage

Bindings reference the closed Phase 3R vocabulary. `DIRECT` and `INVERSE` are single-factor executable; `CONDITIONAL` still requires future condition binding; `CONFIRMATION_ONLY`, `RISK_ONLY`, and `VETO` remain owned by future cross-factor, risk-axis, and veto-channel contracts. Naming a relationship does not make deferred behavior executable.

## Requirement-level semantics

Requirement is exactly `MANDATORY` or `OPTIONAL`. Missing mandatory data must later fail closed or produce a non-actionable result under compiled policy. Optional data may permit explicit partial execution. Neither silently receives zero. This is distinct from legacy `BLOCK | PARTIAL | ZERO | IGNORE` authoring policy.

## Weight semantics

Compiled weights are finite, greater than zero, and at most 100, matching Phase 2 aggregation bounds. Legacy authoring may store zero for disabled rules, but a zero-weight executable binding is rejected.

## Provider-binding lineage

Bindings store `providerBindingId + providerBindingVersion` without live health or a selected provider. Phase 3 `FactorProviderBinding` currently has neither identity nor version, so these are bounded future references only. A versioned immutable provider-binding authority is required before compilation/execution can claim reproducibility.

## Provider-resolution-policy lineage

Bindings store `resolutionPolicyId + resolutionPolicyVersion`. These fields correspond to real Phase 3 policy identity/version, but Phase 4A performs structural validation only and does not access a policy registry.

## Aggregation-policy lineage

Aggregation lineage is per factor binding because Phase 2 aggregation targets a single factor execution plan. It stores `aggregationPolicyId + aggregationPolicyVersion`.

## Normalization-policy lineage

Normalization lineage is per factor binding and stores `normalizationPolicyId + normalizationPolicyVersion`; it follows the binding's aggregation lineage.

## Decision-band-policy lineage

Decision-band lineage is per factor binding and stores `decisionBandPolicyId + decisionBandPolicyVersion`; it follows the binding's normalization lineage. Analytical bands remain distinct from final trade decisions.

## Future cluster-policy lineage

`crossFactorPolicy` is `CompiledPolicyLineage | null`. It remains `null` until a future cross-factor/cluster contract is implemented; Phase 4A creates no such engine or policy body.

## Future decision-policy lineage

`decisionPolicy` is `CompiledPolicyLineage | null`. It remains `null` until future decision derivation is implemented. A factor decision-band policy is not a complete-rulebook decision policy.

## Compilation timestamp semantics

`compiledAt` is a caller-supplied valid `Date`. Validation never reads the system clock, changes the date, or assigns a default. Returned dates are defensive clones.

## Compilation input-hash semantics

The target is SHA-256 over a future canonical compilation input. Phase 4A does not define canonicalization or compute hashes. It accepts exactly 64 lowercase hexadecimal characters, with no whitespace. Lowercase avoids two textual encodings of one digest.

## Immutability

The validator returns detached, recursively frozen records and arrays. Input changes cannot alter output. Each call produces a new detached value, so mutation of a returned cloned `Date` cannot affect another result or internal state. No update method or mutable lifecycle status exists.

## Determinism

Validation performs no I/O, database access, registry lookup, hashing, ID generation, clock access, randomness, normalization, sorting of returned bindings, or compilation. Identical inputs produce deep-equal results and the original declared order is preserved after contiguous-order validation.

## Validation ordering

The first failure only is returned in this order: top-level rulebook; identity; source; compiler identity; input hash; timestamp; collection shape/lower/upper bounds; binding order shape; duplicate IDs; duplicate orders; contiguity; each binding in order; cross-factor lineage; decision lineage. Per binding: ID, order, factor, subject, evaluator, relationship, requirement, weight, provider, aggregation, normalization, decision band.

## Duplicate detection

Duplicate binding IDs and orders fail before detailed binding validation. Exact semantic duplicates also fail. Semantic identity is factor key/version, subject binding, evaluator identity/version/configuration identity/version, and relationship type. Reusing a factor for a different subject is valid.

## Collection bounds

Rulebooks contain 1 through 100 bindings. Existing editable templates have no global evaluator count bound; 100 is a conservative contract ceiling large enough for current templates while preventing unbounded validation/runtime plans. A future ADR may lower it based on compilation eligibility and execution budgets.

## Compatibility with existing templates

Existing system and user templates remain evaluator-key-centered. User templates may mutate in place before first use and version only after usage. Their missing-data, permission, resource, and allowed-symbol contracts are unchanged. Phase 4A does not claim they can compile. Template-to-factor mapping, unsupported-rule reporting, stable user-template source identity, and legacy compatibility belong to Phase 4B/4D.

## Compatibility with Phase 1

Rulebooks contain no Evidence, observations, prices, provider payloads, lifecycle state, or live subjects. A fixed binding reuses only the closed Evidence subject vocabulary.

## Compatibility with Phase 2

Factor versions and evaluator/policy identity fields reflect existing Phase 2 contracts. Execution policy ownership remains factor-local. Nothing executes, aggregates, normalizes, or classifies.

## Compatibility with Phase 3

Resolution-policy version lineage is real. Provider-binding identity/version is a declared prerequisite because Phase 3 bindings currently have neither. Runtime will later combine compiled lineage with caller-supplied current health; selected provider keys and telemetry never enter compiled content.

## Compatibility with ScoreCheck orchestration

ADR-037 remains authoritative. Phase 4A adds no orchestration stage, snapshot field, idempotency behavior, service import, persistence, controller, or route. Legacy scoring continues to produce decisions.

## Feature-flag boundary

`COMPILED_RULEBOOK_EXECUTION` remains default OFF and unchanged. Contracts are not imported by production modules or registries.

## Persistence boundary

No model, schema, repository, latest pointer, activation status, invalidation metadata, or API is introduced. Those are future repository metadata and must never mutate compiled content.

## Compiler boundary

No compiler, canonicalizer, hash generator, template mapper, subject resolver, registry verifier, or migration is introduced. Phase 4A validates caller-created definitions only.

## Migration strategy

Phase 4B must establish compilation prerequisites and eligibility: stable source-template identity, exact factor mappings, version-aware factor verification, immutable evaluator configurations, and versioned provider bindings. Later approved phases may define compiler behavior, legacy mapping, persistence metadata, and runtime activation. Unsupported legacy rules must be reported explicitly rather than guessed.

## Deferred work

Template compilation; template migration; subject resolution; historical registries; immutable configuration retrieval/snapshot hashes; provider-binding versioning; condition bindings; cross-factor, risk, veto, and final-decision policies; persistence; APIs; ScoreCheck wiring; runtime execution; activation and invalidation metadata.

## Rejected alternatives

Rejected: treating latest template as lineage; random compiler IDs; embedding live data; using factor key as binding ID; inventing provider-binding registry guarantees; embedding arbitrary evaluator configuration; allowing zero/negative weights; silently normalizing IDs or hashes; treating all relationship types as executable; mutable status inside compiled content; compiling or persisting in Phase 4A.

## Consequences

The repository gains an honest immutable executable-projection contract and deterministic validator without activating it. Real lineage is reused where present, missing lineage is visible rather than fabricated, and later compiler/runtime work has explicit prerequisites and fail-closed boundaries.

## Phase 4D1 Amendment — Optional Missing-Data Behavior

Status: Accepted

Date: 2026-08-03

The Phase 4E pre-coding audit found that `requirementLevel` alone could not preserve the materially different Phase 4D results OPTIONAL/PARTIAL and OPTIONAL/OMIT. Collapsing both to OPTIONAL would make compiled replay ambiguous.

The compiled factor-binding contract therefore adds a required `optionalBehavior` field with the closed compiled vocabulary PARTIAL and OMIT plus null. MANDATORY requires null. OPTIONAL requires exactly PARTIAL or OMIT. Missing, unknown, lowercase, or inconsistent values fail structural validation at the optional-behavior path.

This is direct per-binding missing-data behavior. Aggregation policy lineage does not own it and cannot restore a discarded distinction. Optional behavior participates in compiled semantic identity, survives detached cloning and freezing, and remains visible for future compiler and runtime interpretation.

Phase 4C translations remain BLOCK → MANDATORY/null, PARTIAL → OPTIONAL/PARTIAL, IGNORE → OPTIONAL/OMIT, and ZERO unsupported. Phase 4D already resolves this exact pair and needs no behavioral change. Phase 4E must preserve both fields without inference.

Existing compiled fixtures migrate by adding an explicit field; there is no production default. Runtime interpretation, execution, persistence, and activation remain deferred. Rejected alternatives were collapsing both behaviors to OPTIONAL, making the field optional, inferring a default, or moving the distinction into aggregation policy. The consequence is additive contract precision without runtime behavior.
