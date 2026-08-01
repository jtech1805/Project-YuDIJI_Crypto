# YUDIJI Phase Log

This file tracks approved migration phases for the production-grade evolution of YUDIJI scoring architecture. It is an operating log, not a replacement for ADRs, PRDs, HLDs, LLDs, or tests.

## Project Operating Rules

Current active phase:
No active implementation phase; Phase 3D deterministic provider resolution execution is complete.

Last completed acceptance gate:
Phase 3D — Deterministic Provider Resolution Execution

Next smallest task:
Phase 3E — Adapter Composition and Adversarial Fallback Proof, only through a separately approved ADR and implementation prompt.

Phase 0 status:
COMPLETE

Characterization-suite requirement:
The scoring characterization suite is mandatory for every later scoring-related implementation. Existing expectations must not be changed merely to make a later implementation pass.

Feature-flag state:
Feature-flag scaffolding exists in Phase 0D. All approved flags default OFF and no flag is connected to scoring, LLM tracing, provider, API, WebSocket, trade, or frontend behavior yet.

Known constraints:
- Legacy scoring remains authoritative during the migration.
- New architecture must sit beside legacy scoring until a future ADR changes authority.
- Existing public scoring output fields remain backward compatible.
- Active templates must not be silently mutated.
- Accepted ADRs must not be silently rewritten to change their meaning.
- Codex implements approved decisions and must not invent architecture.

## Phase Entries

### Phase 0A — Scoring Characterization

Status:
COMPLETE

Objective:
Lock current scoring behavior.

Production code changed:
No

Tests added:
`scoring-engine.characterization.test.ts`

Dedicated tests:
15/15 passed

Full backend tests:
393/393 passed

Typecheck:
passed

Regression status:
green

Feature flags:
none introduced

Known limitations:
existing behavior is characterized, including unusual legacy normalization behavior

Commit reference:
pending user-provided commit hash

### Phase 0B — ADR Foundation and Phase Log

Status:
COMPLETE

Objective:
Establish architecture decision history and phase execution tracking.

Production code changed:
No

Feature flags:
documented only, not implemented

Acceptance gate:
ADR index, ADR-001 through ADR-005 and `PHASE_LOG.md` exist and are internally consistent.

### Phase 0C — LLM Call Inventory And Trace Design

Status:
COMPLETE

Objective:
Inventory existing LLM calls and design trace boundaries before implementation.

Production code changed:
No

Active LLM workflows:
- Analyzer alert report.
- Copilot chat.
- Post-trade review.

Artifacts:
- `docs/ai/LLM_CALL_INVENTORY.md`
- `docs/design/LLM_TRACE_DESIGN.md`
- `docs/adr/ADR-006-shared-provider-independent-llm-trace-contract.md`

Feature flags:
documented only, not implemented

Known architectural debt:
Copilot currently returns LLM-generated `isApproved`. Future architecture requires deterministic systems to own trade permission. Phase 0C records this debt and does not change behavior.

Acceptance gate:
LLM inventory, trace design, ADR-006, ADR index and phase log are internally consistent.

### Phase 0D — Feature-Flag Scaffolding

Status:
COMPLETE

Objective:
Introduce default-OFF feature-flag scaffolding for future scoring architecture capabilities.

Production code changed:
Startup validation only. No product behavior is connected to a flag.

Files added:
- `yujidi-server/src/config/feature-flags.ts`
- `yujidi-server/tests/unit/config/feature-flags.test.ts`

Files modified:
- `yujidi-server/src/server.ts`
- `PHASE_LOG.md`

Approved flags:
- `EVIDENCE_PIPELINE_ENABLED` default OFF
- `GENERIC_EVALUATOR_ENABLED` default OFF
- `SOURCE_RESOLVER_FALLBACK_ENABLED` default OFF
- `COMPILED_RULEBOOK_EXECUTION` default OFF
- `DECISION_AXES_ENABLED` default OFF
- `EVENT_CLASSIFICATION_READONLY` default OFF
- `EVENT_CLASSIFICATION_AFFECTS_RISK` default OFF
- `RAG_TEMPLATE_DRAFTING_ENABLED` default OFF
- `WEIGHT_PROPOSALS_ENABLED` default OFF

Behavior connection state:
No scoring, LLM, provider, template, API, WebSocket, trade, or frontend behavior is controlled by these flags in Phase 0D.

Acceptance gate:
Dedicated feature-flag tests, existing backend regression suite, typecheck, optional architecture check, and `git diff --check` pass.

## Future Phase Outline

### Phase 0E-1 — LLM Trace Foundation

Status:
COMPLETE

Objective:
Implement the approved provider-independent LLM trace contract, append-oriented model, and best-effort persistence service.

Files added:
- `yujidi-server/src/types/llm-trace.types.ts`
- `yujidi-server/src/models/llm-trace.model.ts`
- `yujidi-server/src/services/llm-trace.service.ts`
- `yujidi-server/tests/unit/services/llm-trace.service.test.ts`
- `yujidi-server/tests/unit/models/llm-trace.model.test.ts`

Integration state:
No analyzer alert, Copilot chat, post-trade review, `LlmService`, provider interface, or Groq workflow is integrated with trace persistence yet.

Persistence behavior:
Trace writes are metadata-first and best effort. Persistence failures are sanitized, logged, and never fail the calling workflow.

### Phase 0E-2 — Post-Trade Review Trace Integration

Status:
COMPLETE

Scope:
Post-trade review only.

Files modified:
- `yujidi-server/src/services/ai-trade-review.service.ts`
- `yujidi-server/tests/unit/services/ai-trade-review.service.test.ts`
- `PHASE_LOG.md`

Trace behavior:
Each attempted post-trade review provider call emits exactly one finalized, metadata-only trace. Valid output, schema validation failure, semantic validation failure, and provider failure have distinct approved trace metadata. Trace persistence is non-blocking and best effort.

Preserved behavior:
Review output and deterministic fallback behavior, `AiExplanation` persistence, journal updates, API behavior, and existing audit actions and ordering remain unchanged. Requests rejected before provider invocation are not traced.

Integration state:
Analyzer alert and Copilot chat workflows were not integrated during Phase 0E-2.

### Phase 0E-3 — Analyzer Alert-Report Trace Integration

Status:
COMPLETE

Scope:
Analyzer alert-report generation. This is the second integrated LLM workflow after post-trade review.

Trace behavior:
Every attempted analyzer alert-report generation emits one finalized, metadata-only trace. Accepted reports map to `COMPLETED`; all report-generation rejections map to `PROVIDER_FAILED` with `ALERT_REPORT_GENERATION_FAILED`. No fallback alert report exists.

Provider-abstraction limitation:
Provider-internal empty-response, parse, and schema stages are not distinguishable at the analyzer boundary. Successful validation flags mean the provider returned the accepted application output contract, not that the analyzer performs separate semantic validation.

Preserved behavior:
Threshold evaluation, monitor caching, cooldown timing, news and CVD handling, order-book calculations, Alert persistence, WebSocket emission, and existing failure behavior remain unchanged.

### Phase 0E-4 — Copilot Chat Trace Integration

Status:
COMPLETE

Scope:
Copilot chat. This is the third and final active LLM workflow integrated with the shared trace foundation.

Trace behavior:
Every attempted Copilot provider call emits one finalized, metadata-only trace. Accepted output maps to `COMPLETED`; provider-boundary rejection maps to `PROVIDER_FAILED` with `COPILOT_CHAT_GENERATION_FAILED`. Trace writes are non-blocking and failure-isolated.

Metadata boundary:
Input traces store a deterministic hash plus message/history counts and availability booleans. Output traces store only intent, the current `isApproved` output boolean, and reply length. Raw messages, history, replies, wallet and trade values are not persisted.

Architectural debt:
Copilot still returns LLM-generated `isApproved`. Tracing records this existing public output as metadata only and does not make the LLM authoritative for deterministic trade permission.

Provider-abstraction limitation:
Provider-internal empty-response, parse, and schema stages are not distinguishable at the controller boundary, so thrown failures use one generic provider-failure mapping without error-message inspection.

Preserved behavior:
Request validation, session ownership, recent-history selection, deterministic trade calculations, message ordering and persistence, API response fields, and existing error responses remain unchanged.

### Phase 1A — Evidence Contract and Persistence

Status:
COMPLETE

