# ADR-046: Immutable Template-to-Factor and Subject-Binding Mapping Authority

Status: Accepted

Date: 2026-08-03

Phase: Phase 4C

## Context and problem statement

Legacy template evaluator rules are editable authoring instructions. Phase 4A compiled bindings require exact factor, subject, evaluator, configuration, provider, and policy lineage. Phase 4C introduces the immutable approved translation specification between them without compiling or executing anything.

## Current template-rule model

Rules contain evaluator key, label, weight, enabled state, optional missing-data metadata, and untyped configuration. They have no persistent rule ID. Section keys exist, but duplicate evaluator keys are not prohibited within or across sections.

## Compiled factor-binding model and mapping responsibility

A mapping declares exact future binding lineage and translation instructions. It does not traverse templates, calculate weights, resolve subjects, validate a complete template, generate a rulebook, or execute providers, evaluators, or policies.

## Mapping identity and version

Mappings use `mappingId + mappingVersion`. IDs follow bounded uppercase identifier conventions and versions are positive safe integers. Changes require a new version; update, replacement, and deletion are unavailable.

## Source evaluator-key identity and source-rule limitations

Evaluator keys are reusable mapping selectors, not unique template-rule identities. Mappings store a normalized `source.evaluatorKey` only. Existing user-template normalization—trim then uppercase—is preserved.

One exact occurrence is identified later by exact template snapshot plus `sectionIndex + evaluatorIndex`. `sectionKey` and `evaluatorKey` are coordinate integrity fields. The mapping does not store coordinates and remains reusable across templates.

Duplicate evaluator occurrences may independently use the same mapping while preserving their own section context, weight, configuration, enabled state, and missing-data metadata. Persistent stable rule IDs are deferred. Prohibiting duplicate keys is rejected because it would change legacy authoring behavior; storing occurrence positions in mappings is rejected because it would make mappings template-specific.

## Template snapshot identity

Because unused user templates may mutate without a numeric version increment, Phase 4D must bind resolved compatibility to `templateId + templateVersion + templateSnapshotHash`. Hashing is not implemented here, and no latest template read may occur after compatibility resolution begins.

## Generic-factor key behavior

The existing `GENERIC_FACTOR:` namespace remains case-sensitive at its parser boundary. Mapping registration uses the existing user-authoring normalization policy before retaining the key; it does not execute the generic compatibility dispatcher.

## Exact lineage

Mappings retain exact factor definition, evaluator declaration, evaluator configuration, provider binding, provider-resolution, aggregation, normalization, and decision-band identity/version references. Subject bindings reuse the Phase 4A FIXED, TRADED_INSTRUMENT, and UNDERLYING_ASSET vocabulary. Relationship identities reuse the six Phase 3R-D values.

Registration resolves every reference exclusively with `getExact`. It verifies evaluator factor/relationship support, configuration evaluator/factor/relationship support, provider-binding factor lineage, and compile eligibility. Latest lookup is never used for reference validation.

## Missing-data compatibility

Section policy is authoritative in current legacy scoring. Evaluator override is persisted metadata but is not currently consumed. Future resolution records section policy, nullable evaluator override, and `legacyEffectivePolicy`, which must initially equal section policy.

The deterministic initial matrix is BLOCK → MANDATORY, PARTIAL → OPTIONAL/PARTIAL, and IGNORE → OPTIONAL/OMIT. ZERO is rejected until an explicit typed compatibility policy exists. Duplicate source policies fail.

## Weight ownership

Mappings store only `USE_EFFECTIVE_TEMPLATE_WEIGHT`. Phase 4D receives source section and evaluator weights and freezes or invokes exact legacy arithmetic. Phase 4E stores the numeric compiled weight. Registration performs no weight calculation.

## Compile eligibility and relationship eligibility

Eligibility is immutable mapping content. DIRECT and INVERSE may be eligible when every exact reference is eligible. CONDITIONAL, CONFIRMATION_ONLY, RISK_ONLY, and VETO remain historically storable only with `compileEligible: false`.

## Historical, latest, and evaluator-key lookup

`getExact` is authoritative, `getLatest` is convenience only, and `listVersions` is ascending. `findBySourceEvaluatorKey` considers compile-eligible mapping definitions only: zero matches returns NOT_FOUND, one returns UNIQUE, and several return AMBIGUOUS. It never selects the first match. Compile-ineligible mappings remain available through historical identity/version lookup.

Duplicate source occurrences are not mapping ambiguity. True ambiguity means materially different compile-eligible mapping definitions match the same evaluator key.

## Duplicate and semantic-conflict behavior

Duplicate mapping identity/version fails, including deep-equal registration. Indistinguishable compile-eligible semantic mappings under different identities also fail. Materially different mappings for one evaluator key are allowed and produce explicit ambiguity.

## Immutability and determinism

Authorities are closed constructor snapshots. Inputs are cloned, stored values are deeply frozen, and reads return detached frozen copies. Validation has deterministic first-failure order and uses no clock, I/O, database, template access, execution, runtime discovery, or generated identity.

## Default mapping collection and production boundary

The production default collection is empty. ETF-flow lineage is proven with test-local definitions only. Availability in a test authority does not activate compiled execution.

## Phase boundaries and compatibility

Phase 4A supplies compiled lineage types; Phase 4B and 4C0 supply exact authorities. Phase 4D will traverse an exact template snapshot, create coordinates, resolve missing-data and weights, and validate complete compatibility. Phase 4E will compile and hash. Legacy scoring remains unchanged and authoritative.

No complete template validation, compiler, hash generation, persistence, subject resolution, ScoreCheck wiring, API, runtime registration, or production mapping is introduced.

## Migration strategy and deferred mappings

Add audited mappings explicitly as immutable versions after their complete lineage exists. VWAP, Tata Steel, commodity, CVD, order-book, and event examples remain deferred. A future `PRICE_ABOVE_VWAP` mapping may target `TECHNICAL.PRICE_VS_VWAP` for TRADED_INSTRUMENT, but none of that lineage is registered here.

## Rejected alternatives

Rejected: evaluator key as concrete rule identity; duplicate-key prohibition; persistent rule IDs in this phase; mapping-stored occurrence indexes; section labels as identity; latest-reference substitution; implicit policy defaults; ZERO coercion; hidden weight arithmetic; executable mappings; speculative production mappings.

## Consequences

YUDIJI now has immutable reusable translations from evaluator-key candidates to complete exact lineage, explicit ambiguity, and a separate coordinate contract for duplicate occurrences. Phase 4D can resolve exact snapshots without changing legacy templates or pretending evaluator keys are unique.
