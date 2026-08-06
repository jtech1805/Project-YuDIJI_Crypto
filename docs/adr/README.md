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
| ADR-033 | Provider resolution policy | ACCEPTED | Phase 3C | One immutable single-factor policy declares preferred/fallback health acceptance, visible exceptional outcomes, and unapplied confidence adjustments without health inspection or selection. | None | None |
| ADR-034 | Deterministic provider resolution execution | ACCEPTED | Phase 3D | Exact catalog, binding, health, and policy lineage is resolved in Phase 3A order into one transparent immutable provider outcome without adapter execution or confidence application. | None | None |
| ADR-035 | Provider resolution composition and adversarial proof | ACCEPTED | Phase 3E | An explicit immutable provider-runner registry executes only the already-selected Phase 3D provider once and safely projects the existing Phase 1 ingestion outcome without retry, reselection, or runtime activation. | None | None |
| ADR-036 | Foundation roadmap reconciliation and ScoreCheck execution flow | ACCEPTED | Phase 3R-A | Reconciles the original foundation deliverables with Phases 1–3 and freezes templates, compiled rulebooks, subjects, providers, Evidence, factor pipelines, future cross-factor decisions, and thin ScoreCheck orchestration without runtime activation. | None | None |
| ADR-037 | ScoreCheck orchestration contract | ACCEPTED | Phase 3R-B | Freezes mode-aware ScoreCheck request, stage, lineage, idempotency, coordination-port, persistence, audit, snapshot, failure, and migration contracts while legacy scoring remains authoritative and compiled execution remains off. | None | None |
| ADR-038 | ASSET subject and crypto ETF net-flow mocked-Evidence proof | ACCEPTED | Phase 3R-C | Adds canonical ASSET identity, registers `CRYPTO.ETF_NET_FLOW`, and generalizes Phase 2 source resolution/input assembly to exact registered factors while proving test-only ETF-flow Evidence through canonical input assembly. | None | None |
| ADR-039 | Generic factor relationship semantics | ACCEPTED | Phase 3R-D | Freezes six relationship meanings and assigns single-factor, condition-binding, cross-factor, risk-axis, and veto-channel ownership without disguising deferred behavior as points. | None | None |
| ADR-040 | Generic relationship evaluator and golden fixtures | ACCEPTED | Phase 3R-E | Implements versioned DIRECT/INVERSE ETF-flow arithmetic through Phase 2 contracts and freezes honest golden outcomes for executable and deferred relationship semantics. | None | None |
| ADR-041 | Legacy generic-factor compatibility and DRAFT-template proof | ACCEPTED | Phase 3R-F | Freezes the generic evaluator namespace and isolated default-off legacy result projection with a private test-only DRAFT template proof. | None | None |
| ADR-042 | MCP and evaluation-harness foundation decision | ACCEPTED | Phase 3R-G | Formally defers runtime MCP/harness work while freezing read-only tools, security boundaries, deterministic manifest scope, and exact implementation prerequisites. | None | None |
| ADR-043 | Compiled rulebook contract, identity, and version lineage | ACCEPTED | Phase 4A | Freezes immutable compiled-rulebook identity, exact template and execution lineage, deterministic validation, and honest missing-lineage prerequisites without compiler, persistence, or runtime activation. | None | None |
| ADR-044 | Immutable evaluator-configuration and provider-binding lineage authorities | ACCEPTED | Phase 4B | Adds closed immutable historical authorities for exact evaluator-configuration and provider-binding identity/version lookup without compiler, persistence, execution, or production registration. | None | None |
| ADR-045 | Immutable historical authorities for compiled references | ACCEPTED | Phase 4C0 | Adds exact immutable historical authorities for factor, evaluator declaration, resolution, aggregation, normalization, and decision-band references without executable instances or runtime activation. | None | None |
| ADR-046 | Immutable template-to-factor and subject-binding mapping authority | ACCEPTED | Phase 4C | Adds immutable evaluator-key-centered mapping lineage, explicit ambiguity, and deferred source-rule coordinates without template mutation, compilation, or runtime activation. | None | None |
| ADR-047 | Complete compilation compatibility and reference-graph validation | ACCEPTED | Phase 4D | Hashes one exact detached template snapshot and resolves complete exact compiler-ready lineage without creating or executing a rulebook. | None | None |
| ADR-048 | Compiled optional missing-data behavior amendment | ACCEPTED | Phase 4D1 | Records ADR-043's additive required PARTIAL/OMIT per-binding behavior contract without runtime execution. | ADR-043 | None |
| ADR-049 | Deterministic compiled rulebook compiler | ACCEPTED | Phase 4E | Purely translates one immutable resolved specification into a deterministically hashed and validated compiled rulebook without persistence or execution. | None | None |
| ADR-050 | Immutable compiled rulebook repository and read boundary | ACCEPTED | Phase 4F | Persists validated compiled rulebooks append-only with exact immutable historical and bounded template-version reads, without execution or runtime wiring. | None | None |
| ADR-051 | Compiled rulebook runtime aggregation and observation attestation | ACCEPTED | Phase 4G0 | Freezes distinct mandatory/partial/omit outcomes, compiled weighted-mean arithmetic, uniform policy lineage, and exact provider-attested shadow observations without execution or production wiring. | None | None |
| ADR-052 | Compiled runtime execution preparation | ACCEPTED | Phase 4G1 | Freezes explicit execution requests, dynamic subject resolution, exact observation selection, versioned freshness checks, and Evidence-independent compiled factor inputs without evaluator execution or runtime wiring. | None | None |
| ADR-053 | Compiled binding execution runtime | ACCEPTED | Phase 4G2 architecture | Freezes an Evidence-independent compiled evaluator port, exact declaration/configuration/implementation resolution, DIRECT/INVERSE shared-core execution, binding-score projection, preparation-failure mapping, and immutable one-binding outcomes without implementation or activation. | None | None |
| ADR-054 | Compiled rulebook runtime execution | ACCEPTED | Phase 4G3 architecture | Freezes caller-owned exact rulebook loading, ordered complete binding traversal, ADR-051 aggregation, compiled `[0,100]` normalization projection, semantic decision classification, final result statuses, and exact policy authority without implementation or activation. | None | None |
| ADR-055 | Compiled shadow execution and parity boundary | ACCEPTED | Phase 4G4 | Freezes explicit template-to-rulebook execution binding, attested observation assembly, failure-isolated read-only shadow orchestration, versioned parity projection, default-OFF ScoreCheck create integration, and non-domain observability while legacy scoring remains authoritative. | None | None |
| ADR-056 | Historical Evidence publication eligibility for compiled shadow execution | ACCEPTED | Phase A3 | Freezes system-known replay using exact source publication and persisted Evidence creation times before lifecycle resolution, while keeping freshness and compiled observation contracts separate. | None | None |
| ADR-057 | Historical provider-resolution attestation for Evidence | ACCEPTED | Phase A3.5 | Freezes a separate append-only Evidence-ID attestation emitted by Phase 3E with exact versioned binding/policy lineage, explicit provider namespace mapping, historical status, and deterministic compiled outcome projection. | None | None |
| ADR-058 | Internal template exposure and non-live provider compilation authority | ACCEPTED | Phase A5.5-B1.5 | Separates system-template listing, ScoreCheck, duplication, and compilation capabilities, and separates provider compilation, live execution, and replay-fixture eligibility while preserving exact lineage. | None | None |
| ADR-059 | AI template draft candidates are transient, registry-grounded and non-authoritative | ACCEPTED | Track B1-B | Freezes a transient structured candidate, compact exact registry projection, deterministic support validation, visible unresolved concepts, partial success, disabled AI weights, and no persistence or RAG. | None | None |
| ADR-060 | RAG uses versioned document corpora and immutable citation-bearing chunks | ACCEPTED | Track B2-A | Freezes separate corpus classes, immutable document/chunk and citation lineage, document-specific chunking, provider-neutral index boundaries, bounded hybrid retrieval, tenant isolation, and registry-authoritative RAG integration. | None | None |
| ADR-061 | Production AI and RAG providers use versioned adapters, independent rollout controls and evaluation-gated activation | ACCEPTED | Track C-A | Freezes independent provider classes, exact identities, benchmark-gated selection, immutable publication, metadata-only operations, and evaluation-gated default-OFF rollout without implementing or activating providers. | None | None |