Objective:
Add the provider-independent Evidence persistence foundation beside legacy scoring without making it authoritative.

Artifacts:
- `docs/adr/ADR-007-append-only-evidence-foundation.md`
- `yujidi-server/src/types/evidence.types.ts`
- `yujidi-server/src/models/evidence.model.ts`
- `yujidi-server/src/repositories/evidence.repository.ts`
- `yujidi-server/tests/unit/models/evidence.model.test.ts`
- `yujidi-server/tests/unit/repositories/evidence.repository.test.ts`

Architecture:
Evidence records normalized observations and append-only revocations rather than decisions. Observation values use a discriminated number, boolean, category, or event contract. Corrections, supersession, and revocation create new records rather than mutating existing records.

Repository:
The Evidence repository supports create, find by evidence ID, and find by deduplication key only. It exposes no update, replace, delete, upsert, or bulk-mutation API.

Runtime integration:
None. Evidence is not connected to scoring, templates, monitors, analyzer, Copilot, post-trade review, providers, schedulers, WebSockets, HTTP APIs, or frontend code.

Authority and flags:
Legacy scoring remains authoritative. `EVIDENCE_PIPELINE_ENABLED` remains default `false` and unused.

Known test-discovery limitation:
The default backend `npm test` glob does not discover tests under `tests/unit/models`, `tests/unit/repositories`, or `tests/unit/controllers`. Evidence and Copilot tests must also be run explicitly until test discovery is expanded in a separately approved task.

Retained architectural debt:
Provider-internal LLM failure stages remain indistinguishable at analyzer and Copilot boundaries. Copilot LLM-generated `isApproved` remains non-authoritative architectural debt.

### Phase 1B — Evidence Ingestion and Deduplication

Status:
COMPLETE

Objective:
Add a provider-independent candidate, normalization, canonical deduplication, and ingestion boundary while preserving append-only Evidence.

Artifacts:
- `docs/adr/ADR-008-provider-independent-evidence-ingestion.md`
- `yujidi-server/src/types/evidence-ingestion.types.ts`
- `yujidi-server/src/ports/evidence-provider-adapter.port.ts`
- `yujidi-server/src/services/evidence-candidate-normalizer.service.ts`
- `yujidi-server/src/services/evidence-deduplication-key.service.ts`
- `yujidi-server/src/services/evidence-ingestion.service.ts`
- focused service tests for normalization, deduplication, and ingestion

Normalization:
Candidates reuse the Phase 1A discriminated Evidence union without persistence-owned identifiers. Validation rejects malformed, mixed, untrimmed, incorrectly typed, or unknown data rather than coercing it.

Deduplication:
Canonical normalized identity is recursively key-sorted, serializes dates as UTC ISO strings, includes an explicit `v1` version, and is hashed with SHA-256. Duplicate-key races map to `DUPLICATE` only when structured MongoDB metadata identifies the unique deduplication index and its winning record can be read.

Append-only behavior:
The ingestion service calls only approved reads and repository `create()`. No update, replace, delete, remove, upsert, bulk mutation, mark-revoked, or mark-superseded method exists.

Runtime and provider integration:
None. Phase 1B defines only the generic adapter boundary. No concrete provider, scoring, alert, controller, route, scheduler, WebSocket, LLM, or frontend integration exists.

Authority and flags:
Legacy scoring remains authoritative. `EVIDENCE_PIPELINE_ENABLED` remains default `false` and unused.

Known test-discovery limitation:
The default backend `npm test` glob discovers the new service tests but still does not discover model, repository, controller, or configuration directories without focused commands.

Retained architectural debt:
Provider-internal LLM failure stages remain indistinguishable at analyzer and Copilot boundaries. Copilot LLM-generated `isApproved` remains non-authoritative architectural debt.

### Phase 1C — Evidence Lifecycle Resolution

Status:
COMPLETE

Objective:
Interpret supplied append-only Evidence history at a caller-provided evaluation time without persisting derived lifecycle state.

Artifacts:
- `docs/adr/ADR-009-evidence-lifecycle-resolution.md`
- `yujidi-server/src/types/evidence-lifecycle.types.ts`
- `yujidi-server/src/services/evidence-lifecycle-resolver.service.ts`
- `yujidi-server/tests/unit/services/evidence-lifecycle-resolver.service.test.ts`

Read-time computation:
The pure resolver accepts supplied Evidence records and an explicit `asOf`. It has no repository, MongoDB, logger, environment, system-clock, feature-flag, or mutation dependency.

Precedence and validity:
Revocation takes precedence over supersession, which takes precedence over validity windows. `validFrom` and `validUntil` are inclusive, and missing boundaries are unbounded.

Relationship diagnostics:
Missing targets, self-reference, supersession cycles, and duplicate supplied Evidence IDs are tolerated and surfaced through deterministically sorted diagnostics. Cycle edges are ignored rather than selecting a winner.

Runtime integration:
None. Lifecycle resolution is not connected to scoring, alerts, controllers, routes, providers, schedulers, WebSockets, LLMs, or frontend code.

Authority and flags:
Legacy scoring remains authoritative. `EVIDENCE_PIPELINE_ENABLED` remains default `false` and unused.

Known test-discovery limitation:
The default backend `npm test` glob discovers lifecycle service tests but still does not discover model, repository, controller, or configuration directories without focused commands.

Retained architectural debt:
Provider-internal LLM failure stages remain indistinguishable at analyzer and Copilot boundaries. Copilot LLM-generated `isApproved` remains non-authoritative architectural debt.

### Phase 1D — Evidence Read and Query Boundary

Status:
COMPLETE

Objective:
Load bounded relevant Evidence history and apply the Phase 1C lifecycle resolver through an internal read-only application boundary.

Artifacts:
- `docs/adr/ADR-010-evidence-read-query-boundary.md`
- `yujidi-server/src/types/evidence-read.types.ts`
- `yujidi-server/src/services/evidence-read.service.ts`
- repository read/count extensions and query-specific indexes
- focused repository and read-service tests

Bounds and counts:
Base history defaults to 200 and is capped at 1,000. Relationship history is capped at 2,000. Both queries have matching counts.

Completeness:
Base or relationship truncation marks the result incomplete. Incomplete results expose bounded history and counts but return no active observations, lifecycle resolutions, or diagnostics.

Relationship loading:
Revocations and superseding observations targeting bounded base IDs are loaded separately with `observedAt <= asOf`, then merged deterministically.

Lifecycle integration:
Complete history is delegated to the Phase 1C resolver. Active observations and resolutions are filtered back to base query IDs so external relationship observations cannot escape query scope.

Runtime integration:
None. The read boundary is not connected to scoring, alerts, controllers, routes, providers, schedulers, WebSockets, LLMs, or frontend code.

Authority and flags:
Legacy scoring remains authoritative. `EVIDENCE_PIPELINE_ENABLED` remains default `false` and unused.

Known test-discovery limitation:
The default backend `npm test` glob discovers read-service tests but still does not discover model, repository, controller, or configuration directories without focused commands.

Retained architectural debt:
Provider-internal LLM failure stages remain indistinguishable at analyzer and Copilot boundaries. Copilot LLM-generated `isApproved` remains non-authoritative architectural debt.

### Phase 1E — Generic Provider Adapter Harness

Status:
COMPLETE

Objective:
Execute the frozen Phase 1B adapter contract through a bounded, deterministic, sequential ingestion harness without adding a concrete provider.

Artifacts:
- `docs/adr/ADR-011-generic-evidence-provider-runner.md`
- `yujidi-server/src/types/evidence-provider-run.types.ts`
- `yujidi-server/src/services/evidence-provider-runner.service.ts`
- focused provider-runner tests

Batch policy:
Empty candidate arrays are valid and the fixed maximum is 500. Oversized arrays fail before ingestion and are not truncated or split.

Execution:
The runner validates `adapterId`, calls `readCandidates()` exactly once, and calls `EvidenceIngestionService.ingest()` sequentially once per candidate in original order.

Failure isolation and status:
Candidate rejection, duplication, failure, or unexpected thrown exception does not stop later candidates. `COMPLETED` means all candidates were created or duplicates; any candidate rejection/failure produces `PARTIAL`; batch-level `FAILED` is reserved for pre-ingestion adapter failures.

