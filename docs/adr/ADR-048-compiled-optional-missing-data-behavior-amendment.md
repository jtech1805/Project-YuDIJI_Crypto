# ADR-048: Compiled Optional Missing-Data Behavior Amendment

Status: Accepted

Date: 2026-08-03

Phase: Phase 4D1

## Decision

ADR-043 remains the authoritative compiled-rulebook contract. Its accepted Phase 4D1 amendment adds the required per-binding `optionalBehavior` field with the closed PARTIAL/OMIT vocabulary and null for mandatory bindings.

MANDATORY requires null. OPTIONAL requires PARTIAL or OMIT. This distinction belongs directly to the compiled binding rather than aggregation policy lineage, because it controls the behavior of one missing optional factor.

## Reason

Phase 4D resolves OPTIONAL/PARTIAL and OPTIONAL/OMIT as materially distinct. Requirement level alone would collapse them and prevent deterministic compiler/runtime replay.

## Scope and consequences

The amendment changes only the compiled type, structural validation, semantic duplicate identity, clone/freeze proof, and aligned Phase 4C/4D types. It adds no compiler, persistence, execution, ScoreCheck wiring, feature activation, or inferred default. Phase 4E must preserve the pair exactly.

This ADR records amendment execution and numbering; it does not replace or contradict ADR-043.
