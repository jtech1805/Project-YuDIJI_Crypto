# ADR-036: Foundation Roadmap Reconciliation and ScoreCheck Execution Flow

Status: Accepted

Date: 2026-08-02

Phase: Phase 3R-A

## Context

Phases 1 through 3 established a provider-independent Evidence foundation, a deterministic single-factor pipeline, and deterministic provider resolution/execution. The existing product, however, begins with a user-selected scoring template and persists a legacy `ScoreCheck`. Before compiled rulebooks are designed, the relationship between that live template workflow and the shadow foundation must be explicit.

The repository does not contain the separately named `YUDIJI_Merged_Execution_Plan` artifact. This reconciliation therefore treats the original deliverables explicitly enumerated by the approved Phase 3R-A implementation prompt as the roadmap baseline and compares them with the repository, ADR-007 through ADR-035, and `PHASE_LOG.md`. It does not claim to have inspected an unavailable document.

No runtime behavior is approved by this ADR. Existing scoring remains authoritative.

## Original roadmap intent

The original foundation direction called for provider-independent Evidence, a Factor Registry, generic deterministic evaluation, representative Evidence/factor proofs, relationship semantics and fixtures, compatibility with template evaluator dispatch, provider health/resolution, MCP v0, an evaluation-harness shell, and eventually compiled rulebooks.

The original deliverable set included or implied:

- Evidence storage and ingestion, including Binance price and later funding/open-interest observations.
- A Factor Registry and generic deterministic evaluator architecture.
- A concrete `BTC_ETF_NET_FLOW` mocked-Evidence proof.
- Six Evidence relationship types with golden fixtures.
- `GENERIC_FACTOR:` compatibility in the existing scoring-template dispatch path.
- A non-production template proof.
- Provider health and resolution.
- MCP v0 and an evaluation-harness shell.
- Compiled rulebooks after the foundation was reconciled.

## Actual Phase 1 implementation

Phase 1 is complete and broader than a minimal Evidence model:

- ADR-007 defines append-only provider-independent observations and revocations.
- ADR-008 adds strict normalization, deterministic deduplication, idempotent ingestion, and the generic adapter port.
- ADR-009 derives lifecycle state at explicit time without mutating Evidence.
- ADR-010 provides bounded, completeness-aware lifecycle reads.
- ADR-011 runs one adapter once and ingests its bounded candidates sequentially.
- ADR-012 proves a strict public Binance spot-price adapter.
- ADR-013 records bounded in-memory shadow observability.
- ADR-014 composes explicit caller-triggered shadow execution.

Evidence is append-only, deduplicated, lifecycle-aware, provider-independent, explicitly timestamped, and historically replayable. The current implementation does not include Binance funding/open-interest adapters, production scheduling, generalized relationship semantics, or runtime ScoreCheck consumption.

## Actual Phase 2 implementation

Phase 2 is complete as a shadow-only deterministic pipeline for one factor:

- ADR-015 registers the canonical `MARKET.PRICE` factor.
- ADR-016 checks Evidence compatibility and freshness at explicit time.
- ADR-017 resolves one authoritative source from complete lifecycle-active observations.
- ADR-018 assembles a minimized evaluator input.
- ADR-019 through ADR-023 define evaluator contracts, immutable registration, explicit execution, multi-evaluator plans, and bounded plan execution.
- ADR-024 through ADR-029 define and execute contribution aggregation, normalization, and semantic decision-band classification.
- ADR-030 composes those completed stages behind one explicit dependency-injected single-factor boundary.

Phase 2 currently handles one factor pipeline at a time. The default deterministic evaluator registry is empty, and no production factor evaluator has been approved. `BTC_ETF_NET_FLOW`, relationship golden fixtures, `GENERIC_FACTOR:` compatibility, template proof, cross-factor conflict handling, and final multi-axis decisions remain pending.

## Actual Phase 3 implementation

Phase 3 is complete and expanded beyond provider metadata:

- ADR-031 defines immutable provider definitions and exact factor-provider order.
- ADR-032 assesses caller-supplied provider telemetry under explicit policies and `asOf`.
- ADR-033 validates explicit provider-resolution rules and unapplied confidence adjustments.
- ADR-034 selects at most one provider in configured order while preserving fallback/proxy/manual/degraded transparency.
- ADR-035 executes only that already-selected runner once and projects the existing Phase 1 ingestion result without retry or second fallback.

Phase 3 remains shadow-only. There are no production provider registrations, telemetry collectors, template bindings, compiled rulebooks, schedulers, controllers, or ScoreCheck integration. Confidence adjustments remain metadata and are not applied.