Retry and logging:
No retries and no logging are added. Raw payloads, candidates, values, credentials, and exception messages are not exposed.

Deferred technical debt:
The existing Phase 1B `EvidenceIngestionService.ingestFrom()` method uses parallel `Promise.all`. Phase 1E does not call, modify, or remove it; reconciliation is deferred.

Runtime integration:
None. No concrete provider, payload adapter, scoring, alert, controller, route, scheduler, WebSocket, LLM, lifecycle read, or frontend integration exists.

Authority and flags:
Legacy scoring remains authoritative. `EVIDENCE_PIPELINE_ENABLED` remains default `false` and unused.

Known test-discovery limitation:
The default backend `npm test` glob discovers provider-runner service tests but still does not discover model, repository, controller, or configuration directories without focused commands.

Retained architectural debt:
Provider-internal LLM failure stages remain indistinguishable at analyzer and Copilot boundaries. Copilot LLM-generated `isApproved` remains non-authoritative architectural debt.

### Phase 1F — First Concrete Provider Adapter in Shadow Mode

Status:
COMPLETE

Objective:
Translate bounded Binance public spot-price responses into normalized Evidence candidates through the frozen pull-adapter contract.

Artifacts:
- `docs/adr/ADR-012-binance-public-price-evidence-adapter.md`
- injected Binance public-market client port and Axios implementation
- injected clock port
- `BINANCE_PUBLIC_MARKET_PRICE_V1` adapter and safe typed errors
- focused adapter/client and generic-runner integration tests

Provider scope:
Public `/api/v3/ticker/price` data only. Initial shadow configurations cover `BTCUSDT` and `ETHUSDT`; constructor injection is bounded to 1–20 unique normalized USDT symbols.

Mapping:
Prices map to `MARKET.PRICE`, canonical `CRYPTO:BINANCE:<symbol>` instrument subjects, `MARKET_DATA`/`BINANCE` provenance, numeric values, and unit `USDT`.

Timestamp and validation:
An injected clock is called once per adapter run and cloned per candidate. Provider objects, symbols, and positive decimal strings are validated strictly without loose coercion.

Execution and failures:
Provider requests are sequential in configured order. Any request, response, symbol, price, or clock failure fails the coherent adapter snapshot; no partial candidate batch is returned.

Shadow-only state:
The adapter is instantiated only by tests. No scheduler, startup registration, controller, route, WebSocket, manual script, or automatic runtime path exists.

Security and authority:
No Binance credentials, account, order, balance, position, trade, or user data is accessed. No scoring or LLM integration exists. Legacy scoring remains authoritative and `EVIDENCE_PIPELINE_ENABLED` remains default `false`.

Known test-discovery limitation:
The default backend `npm test` glob discovers the runner integration test but does not discover adapter, client, model, repository, controller, or configuration directories without focused commands.

Retained architectural debt:
The unused Phase 1B `ingestFrom()` path remains parallel while the Phase 1E runner is sequential. Provider-internal LLM failure stages remain indistinguishable at analyzer and Copilot boundaries.

### Phase 1F-QA — Deterministic SymbolSearch Test Baseline Repair

Status:
COMPLETE

Objective:
Restore the full backend baseline by removing system-clock dependence from the two active NFO SymbolSearch fixtures.

Deterministic time:
`SymbolSearchService` accepts the shared clock port with a system-clock production default. Search reads the clock once when applying the unchanged default expiry filter. Tests inject `2026-07-01T00:00:00.000Z`.

Preserved behavior:
Active NFO instruments remain included, expired instruments remain excluded, and an instrument with `expiry` exactly equal to the evaluation time remains active under the existing inclusive `$gte` rule.

Scope:
No SymbolSearch business semantics, Evidence files, scoring behavior, API behavior, frontend behavior, dependencies, or package scripts changed.

Verification:
The deterministic SymbolSearch suite, Phase 1 regression, trace regression, full backend suite, typecheck, circular dependency check, and `git diff --check` pass.

### Phase 1G — Evidence Pipeline Observability and Shadow Health

Status:
COMPLETE

Objective:
Record privacy-safe operational summaries for explicitly executed Evidence provider runs and derive deterministic per-adapter health.

Artifacts:
- `docs/adr/ADR-013-evidence-shadow-observability.md`
- `yujidi-server/src/types/evidence-observability.types.ts`
- `yujidi-server/src/services/evidence-observability.service.ts`
- focused observability tests

State and bounds:
Health is process-local in-memory operational state, not Evidence. At most 100 unique adapter IDs are tracked with no silent eviction; process restart clears all state.

Health:
Completed runs are healthy, partial runs and one consecutive batch failure are degraded, and two or more consecutive batch failures are unhealthy. Completed and partial runs reset the batch-level consecutive failure counter.

Metrics:
Safe run/candidate counters, last run, last full success, last status, safe failure code, and exact supplied duration are retained. Pipeline snapshots use one injected-clock call and sort adapters deterministically.

Privacy:
No payloads, candidate values/results, Evidence documents, credentials, exceptions, or stack traces are retained or logged.

Execution state:
Recording is explicit after a provider run. The runner and provider adapters are unchanged. No provider scheduler, automatic registration, runtime executor, API, WebSocket, frontend, or external exporter exists.

Authority and flags:
No scoring consumer exists. Legacy scoring remains authoritative and `EVIDENCE_PIPELINE_ENABLED` remains default `false`.

Known test-discovery limitation:
The default backend `npm test` glob discovers observability service tests but still omits adapter, client, model, repository, controller, and configuration directories without focused commands.

### Phase 1H — Explicit Evidence Shadow Execution Boundary

Status:
COMPLETE

Objective:
Coordinate explicitly supplied adapters through the generic runner and operational observability without creating an automatic runtime path.

Artifacts:
- `docs/adr/ADR-014-explicit-evidence-shadow-execution.md`
- `yujidi-server/src/types/evidence-shadow-execution.types.ts`
- `yujidi-server/src/services/evidence-shadow-execution.service.ts`
- focused shadow-execution tests

Execution:
An explicit caller supplies an already constructed adapter. The executor reads one injected clock before and after the single runner call, sends every typed `COMPLETED`, `PARTIAL`, or `FAILED` result unchanged to observability, and returns aggregate timing, run, and health data.

Failure isolation:
Unexpected runner throws return sanitized `EXECUTION_FAILED` results without observability. Observability throws return `OBSERVABILITY_FAILED` with the safe run summary and no fabricated health. Invalid initial clocks throw a typed error; invalid completion clocks return a sanitized `INVALID_CLOCK` failure without recording.

Privacy and immutability:
No provider payload, candidate value/result, Evidence identifier, deduplication key, credential, raw error, or stack trace is returned or logged. Input dates and health dates are cloned.

Runtime integration:
None. The executor has no scheduler, registry, provider-client construction, startup hook, controller, route, WebSocket, frontend, scoring, or persistent execution-history integration.

Authority and flags:
Legacy scoring remains authoritative. `EVIDENCE_PIPELINE_ENABLED` remains default `false` and unused.

Verification:
Focused execution, full Phase 1, trace regression, full backend, typecheck, repository-owned circular dependency, and whitespace gates pass.

### Phase 1H-QA — Circular Dependency Gate Restoration and Legacy Cycle Audit

Status:
COMPLETE

Objective:
Restore a reproducible repository-owned circular-dependency gate and explicitly audit the legacy cycles that predate Phase 1 Evidence work.

Tooling:
Madge 6.0.0 is pinned as a development dependency compatible with the repository's Node 20 and TypeScript 6 installation. `npm ci` installs it locally, and `npm run arch:circular` invokes the repository-owned comparison script without global or temporary tooling.

Baseline and enforcement:
Six verified legacy cycles are recorded in `docs/architecture/known-circular-dependencies.json`. Cycle paths are normalized across separators, rotation, and reverse orientation. Malformed or duplicate baseline entries fail. New or changed cycles fail. Resolved baseline entries are reported as removable debt. No production directory is broadly excluded.

Legacy remediation:
- `LEGACY-CYCLE-001`: extract live-tick and cached-trade projection contracts into a neutral type module.
- `LEGACY-CYCLE-002`: relocate the trade-event record contract and inject a delivery port.
- `LEGACY-CYCLE-003`: inject narrow delivery and live-monitoring ports at composition.
- `LEGACY-CYCLE-004`: compose subscription, monitoring, and delivery without cross-imported singletons.
- `LEGACY-CYCLE-005`: extract the active-trade record projection into a neutral trade contract.
- `LEGACY-CYCLE-006`: relocate evaluator interfaces without changing authoritative scoring semantics.

