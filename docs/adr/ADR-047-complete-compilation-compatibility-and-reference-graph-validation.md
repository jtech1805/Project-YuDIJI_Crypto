# ADR-047: Complete Compilation Compatibility and Reference-Graph Validation

Status: Accepted

Date: 2026-08-03

Phase: Phase 4D

## Context and problem statement

Phase 4A froze compiled lineage, Phase 4B/4C0 supplied exact historical authorities, and Phase 4C supplied immutable template-rule mappings. Phase 4D must prove one exact authoring snapshot is fully compatible and produce compiler-ready lineage without creating a rulebook.

## Compatibility responsibility; structural versus referential validation

The service validates a caller-supplied detached snapshot, hashes its material projection, traverses enabled occurrences, resolves exactly one mapping, revalidates all exact references, translates missing-data behavior, calculates configured weight, detects semantic conflicts, and returns an immutable resolved specification. Structural validation precedes referential validation in deterministic first-failure order.

## Exact common template snapshot

The common projection contains explicit template ID/version/kind/status/visibility; market, trade-style, instrument, and allowed-symbol scope; explicit aggregation mode; and ordered sections/evaluators. It excludes Mongo internals, `isLatest`, usage counts, timestamps, descriptions, permission thresholds, runtime resources, and ScoreCheck state.

System identity is template key plus registry version. User identity is persistent template ID plus numeric version. Because an unused draft can mutate in place, version alone is insufficient.

## Snapshot hash and canonicalization

SHA-256 is computed over stable canonical JSON. Object keys sort lexically; arrays retain order; finite numbers retain native precision; negative zero becomes zero. Undefined, non-finite numbers, functions, symbols, BigInt, Dates, non-plain objects including ObjectIds, and cycles fail typed. Material changes to weights, enabled state, policies, configuration, or ordering change the hash.

## Source-rule coordinates and traversal

Sections and evaluators traverse in array order. Disabled sections and evaluators remain hash material but create no binding. Enabled occurrences receive `sectionIndex/sectionKey/evaluatorIndex/evaluatorKey`; positions are authoritative and keys are integrity fields. Duplicate evaluator keys get distinct coordinates.

## Mapping lookup, missing mappings, and ambiguity

Normalized evaluator key lookup must return UNIQUE. NOT_FOUND and AMBIGUOUS fail; first-match selection and generic-parser fallback are prohibited. Compile-ineligible mappings cannot produce new resolved specifications.

## Complete exact reference validation

Factor definition, evaluator declaration, evaluator configuration, provider binding, provider-resolution, aggregation, normalization, and decision-band definitions are reloaded only with `getExact`. Every definition must exist and be compile eligible. Evaluator factor/relationship support, configuration evaluator/factor/relationship support, and provider-binding factor lineage are rechecked. `getLatest` is never used.

## Subject and relationship behavior

Phase 4C mappings supply structurally validated FIXED, TRADED_INSTRUMENT, or UNDERLYING_ASSET instructions. Phase 4D does not resolve them. DIRECT and INVERSE are executable; CONDITIONAL, CONFIRMATION_ONLY, RISK_ONLY, and VETO fail as deferred.

## Missing-data compatibility

Section policy remains the current legacy-effective policy. Evaluator override is preserved metadata only. BLOCK becomes MANDATORY, PARTIAL becomes OPTIONAL/PARTIAL, IGNORE becomes OPTIONAL/OMIT, and ZERO is unsupported.

## Weight compatibility

Configured effective weight is `(sectionWeight × evaluatorWeight) / 100`, without rounding. This matches configured two-layer contribution. Runtime included-result or executed-section renormalization is not performed and remains execution-policy behavior.

## Aggregation-mode compatibility

Only explicit WEIGHTED_SUM is accepted. NORMALIZE_EXECUTED and omitted mode are rejected because Phase 4A has no lineage capable of expressing legacy executed-section renormalization. Per-factor aggregation policies do not silently substitute for template-level aggregation semantics.

## Template status, visibility, scope, and symbols

SYSTEM and USER snapshots may be DRAFT or ACTIVE when structurally valid; ARCHIVED is ineligible for new compilation. SYSTEM visibility is null; USER visibility is PRIVATE or PUBLIC. Visibility does not grant runtime activation. Scope and allowed symbol IDs are preserved as source lineage; no symbol is resolved or checked against ScoreCheck.

## Semantic duplicate and weight-conflict behavior

Semantic identity includes exact factor, subject, evaluator/configuration, relationship, requirement translation, provider, and policy lineage, but excludes coordinate and weight. Equal semantics/equal weight are duplicates; equal semantics/different weight are conflicts. Same factor with a materially different subject or configuration can remain distinct.

## Resolved compilation specification

Output contains source template identity/hash/scope, ordered resolved bindings with coordinates and source values, exact mapping/reference lineage, translated requirement, configured effective weight, and null future policy placeholders. It contains no rulebook ID/version, compiler identity, timestamp, executable object, or authority object.

## Immutability, determinism, and failure behavior

Inputs are not mutated; successful output is detached and deeply frozen. Validation is synchronous, clock-free, database-free, and deterministic, returning one typed first failure.

## Phase and runtime boundaries

Phase 4E owns compiler identity, rulebook identity/version, compiled binding generation, and compilation input hashing. Persistence, subject resolution, providers, Evidence, evaluators, policies, ScoreCheck, runtime wiring, and feature activation remain outside Phase 4D. Legacy scoring remains authoritative.

## Deferred identity and examples

Persistent stable template-rule IDs remain deferred. Future Tata Steel mappings may use fixed NIFTY/NIFTY_METAL subjects and TRADED_INSTRUMENT VWAP/CVD/event factors, but none are registered here.

## Rejected alternatives and consequences

Rejected: latest template/reference reads, arbitrary document hashing, plain unsorted serialization, implicit NORMALIZE_EXECUTED approximation, evaluator override activation, ZERO coercion, runtime renormalization, coordinate-based semantic equality, first mapping wins, compiler or persistence work. The consequence is an honest immutable compatibility proof for explicit WEIGHTED_SUM snapshots and a typed rejection for semantics the compiled contract cannot yet express.
