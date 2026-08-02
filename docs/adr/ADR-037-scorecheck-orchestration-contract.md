# ADR-037: ScoreCheck Orchestration Contract

Status: Accepted

Date: 2026-08-02

Phase: Phase 3R-B

## Context

ADR-036 freezes the future template-driven flow connecting compiled rulebooks, subject resolution, Phase 3 provider execution, Phase 1 Evidence, Phase 2 factor pipelines, later cross-factor processing, and ScoreCheck persistence. The existing production path also owns trade validation, monitored context, legacy scoring, persistence, auditing, expiring snapshots, template usage, update/delete constraints, and trade-setup conversion. Runtime composition cannot be introduced safely until application-level ownership and failure semantics are fixed.

This ADR defines contracts only. It adds no orchestrator, wiring, API, schema, repository, feature flag, or production execution.

## Current production ScoreCheck flow

Authenticated `POST /api/score-checks` invokes `createScoreCheck` in the ScoreCheck controller. The controller validates the body with `createScoreCheckSchema`, obtains `req.user.id`, calls `ScoreCheckService.createScoreCheck`, and returns HTTP 201 with the created projection.

The service then:

1. Validates user and request identifiers and LONG/SHORT trade geometry.
2. Loads the selected Symbol and requires `ACTIVE` or `TRADING` status.
3. Resolves a system template by registry key or an owned user template by ID/latest key.
4. Accepts current user templates in `ACTIVE` or `DRAFT` state.
5. Validates market, instrument, trade-style, commodity, expiry, and user-template Symbol eligibility.
6. Builds the Symbol snapshot, geometry, legacy scoring context, and optional user-template resource snapshot summary.
7. Calls `ScoringEngineService.score` synchronously.
8. Creates the authoritative ScoreCheck.
9. Attempts `SCORE_CHECK_CREATED`, updates reason codes, and attempts `SCORE_CALCULATED` audit records.
10. Marks a user template used.
11. Upserts the expiring ScoreCheck snapshot.
12. Returns the ScoreCheck plus snapshot identity and expiry.

## Target orchestration flow

The public workflow continues to begin at `POST /api/score-checks`, with a thin controller. A future application orchestrator coordinates one immutable request through mode-specific stages. Domain services retain their existing rules.

```text
request validation
→ template resolution
→ optional rulebook resolution
→ instrument and geometry validation
→ mode-specific legacy and/or compiled execution
→ validated authoritative result
→ persistence
→ mandatory audit consistency
→ versioned snapshot projection
→ response
```

## Orchestration responsibility

The future orchestrator coordinates exact dependencies, stage transitions, short-circuiting, idempotency, persistence ordering, and safe projections. It does not calculate provider health, select providers, normalize Evidence, implement evaluator arithmetic, aggregate contributions, normalize scores, classify bands, collapse clusters, or derive decisions.

## Controller responsibility

The controller authenticates, parses the HTTP request and idempotency header, calls the orchestrator once, maps typed request/execution outcomes to HTTP responses, and returns the safe projection. It contains no execution-mode selection heuristics or domain rules.

## Template-resolution responsibility

The template resolver owns current system/user lookup, ownership, executable status, exact version resolution, compatibility metadata, and immutable template lineage. One execution never switches template identity or version. The existing acceptance of `DRAFT` templates is preserved for legacy compatibility but must be an explicit compiled-rulebook compilation/execution policy rather than inherited silently.

## Compiled-rulebook responsibility

The rulebook resolver returns an exact rulebook ID/version tied to the resolved template ID/version. Compiled and shadow execution fail or degrade according to their explicit mode policy when exact lineage is absent; no “latest” substitution is allowed.

## Subject-resolution responsibility

A future subject resolver applies compiled subject-binding rules and returns exact factor, subject, and mandatory/optional requirement metadata. It performs no provider access, Evidence read, or factor evaluation.

## Provider-resolution responsibility

Provider resolution occurs independently per factor instance through Phase 3 contracts. Exact provider binding, health inputs, resolution policy, selected identity, resolution status, confidence adjustment, and warnings remain visible. The orchestration layer never loops through provider order, retries, or executes an alternate fallback.

