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
| ADR-007 | Append-only Evidence foundation | ACCEPTED | Phase 1A | Evidence stores immutable provider-independent observations and append-only revocations beside authoritative legacy scoring. | None | None |
| ADR-008 | Provider-independent Evidence ingestion | ACCEPTED | Phase 1B | Strict candidates are normalized, canonically hashed, deduplicated, and persisted through an append-only provider-independent boundary. | None | None |
| ADR-009 | Evidence lifecycle resolution | ACCEPTED | Phase 1C | Lifecycle state is derived deterministically at read time from immutable Evidence history and an explicit evaluation time. | None | None |
| ADR-010 | Evidence read and query boundary | ACCEPTED | Phase 1D | Bounded and counted base/relationship reads invoke lifecycle resolution only when history is complete. | None | None |
| ADR-011 | Generic Evidence provider runner | ACCEPTED | Phase 1E | Existing adapters are executed once and bounded candidates are ingested sequentially with deterministic failure isolation. | None | None |
| ADR-012 | Binance public price Evidence adapter | ACCEPTED | Phase 1F | A bounded, strict, public-only Binance spot-price adapter proves shadow Evidence translation without runtime activation. | None | None |
| ADR-013 | Evidence shadow observability | ACCEPTED | Phase 1G | Explicit provider-run summaries update bounded, in-memory, privacy-safe adapter health without changing runner behavior. | None | None |
| ADR-014 | Explicit Evidence shadow execution | ACCEPTED | Phase 1H | Caller-supplied adapters are explicitly run, timed, and recorded through a privacy-safe orchestration boundary with no runtime activation. | None | None |
| ADR-015 | Factor Registry foundation | ACCEPTED | Phase 2A | A code-defined immutable registry provides strict versioned factor metadata without Evidence, evaluator, or scoring integration. | None | None |
| ADR-016 | Evidence-to-Factor compatibility and freshness | ACCEPTED | Phase 2B | One supplied observation is validated against factor metadata, inclusive validity, and explicit-time freshness without reads or scoring. | None | None |
| ADR-017 | Deterministic Evidence source resolution | ACCEPTED | Phase 2C | Bounded lifecycle-active observations are resolved by compatibility, immutable source authority, recency, confidence, and stable identity without reads or scoring. | None | None |
| ADR-018 | Deterministic Factor input assembly | ACCEPTED | Phase 2D | Phase 1D reads and Phase 2C selection are orchestrated into one safe evaluator-ready `MARKET.PRICE` input without evaluator or scoring execution. | None | None |
| ADR-019 | Deterministic Factor evaluator contract | ACCEPTED | Phase 2E | A synchronous, no-I/O evaluator port and strict result validator preserve audit identity and bounded contributions without production evaluation or aggregation. | None | None |
| ADR-020 | Deterministic Factor evaluator registry | ACCEPTED | Phase 2F | Valid evaluator implementations are indexed immutably by exact identity and factor support, with an empty default and no execution or automatic selection. | None | None |
| ADR-021 | Explicit deterministic evaluator execution boundary | ACCEPTED | Phase 2G | One caller-selected evaluator executes synchronously against a caller-supplied assembled input, with exact lookup, support pre-checks, Phase 2E validation, and sanitized failures but no aggregation or runtime activation. | None | None |
| ADR-022 | Explicit multi-evaluator execution plan contract | ACCEPTED | Phase 2H | Caller-supplied single-factor plans preserve a bounded explicit evaluator order, exact registry validation, metadata snapshots, and future-runner failure policy without execution, aggregation, or runtime activation. | None | None |
| ADR-023 | Bounded multi-evaluator execution runner | ACCEPTED | Phase 2I | One validated single-factor plan runs synchronously through Phase 2G with exact ordered attempts, explicit skipped steps, categorical failure-policy reporting, and no aggregation or runtime activation. | None | None |
| ADR-024 | Deterministic contribution aggregation contract | ACCEPTED | Phase 2J | One versioned single-factor policy exactly mirrors a validated plan with explicit bounded weights, aggregate bounds, and fixed outcome eligibility without aggregation, normalization, or runtime activation. | None | None |
| ADR-025 | Deterministic contribution aggregation execution | ACCEPTED | Phase 2K | A validated policy and successful ordered execution report produce a finite bounded raw weighted contribution with explicit eligibility projections and no normalization, decision, persistence, or runtime activation. | None | None |
| ADR-026 | Deterministic raw aggregate normalization contract | ACCEPTED | Phase 2L | One immutable policy targets an exact aggregation policy and factor with explicit zero-anchored source and target ranges, fail-closed bounds, and native precision semantics without executing normalization or decisions. | None | None |
| ADR-027 | Deterministic raw aggregate normalization execution | ACCEPTED | Phase 2M | One pure executor maps a bounded Phase 2K aggregate through an exact Phase 2L zero-anchored policy with native precision and no clamping, rounding, or decisions. | None | None |
| ADR-028 | Deterministic decision-band contract | ACCEPTED | Phase 2N | One immutable five-band analytical policy fully partitions an exact normalized range with fixed contiguous interval semantics and no runtime classification or trade action. | None | None |
| ADR-029 | Deterministic decision-band execution | ACCEPTED | Phase 2O | One pure classifier maps a successful normalized score into exactly one immutable semantic band without translating it into a production trading instruction. | None | None |
| ADR-030 | End-to-end deterministic pipeline composition | ACCEPTED | Phase 2P | One explicit shadow-only boundary preflights validated lineage and delegates once in order through execution, aggregation, normalization, and semantic classification with typed short-circuit failures. | None | None |
| ADR-031 | Provider definition and factor binding contract | ACCEPTED | Phase 3A | Code-defined immutable provider metadata and explicit factor-provider order are validated without health, selection, execution, persistence, or commercial inference. | None | None |
| ADR-032 | Provider health state and assessment | ACCEPTED | Phase 3B | One caller-fed immutable telemetry snapshot is assessed under explicit thresholds and `asOf` without selection, fallback, execution, persistence, or system time. | None | None |