Phase 1 isolation:
No cycle contains shadow execution, observability, the provider runner, the Binance adapter, or any Phase 1 Evidence contract. No Evidence, scoring, API, provider execution, observability, frontend, or runtime behavior changed.

Verification:
Clean `npm ci`, focused architecture tests, the repository-owned circular gate, full Phase 1 regression, trace regression, full backend suite, typecheck, and `git diff --check` pass.

### Phase 2A — Factor Registry Foundation

Status:
COMPLETE

Objective:
Define authoritative, deterministic, immutable factor metadata without connecting it to Evidence reads, source resolution, evaluators, or scoring.

Artifacts:
- `docs/adr/ADR-015-factor-registry-foundation.md`
- `yujidi-server/src/types/factor-registry.types.ts`
- `yujidi-server/src/registries/default-factor-definitions.ts`
- `yujidi-server/src/registries/factor.registry.ts`
- focused registry tests

Initial definition:
Only the concretely supported `MARKET.PRICE` factor is registered. It is version 1, active, numeric, instrument-scoped, requires a quote-currency unit, carries a 10,000 ms maximum-age policy, and is metadata-classified as eligible for future deterministic scoring.

Validation and immutability:
Construction validates every runtime field, rejects empty registries and duplicate keys, and protects source and returned nested state through defensive cloning and freezing. Lookup is exact and unknown factors fail closed.

Compatibility:
The registry validates lifecycle, Evidence value type, Evidence subject type, and required, optional, forbidden, or allow-listed unit policy. It does not inspect an Evidence document or evaluate freshness or scoring eligibility.

Runtime integration:
None. No Evidence query, source selection, evaluator execution, score calculation, database registry, administration, API, scheduler, frontend, provider, LLM, or runtime activation exists.

Authority and flags:
Existing scoring remains authoritative. `EVIDENCE_PIPELINE_ENABLED` remains default `false` and unused.

Verification:
Focused registry tests, Phase 1 regression, trace regression, full backend suite, typecheck, the repository-owned circular dependency gate, and `git diff --check` pass.

### Phase 2B — Evidence-to-Factor Compatibility Boundary

Status:
COMPLETE

Objective:
Validate one caller-supplied Evidence observation against immutable factor metadata, its inclusive validity interval, and freshness at an explicit evaluation time.

Artifacts:
- `docs/adr/ADR-016-evidence-factor-compatibility-freshness.md`
- `yujidi-server/src/types/evidence-factor-compatibility.types.ts`
- `yujidi-server/src/services/evidence-factor-compatibility.service.ts`
- focused compatibility tests

Input and evaluation:
The service accepts one unknown runtime value and explicit `asOf`, rejects revocations, delegates factor lifecycle/value/subject/unit policy to the Phase 2A registry, evaluates inclusive validity, rejects future observations, and evaluates `MAX_AGE`, `VALIDITY_INTERVAL`, or `NON_EXPIRING` freshness deterministically.

Market-price boundary:
`MARKET.PRICE` is fresh through exactly 10,000 ms of age and stale above that boundary. Temporal validity and freshness remain separate decisions.

Privacy and immutability:
Results expose safe identity, definition version, scoring-eligibility metadata, evaluation time, and freshness only. Evidence values, deduplication keys, provenance, provider data, and raw validation errors are excluded. Inputs and registry definitions are not mutated.

Runtime integration:
None. No repository read, lifecycle resolution, source selection, evaluator execution, scoring, database write, API, scheduler, provider, frontend, LLM, or runtime activation exists.

Authority and flags:
Existing scoring remains authoritative. Evidence remains disconnected from production decision-making, and `EVIDENCE_PIPELINE_ENABLED` remains default `false`.

Verification:
Focused compatibility tests, Phase 2A regression, Phase 1 regression, trace regression, full backend suite, typecheck, the repository-owned circular dependency gate, and `git diff --check` pass.

### Phase 2C — Evidence Source Resolution Foundation

Status:
COMPLETE

Objective:
Select one authoritative observation deterministically from a caller-supplied, bounded, lifecycle-active set without repository reads, lifecycle resolution, evaluator execution, or scoring.

Artifacts:
- `docs/adr/ADR-017-deterministic-evidence-source-resolution.md`
- `yujidi-server/src/types/evidence-source-resolution.types.ts`
- `yujidi-server/src/registries/default-evidence-source-authority.ts`
- `yujidi-server/src/registries/evidence-source-authority.registry.ts`
- `yujidi-server/src/services/evidence-source-resolution.service.ts`
- focused authority-registry and resolver tests

Input and bounds:
The caller supplies factor, subject, active observations, exact Phase 1D completeness metadata, and explicit `asOf`. Zero through 100 observations are accepted; 101 or more fail before compatibility evaluation. Incomplete or truncated history fails closed.

Compatibility and selection:
Every valid candidate is evaluated exactly once through Phase 2B. For `MARKET.PRICE`, configured source authority ranks before recency, confidence, provider, source ID, and Evidence ID. The audited `MARKET_DATA` / `BINANCE` authority has priority 100. Unknown sources remain eligible without fabricated priority.

Safety and determinism:
Mixed factors, mixed subjects, duplicate IDs, malformed candidates, and unsupported factors fail closed. Input order cannot affect selection. Traces expose safe identity and decision metadata only, never Evidence values, deduplication keys, or payloads.

Runtime integration:
None. No repository, Evidence-read service, lifecycle service, provider, controller, API, scheduler, evaluator, scoring, frontend, LLM, or runtime activation is connected.

Authority and flags:
Existing scoring remains authoritative. Evidence remains disconnected from production decision-making, and `EVIDENCE_PIPELINE_ENABLED` remains default `false`.

Verification:
Focused Phase 2C tests, Phase 2A–2B regression, Phase 1 regression, trace regression, full backend suite, typecheck, the repository-owned circular dependency gate, and `git diff --check` pass.

### Phase 2D — Deterministic Factor Input Assembly

Status:
COMPLETE

Objective:
Assemble one evaluator-ready factor input by orchestrating bounded lifecycle-aware Evidence reads and Phase 2C source selection without independently selecting Evidence, executing an evaluator, or calculating a score.

Artifacts:
- `docs/adr/ADR-018-deterministic-factor-input-assembly.md`
- `yujidi-server/src/types/factor-input-assembly.types.ts`
- `yujidi-server/src/services/factor-input-assembly.service.ts`
- focused factor-input assembly tests

Read orchestration:
All Evidence reads use `EvidenceReadService.read` with exact factor/subject scope, explicit caller `asOf`, and the Phase 1D maximum base-history limit of 1,000. No repository is imported directly and lifecycle resolution is not duplicated.

Completeness and selection:
Incomplete, base-truncated, or relationship-truncated reads fail closed before source resolution. Complete active observations and exact completeness metadata are passed unchanged to Phase 2C once. Phase 2C exclusively selects the Evidence ID.

Selected input:
The selected ID must occur exactly once in active observations. `MARKET.PRICE` projects an exact finite `NUMBER` and required unit, safe source identity, definition version, cloned times, confidence, aggregate candidate counts, and freshness derived from explicit time and registered policy.

Data minimization:
The result excludes complete Evidence records, deduplication keys, provider payloads, validity and lifecycle internals, unselected values, and the full Phase 2C trace.

Runtime integration:
None. No direct repository, lifecycle resolver, provider, controller, API, scheduler, evaluator, scoring, frontend, LLM, or runtime activation is connected.

Authority and flags:
Existing scoring remains authoritative. Evidence remains disconnected from production decisions, and `EVIDENCE_PIPELINE_ENABLED` remains default `false`.

Verification:
Focused Phase 2D tests, combined Phase 2 regression, Phase 1 regression, trace regression, full backend suite, typecheck, the repository-owned circular dependency gate, and `git diff --check` pass.

### Phase 2E — Deterministic Evaluator Foundation

Status:
COMPLETE

Objective:
Define the stable synchronous contract, result taxonomy, and validation boundary that future deterministic factor evaluators must follow without implementing production factor logic or score aggregation.

