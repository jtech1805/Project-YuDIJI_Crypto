# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for YUDIJI.

An ADR records an important architecture decision, the context behind it, the consequences, alternatives considered, and how the decision can be migrated or rolled back. ADRs are used to keep implementation work aligned with approved project direction.

## When An ADR Is Required

Create an ADR when a change:

- Changes scoring authority, scoring output contracts, or evaluator execution.
- Introduces a new architecture path beside an existing production path.
- Adds feature flags that affect production behavior.
- Changes migration, rollback, data ownership, or compatibility rules.
- Supersedes an accepted architecture decision.

Small implementation details, bug fixes that do not change architecture, and documentation-only clarifications usually do not require a new ADR.

## Status Values

Use these status values:

- `PROPOSED`: under discussion and not yet authoritative.
- `ACCEPTED`: approved and active.
- `SUPERSEDED`: replaced by a later ADR.
- `REJECTED`: considered but not accepted.

## Numbering Convention

ADRs use a stable sequential number:

```text
ADR-001-decision-title.md
ADR-002-decision-title.md
```

Numbers are never reused. If a decision changes, create a new ADR and mark the older ADR as superseded.

## Superseding Rules

Accepted ADRs must not be silently rewritten to change their meaning. Corrections for spelling, broken links, or formatting are allowed only when they do not alter the decision.

Any meaningful change requires:

1. A new ADR.
2. A clear `Supersedes` link to the old ADR.
3. A matching `Superseded by` entry in the old ADR and index.
4. Updated phase tracking in `PHASE_LOG.md`.

## Relationship To Other Artifacts

ADRs define approved architecture decisions. PRDs explain product intent. HLDs and LLDs explain design structure and implementation detail. Tests verify behavior. Codex prompts execute narrow approved tasks.

The expected flow is:

```text
Product intent
  -> PRD
  -> ADR for architecture decision
  -> HLD/LLD for implementation design
  -> Codex implementation prompt
  -> tests and characterization gates
  -> PHASE_LOG.md update
```

If these artifacts disagree, current production code and accepted ADRs must be reconciled explicitly. Do not silently change accepted decisions.

## ADR Index

| ADR | Title | Status | Phase | Summary | Supersedes | Superseded by |
| --- | --- | --- | --- | --- | --- | --- |
| ADR-001 | Legacy scoring remains authoritative | ACCEPTED | Phase 0B | Current scoring engine, evaluator registry, legacy evaluators, templates, and scoring outputs remain authoritative during migration. | None | None |
| ADR-002 | New Evidence architecture sits next to legacy | ACCEPTED | Phase 0B | Evidence, Factor Registry, and generic-evaluator architecture will be additive beside the legacy scoring path. | None | None |
| ADR-003 | Preserve public scoring contracts | ACCEPTED | Phase 0B | Public scoring output fields remain backward compatible during migration. | None | None |
| ADR-004 | New capabilities require default-OFF feature flags | ACCEPTED | Phase 0B | Future scoring architecture capabilities must be guarded by explicit feature flags that default OFF. | None | None |
| ADR-005 | Characterization suite is the regression gate | ACCEPTED | Phase 0B | Phase 0A characterization tests and full backend tests are mandatory gates for later scoring-related phases. | None | None |
| ADR-006 | Shared provider-independent LLM trace contract | ACCEPTED | Phase 0C | All active LLM workflows will use one metadata-first trace contract that is provider-independent and best effort. | None | None |