## Evidence-collection responsibility

A future factor-Evidence coordinator composes provider catalog/binding lookup, supplied health access, Phase 3 selection/execution, Evidence readback, and authoritative Evidence selection. Phase 1 remains the sole normalization, deduplication, persistence, lifecycle, and read boundary. Evidence-level deduplication does not provide ScoreCheck request idempotency.

## Factor-evaluation responsibility

A future factor coordinator receives one resolved factor subject and selected Evidence ID, assembles canonical input, executes the Phase 2 pipeline, and returns canonical evaluator/configuration, aggregation, normalization, and classification lineage. It never selects providers, resolves subjects, or applies cross-factor rules.

## Future cross-factor responsibility

Cross-factor processing remains deferred. Its future coordinator consumes completed canonical factor results only and applies explicitly versioned cluster/correlation/conflict rules. It does not read providers or raw Evidence.

## Decision responsibility

Decision derivation remains deferred. Its future coordinator consumes canonical factor and cross-factor results and returns versioned decision axes. Until both cross-factor and decision contracts exist, `COMPILED` mode remains disabled.

## Persistence responsibility

The orchestrator coordinates persistence only after a validated authoritative execution result exists. A repository port owns ScoreCheck database operations. Persistence failures are execution failures and must never be projected as successful ScoreChecks.

## Audit responsibility

The audit port owns sanitized audit persistence. Future authoritative execution requires a consistency strategy in which the mandatory audit outcome is known and recoverable. Audit metadata includes execution mode, template/rulebook lineage, user, instrument, ScoreCheck status, and safe provider fallback/proxy/manual/degraded warnings, without raw provider payloads or complete Evidence.

The current `AuditLogService.record` is best effort and swallows persistence errors after logging. That behavior does not satisfy the future mandatory-audit requirement and must be reconciled before orchestrator activation without changing it in this phase.

## Snapshot responsibility

The current TTL ScoreCheck snapshot is a read-optimized, time-bounded scoring/resource projection and a prerequisite for trade-setup conversion. It is not an Evidence store or authorization token. Compiled lineage must use a new versioned snapshot projection or an explicitly versioned extension; it must not repurpose existing mixed fields silently.

## Trade-setup conversion responsibility

Existing conversion remains compatible and continues to require an owned ready/unexpired ScoreCheck, valid TTL snapshot, active matching TradePlan, permanent trade-score snapshot, and risk-governor approval. A future authoritative compiled ScoreCheck must provide the stable score/status/permission and snapshot semantics conversion requires, or conversion must explicitly support a new version. Orchestration cannot break current uniqueness and conversion guards.

## Execution modes

The frozen modes are `LEGACY`, `SHADOW`, and `COMPILED`. There is no implicit fallback between them.

## Feature-flag behavior

`LEGACY` remains available under current production behavior. `SHADOW` requires explicit Evidence/shadow approval, including `EVIDENCE_PIPELINE_ENABLED`, and remains non-authoritative. `COMPILED` requires `COMPILED_RULEBOOK_EXECUTION` plus every required downstream capability flag, including Evidence and decision capabilities. `EVIDENCE_PIPELINE_ENABLED`, `COMPILED_RULEBOOK_EXECUTION`, and `DECISION_AXES_ENABLED` remain OFF and unchanged.

Flags authorize bounded capabilities; they do not select fallback modes. A requested unavailable mode returns a typed failure.

## Shadow execution

Shadow ordering is frozen as shared validation, authoritative legacy execution, then bounded safe shadow execution, then authoritative persistence. This avoids racing two paths over shared mutable state and guarantees that shadow output cannot alter the legacy score, permission, status, or response.

Shadow failure is sanitized and must not fail a valid legacy request. Any shadow diagnostic persistence requires a separately approved bounded schema/projection. This ADR does not approve background execution, response delay without bound, or persistence of raw shadow data.

## Compiled execution

Compiled execution resolves exact rulebook lineage, subjects, providers, Evidence, factor results, cross-factor result, and decision before authoritative persistence. Mandatory missing inputs fail closed. It never runs legacy scoring as a substitute. Until cross-factor and decision contracts and required flags exist, compiled execution is unavailable.

