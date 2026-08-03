# ADR-049: Deterministic Compiled Rulebook Compiler

Status: Accepted

Date: 2026-08-03

Phase: Phase 4E

## Context and problem statement

Phase 4D produces an immutable resolved compatibility specification, and Phase 4D1 ensures optional missing-data behavior is representable. Phase 4E must translate that proof into the Phase 4A compiled contract without persistence, lookup, execution, clocks, randomness, or semantic loss.

## Compiler responsibility, input, and output

The compiler accepts caller-supplied rulebook identity/version, compiler identity/version, compiledAt Date, and one resolved specification. It creates a canonical logical-input hash, deterministic binding IDs and contiguous source-order bindings, constructs a `CompiledRulebookDefinition`, and returns only the detached frozen success from Phase 4A/4D1 validation.

## Identity, version, and timestamp ownership

The caller owns rulebook ID/version, compiler ID/version, and compiledAt. The compiler validates but never chooses or increments them. It clones the supplied valid Date and never reads the system clock.

## Template, mapping, and source provenance

Template identity/version/hash/kind/status/visibility/scope/aggregation mode, mapping identity/version, and source coordinates enter the logical compilation hash. Phase 4A has no mapping or coordinate provenance fields, so mapping and coordinate lineage also seed deterministic binding IDs but are not injected into undocumented compiled fields. The template snapshot hash remains the immutable provenance anchor.

## Canonical compilation-input projection and hash material

The dedicated projection contains compiler identity/version, complete source-template provenance, ordered bindings, mapping/coordinate provenance, every compiled semantic, effective weight, and future policy placeholders. Rulebook identity/version and compiledAt are excluded so equivalent logical compilations retain one hash across storage identity or timestamp changes.

## Canonical serialization and SHA-256

Object keys sort lexically; arrays preserve order; strings, booleans, null, and finite numbers are preserved; negative zero becomes zero. Undefined, functions, symbols, BigInt, Dates, non-plain objects, non-finite values, and cycles fail typed. SHA-256 output is exactly 64 lowercase hexadecimal characters.

## Binding identity and collision handling

Each binding seed contains template snapshot hash, section/evaluator indexes, and mapping identity/version. Its ID is `BINDING_` plus the full uppercase SHA-256 digest, totaling 72 characters and satisfying Phase 4A. Duplicate generated IDs fail explicitly; no truncation, random ID, label, or evaluator-key-only identity is used.

## Binding order and translation

Resolved array order is authoritative and becomes contiguous order `0..n-1`; no sorting occurs. Factor, subject, evaluator/configuration, relationship, provider, resolution, aggregation, normalization, and decision-band lineage translate directly. Compiled weight is the Phase 4D effective weight without recalculation or rounding.

## Requirement and optional behavior

MANDATORY/null, OPTIONAL/PARTIAL, and OPTIONAL/OMIT are copied exactly. Both requirement and optional behavior participate in canonical hashing and Phase 4A/4D1 validation. PARTIAL and OMIT never collapse.

## Future policy placeholders

Resolved cross-factor and decision-policy placeholders are preserved exactly. They currently remain null; no defaults are invented.

## Validation, failure, determinism, and immutability

Request and coordinate/optional-behavior prerequisites fail in deterministic order. Canonicalization, hashing, ID generation, collision, and final contract failures are typed. The compiler returns no pre-validation candidate. Identical requests produce deep-equal results; compiledAt-only changes retain hash/bindings and change only timestamp; rulebook-identity-only changes retain hash/bindings.

## Pure boundaries

The compiler performs no registry or latest lookup, database/repository access, persistence, subject resolution, Evidence read, provider/evaluator/policy execution, ScoreCheck access, feature-flag read, runtime registration, UUID generation, or production mapping change. Compiled execution remains OFF and legacy scoring remains authoritative.

## Relationships and migration

Phase 4A supplies output and validation, Phase 4D supplies compiler-ready values, and Phase 4D1 supplies lossless optional behavior. Phase 4F may add persistence without changing compiled content. Existing callers must supply all identities and timestamp explicitly.

## Rejected alternatives and consequences

Rejected: hashing raw service output, including compiledAt or rulebook identity in logical hash, random/truncated IDs, sorting bindings, recalculating weights, collapsing optional behavior, persisting provenance in undocumented fields, bypassing Phase 4A validation, and runtime activation. The consequence is a pure reproducible compiler whose output is structurally valid but neither stored nor executed.