## Roadmap gaps

| Roadmap item | Actual status | Decision |
| --- | --- | --- |
| Evidence foundation | Complete and expanded | Keep |
| Binance price Evidence | Complete | Keep |
| Binance funding/open interest | Pending | Defer |
| Factor Registry | Complete for `MARKET.PRICE` | Keep and extend deliberately |
| Generic deterministic evaluator architecture | Complete and expanded | Keep |
| `BTC_ETF_NET_FLOW` proof | Pending | Phase 3R reconciliation backlog |
| Six relationship types | Pending architectural decision | Separate ADR |
| Relationship golden fixtures | Pending | Follow relationship ADR |
| `GENERIC_FACTOR:` dispatch | Pending | Compatibility phase |
| Non-production template proof | Pending | Compatibility phase |
| Provider health/resolution | Complete and expanded | Keep |
| Production provider registration/telemetry | Pending | Defer |
| MCP v0 | Pending | Separate explicit backlog decision |
| Evaluation-harness shell | Pending | Separate explicit backlog decision |
| Compiled rulebooks | Not implemented | Phase 4 after reconciliation |
| Cross-factor clusters/conflicts | Not implemented | Later architecture |
| Decision axes | Not implemented | Later architecture |
| ScoreCheck foundation orchestrator | Not implemented | Dedicated follow-up ADR |

## Existing scoring-template flow

The user-facing workflow already begins with a scoring template. System templates are read-only code-registry definitions. User templates are MongoDB documents derived from a system base and contain scope, key/base key, name, market/trade/instrument scope, version/latest/status metadata, weighted sections, exact legacy evaluator keys/configuration, missing-data policies, permission thresholds, resource configuration, allowed tradable symbols, section overrides, and a snapshot policy.

Template resource configuration currently identifies market, bank, volatility, and sector indexes plus related symbols. These roles and legacy evaluator keys are factor-like inputs, but they are not canonical Phase 2 factor bindings.

User template edits are versioned after first use: prior records become non-latest and a new version is created. Unused templates may update in place. System templates are registry version 1. ScoreCheck resolution currently permits system templates and user templates in `ACTIVE` or `DRAFT` state.

The current `ScoreCheckService.createScoreCheck` validates request geometry, loads an active Symbol, resolves the selected template, checks template/symbol compatibility and user-template allowlisting, builds legacy monitored context and optional resource snapshots, invokes `ScoringEngineService.score`, persists and audits the ScoreCheck, marks the template used, and upserts an expiring ScoreCheck snapshot.

`ScoringEngineService.score` is the authoritative entry point. It executes enabled section evaluator keys through `ScoringRuleEvaluatorRegistryService`, aggregates the legacy section results, and derives the current score and trade permission.

## Target template-driven execution flow

The target flow is:

```text
User selects template and instrument
        ↓
Template/version is loaded
        ↓
Compiled rulebook is loaded
        ↓
Factor subjects are resolved
        ↓
Providers are resolved per factor
        ↓
Selected providers create Evidence
        ↓
Compatible authoritative Evidence is selected
        ↓
Factor inputs are assembled
        ↓
Factor evaluators execute
        ↓
Factor contributions are aggregated
        ↓
Factor results are normalized/classified
        ↓
Cross-factor cluster/conflict handling runs later
        ↓
Decision axes are derived later
        ↓
ScoreCheck is persisted
        ↓
Result and explanation are returned
```

The user-facing workflow continues to begin with a scoring template. The new Evidence/Factor/Provider architecture does not replace templates.

Templates declare what must be monitored. Compiled rulebooks freeze how those requirements execute. Evidence represents what was observed. Factors define the meaning and type of each monitored requirement. Providers supply Evidence. Evaluators interpret Evidence. Later cluster/conflict and decision services combine factor results.

## Template responsibilities

A template answers:

- Which strategy is being evaluated?
- Which market, trade style, instrument type, and instruments are eligible?
- Which monitored requirements/factors are required?
- Which strategy weights, missing-data posture, and high-level permission rules apply?
- Which user-facing labels and explanations should be retained?

A template does not select a live provider, calculate provider health, normalize Evidence, execute factor logic, or embed runtime orchestration.

## Compiled-rulebook responsibilities

A compiled rulebook is an immutable executable projection of one source template version. It freezes:

- rulebook ID/version and source template ID/version;
- factor keys/versions;
- subject-binding rules;
- evaluator IDs, evaluator versions, and configuration versions;
- evaluator execution plans;
- aggregation, normalization, and decision-band policy identities/versions;
- provider-binding identities/versions and provider-resolution-policy identities/versions;
- future cluster and decision-policy identities when those contracts exist.