## Legacy execution

Legacy execution preserves the current template/context/`ScoringEngineService` path and remains authoritative by default. A future orchestrator calls it through a narrow legacy-executor port rather than duplicating current calculations. Existing templates remain executable until an explicit migration retires them.

## Request contract

`ScoreCheckExecutionRequest` freezes request ID, user-scoped idempotency key, user, exact key-or-ID template selection and optional requested version, instrument and canonical market/instrument/trade types, immutable geometry, execution mode, and explicit fixed `asOf`.

`requestId` is correlation identity; `idempotencyKey` is authoritative duplicate-request identity. They are not generated by the contract and cannot change during execution.

## Result contract

`ScoreCheckExecutionResult` contains safe ScoreCheck identity when persisted, request/mode/status, exact template and optional rulebook lineage, instrument and `asOf`, bounded legacy and/or compiled projections, and immutable stage reports. Compiled projections retain provider-resolution lineage, Evidence IDs, evaluator/configuration lineage, canonical factor results, and future cross-factor/decision output.

No result builder or persistence implementation is added now.

## Stage model

The fixed stages are request validation, template resolution, rulebook resolution, instrument validation, geometry validation, subject resolution, provider resolution, Evidence collection, Evidence selection, factor evaluation, cross-factor processing, decision derivation, legacy scoring, persistence, audit, snapshot creation, and response projection.

States are `PENDING`, `COMPLETED`, `PARTIAL`, `FAILED`, and `SKIPPED`. Reports contain only stage, state, and a safe code. Raw exceptions never appear.

## Stage failure behavior

- Invalid request, template/version mismatch, ineligible instrument, and invalid geometry are request failures before execution.
- Missing rulebook, subject failure, unresolved mandatory provider, unavailable mandatory Evidence, factor failure, cross-factor failure, and decision failure are execution failures in authoritative compiled mode.
- The corresponding new-pipeline failures are non-authoritative diagnostics in shadow mode after legacy success.
- Persistence failure is an authoritative execution failure.
- Audit and snapshot failures after ScoreCheck persistence are consistency failures requiring recovery state; they must not be reported as ordinary full success.
- All later unattempted stages are `SKIPPED`; no mode substitution occurs.

## Partial behavior

Factor requirement levels initially support `MANDATORY` and `OPTIONAL`. Mandatory unavailability makes compiled output failed or explicitly non-actionable according to a future versioned rulebook policy; it can never be scored as zero silently. Optional unavailability may produce `PARTIAL` only when the compiled policy explicitly permits continuation, and it also cannot silently receive zero.

Legacy `BLOCK`, `PARTIAL`, `ZERO`, and `IGNORE` policies are not automatically equivalent to these levels. Their mapping requires explicit template compatibility/compilation rules. Advanced confirmation/risk relationships remain deferred.

## Idempotency

Future HTTP requests carry a client-generated `Idempotency-Key`. The authoritative identity is exact `(userId, idempotencyKey)`. Repeating that identity with the same canonical request returns the same authoritative ScoreCheck result. Reuse with a different canonical request fails as an idempotency conflict.

The implementation must reserve identity before external provider execution and coordinate concurrent duplicates so only one owner performs side effects. Replays must not intentionally repeat provider execution, create duplicate ScoreChecks, audits, or snapshots. Evidence deduplication remains a separate observation-level guarantee.

## Transaction boundaries

The current flow has no MongoDB session or transaction. ScoreCheck create/update, best-effort audits, template usage, and snapshot upsert are sequential. Trade-setup conversion also spans several sequential writes without a transaction.

The future consistency unit includes authoritative ScoreCheck persistence, mandatory audit persistence, and required snapshot linkage. The implementation ADR must choose either a supported database transaction or a durable idempotent state machine/outbox with explicit recovery. This contract does not falsely claim atomicity today.

## Rollback behavior

No current coordinated rollback exists. The future design must prefer recoverable forward completion over deleting append-only Evidence or audit history. A pre-persistence execution failure creates no authoritative ScoreCheck. A post-persistence audit/snapshot failure records a recoverable consistency state and retries only the missing idempotent operation; it does not rerun providers or factors.