Artifacts:
- `docs/adr/ADR-019-deterministic-factor-evaluator-contract.md`
- `yujidi-server/src/types/factor-evaluator.types.ts`
- `yujidi-server/src/ports/deterministic-factor-evaluator.port.ts`
- `yujidi-server/src/services/factor-evaluator-contract.service.ts`
- focused evaluator-contract tests

Port and identity:
Evaluators synchronously consume only `AssembledFactorInput`, declare an exact immutable ID, positive evaluator and configuration versions, and non-empty duplicate-free supported Factor keys. The port permits no Promise or I/O assumption.

Outcomes and contributions:
Results use `PASS`, `FAIL`, `NEUTRAL`, or `UNAVAILABLE`. Evaluators declare finite minimum and maximum points; returned points must remain within them. PASS is positive, FAIL negative, and NEUTRAL/UNAVAILABLE zero.

Audit and diagnostics:
Results preserve exact factor, subject, Evidence ID, definition version, safe source identity, and observation/evaluation times. Reason codes are bounded uppercase machine identifiers. Diagnostics are limited to 20 bounded primitive-only entries.

Validation and immutability:
Declaration validation does not invoke evaluators. Execution validation rejects identity, input, bounds, outcome, reason, diagnostics, and audit-reference mismatches without repair. Valid results are defensively cloned and frozen with independent dates.

Runtime integration:
None. No production evaluator, new evaluator registry, Factor Input Assembly call, Evidence read, repository, provider, network, database, scoring aggregation, legacy evaluator modification, API, scheduler, frontend, LLM, or runtime activation exists.

Authority and flags:
Legacy scoring remains unchanged and authoritative. Evidence remains disconnected from production decisions, and `EVIDENCE_PIPELINE_ENABLED` remains default `false`.

Verification:
Focused Phase 2E tests, combined Phase 2 regression, Phase 1 regression, trace regression, full backend suite, typecheck, the repository-owned circular dependency gate, and `git diff --check` pass.

### Phase 2F — Deterministic Evaluator Registry Foundation

Status:
COMPLETE

Objective:
Register and resolve Phase 2E-valid deterministic evaluator implementations through immutable code-defined exact lookup without executing evaluators or selecting one automatically.

Artifacts:
- `docs/adr/ADR-020-deterministic-factor-evaluator-registry.md`
- `yujidi-server/src/types/factor-evaluator-registry.types.ts`
- `yujidi-server/src/registries/deterministic-factor-evaluator.registry.ts`
- `yujidi-server/src/registries/default-deterministic-factor-evaluator.registry.ts`
- focused deterministic evaluator registry tests

Construction:
The registry accepts a dense caller-supplied array, delegates declaration validation exactly once per evaluator to Phase 2E, rejects invalid evaluators and duplicate exact IDs with sanitized typed errors, and permits an empty registry.

Lookup and ordering:
Exact ID lookup returns the retained implementation reference or `null`. Factor lookup returns every matching evaluator, never a preferred one. Summaries and implementation lists sort by evaluator ID, independent of construction order.

Snapshots and immutability:
Evaluator ID, evaluator/configuration versions, and supported Factor keys are snapshotted during construction. Source-array or evaluator-metadata mutation cannot change indexes or summaries. Returned summary structures and implementation-list arrays are defensively frozen.

Default state:
The production evaluator collection is explicitly empty. No placeholder, fake, or production evaluator is registered.

Runtime integration:
None. No evaluator execution, automatic evaluator selection, Factor Input Assembly call, Evidence read, provider, repository, score aggregation, legacy registry bridge, API, scheduler, frontend, LLM, or runtime activation exists.

Authority and flags:
Legacy scoring remains unchanged and authoritative. Evidence remains disconnected from production decisions, and `EVIDENCE_PIPELINE_ENABLED` remains default `false`.

Verification:
Focused Phase 2F tests, combined Phase 2 regression, Phase 1 regression, trace regression, full backend suite, typecheck, the repository-owned circular dependency gate, and `git diff --check` pass.

### Phase 2G — Deterministic Evaluator Execution Foundation

Status:
COMPLETE

Objective:
Execute exactly one caller-selected Phase 2E evaluator against one caller-supplied assembled factor input through a deterministic, sanitized, fail-closed boundary.

Artifacts:
- `docs/adr/ADR-021-explicit-deterministic-evaluator-execution-boundary.md`
- `yujidi-server/src/types/factor-evaluator-execution.types.ts`
- `yujidi-server/src/services/explicit-factor-evaluator-execution.service.ts`
- focused explicit evaluator execution tests

Request and lookup:
The caller supplies an exact non-empty pre-trimmed evaluator ID and an already assembled input. Phase 2G validates only the safe boundary shape and calls Phase 2F `getById()` exactly once without normalization, version fallback, factor-based selection, or default selection.

Execution:
Exact factor support is verified before execution. One synchronous `evaluate()` call is permitted, with no retry. Unexpected thrown values are reduced to `EVALUATOR_EXECUTION_FAILED`; Promise-like returns are rejected without awaiting.

Result validation:
Every ordinary evaluator return is delegated exactly once to Phase 2E `validateResult()`. Invalid output fails closed without repair or leakage. Valid normal results and typed `evaluated: false` failures are preserved as successful boundary executions using Phase 2E's defensive result.

Immutability and determinism:
Requests, assembled inputs, evaluator declarations, supported factors, raw output, and validated output are not mutated. Boundary objects are frozen, no clock or randomness is read, and no execution ID or duration is generated.

Runtime integration:
None. Phase 2G does not call Factor Input Assembly, read Evidence, access a provider or database, persist results, run multiple evaluators, aggregate or weight contributions, calculate a score or decision band, modify legacy execution, or add an API, scheduler, frontend, LLM, or runtime path.

Authority and flags:
Legacy scoring remains unchanged and authoritative. No BUY, SELL, or HOLD decision is produced. Evidence remains disconnected from production decisions, and `EVIDENCE_PIPELINE_ENABLED` remains default `false`.

Verification:
Focused Phase 2G tests passed 11/11. Combined Phase 2 regression passed 110/110, Phase 1 regression passed 113/113, trace regression passed 55/55, and the full backend suite passed 565/565. Typecheck, the repository-owned circular dependency gate with zero new cycles, and `git diff --check` passed.

### Phase 2H — Explicit Multi-Evaluator Execution Plan Contract

Status:
COMPLETE

Objective:
Validate one caller-supplied, single-factor multi-evaluator plan as a bounded, deterministic, immutable contract without executing evaluators or introducing aggregation.

Artifacts:
- `docs/adr/ADR-022-explicit-multi-evaluator-execution-plan-contract.md`
- `yujidi-server/src/types/factor-evaluator-execution-plan.types.ts`
- `yujidi-server/src/services/factor-evaluator-execution-plan.service.ts`
- focused execution-plan validation tests

Plan identity and scope:
The caller supplies an exact uppercase plan ID, a positive integer plan version, one registered factor key, one explicit failure policy, and 1–20 evaluator steps. A plan targets one future assembled factor input and never contains input data, Evidence references, weights, contributions, or results.

Ordering and uniqueness:
Every step carries an explicit positive order. Array order must agree with contiguous `1..N` order, no sorting or repair occurs, and duplicate step orders or exact evaluator IDs fail closed.

Registry and factor validation:
After all structural checks pass, Phase 2F `getById()` resolves every exact evaluator ID once in plan order. Every evaluator must exist and support the plan factor. Safe evaluator identity, evaluator version, configuration version, and supported-factor metadata are snapshotted without retaining or invoking implementations.

Failure policies:
`STOP_ON_ANY_FAILURE` stops a future runner after any Phase 2G boundary or typed evaluator failure. `CONTINUE_ON_EVALUATOR_FAILURE` continues only after typed evaluator failures. `CONTINUE_ALWAYS` attempts all remaining steps. Phase 2H records these semantics but performs no execution or retry.

Immutability and determinism:
Validated plans, steps, and supported-factor arrays are defensively cloned and frozen. Validation preserves caller order, returns the first failure in a fixed order, and reads no clock, randomness, generated ID, persistence, or I/O.

Runtime integration:
None. Phase 2H does not call Phase 2G, Factor Input Assembly, Evidence, providers, repositories, legacy evaluators, scoring, APIs, schedulers, frontend, LLMs, RAG, or MCP. It performs no weighting, contribution aggregation, final scoring, decision-band calculation, or BUY, SELL, or HOLD decision.