The compiled rulebook must not silently select “latest” dependencies at execution time. Phase 4 must define validation, compilation, immutability, lineage, and compatibility; it does not activate runtime execution by itself.

## Factor responsibilities

A factor definition provides stable meaning, expected value shape/unit, freshness, lifecycle, and version metadata. It remains separate from Evidence and from a particular execution subject.

A factor instance is a factor definition bound to a subject for one ScoreCheck. For example:

```text
MARKET.NIFTY_TREND              → NIFTY_50
SECTOR.METAL_INDEX_TREND        → NIFTY_METAL
INSTRUMENT.PRICE_VS_VWAP        → TATA_STEEL
INSTRUMENT.CVD_DIRECTION         → TATA_STEEL
INSTRUMENT.ORDER_BOOK_IMBALANCE → TATA_STEEL
INSTRUMENT.VOLUME_EXPANSION      → TATA_STEEL
MACRO.DXY_TREND                  → DXY
```

## Subject-resolution responsibilities

A future bounded `FactorSubjectResolver`, or equivalent service, will apply compiled subject-binding rules to the selected instrument and fixed/contextual subjects. It must return exact factor-instance identities and safe failures. It must not fetch Evidence, select providers, or evaluate factors.

Subject resolution is not implemented in Phase 3R-A. Its contract direction must be frozen before compiled rulebooks become executable.

## Provider-resolution responsibilities

For each resolved factor instance, orchestration will provide the exact Phase 3 inputs:

```text
Phase 3A provider binding
+ Phase 3B health assessments
+ Phase 3C resolution policy
→ Phase 3D selected provider
→ Phase 3E selected runner and Evidence ingestion
```

Provider order, health assessment, selection policy, selection result, and execution remain separate responsibilities. Fallback, proxy, manual, degraded-primary, warning, and confidence-adjustment metadata must remain visible through the ScoreCheck response. Runner failure must not trigger hidden reselection, retry, or a second fallback.

## Evidence responsibilities

Selected providers create normalized Evidence through the existing Phase 1 ingestion path. Evidence records observations, provenance, explicit time, factor and subject identity, typed values, validity, and append-only lifecycle relationships. Evidence does not contain a score, trade permission, provider-resolution decision, or final recommendation.

Evidence reads for evaluation remain bounded, lifecycle-aware, completeness-aware, and historically replayable at explicit `asOf`.

## Factor-evaluation responsibilities

For each factor instance, the target reuses the Phase 1/2 sequence:

```text
Evidence read
→ lifecycle filtering
→ compatibility/freshness
→ authoritative source resolution
→ factor input assembly
→ evaluator execution
→ contribution aggregation
→ normalization
→ decision-band classification
```

Phase 2 remains single-factor. Its semantic decision band is a factor classification, not the current legacy trade permission and not a final multi-factor decision.

## Cross-factor responsibilities

Cross-factor processing is planned, not implemented. A future contract may take factor results through correlation clusters, cluster collapse, and conflict detection. Correlated inputs such as VWAP, CVD, order book, and volume must not be blindly counted as four independent confirmations.

Cross-factor output may later contribute to `contextBias`, `executionReadiness`, `riskState`, and `evidenceAgreement`. Those axes and their policies require explicit ADRs and versioned contracts.

## Decision responsibilities

Future decision services will consume completed factor and cluster/conflict results and derive versioned decision axes. They must not fetch providers, read raw Evidence, or contain evaluator arithmetic. Translation from decision axes to product permissions or trade actions remains a separate compatibility and authority decision.

## ScoreCheck orchestration responsibilities

A future thin application service, conceptually `ScoreCheckExecutionService`, will:

- load the exact template and compiled rulebook;
- validate instrument eligibility;
- resolve factor subjects;
- coordinate provider resolution and selected-provider execution;
- collect Evidence references;
- assemble and execute factor pipelines;
- coordinate future cluster/conflict processing and decision derivation;
- persist the ScoreCheck and build its API projection.

It must not contain provider-health formulas, provider-selection rules, Evidence compatibility logic, factor calculations, aggregation or normalization formulas, decision-band thresholds, cluster rules, or decision rules.

Repository inspection shows that current ScoreCheck creation also owns trade geometry, auditing, template usage, TTL snapshots, update/delete constraints, and trade-setup conversion relationships. A dedicated orchestration-contract ADR is therefore required before runtime implementation to freeze transactional ordering, idempotency, partial/failure behavior, refresh behavior, snapshot compatibility, and migration from `ScoreCheckService`.

