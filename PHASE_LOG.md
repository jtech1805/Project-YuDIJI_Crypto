# YUDIJI Phase Log

This file tracks approved migration phases for the production-grade evolution of YUDIJI scoring architecture. It is an operating log, not a replacement for ADRs, PRDs, HLDs, LLDs, or tests.

## Project Operating Rules

Current active phase:
Phase 2G — Deterministic Evaluator Execution Foundation

Last completed acceptance gate:
Phase 2F — Deterministic Factor Evaluator Registry

Next smallest task:
Define explicit evaluator execution orchestration under a separate ADR without score aggregation or runtime integration.

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
PENDING