Authority and flags:
Legacy scoring remains unchanged and authoritative. Evidence remains disconnected from production decisions, and `EVIDENCE_PIPELINE_ENABLED` remains default `false`.

Verification:
Focused Phase 2H tests passed 13/13. Combined Phase 2 regression passed 123/123, Phase 1 regression passed 113/113, trace regression passed 55/55, and the full backend suite passed 578/578. Typecheck, the repository-owned circular dependency gate with six approved legacy cycles and zero new cycles, and `git diff --check` passed.

### Phase 2I — Bounded Multi-Evaluator Execution Runner

Status:
COMPLETE

Objective:
Run one already validated Phase 2H plan against one already assembled Phase 2D input through ordered Phase 2G delegation and return a safe categorical execution report without aggregating contributions.

Artifacts:
- `docs/adr/ADR-023-bounded-multi-evaluator-execution-runner.md`
- `yujidi-server/src/types/factor-evaluator-plan-runner.types.ts`
- `yujidi-server/src/services/factor-evaluator-plan-runner.service.ts`
- focused multi-evaluator runner tests

Input boundary:
The synchronous runner accepts only one defensively checked validated plan and one already assembled input. Plan and input factor keys must match exactly before execution. Raw-plan validation, Factor Input Assembly, registry access, evaluator selection, Evidence reads, providers, and persistence are excluded.

Sequential delegation:
At most 20 validated steps are attempted in exact plan order. Each attempted step calls Phase 2G exactly once with the step evaluator ID and unchanged input. No evaluator is called directly, no retry exists, and skipped steps never call Phase 2G.

Failure behavior:
`STOP_ON_ANY_FAILURE` stops before remaining steps after typed evaluator or boundary failure. `CONTINUE_ON_EVALUATOR_FAILURE` continues after typed evaluator failures and stops after boundary failures. `CONTINUE_ALWAYS` attempts every step. Unexpected Phase 2G throws and malformed results become sanitized boundary failures.

Report behavior:
Typed evaluator and boundary failures remain distinct. Early termination emits explicit metadata-only skipped-step reports and `STOPPED` termination metadata. A failure on the final step remains `COMPLETED` because every step was attempted. Summary counts are categorical only and satisfy attempted/skipped and disposition invariants.

Immutability and determinism:
Reports, termination metadata, summaries, step arrays, step reports, and copied Phase 2G results are defensively cloned and frozen. The runner reads no clock or randomness and generates no ID, timestamp, or duration.

Runtime integration:
None. Phase 2I does not inspect contributions for control flow, aggregate or weight points, calculate a total or final score, map decision bands, produce BUY, SELL, or HOLD, persist reports, or add APIs, schedulers, frontend, LLMs, RAG, MCP, or runtime composition.

Authority and flags:
Legacy scoring remains unchanged and authoritative. Evidence remains disconnected from production decisions, and `EVIDENCE_PIPELINE_ENABLED` remains default `false`.

Verification:
Focused Phase 2I tests passed 14/14. Combined Phase 2 regression passed 137/137, Phase 1 regression passed 113/113, trace regression passed 55/55, and the full backend suite passed 592/592. Typecheck, the repository-owned circular dependency gate with six approved legacy cycles and zero new cycles, and `git diff --check` passed.

### Phase 2J — Deterministic Contribution Aggregation Contract

Status:
COMPLETE

Objective:
Validate an immutable, versioned contribution-aggregation policy for one factor and one exact validated execution plan without reading a report or performing aggregation.

Artifacts:
- `docs/adr/ADR-024-deterministic-contribution-aggregation-contract.md`
- `yujidi-server/src/types/factor-contribution-aggregation.types.ts`
- `yujidi-server/src/services/factor-contribution-aggregation-policy.service.ts`
- focused aggregation-policy validation tests

Identity and scope:
The caller supplies an exact uppercase policy ID, positive integer policy version, exact plan ID/version reference, one matching factor key, explicit method, bounds, and entries. The policy does not discover a plan or evaluator and does not contain report or contribution values.

Coverage and ordering:
Policy entries exactly cover all 1–20 validated plan steps in the same contiguous array order. Evaluator IDs, evaluator versions, and configuration versions must match index-by-index. Duplicate orders and evaluator IDs fail closed.

Method, weights, and bounds:
`WEIGHTED_SUM` is the only approved method, but Phase 2J does not execute it. Every entry requires an explicit finite weight satisfying `0 < weight <= 100`, without rounding, normalization, percentage interpretation, or total-weight constraint. Caller-declared finite aggregate minimum and maximum bounds must be ordered and include zero.

Eligibility:
Successfully evaluated `PASS`, `FAIL`, and `NEUTRAL` results are eligible for future numeric aggregation. `UNAVAILABLE`, typed evaluator failures, Phase 2G boundary failures, and Phase 2I skipped steps are ineligible and are never substituted with zero.

Immutability and determinism:
Validated policies defensively clone and freeze bounds, outcome eligibility, entries, and entry arrays. Validation returns the first failure in a fixed order and reads no clock, randomness, generated identity, report, persistence, or external state.

Runtime integration:
None. Phase 2J does not call Phase 2I, inspect execution reports, multiply or sum contributions, normalize percentages, calculate a final score, create a decision band, produce BUY, SELL, or HOLD, persist policies, or add APIs, schedulers, frontend, LLMs, RAG, MCP, or runtime composition.

Authority and flags:
Legacy scoring, its 0–100 conventions, weights, normalization, and decisions remain unchanged and authoritative. Evidence remains disconnected from production decisions, and `EVIDENCE_PIPELINE_ENABLED` remains default `false`.

Verification:
Focused Phase 2J tests passed 13/13. Combined Phase 2 regression passed 150/150, Phase 1 regression passed 113/113, trace regression passed 55/55, and the full backend suite passed 605/605. Typecheck, the repository-owned circular dependency gate with six approved legacy cycles and zero new cycles, and `git diff --check` passed.

### Phase 2K — Deterministic Contribution Aggregation Execution

Status:
COMPLETE

Objective:
Aggregate eligible contributions from one successful Phase 2I report under one exact validated Phase 2J policy into a finite, bounded raw weighted contribution without normalization or decisions.

Artifacts:
- `docs/adr/ADR-025-deterministic-contribution-aggregation-execution.md`
- `yujidi-server/src/types/factor-contribution-aggregation-execution.types.ts`
- `yujidi-server/src/services/factor-contribution-aggregation-execution.service.ts`
- focused aggregation-execution tests

Input and identity boundary:
The synchronous dependency-free service accepts only one defensively safe validated policy and one `ran: true` report. Plan ID/version, factor, step count, order, evaluator ID, evaluator version, and configuration version must align exactly before classification or arithmetic.

Eligibility:
Evaluated `PASS`, `FAIL`, and `NEUTRAL` contributions are eligible. `UNAVAILABLE`, typed evaluator failures, Phase 2G boundary failures, and Phase 2I skipped steps are explicitly projected as ineligible and excluded rather than assigned synthetic zero contributions.

Arithmetic and bounds:
Eligible contribution points and minimum/maximum bounds are multiplied by raw positive policy weights with native JavaScript arithmetic and no rounding. Theoretical weighted bounds and actual points are summed sequentially in report order, must remain finite, and must fit inclusively within declared policy bounds. All-ineligible reports validly produce aggregate and theoretical bounds of zero.

Report behavior:
Success exposes only policy/plan/factor identity, raw aggregate points, declared and theoretical bounds, categorical summary counts, and minimized immutable step projections. It omits raw policies, reports, execution objects, Evidence, diagnostics, provider data, exceptions, and legacy scoring data.

Immutability and determinism:
The service does not mutate policy or report inputs. Result bounds, summaries, contributions, weighted contributions, step projections, arrays, and outer results are newly created and frozen. No clock, randomness, generated ID, timestamp, duration, parallel reduction, or external state is used.

Runtime integration:
None. Phase 2K does not call Phase 2I or Phase 2J services, execute evaluators, access registries, query Evidence, fetch providers, normalize weights or scores, round results, calculate percentages or final scores, create decision bands, produce BUY, SELL, or HOLD, persist results, or add APIs, schedulers, frontend, LLMs, RAG, MCP, or runtime composition.