## Persistence touchpoints

The existing ScoreCheck model stores user/symbol/trade geometry, template lineage, current score/status/permission/confidence, reason codes, warnings, a mixed breakdown, calculation/validity dates, and trade-setup/deletion state. A separate expiring snapshot stores resolved legacy resources, resource snapshots, readiness, section breakdown, final score, permission, warnings, and blockers.

The target conceptual ScoreCheck adds, without changing the current schema in this phase:

```ts
{
  scoreCheckId: string;
  userId: string;
  templateId: string;
  templateVersion: number;
  rulebookId: string;
  rulebookVersion: number;
  instrumentId: string;
  tradeDirection: string;
  asOf: Date;
  providerResolutions: readonly {
    factorKey: string;
    requestedProviderKey: string;
    selectedProviderKey: string | null;
    resolutionStatus: string;
    confidenceAdjustment: number;
    warningCodes: readonly string[];
  }[];
  evidenceIds: readonly string[];
  factorResults: readonly {
    factorKey: string;
    subjectKey: string;
    evaluatorLineage: unknown;
    rawAggregate: number;
    normalizedScore: number;
    classification: string;
  }[];
  clusterResult: unknown | null;
  decision: unknown | null;
  status: "COLLECTING_EVIDENCE" | "EVALUATING" | "COMPLETED" | "PARTIAL" | "FAILED";
}
```

The target differs from the current schema by adding compiled-rulebook lineage, explicit `asOf`, per-factor provider-resolution lineage, Evidence references, canonical factor results, future cluster/decision outputs, and orchestration status. It must coexist with or migrate current geometry, score, permission, breakdown, audit, snapshot, and conversion fields deliberately; this ADR does not approve a schema change.

## API touchpoints

Existing authenticated routes are:

- `GET /api/scoring-templates`
- `GET /api/scoring-templates/system/:templateKey`
- `POST /api/scoring-templates/system/:templateKey/duplicate`
- `GET /api/scoring-templates/:id`
- `PATCH /api/scoring-templates/:id`
- `POST /api/scoring-templates/:id/archive`
- `POST /api/score-checks`
- `GET /api/score-checks`
- `GET /api/score-checks/:id`
- `GET /api/score-checks/:id/snapshot`
- `PATCH /api/score-checks/:id`
- `DELETE /api/score-checks/:id`
- `POST /api/score-checks/:id/convert-to-trade-setup`

Potential future groups include template validation/compilation, compiled-rulebook reads, ScoreCheck refresh, and internal provider/Evidence diagnostics. Candidate paths such as `POST /scoring-templates/:templateId/validate`, `POST /scoring-templates/:templateId/compile`, `GET /compiled-rulebooks/:rulebookId`, `POST /score-checks/:scoreCheckId/refresh`, provider-health preview, resolution preview, and Evidence lookup remain deferred design examples—not approved or implemented public APIs.

## Feature-flag boundaries

The repository already defines default-OFF flags including `EVIDENCE_PIPELINE_ENABLED`, `GENERIC_EVALUATOR_ENABLED`, `COMPILED_RULEBOOK_EXECUTION`, `SOURCE_RESOLVER_FALLBACK_ENABLED`, and `DECISION_AXES_ENABLED`. They are not wired into current ScoreCheck execution.

Phase 3R-A adds or changes no flag. Future runtime work must require explicit default-OFF activation and must not overload one flag to authorize unrelated stages.

## Shadow-mode boundaries

All Phase 1–3 provider/Evidence/factor composition remains caller-triggered or dependency-injected shadow functionality. Default deterministic evaluator and provider-runner production registrations are empty. There is no scheduler, API, controller, module wiring, or production ScoreCheck consumer for the new path.

## Legacy-scoring relationship

Legacy `ScoringEngineService` and `ScoringRuleEvaluatorRegistryService` remain authoritative. Templates continue to drive current ScoreChecks directly until an explicitly approved compatibility and migration path is implemented behind default-OFF controls.

The new architecture sits beside the live path. It does not reinterpret current scores, permissions, snapshots, or persisted ScoreChecks and does not make current template evaluator keys aliases for canonical factors.

## Migration strategy

1. Freeze compiled-rulebook contracts and compilation in Phase 4 without runtime activation.
2. Freeze ScoreCheck orchestration, transactional behavior, status semantics, and persistence compatibility in a dedicated ADR.
3. Add missing factor and relationship proofs and legacy `GENERIC_FACTOR:` compatibility in isolated reconciliation phases.
4. Prove one non-production template-to-rulebook execution with fixed fixtures and no production registrations.
5. Compare shadow outputs with legacy results; do not overwrite or reinterpret legacy fields.
6. Introduce explicit default-OFF activation and rollback controls only in later approved runtime phases.
7. Preserve legacy authority until acceptance gates explicitly transfer a bounded responsibility.

