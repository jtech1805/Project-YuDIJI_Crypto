# ADR-050: Immutable Compiled Rulebook Repository and Read Boundary

Status: Accepted

Date: 2026-08-03

Phase: Phase 4F

## Context and problem statement

Phase 4E produces a validated immutable compiled rulebook. Phase 4F persists that exact definition append-only and exposes bounded immutable historical reads without execution, activation, or production wiring.

## Persistence responsibility and append-only contract

The repository defensively applies Phase 4A/4D1 validation, maps the domain definition to a strict Mongo document, and permits only insert. It exposes no update, replace, upsert, delete, archive, activation, or mutable metadata operation.

## Authoritative identity and versions

`rulebookId + rulebookVersion` is globally unique through a compound unique index. Template ID/version is intentionally non-unique because different compiler versions, mappings, policies, snapshots, or explicit rulebook identities may compile the same template version.

## Mongo and domain representation

The persistence document stores top-level rulebook ID/version, source-template lineage, compilation lineage and Date, ordered factor bindings, optional behavior, and future policy placeholders. Domain identity nesting is reconstructed on reads. Mongo `_id` is storage-only and never escapes. No field is defaulted or transformed semantically.

## Round-trip preservation

All identities, versions, hash, Date, order, subject variants, relationship, requirement, PARTIAL/OMIT/null optional behavior, weights, provider/policy lineage, and nullable future policies round-trip exactly. Read projections pass through the compiled contract validator, which clones and deeply freezes the domain result.

## Indexes

The authoritative compound unique index is rulebook ID/version. Supporting non-unique indexes cover template ID/version plus compiledAt for recent-compilation reads, template ID/version plus rulebook version/ID for deterministic listing, and compilation input hash for diagnostics/deduplication investigation.

## Duplicate, conflict, and race semantics

An existing exact identity with deep-equal validated domain content returns DUPLICATE_RULEBOOK. Any content difference at the same identity/version returns RULEBOOK_VERSION_CONFLICT, including same hash/different content or different hash. Mongo error 11000 triggers an exact reread and the same comparison. Raw database errors never escape and no new version is inferred.

## Historical and template reads

`findExact` is authoritative and never substitutes latest. Template-version listing is ordered by rulebookVersion ascending then rulebookId ascending, accepts explicit skip 0–10,000 and limit 1–100, fetches limit+1 to compute `hasMore`, and performs no count query. Multiple IDs and versions coexist.

`findMostRecentlyCompiledForTemplateVersion` is convenience metadata only. It orders compiledAt descending, rulebookVersion descending, then rulebookId descending and is never used by exact reads.

## Read service and immutability

The read service validates identifiers, versions, and pagination before delegation. Mongoose documents never escape. Exact, list, and convenience results contain detached frozen rulebooks, arrays, nested lineage, subjects, and cloned Dates. Caller or returned-value mutation cannot affect persistence.

## Compiler, runtime, and ScoreCheck boundaries

The repository accepts compiler output but neither compiles nor executes it. No subject resolution, Evidence read, provider/evaluator/policy execution, ScoreCheck wiring, controller, route, public API, module registration, feature flag, scheduler, activation state, or runtime execution is introduced.

## Migration, rejected alternatives, and consequences

Future migrations create indexes and may wire the repository only in an explicitly approved phase. Rejected alternatives include mutable status on compiled content, latest substitution, unique template-version identity, idempotent conflict success, raw E11000 leakage, unbounded reads, total-count queries, defaults for optional behavior, and production wiring. The consequence is durable exact historical content with honest append-only conflict semantics and isolated immutable reads.