Authority and flags:
Legacy scoring, weighted averages, normalization, rounding, templates, and decisions remain unchanged and authoritative. Evidence remains disconnected from production decisions, and `EVIDENCE_PIPELINE_ENABLED` remains default `false`.

Verification:
Focused Phase 2K tests passed 14/14. Combined Phase 2 regression passed 164/164, Phase 1 regression passed 113/113, trace regression passed 55/55, and the full backend suite passed 619/619. Typecheck, the repository-owned circular dependency gate with six approved legacy cycles and zero new cycles, and `git diff --check` passed.

### Phase 2L — Deterministic Raw Aggregate Normalization Contract

Status:
COMPLETE

Objective:
Define an immutable normalization-policy contract for a future deterministic mapping of one bounded raw aggregate into an explicit normalized numeric range without executing normalization or producing decisions.

Artifacts:
- `docs/adr/ADR-026-deterministic-raw-aggregate-normalization-contract.md`
- `yujidi-server/src/types/factor-aggregate-normalization.types.ts`
- `yujidi-server/src/services/factor-aggregate-normalization-policy.service.ts`
- focused normalization-policy validation tests

Identity and scope:
The caller supplies an uppercase normalization-policy ID, positive integer version, one exact Phase 2J aggregation-policy ID/version, and the same single factor. No latest-version resolution, generated identity, cross-factor mapping, policy registry, or persistence exists.

Ranges and neutral anchor:
The caller explicitly declares finite source bounds that exactly match the aggregation policy, with a negative minimum, literal zero neutral, positive maximum, and non-zero capacity on both sides. The finite target range is strictly ordered around an explicit neutral score. Raw zero maps to normalized neutral, and asymmetric source and target ranges are supported without a fixed 0–100 convention or midpoint assumption.

Method and future behavior:
`PIECEWISE_LINEAR_ZERO_ANCHORED` is the only method. It defines independent future lower and upper linear segments around zero. `FAIL` is the only out-of-range policy, so future execution must fail closed; clamping, saturation, and extrapolation are forbidden. `PRESERVE_NATIVE` is the only precision policy, with no rounding, truncation, decimal-place configuration, or epsilon adjustment.

Validation, immutability, and determinism:
The synchronous pure service validates the runtime aggregation-policy boundary and returns only the first failure in a fixed order. Successful policies defensively clone and freeze both ranges and the outer policy. Validation reads no Phase 2K result, clock, randomness, generated ID, external state, or I/O.

Runtime integration:
None. Phase 2L performs no normalization arithmetic, normalized-score calculation, decision-band evaluation, confidence calculation, BUY, SELL, HOLD, or NO_TRADE output. It adds no API, controller, scheduler, frontend, provider, LLM, RAG, MCP, persistence, or runtime activation.

Authority and flags:
Legacy scoring, normalization, rounding, templates, thresholds, and decisions remain unchanged and authoritative. Evidence remains disconnected from production decisions, and `EVIDENCE_PIPELINE_ENABLED` remains default `false`.

Verification:
Focused Phase 2L tests passed 13/13. Combined Phase 2 regression passed 177/177, Phase 1 regression passed 113/113, trace regression passed 55/55, and the full backend suite passed 632/632. Typecheck, the repository-owned circular dependency gate with six approved legacy cycles and zero new cycles, and `git diff --check` passed.

### Phase 2M — Deterministic Raw Aggregate Normalization Execution

Status:
COMPLETE

Objective:
Map one bounded Phase 2K raw aggregate through one exact Phase 2L policy into an immutable normalized numeric result.

Contract and execution:
The independent synchronous service requires exact aggregation policy ID/version, factor, and declared source bounds. Source minimum, zero (including negative zero), and source maximum map exactly to target minimum, neutral, and maximum. Interior values use independent lower and upper piecewise-linear segments.

Safety and scope:
Raw and normalized values must remain finite and inclusively bounded. `FAIL` prohibits clamping or extrapolation and `PRESERVE_NATIVE` prohibits rounding or truncation. No band, permission, confidence, persistence, API, or runtime activation exists.

Verification:
Focused Phase 2M tests passed 10/10 and typecheck passed before Phase 2N began.

### Phase 2N — Deterministic Decision-Band Contract

Status:
COMPLETE

Objective:
Validate one immutable policy that completely partitions an exact normalized range into five semantic analytical bands without classifying a runtime score.

Contract:
The policy targets one exact normalization policy ID/version and factor. It requires `STRONG_NEGATIVE`, `NEGATIVE`, `NEUTRAL`, `POSITIVE`, and `STRONG_POSITIVE` in exact order with caller-defined finite thresholds, contiguous orders, unique labels, positive widths, complete endpoint coverage, no gaps, and no overlaps.

Boundary convention:
Every minimum is inclusive. The first four maxima are exclusive and the final maximum is inclusive, producing `[min,max)` intervals followed by `[min,max]`.

Verification:
Focused Phase 2N tests passed 9/9 and typecheck passed before Phase 2O began.

### Phase 2O — Deterministic Decision-Band Execution

Status:
COMPLETE

Objective:
Classify one successful Phase 2M normalized result through one exact validated Phase 2N policy into exactly one semantic analytical band.

Classification:
Normalization identity, factor, and normalized range must match exactly. Scores must be finite and inclusively bounded. Shared boundaries map to the later band, the final maximum maps to `STRONG_POSITIVE`, and zero or multiple matches fail closed.

Semantic limitation and authority:
Band labels describe score position only and are not BUY, SELL, HOLD, broker, order, position, confidence, or risk instructions. No persistence, API, scheduler, frontend, LLM, provider, or runtime composition is added. Legacy scoring remains unchanged and authoritative, Evidence remains disconnected from production decisions, and `EVIDENCE_PIPELINE_ENABLED` remains default `false`.

Phase 2 functional architecture:
COMPLETE through deterministic semantic classification. Runtime activation and authority migration remain unapproved and deferred.

Verification:
Focused Phase 2O tests passed 8/8. Combined Phase 2 regression passed 204/204, Phase 1 regression passed 113/113, trace regression passed 55/55, and the full backend suite passed 659/659. Typecheck, the repository-owned circular dependency gate with six approved legacy cycles and zero new cycles, forbidden-import audits, and `git diff --check` passed.

### Phase 2P — End-to-End Deterministic Pipeline Composition

Status:
COMPLETE

Objective:
Compose one already assembled factor input and validated evaluator-plan, aggregation, normalization, and decision-band contracts through the completed deterministic stages as an explicit caller-triggered shadow pipeline.

Input and preflight boundary:
The service accepts assembled and validated contracts only. Defensive runtime checks precede exact factor, plan, evaluator-entry, aggregation-policy, source-bound, normalization-policy, target-range, and decision-band lineage checks. It calls no raw-policy validator and performs no Factor Input Assembly.

Sequential delegation:
Phase 2I is invoked exactly once after successful preflight. Phase 2K, Phase 2M, and Phase 2O are each invoked at most once and only after the preceding stage succeeds. No business logic from those stages is duplicated, and no retry, fallback, policy discovery, evaluator selection, or alternate ordering exists.

Failure and trace behavior:
The first typed downstream failure stops all later stages and preserves only its sanitized categorical code. Unexpected dependency exceptions become `UNEXPECTED_STAGE_EXCEPTION` without exposing thrown data. Every success and failure contains the same five-stage trace in exact order with `COMPLETED`, `FAILED`, or `SKIPPED` status.

Success, immutability, and determinism:
Success retains complete plan and policy version lineage and the four already sanitized immutable downstream outputs. New identity, subject, trace, and outer structures are frozen. No clock, random value, pipeline ID, timestamp, duration, persistence, or external state is used.

Shadow-only scope and authority:
The pipeline is not registered in production runtime. It does not read Evidence, execute providers or evaluators directly, access registries, persist output, expose an API, schedule work, emit WebSockets, modify legacy scoring, or translate semantic bands into BUY, SELL, HOLD, or broker instructions. Legacy scoring remains authoritative and `EVIDENCE_PIPELINE_ENABLED` remains default `false`.

Phase 2 deterministic functional architecture:
COMPLETE through explicit end-to-end shadow composition. Production activation, persistence, monitoring, and authority migration remain unapproved and deferred.