## Continuous example

Input:

```json
{
  "templateId": "METAL_SECTOR_INTRADAY",
  "instrumentId": "TATA_STEEL",
  "tradeDirection": "LONG"
}
```

The template requires:

```text
MARKET.NIFTY_TREND
SECTOR.METAL_INDEX_TREND
INSTRUMENT.PRICE_VS_VWAP
INSTRUMENT.CVD_DIRECTION
INSTRUMENT.ORDER_BOOK_IMBALANCE
INSTRUMENT.VOLUME_EXPANSION
MACRO.DXY_TREND
```

The future execution is:

```text
METAL_SECTOR_INTRADAY version 4 + TATA_STEEL + LONG
→ load METAL_SECTOR_INTRADAY_RULEBOOK version 1
→ bind NIFTY trend to NIFTY_50
→ bind metal-sector trend to NIFTY_METAL
→ bind VWAP/CVD/order-book/volume factors to TATA_STEEL
→ bind macro trend to DXY
→ resolve each exact provider binding under its health/policy lineage
→ if NSE_MARKET_DATA is unavailable, select BROKER_INDEX_FEED visibly as FALLBACK_USED
→ execute only each selected runner and ingest normalized Evidence
→ read complete lifecycle history at the ScoreCheck asOf
→ select compatible authoritative Evidence
→ assemble and execute each single-factor pipeline
→ retain raw aggregate, normalized score, classification, Evidence IDs, evaluator lineage, and provider warnings
→ later collapse correlated technical factors and detect conflicts
→ later derive contextBias, executionReadiness, riskState, and evidenceAgreement
→ persist the target ScoreCheck projection alongside required legacy compatibility fields
→ return result and explanation with fallback provenance still visible
```

## Phase 4 entry conditions

Phase 4 may begin because this ADR freezes the direction of:

- compiled rulebook purpose;
- template-to-factor binding;
- factor-definition versus factor-instance ownership;
- subject-resolution contract;
- factor/evaluator/configuration version lineage;
- provider-binding and provider-resolution-policy lineage;
- target ScoreCheck flow;
- legacy/live compatibility and shadow-only authority.

Phase 4 need not implement every factor, provider, relationship, API, or orchestrator. It must keep the executable rulebook target unambiguous and must not activate compiled execution.

## Deferred work

- Phase 3R-B: ScoreCheck orchestration contract, required before runtime implementation.
- Phase 3R-C: `BTC_ETF_NET_FLOW` factor and mocked Evidence proof.
- Phase 3R-D: relationship-semantics ADR.
- Phase 3R-E: relationship golden fixtures.
- Phase 3R-F: legacy `GENERIC_FACTOR:` compatibility and draft-template proof.
- Phase 3R-G: MCP and evaluation-harness implement/defer decision.
- Phase 4: compiled-rulebook contracts and compiler, without production activation.
- Binance funding/open-interest Evidence, production telemetry/registrations, cross-factor clusters, decision axes, schema migration, public APIs, scheduling, persistence orchestration, and runtime rollout.

The lettering differs from the prompt's suggested backlog because repository inspection reveals that ScoreCheck orchestration ambiguity must be resolved first. No backlog item is dropped.

## Rejected alternatives

1. Replace templates with Factor Registry entries.
2. Treat current legacy evaluator keys as canonical factors without compatibility contracts.
3. Compile templates without explicit subject, evaluator, provider, and policy versions.
4. Put provider, Evidence, factor, cluster, and decision formulas into one ScoreCheck service.
5. Activate the new path or change schemas/APIs during reconciliation.
6. Double-count correlated factors as independent confirmations.
7. Hide fallback, proxy, manual, degraded-primary, or missing-data lineage.
8. Claim roadmap completeness while named proofs and relationship decisions remain pending.

## Consequences

- The product continues to begin with templates while compiled rulebooks become the future executable bridge.
- Phase 1–3 boundaries retain their existing ownership and shadow-only status.
- Phase 4 has an explicit compilation target and lineage requirements.
- The current legacy scoring path and persisted ScoreChecks remain unchanged and authoritative.
- A dedicated orchestration ADR is mandatory before runtime integration.
- Remaining roadmap gaps are visible rather than silently absorbed into Phase 4.