## Retry policy

There is no orchestrator-level automatic retry of provider selection, provider execution, Evidence collection, evaluator execution, or mode selection. Operational persistence/audit/snapshot recovery may retry only a bounded idempotent write under the same request identity. No retry may create another authoritative ScoreCheck or hide a failure behind another provider/evaluator/mode.

## Concurrency considerations

Concurrent identical requests must serialize or converge on one idempotency record and ScoreCheck. Template/rulebook/instrument/asOf lineage is snapshotted before execution. A template edit, rulebook publication, provider-health change, or Symbol change after that snapshot cannot alter the in-flight identity. Trade-setup conversion retains its current compare-and-set guard and unique source relationship.

## Lineage persistence

Future persistence records execution mode; request/idempotency identity; template and rulebook ID/version; instrument and `asOf`; factor/subject/requirement; provider resolution status, warnings, and confidence adjustment; Evidence IDs; evaluator/configuration versions; aggregation/normalization/classification lineage; and future cluster/decision versions. Raw payloads and credentials are excluded.

## Compatibility with current schemas

Current ScoreCheck and TTL snapshot schemas do not contain idempotency, execution mode, rulebook, provider-resolution, Evidence, or canonical factor lineage. The pure contracts do not imply those fields exist. A later schema ADR must version or add persistence while preserving current score, permission, status, geometry, audit, snapshot, and conversion consumers.

## Migration strategy

1. Keep legacy execution authoritative and unchanged.
2. Define compiled rulebooks and the subject/factor coordination contracts without activation.
3. Add a durable user-scoped idempotency and consistency design.
4. Version ScoreCheck and snapshot persistence explicitly.
5. Introduce bounded shadow comparison behind default-OFF approval.
6. Prove replay, concurrency, partial, failure, audit, snapshot, and conversion compatibility.
7. Enable compiled mode only after cross-factor/decision contracts and all capability gates exist.
8. Never interpret legacy evaluator keys as canonical factor identities without a compatibility compiler.

## Relationship to Phase 1

Phase 1 exclusively owns Evidence normalization, deduplication, persistence, lifecycle, and reads. The orchestrator coordinates through ports and never bypasses those boundaries.

## Relationship to Phase 2

Phase 2 owns single-factor compatibility, source selection, assembly, evaluation, aggregation, normalization, and classification. The orchestrator and factor coordinator do not reproduce its formulas.

## Relationship to Phase 3

Phase 3 owns provider metadata, health assessment, resolution policy, deterministic selection, selected-runner execution, and fallback transparency. Orchestration supplies exact inputs and preserves results.

## Relationship to Phase 4

Phase 4 compiles template requirements into exact versioned rulebook lineage consumed by this request flow. Phase 4 adds no production activation and must honor this mode, idempotency, stage, and compatibility contract.

## Deferred implementation

The orchestrator, idempotency store, database consistency mechanism, schema/version migration, rulebook compiler, subject resolver, Evidence/factor coordinators, cross-factor/decision services, shadow diagnostics, API header handling, and runtime feature-flag wiring remain deferred.

## Rejected alternatives

1. Put all domain formulas into a single ScoreCheck service.
2. Make shadow output authoritative or allow shadow failure to fail legacy requests.
3. Let compiled execution silently invoke legacy scoring when requirements fail.
4. Treat Evidence deduplication as API request idempotency.
5. Persist before validating the authoritative output.
6. Claim current sequential writes are transactional.
7. Continue after missing mandatory factors by assigning zero.
8. Repurpose the existing TTL snapshot without versioning.
9. Retry providers, evaluators, or modes invisibly.

## Consequences

- Runtime orchestration now has a bounded, mode-aware target without being implemented.
- Current transaction and best-effort audit risks are explicit.
- Legacy ScoreCheck and trade-setup behavior remains authoritative and unchanged.
- Shadow comparison cannot alter user-visible results.
- Compiled mode remains unavailable until its complete downstream architecture exists.
- Later implementation must solve idempotency and post-persistence recovery before activation.