Verification:
Focused Phase 2P tests passed 9/9. Combined Phase 2 regression passed 213/213, Phase 1 regression passed 113/113, trace regression passed 55/55, and the full backend suite passed 668/668. Typecheck, the repository-owned circular dependency gate with six approved legacy cycles and zero new cycles, forbidden-import and duplicated-logic audits, and `git diff --check` passed.

### Phase 3A — Provider Definition and Factor Binding Contract

Status:
COMPLETE

Next:
Phase 3B — Provider Health

Architecture decision:
ADR-031 accepted.

Contracts:
- Provider definition and stable provider identity are frozen.
- Provider type, descriptive authority metadata, and descriptive cost metadata are frozen.
- Licensing, production-use suitability, proxy approval, cost, and other commercial decisions remain human-owned.
- Supported factors reuse the canonical `FactorKey`; enabled status is explicit.
- Factor-provider bindings record one exact factor and an explicit ordered provider list.
- Position zero is the preferred provider; remaining providers are fallback candidates in exact declared order.
- Proxy and manual provider status remain explicit and are never hidden.
- Duplicate provider keys, duplicate supported factors, duplicate factor bindings, and duplicate bound providers are rejected.
- Unknown, disabled, and factor-incompatible bound providers are rejected.
- Successful catalogs are detached, deeply frozen snapshots that preserve caller order.

Runtime integration:
None. Phase 3A calculates no provider health, selects no provider, executes no fallback or adapter, creates no Evidence, invokes no Phase 2 service, persists no configuration, and adds no API, controller, scheduler, frontend, or MCP implementation. It generates no warnings, confidence adjustment, IDs, timestamps, or runtime activation.

Authority and flags:
Legacy scoring remains unchanged and authoritative. `EVIDENCE_PIPELINE_ENABLED` remains default `false` and disconnected.

Verification:
Focused Phase 3A tests passed 21/21. Combined Phase 2 regression passed 213/213, Phase 1 regression passed 113/113, trace regression passed 55/55, and the full backend suite passed 689/689. Typecheck, the repository-owned circular dependency gate with six approved legacy cycles and zero new cycles, forbidden-import audit, and `git diff --check` passed.

### Phase 3B — Provider Health State and Assessment

Status:
COMPLETE

Next:
Phase 3C — Provider Resolution Policy

Architecture decision:
ADR-032 accepted.

Contracts:
- Frozen `HEALTHY`, `DEGRADED`, `UNAVAILABLE`, and `UNKNOWN` provider-health states were added.
- One bounded caller-supplied aggregate telemetry contract records explicit window dates, attempt counts, consecutive failures, average/maximum latency, latest success/failure, and runtime operator disablement.
- One explicit caller-supplied threshold policy controls telemetry freshness, error rate, consecutive failures, average latency, and required recent success.
- Assessment uses an explicit `asOf`; no system clock is read.
- Operator disablement has highest assessment precedence after validation.
- Missing or empty telemetry and stale telemetry produce typed unknown health.
- Unavailable conditions take precedence over degraded conditions.
- Multiple typed reasons are returned in frozen deterministic order.
- Error rates retain native precision without rounding or percentage conversion.
- Assessment results, metrics, and reason arrays are detached and deeply frozen.

Runtime integration:
None. Provider health remains separate from Evidence freshness. Phase 3B selects no provider, executes no fallback, inspects no provider binding, calculates no confidence adjustment or resolution status, invokes no adapter, creates no Evidence, invokes no Phase 2 service, persists no telemetry or result, and adds no monitoring runtime, API, controller, scheduler, frontend, or MCP implementation.

Authority and flags:
Provider type, authority, and cost do not affect health. Legacy scoring remains unchanged and authoritative. `EVIDENCE_PIPELINE_ENABLED` remains default `false` and disconnected.

Verification:
Focused Phase 3B tests passed 18/18 and Phase 3A regression passed 21/21. Combined Phase 2 regression passed 213/213, Phase 1 regression passed 113/113, trace regression passed 55/55, and the full backend suite passed 707/707. Typecheck, the repository-owned circular dependency gate with six approved legacy cycles and zero new cycles, forbidden-import audit, and `git diff --check` passed.

### Phase 3C — Provider Resolution Policy

Status:
COMPLETE

Next:
Phase 3D — Provider Resolution Execution

Architecture decision:
ADR-033 accepted.

Contracts:
- The provider-resolution policy contract and frozen typed resolution statuses were added.
- Frozen warning codes define future Phase 3D output requirements without generating runtime warnings.
- Each policy has an explicit uppercase identity, positive version, and one canonical factor.
- Preferred and fallback provider health-acceptance rules are explicit and preserve caller order.
- `UNKNOWN` and `UNAVAILABLE` are never usable.
- Degraded preferred use requires both explicit health acceptance and the degraded-primary flag.
- Degraded fallback use may be independently permitted.
- The no-usable-provider outcome is explicitly `MANUAL_REQUIRED` or `UNRESOLVED`.
- `RESOLVED` confidence adjustment is exactly zero; all exceptional adjustments are finite and non-positive.
- Proxy, manual, fallback, and degraded-primary outcome transparency is frozen in ADR-033.
- Validated policies and all nested structures are detached and deeply frozen.

Runtime integration:
None. Phase 3C duplicates no provider order, calculates or inspects no provider health, selects no provider, executes no fallback, applies no confidence adjustment, generates no runtime warning, invokes no adapter, creates no Evidence, invokes no Phase 2 service, persists no policy, and adds no API, controller, scheduler, frontend, or MCP implementation.

Authority and flags:
Provider ordering remains owned by Phase 3A. Health assessment remains owned by Phase 3B. Legacy scoring remains unchanged and authoritative. `EVIDENCE_PIPELINE_ENABLED` remains default `false` and disconnected.

Verification:
Focused Phase 3C tests passed 17/17, Phase 3B regression passed 18/18, and Phase 3A regression passed 21/21. Combined Phase 2 regression passed 213/213, Phase 1 regression passed 113/113, trace regression passed 55/55, and the full backend suite passed 724/724. Typecheck, the repository-owned circular dependency gate with six approved legacy cycles and zero new cycles, forbidden-import audit, and `git diff --check` passed.

### Phase 3D — Deterministic Provider Resolution Execution

Status:
COMPLETE

Next:
Phase 3E — Adapter Composition and Adversarial Fallback Proof

Architecture decision:
ADR-034 accepted.

Contracts and execution:
- One synchronous deterministic provider-resolution executor was added.
- Catalog, exact binding, policy factor, bound-provider, and health-assessment lineage are defensively validated without calling earlier validation services.
- Exactly one health assessment is required per bound provider; duplicate, missing, and unexpected assessments fail closed.
- Providers are evaluated strictly in Phase 3A order and resolution stops at the first usable provider.
- Preferred direct, degraded-primary, direct fallback, manual, and proxy outcomes remain explicitly distinguished.
- Rejected preferred health, fallback, proxy, manual, degraded selection, no-provider, and manual-intervention warnings are derived as frozen typed codes in deterministic order.
- Confidence adjustment is copied from the exact Phase 3C status mapping and is not applied.
- Attempts preserve exact binding order with `SELECTED`, `REJECTED_HEALTH`, and `NOT_ATTEMPTED` outcomes.
- Manual-required and unresolved no-provider outcomes are supported.
- Execution wrappers, results, failures, warnings, attempts, and attempt objects are detached and deeply frozen.

Runtime integration:
None. Phase 3D recalculates no health, executes no provider or adapter, performs no retry or fetch, creates no Evidence, applies no confidence adjustment, invokes no Phase 2 service, persists no result, and adds no API, controller, scheduler, frontend, or MCP implementation.

Authority and flags:
Provider order remains owned by Phase 3A, health by Phase 3B, and selection rules by Phase 3C. Legacy scoring remains unchanged and authoritative. `EVIDENCE_PIPELINE_ENABLED` remains default `false` and disconnected.

Verification:
Focused Phase 3D tests passed 15/15, Phase 3C regression passed 17/17, Phase 3B regression passed 18/18, and Phase 3A regression passed 21/21. Combined Phase 2 regression passed 213/213, Phase 1 regression passed 113/113, trace regression passed 55/55, and the full backend suite passed 739/739. Typecheck, the repository-owned circular dependency gate with six approved legacy cycles and zero new cycles, forbidden-import audit, and `git diff --check` passed.
