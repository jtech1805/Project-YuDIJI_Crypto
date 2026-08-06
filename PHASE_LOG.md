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

### Phase 3E — Provider Resolution Composition and Adversarial Proof

Status:
COMPLETE

Next:
Phase 4

Architecture decision:
ADR-035 accepted.

Composition and proof:
- Explicit immutable provider-runner registration and exact provider-key lookup were added with an empty default production registry.
- Provider key, runner identity, adapter identity, and Evidence provenance remain separate explicit namespaces; no identity is inferred.
- Only the already-selected Phase 3D provider can execute, exactly once.
- Rejected and `NOT_ATTEMPTED` provider runners remain uncalled in adversarial invocation-count tests.
- No-provider results short-circuit before lookup and execute zero runners.
- Missing registrations, identity mismatches, typed runner failures, runner exceptions, malformed results, and contained Evidence-ingestion failures fail closed with sanitized typed codes.
- Phase 1's canonical runner remains the sole ingestion boundary; Phase 3E performs no second ingestion, normalization, deduplication, lifecycle resolution, or persistence path.
- Rejected-only partial and valid zero-candidate Phase 1 outcomes retain their existing semantics.
- Fallback, proxy, manual, and degraded-primary resolution status and warnings remain visible.
- Factor, requested and selected provider, provider type, warning order, and confidence-adjustment metadata are preserved without application.
- Fixed immutable composition stages make reached, failed, and skipped work explicit.
- Composition results and nested safe projections are detached and frozen.

Runtime integration:
None. Phase 3E recalculates no health, performs no provider reselection, retry, second fallback, or alternate runner execution, invokes no Phase 2 or legacy scoring service, applies no confidence adjustment, persists no resolution result, and adds no API, controller, scheduler, frontend, MCP, dependency injection, or production provider registration.

Authority and flags:
Phase 3A remains authoritative for provider order, Phase 3B for health, Phase 3C for rules and adjustment metadata, and Phase 3D for selection. Legacy scoring remains authoritative. `EVIDENCE_PIPELINE_ENABLED` remains default `false` and disconnected.

Verification:
Focused Phase 3E tests, Phase 3A–3D regressions, Phase 2, Phase 1, trace regression, the full backend suite, typecheck, circular dependency gate, forbidden-import audit, dependency audit, and `git diff --check` passed.

### Phase 3 — Provider Resolution Foundation

Status:
COMPLETE

Next:
Phase 4

Phases 3A through 3E are complete. Provider definition, health assessment, resolution policy, deterministic selection, and selected-runner shadow composition are frozen without production activation or any change to authoritative legacy scoring.

### Phase 3R-A — Foundation Roadmap Reconciliation and Execution-Flow Freeze

Status:
COMPLETE

Next:
Phase 3R-B — ScoreCheck Orchestration Contract

Architecture decision:
ADR-036 accepted.

Reconciliation:
- The original foundation roadmap was reconciled with the actual Phase 1–3 implementation and explicit remaining backlog.
- The existing template-driven ScoreCheck flow, template model, versioning, resource snapshots, evaluator dispatch, persistence, and APIs were documented from repository evidence.
- Templates remain the user-facing starting point and declare what must be monitored.
- Compiled rulebooks are frozen as future immutable executable projections of exact template versions.
- Factor definitions remain separate from factor instances and subject resolution.
- A future bounded subject-resolution boundary was documented without implementation.
- Provider resolution and selected-provider execution retain Phase 3 ownership and transparent fallback lineage.
- Evidence remains the append-only provider-independent observation boundary.
- Phase 2 remains the single-factor compatibility, selection, assembly, evaluation, aggregation, normalization, and classification boundary.
- Future cross-factor cluster/conflict and decision-axis responsibilities remain separate and deferred.
- A future thin ScoreCheck orchestrator was scoped, and a dedicated orchestration-contract ADR is required before runtime work.
- Target ScoreCheck persistence and potential API touchpoints were documented conceptually without approving schema or API changes.
- Phase 4 compiled-rulebook entry conditions were frozen.
- Remaining factor, relationship, compatibility, MCP, and evaluation-harness work was recorded explicitly.

Runtime integration:
None. Phase 3R-A adds no runtime code, schema, model, service, API, controller, route, scheduler, feature flag, dependency, module wiring, provider registration, or production activation.

Authority and flags:
Legacy scoring remains authoritative. Phase 1–3 composition remains shadow-only. `EVIDENCE_PIPELINE_ENABLED`, `GENERIC_EVALUATOR_ENABLED`, and `COMPILED_RULEBOOK_EXECUTION` remain default OFF and disconnected from ScoreCheck execution.

Verification:
Documentation-only diff passed `git diff --check`. No source, test, dependency, feature-flag, schema, API, or runtime-wiring file changed.

### Phase 3R-B — ScoreCheck Orchestration Contract

Status:
COMPLETE

Next:
Phase 3R-C — BTC_ETF_NET_FLOW Mocked-Evidence Proof

Architecture decision:
ADR-037 accepted.

Contracts:
- The current production ScoreCheck controller, request, template/Symbol/geometry validation, context, legacy scoring, persistence, audit, snapshot, update/delete, and trade-setup conversion paths were inspected.
- `LEGACY`, `SHADOW`, and `COMPILED` execution modes were frozen without implementation or silent mode fallback.
- One explicit fixed `asOf`, immutable template/rulebook/instrument/trade lineage, and user-scoped idempotency direction were frozen.
- The complete orchestration stage/state model and sanitized stage reports were frozen.
- Legacy execution remains authoritative; shadow execution follows authoritative legacy execution and cannot change its result.
- Compiled execution fails closed and remains unavailable until cross-factor and decision contracts exist.
- Narrow template, rulebook, subject, Evidence, factor, cross-factor, decision, legacy, persistence, audit, and snapshot ports were defined as pure contracts only.
- Mandatory and optional factor requirement levels and non-zero-default partial behavior were frozen.
- Provider fallback/proxy/manual/degraded-primary metadata, Evidence IDs, and evaluator/configuration lineage must be persisted by future implementations.
- ScoreCheck persistence, mandatory audit consistency, versioned snapshot ownership, and trade-setup compatibility were frozen.
- Current sequential non-transactional writes, best-effort audit behavior, rollback gaps, and migration risk were documented accurately.
- Bounded recovery may retry only missing idempotent writes and may not rerun providers, evaluators, or execution modes.

Runtime integration:
None. Phase 3R-B adds no orchestrator, controller, service, model, schema, repository, route, adapter, registry, scheduler, feature-flag wiring, dependency, or production activation.

Authority and flags:
Legacy `ScoringEngineService` and its evaluator registry remain authoritative. `EVIDENCE_PIPELINE_ENABLED`, `COMPILED_RULEBOOK_EXECUTION`, and `DECISION_AXES_ENABLED` remain default OFF and unchanged.

Verification:
Pure contract typecheck, circular dependency gate, protected-file audit, dependency audit, and `git diff --check` passed. No constant-only type test was added because the repository has no `tests/unit/types` convention.

### Phase 3R-C — Crypto ETF Net-Flow Mocked-Evidence Proof

Status:
COMPLETE

Next:
Phase 3R-D — Generic Factor Relationship Semantics

Architecture decision:
ADR-038 accepted.

Contracts and proof:
- Canonical `ASSET` subject identity was added without changing existing subject meanings.
- `ASSET/BTC` denotes the underlying Bitcoin asset; `INSTRUMENT/BTCUSDT` remains a tradable instrument.
- Roadmap label `BTC_ETF_NET_FLOW` was reconciled to canonical factor `CRYPTO.ETF_NET_FLOW` plus subject `ASSET/BTC`.
- The closed Factor Registry now contains `MARKET.PRICE` and `CRYPTO.ETF_NET_FLOW`.
- ETF net flow accepts numeric `USD` Evidence and uses explicit inclusive 24-hour freshness.
- Phase 2C source resolution and Phase 2D assembly now accept exact registered factors instead of a `MARKET.PRICE` literal.
- Mock positive, negative, and zero ETF flow passed canonical ingestion.
- Deduplication, lifecycle-aware read, compatibility, test-local source authority, deterministic source resolution, and factor-input assembly were proven.
- Existing `MARKET.PRICE` behavior remains unchanged.

Runtime integration:
None. No real provider, production authority rule, adapter, runner, registration, evaluator, scheduler, API, ScoreCheck wiring, or feature-flag change was added.

Verification:
Focused Phase 3R-C contract and proof tests passed. Phase 1, Phase 2, Phase 3, full backend, typecheck, circular dependency, and diff gates passed before Phase 3R-D began.

### Phase 3R-D — Generic Factor Relationship Semantics

Status:
COMPLETE

Next:
Phase 3R-E — Relationship Evaluator and Golden Fixture Proof

Architecture decision:
ADR-039 accepted.

Contracts:
- Six exact immutable relationship types and deterministic support classifications are frozen.
- DIRECT and INVERSE are executable single-factor directional arithmetic.
- CONDITIONAL requires a caller-supplied compiled condition binding and remains validation-only.
- CONFIRMATION_ONLY belongs to future cross-factor processing and cannot originate direction.
- RISK_ONLY belongs to a future typed risk axis and produces no directional points.
- VETO belongs to a future typed decision-blocking channel and is never an extreme numeric score.
- Missing input remains explicitly unavailable and never silently neutral.

Runtime integration:
None. No evaluator, registry registration, legacy adapter, template, provider, ScoreCheck wiring, or feature-flag change was added.

### Phase 3R-E — Relationship Evaluator and Golden Fixture Proof

Status:
COMPLETE

Next:
Phase 3R-F — Legacy GENERIC_FACTOR Compatibility and Draft-Template Proof

Architecture decision:
ADR-040 accepted.

Implementation:
- `GENERIC_RELATIONSHIP_FACTOR_EVALUATOR` v1/configuration v1 reuses the Phase 2 evaluator contract.
- DIRECT and INVERSE execute five deterministic ETF-flow bands with bounded contributions.
- CONDITIONAL remains binding-required; confirmation, risk, and veto remain explicitly deferred without directional points.
- Golden tests cover all six relationships, exact boundaries, precision, validation order, immutability, deterministic reruns, and explicit registration.

Runtime integration:
None. The default deterministic evaluator registry remains empty and no production path imports or registers the evaluator.

### Phase 3R-F — Legacy GENERIC_FACTOR Compatibility and Draft-Template Proof

Status:
COMPLETE

Next:
Phase 3R-G — MCP and Evaluation-Harness Decision

Architecture decision:
ADR-041 accepted.

Implementation:
- Exact `GENERIC_FACTOR:<factor-key>` parsing and closed-registry eligibility checks are frozen.
- A separate adapter deterministically projects bounded DIRECT/INVERSE contributions to legacy 0–100 results.
- Missing Evidence and conditional/confirmation/risk/veto semantics fail typed and are never flattened to score zero.
- An isolated, explicitly enabled compatibility dispatcher proves routing without changing production legacy dispatch.
- A private USER/DRAFT test fixture proves the canonical `GENERIC_FACTOR:CRYPTO.ETF_NET_FLOW` reference.

Runtime integration:
None. Generic execution remains default-off; no system template, active user template, production registry, ScoreCheck path, provider, or Evidence orchestration changed.

### Phase 3R-G — MCP and Evaluation-Harness Decision

Status:
COMPLETE

Next:
Phase 4 — Compiled Rulebooks

Architecture decision:
ADR-042 accepted; Outcome B formal deferral.

Decision:
- No MCP or dedicated evaluation-harness infrastructure currently exists.
- Read-only contracts are frozen for factor definition, templates, ScoreChecks, and trade journals, with factor definition as the minimum first tool.
- Authentication, authorization, redaction, bounding, audit, transport, and production-exposure prerequisites are explicit.
- A future network-free versioned foundation manifest must compare exact statuses, ordered reasons, and scores/contributions.
- No dependency, package script, server, tool, runtime wiring, or production exposure was added.

### Phase 3R — Foundation Roadmap Reconciliation

Status:
COMPLETE

Next:
Phase 4 — Compiled Rulebooks

Summary:
- `CRYPTO.ETF_NET_FLOW` plus `ASSET/BTC` is registered and proven with mocked canonical Evidence.
- Relationship semantics are frozen; DIRECT/INVERSE evaluation and all-six-semantic golden proofs exist.
- Isolated legacy generic-factor compatibility and a private DRAFT template reference are proven.
- MCP/evaluation-harness contracts and prerequisites are formally deferred by accepted ADR.
- Legacy scoring remains authoritative; Evidence, generic evaluator, and compiled execution flags remain default OFF.

### Phase 4A — Compiled Rulebook Contract, Identity, and Version Lineage

Status:
COMPLETE

Next:
Phase 4B — Compilation prerequisites and eligibility

Architecture decision:
ADR-043 accepted.

Contracts:
- The immutable compiled-rulebook purpose, identity, version, and exact source-template lineage are frozen.
- Caller-supplied compiler identity/version, timestamp, and lowercase SHA-256 compilation-input hash shape are frozen.
- Stable binding IDs, contiguous zero-based order, closed factor keys with real factor-definition versions, and the FIXED/TRADED_INSTRUMENT/UNDERLYING_ASSET subject vocabulary are frozen.
- Evaluator, configuration, relationship, MANDATORY/OPTIONAL requirement, positive bounded weight, provider, resolution-policy, aggregation, normalization, and decision-band lineage are frozen.
- Nullable future cross-factor and decision-policy lineage placeholders are frozen without implementing those policies.
- Deterministic first-failure validation order, bounded 1..100 bindings, duplicate ID/order/semantic rejection, defensive cloning, and frozen outputs are frozen.
- The Factor Registry has real definition versions; provider-resolution policies have real identity/version. Evaluator configurations lack configuration IDs, and Phase 3 factor-provider bindings lack identity/version, so those compiled fields remain future validated references pending immutable versioned authorities.

Runtime integration:
None. No compiler, canonicalizer, hash generator, subject resolver, repository, model, API, template migration, ScoreCheck wiring, provider/evaluator execution, registry registration, feature-flag change, dependency, or production activation was added. Legacy scoring remains authoritative and compiled execution remains OFF.

### Phase 4B — Immutable Configuration and Provider-Binding Lineage Authorities

Status:
COMPLETE

Next:
Phase 4C — Compiled-rulebook reference validation

Architecture decision:
ADR-044 accepted.

Contracts:
- Evaluator-configuration and provider-binding identity/version are frozen as immutable historical lineage.
- Closed constructor-built authorities provide exact lookup, greatest-version convenience lookup, and deterministic ascending version listing.
- Exact lookup is authoritative; latest lookup never substitutes for a compiled historical reference.
- Duplicate identity/version registration fails even for deep-equal content; no update, delete, or overwrite operation exists.
- Compile eligibility is immutable versioned content. Deferred generic relationships may remain historically visible only when ineligible for compilation.
- Compile-eligible generic configuration content delegates validation to the existing pure evaluator-specific validator.
- Versioned provider bindings preserve exact Phase 3 provider order and validate provider existence, enabled state, and factor support against a supplied validated catalog without embedding provider definitions.
- Both default production definition collections are empty and frozen; BTC ETF-flow proofs are test-local.
- Full compiled-rulebook reference validation is deferred to Phase 4C because remaining evaluator, factor, and policy authorities do not consistently support exact historical lookup.

Runtime integration:
None. No compiler, rulebook repository, database model, template migration, subject resolution, ScoreCheck wiring, API, provider health/selection/execution, evaluator execution, production registration, feature-flag change, dependency, or activation was added. Legacy scoring remains authoritative and compiled execution remains OFF.

### Phase 4C0 — Immutable Historical Authorities for Compiled References

Status:
COMPLETE

Next:
Phase 4C — Template-to-Factor and Subject-Binding Contract

Architecture decision:
ADR-045 accepted. Remaining planned Phase 4 ADRs advance to ADR-046 through ADR-050.

Contracts:
- Exact historical authorities now exist for factor definitions, evaluator declarations, provider-resolution policies, aggregation policies, normalization policies, and decision-band policies.
- All authorities provide authoritative exact lookup, latest-version convenience only, and deterministic ascending historical version lists.
- Historical versions and immutable compile eligibility are retained; duplicate identity/version registration fails even for deep-equal content.
- Factor and policy authorities reuse canonical validators. Aggregation/normalization/decision validation context is supplied only during construction and is not stored as historical definition content.
- Evaluator declarations are immutable data only; executable instances and functions remain exclusively in the unchanged runtime evaluator registry.
- Audited factor definitions and the generic relationship evaluator declaration are available as metadata defaults. Policy defaults remain empty.

Runtime integration:
None. No compiler, template mapping, rulebook generation, persistence, ScoreCheck wiring, policy/evaluator/provider execution, runtime evaluator registration, feature-flag change, dependency, API, or production activation was added. Legacy scoring remains authoritative and compiled execution remains OFF.

### Phase 4C — Immutable Template-to-Factor and Subject-Binding Mapping Authority

Status:
COMPLETE

Next:
Phase 4D — Complete template compatibility validation

Architecture decision:
ADR-046 accepted.

Contracts:
- Mapping identity/version and authoritative exact historical lookup are frozen; latest remains convenience only.
- Reusable mappings select candidates by normalized evaluator key, while exact template occurrences use a later snapshot-bound section/evaluator coordinate.
- Duplicate source occurrences are independent; materially different eligible mapping definitions produce explicit AMBIGUOUS lookup rather than first-match selection.
- Exact factor, evaluator, configuration, provider-binding, resolution, aggregation, normalization, and decision-band lineage is validated with getExact only.
- FIXED, TRADED_INSTRUMENT, and UNDERLYING_ASSET instructions are preserved without subject resolution.
- BLOCK, PARTIAL, and IGNORE compatibility is explicit; ZERO remains unsupported. Current legacy-effective behavior remains section-policy authoritative.
- Weight ownership is USE_EFFECTIVE_TEMPLATE_WEIGHT; no arithmetic occurs in the mapping authority.
- Compile eligibility and historical retention are immutable. Deferred relationships remain historical-only.
- Production defaults remain empty; the complete ETF-flow mapping proof is test-local.

Runtime integration:
None. No template traversal or mutation, compatibility compiler, snapshot hash, rulebook compiler, persistence, subject resolution, ScoreCheck wiring, provider/evaluator/policy execution, runtime registration, feature-flag change, dependency, API, or production activation was added. Legacy scoring remains authoritative and compiled execution remains OFF.

### Phase 4D — Complete Compilation Compatibility and Reference-Graph Validation

Status:
COMPLETE

Next:
Phase 4E — Deterministic compiled-rulebook compiler

Architecture decision:
ADR-047 accepted.

Contracts:
- An exact caller-supplied detached template snapshot and material canonical projection are frozen.
- Stable canonical serialization and SHA-256 snapshot hashing identify in-place draft authoring state.
- Enabled sections/evaluators traverse deterministically into exact Phase 4C source-rule coordinates; disabled entries remain hash material only.
- Every enabled occurrence requires exactly one eligible mapping; missing and ambiguous mappings fail closed.
- All eight historical reference families are revalidated through getExact only, including compatibility and compile eligibility.
- DIRECT/INVERSE remain executable; deferred relationships fail.
- Section missing-data policy remains legacy-effective; evaluator override is metadata. BLOCK/PARTIAL/IGNORE translate explicitly and ZERO fails.
- Configured effective weight is sectionWeight × evaluatorWeight / 100 with native precision; runtime renormalization is not executed.
- Explicit WEIGHTED_SUM is supported. NORMALIZE_EXECUTED and omitted mode fail because template-level renormalization is not representable by current compiled lineage.
- Semantic duplicates and same-semantics/different-weight conflicts fail.
- Success is an immutable resolved compilation specification, not a compiled rulebook.

Runtime integration:
None. No rulebook/compiler identity, compiled-rulebook generation, persistence, template reads or mutation, subject resolution, Evidence, ScoreCheck, provider/evaluator/policy execution, runtime registration, feature-flag change, dependency, API, or production activation was added. Legacy scoring remains authoritative and compiled execution remains OFF.

### Phase 4D1 — Compiled Optional Missing-Data Behavior Contract Amendment

Status:
COMPLETE

Next:
Phase 4E — Deterministic compiled-rulebook compiler

Architecture decision:
ADR-043 additive Phase 4D1 amendment accepted.

Contracts:
- The compiled optional-behavior gap is closed with the canonical PARTIAL/OMIT vocabulary.
- Every compiled binding contains optionalBehavior explicitly.
- MANDATORY requires null; OPTIONAL requires PARTIAL or OMIT.
- Missing, unknown, lowercase, and inconsistent behaviors fail deterministically.
- Optional behavior participates in compiled semantic duplicate identity and survives detached clone/freeze validation.
- Phase 4C translation and Phase 4D resolved-specification semantics remain unchanged.
- Aggregation policies do not own or infer per-binding optional behavior.

Runtime integration:
None. Phase 4E is unblocked as the next phase. No compiler, hash generation, binding-ID generation, persistence, repository, runtime interpretation, ScoreCheck wiring, feature-flag change, dependency, API, or production activation was added. Legacy scoring remains authoritative and compiled execution remains OFF.

### Phase 4E — Deterministic Compiled Rulebook Compiler

Status:
COMPLETE

Next:
Phase 4F — Compiled-rulebook repository

Architecture decision:
ADR-049 accepted.

Contracts:
- The compiler request explicitly carries caller-owned rulebook identity/version, compiler identity/version, compiledAt, and a Phase 4D specification.
- Canonical logical compilation projection and lowercase SHA-256 hashing are frozen.
- Compiler identity/version, template provenance, mapping/coordinate provenance, all compiled semantics, optional behavior, effective weight, and binding order affect the hash.
- compiledAt and rulebook identity/version do not affect the logical hash.
- Binding IDs use BINDING_ plus the full uppercase SHA-256 of exact snapshot/coordinate/mapping lineage; collisions fail.
- Phase 4D source traversal order becomes contiguous compiled order without sorting.
- MANDATORY/null, OPTIONAL/PARTIAL, and OPTIONAL/OMIT are preserved exactly.
- Effective weight and every exact provider/policy lineage field are copied without inference.
- Future policy placeholders remain exact and null by default.
- Phase 4A/4D1 structural validation owns the detached deeply frozen compiler success result.

Runtime integration:
None. No persistence, repository, model, API, registry/latest lookup, subject resolution, Evidence, ScoreCheck, provider/evaluator/policy execution, feature-flag read, runtime registration, random ID, dependency, or production activation was added. Legacy scoring remains authoritative and compiled execution remains OFF.

### Phase 4F — Immutable Compiled Rulebook Repository and Read Boundary

Status:
COMPLETE

Next:
Phase 4G — Shadow execution

Architecture decision:
ADR-050 accepted.

Contracts:
- A strict compiled-rulebook persistence schema and append-only repository are added.
- rulebookId + rulebookVersion is authoritative and uniquely indexed; template identity/version remains non-unique.
- Defensive Phase 4A/4D1 validation protects inserts and immutable domain projection protects reads.
- Identical existing content returns DUPLICATE_RULEBOOK; any difference at one identity/version returns RULEBOOK_VERSION_CONFLICT.
- Mongo duplicate-key races reread exact content and return the same deterministic duplicate/conflict result.
- Exact historical reads never substitute latest.
- Template-version listing is bounded, paginated, and deterministically ordered.
- Most-recently-compiled lookup is explicitly convenience metadata only.
- Dates, binding order, subject variants, optional behavior, exact lineage, and future placeholders round-trip without semantic transformation.
- No update, replace, upsert, delete, archive, or activation operation exists.

Runtime integration:
None. No compiled execution, subject resolution, Evidence, ScoreCheck, provider/evaluator/policy execution, controller, route, API, production module wiring, feature-flag read/change, runtime registration, dependency, or activation state was added. Legacy scoring remains authoritative and compiled execution remains OFF.

### Phase 4G0 — Compiled Rulebook Runtime Aggregation and Observation-Attestation Contract

Status:
COMPLETE

Next:
Phase 4G — Isolated compiled-rulebook shadow execution proof

Architecture decision:
ADR-051 accepted. Phase 4G was blocked by its runtime semantic audit.

Contracts:
- The compiled binding input-state and disposition vocabularies are frozen.
- MANDATORY missing/invalid blocks; OPTIONAL/PARTIAL retains denominator weight; OPTIONAL/OMIT removes denominator weight.
- No missing binding receives a synthetic evaluator score.
- A separate exact versioned compiled weighted-mean policy authority is added with empty production defaults.
- Empty included weight returns INSUFFICIENT_INPUT without division or decision.
- Rulebook aggregation, normalization, and decision-band lineage must each be uniform across bindings.
- Direct shadow observations attest exact factor, subject, provider binding, resolution policy, selected provider, and automated outcome.
- Historical validation uses exact lookups only and returns detached immutable results.

Runtime integration:
None. No compiled executor, subject resolver, evaluator, normalization, decision classification, persistence, Mongo model, Evidence read, provider call, ScoreCheck wiring, controller, route, API, feature-flag change, production registration, dependency, or activation was added. Compiled execution remains OFF and legacy scoring remains authoritative.

### Phase 4G1 — Compiled Runtime Execution Preparation

Status:
COMPLETE

Next:
Phase 4G2 — Isolated single compiled-binding execution

Architecture decision:
ADR-052 accepted.

Contracts:
- One explicit execution request carries exact rulebook identity, caller-controlled `asOf`, nullable dynamic-subject context, and a bounded dense observation collection.
- FIXED, TRADED_INSTRUMENT, and UNDERLYING_ASSET resolve without inference; irrelevant subject context is ignored.
- Observation matching uses exact factor, subject, provider-binding, and resolution-policy lineage and rejects missing, duplicate, or ambiguous matches without ordering selection.
- Exact historical factor lookup supplies subject, unit, compile-eligibility, and freshness policy checks; no latest lookup is permitted.
- `CompiledFactorInput` is a new Evidence-independent immutable runtime model whose authoritative provenance is provider attestation.
- Successful resolved inputs preserve exact binding and rulebook lineage and are detached and deeply frozen.

Runtime integration:
None. No evaluator execution, aggregation, normalization, decision classification, Evidence import/read/write, persistence, ScoreCheck wiring, controller, route, API, feature-flag change, production registration, dependency, or activation was added. Compiled execution remains OFF and legacy scoring remains authoritative.

### Phase 4G2 — Compiled Binding Execution Runtime

Status:
COMPLETE

Next:
Phase 4G3 architecture audit — Compiled rulebook execution

Architecture decision:
ADR-053 accepted.

Contracts:
- A parallel Evidence-independent compiled evaluator port consumes `CompiledFactorInput`; it never manufactures `AssembledFactorInput` or Evidence provenance.
- Legacy and compiled generic evaluators must share one pure DIRECT/INVERSE calculation core so threshold, contribution, outcome, reason, and diagnostic behavior cannot fork.
- Evaluator declaration, immutable configuration, and executable implementation resolve through exact identity/version lookups only.
- Exact compatibility checks bind evaluator, configuration, factor, relationship, implementation, prepared input, and provider-attested lineage before one synchronous execution.
- Raw evaluator contribution is projected to a zero-anchored `[0, 100]` binding score with native precision and without weight, confidence, or policy arithmetic.
- Every Phase 4G1 preparation failure maps explicitly to MISSING or INVALID; existing Phase 4G0 disposition semantics remain authoritative.
- One immutable binding result preserves complete lineage and mechanically projects to the Phase 4G0 binding outcome without performing aggregation.
- The legacy generic evaluator and compiled evaluator delegate to one shared pure relationship calculation core; characterization tests preserve legacy output behavior.
- A caller-supplied exact implementation registry has empty production defaults and exposes no latest lookup.
- Binding execution resolves exact declarations, configurations, and implementations, validates raw output, projects score, and returns one detached immutable result.

Runtime integration:
None. Phase 4G2 adds only dependency-injected compiled binding components with empty production defaults. No repository, model, controller, route, API, persistence, feature flag, production registration, ScoreCheck integration, provider execution, aggregation, normalization, classification, dependency, or activation was added. Compiled execution remains OFF and legacy scoring remains authoritative.

### Phase 4G3 Architecture — Compiled Rulebook Runtime Execution

Status:
COMPLETE

Next:
Future explicit compiled-runtime activation architecture; compiled execution remains OFF

Architecture decision:
ADR-054 accepted.

Contracts:
- Execution accepts an already loaded validated rulebook; exact repository loading, when needed, is caller-owned and occurs before the pure executor.
- Request and rulebook identities must match exactly, and bindings traverse once in stored compiled order without sorting or parallelism.
- Domain binding outcomes always continue for complete traces; only an unrepresentable preparation/execution invariant failure stops traversal.
- Phase 4G2 results project mechanically into ADR-051 outcomes, and `CompiledRulebookAggregationService` remains the sole arithmetic owner.
- The compiled weighted mean is already in `[0,100]`; compiled normalization is an explicit identity projection validated against exact compatible normalization lineage, never a synthetic Phase 2 plan adapter.
- Decision classification reuses one shared band-matching core without manufacturing Phase 2 plan or factor-aggregation envelopes.
- The initial classifier requires one factor lineage across the rulebook because existing normalization and decision policies remain factor-scoped; mixed providers, subjects, relationships, and configurations remain supported.
- Final COMPLETED, PARTIAL, BLOCKED, INSUFFICIENT_INPUT, and FAILED results preserve ordered traces, counts, policy lineage, stage results, and caller-owned evaluation time.

Runtime integration:
None. Phase 4G3 adds only dependency-injected, test-local whole-rulebook execution components. The executor accepts an already-loaded compiled definition, resolves exact policies, traverses Phase 4G1/4G2 sequentially, reuses ADR-051 aggregation, and applies compiled normalization and classification projections. No repository, model, controller, route, API, persistence, feature flag, production registration, ScoreCheck integration, Evidence read, provider execution, compiler/template change, dependency, or activation was added. Compiled execution remains OFF and legacy scoring remains authoritative.

### Phase 4G4 — Compiled Shadow Execution and Parity Boundary

Status:
ARCHITECTURE_ACCEPTED

Next:
Phase 4G4 — Define versioned parity contracts and implement pure comparison

Architecture decision:
ADR-055 accepted. Phase 4G4-A repository audit complete.

Contracts:
- Legacy scoring remains authoritative; compiled execution is a read-only shadow and cannot alter score, permission, status, confidence, diagnostics, persistence, errors, or public responses.
- An explicit immutable authority must map one exact source-template identity to one exact compiled-rulebook identity; latest, most-recent, highest-version, and timestamp inference are forbidden.
- Initial eligibility is restricted to explicitly bound system-template versions; user-template rollout requires a later approval.
- Shadow observations may come only from canonical Evidence or an explicit approved adapter that proves complete `CompiledShadowObservation` lineage.
- The future orchestrator must isolate completed, skipped, and failed shadow outcomes from authoritative behavior and expose explicit skip reasons and failure stages.
- Versioned parity projection separates numeric and semantic comparison, preserves non-comparable diagnostics, and authorizes no tolerance or inferred semantic equivalence.
- Initial production integration is limited to default-OFF ScoreCheck creation after all authoritative legacy writes and side effects.
- No domain or business-state persistence is approved; only structured logs, operational traces, metrics, and telemetry may carry shadow diagnostics.

Runtime integration:
None. Production implementation has not started. `COMPILED_RULEBOOK_EXECUTION` remains default OFF, no runtime registration exists, and compiled execution remains non-authoritative. The next task is parity contracts and pure comparison.

### Phase 4G4-C — Versioned Parity Contracts and Pure Comparison

Status:
COMPLETE

Next:
Phase 4G4 — Exact source-template-to-compiled-rulebook execution-binding authority

Contracts:
- One explicit immutable policy ID/version governs every comparison; no discovery, environment selection, latest lookup, or timestamp selection exists.
- Numeric parity compares the legacy score and compiled normalized score only when enabled and explicitly eligible, after one configured canonical decimal projection and exact equality.
- Original and canonical numeric values are preserved; no epsilon, tolerance, fuzzy equality, scale inference, or forced-value inference is permitted.
- Semantic parity uses explicit per-dimension legacy/compiled source mappings and keeps permission-to-band separate from status-to-execution comparisons.
- Match, mismatch, unmappable, and unavailable remain distinct; comparability is derived mechanically from requested dimension results.
- ADR-055 non-comparable fields are emitted as deterministic diagnostic-only inventory without copying or falsely comparing large envelopes.
- Validation and comparison results are detached and deeply frozen, included dates are cloned, and neither input nor policy is mutated.

Runtime integration:
None. Phase 4G4-C performs no scoring and adds no repository, model, persistence, shadow orchestration, observation assembly, feature-flag change, ScoreCheck integration, API, route, controller, metrics, traces, system clock, randomness, or production registration. Legacy scoring remains authoritative and compiled execution remains default OFF.

### Phase A2 — Immutable Exact Template-to-Rulebook Execution Binding

Status:
COMPLETE

Next:
Publication-time eligibility architecture checkpoint

Contracts:
- A dedicated persisted append-only authority maps one exact system-template identity to one exact compiled-rulebook identity.
- Exact template identity uses `templateId`, `templateVersion`, and the existing `SYSTEM` scope; user-template eligibility is not implemented.
- Candidate insertion loads only the exact rulebook ID/version and validates its exact source-template lineage before persistence.
- Exact duplicates are deterministic, source and binding identity conflicts fail closed, and no update, delete, replacement, upsert, activation, or supersession behavior exists.
- Exact reads require the complete system-template identity, reject corrupted duplicate storage, and never sort or select latest, most recent, or highest versions.
- Inputs remain unchanged and returned bindings are detached, deeply frozen, and contain cloned Dates.

Runtime integration:
None. No observation assembly, shadow orchestration, Phase 4G3 invocation, parity invocation, ScoreCheck integration, API, controller, route, feature-flag change, runtime registration, dependency, or production activation was added. Compiled execution remains default OFF and legacy scoring remains authoritative.

### Phase A3 — Evidence Publication-Time Eligibility

Status:
ARCHITECTURE_ACCEPTED

Next:
Phase A4 — Canonical Evidence to Compiled Shadow Observation Assembly

Architecture decision:
ADR-056 accepted.

Contracts:
- Publication eligibility is evaluated in canonical Evidence assembly before lifecycle resolution, provider lineage validation, freshness, and observation projection.
- Initial historical execution uses system-known replay: both `provenance.sourcePublishedAt` and persisted Evidence `createdAt` must be at or before request `asOf`.
- Missing or invalid publication time fails closed; no exact provider timestamp policy currently authorizes `observedAt` substitution.
- Missing or invalid `createdAt` also fails closed for system-known replay; the typed Evidence read boundary must expose persisted `createdAt` in Phase A4.
- Availability filtering applies to observations, revocations, and superseding records so late-ingested relationships cannot alter earlier replay state.
- Publication eligibility and ingestion eligibility remain separate from ADR-052 freshness, which continues to use `observedAt`.
- `CompiledShadowObservation` remains unchanged; immutable assembly diagnostics will retain Evidence, publication, ingestion, request, provider, and policy lineage.
- Source-available replay is deferred pending a separate explicit policy.

Runtime integration:
None. No source, test, model, persistence, feature-flag, runtime registration, observation assembly, ScoreCheck integration, dependency, or production behavior was changed. Compiled execution remains default OFF and legacy scoring remains authoritative.

### Phase A3.5 — Historical Provider-Resolution Attestation

Status:
ARCHITECTURE_ACCEPTED

Next:
Phase A3.6 — Immutable Provider-Resolution Attestation Authority and Phase 3E Emission

Architecture decision:
ADR-057 accepted.

Track A:
- A1 — Covered by ADR-055
- A2 — COMPLETE
- A3 — ARCHITECTURE_ACCEPTED
- A3.5 — ARCHITECTURE_ACCEPTED
- A4 — BLOCKED pending attestation implementation
- A5 — PENDING
- A6 — PENDING

Contracts:
- Phase A4's provider-provenance blocker is recorded: canonical Evidence does not prove historical provider binding, policy, or resolution status.
- A separate immutable `EvidenceProviderResolutionAttestation` authority is selected rather than embedding resolution state into Evidence.
- Phase 3E is the sole initial emission origin and must use the exact Phase 3D result that caused provider execution.
- Every attestation correlates to exactly one persisted Evidence ID; zero is ineligible and duplicate/conflicting records fail closed.
- Dedicated append-only persistence requires unique Evidence and attestation identities, exact reads, and no update, delete, upsert, latest, or most-recent behavior.
- Exact versioned provider-binding lineage and explicit provider-key/runner/adapter/Evidence-provenance mapping must be validated during emission.
- `DEGRADED_PRIMARY_USED` projects coarsely to compiled `RESOLVED` while detailed status, confidence adjustment, and warnings remain in attestation and assembly traces.
- Unattested Evidence remains canonical and readable but is ineligible for compiled shadow execution.
- Evidence persistence is not rolled back when attestation persistence fails; Phase 3E must expose partial or failed emission explicitly.
- System-known replay additionally requires attestation `createdAt <= request.asOf`.

Runtime integration:
None. No runtime implementation, source, test, model, Evidence contract, provider-resolution service, compiled-observation contract, feature flag, runtime registration, API, dependency, or production behavior was changed. Phase A4 remains blocked until the Phase A3.6 authority and emission boundary are implemented. Compiled execution remains default OFF and legacy scoring remains authoritative.

### Phase A3.6-A — Immutable Provider-Resolution Attestation Authority

Status:
COMPLETE

Next:
Phase A3.6-B — Phase 3E Attestation Emission and Provider Identity Mapping

Contracts:
- A dedicated append-only persisted `EvidenceProviderResolutionAttestation` authority records one exact historical provider-resolution decision for one exact Evidence ID.
- Exact reads use Evidence ID only; unique Evidence-ID and attestation identity/version indexes enforce zero-or-one correlation and immutable identity.
- The service validates exact Evidence existence before insertion without changing Evidence creation, ingestion, model, or read behavior.
- Exact provider-binding and resolution-policy identity/version lineage is preserved alongside selected provider key/type.
- Detailed `RESOLVED`, `DEGRADED_PRIMARY_USED`, `FALLBACK_USED`, and `PROXY_USED` statuses are preserved without compiled coarse projection.
- Caller-supplied `resolvedAt`, finite non-positive confidence adjustment, and typed ordered warnings are preserved; Mongoose controls attestation `createdAt` and no `updatedAt` exists.
- Exact duplicates are idempotent, material Evidence or attestation identity conflicts fail closed, and duplicate-key races are deterministically reclassified.
- Returned records are detached and deeply frozen with cloned Dates and warning arrays.

Runtime integration:
None. Phase 3E emission and provider namespace mapping are not implemented. No Evidence contract, provider-resolution logic, compiled observation, observation assembly, ScoreCheck path, feature flag, runtime registration, API, dependency, or production behavior was changed. Compiled execution remains default OFF and legacy scoring remains authoritative.

### Phase A3.6-B — Phase 3E Attestation Emission and Provider Identity Mapping

Status:
COMPLETE

Next:
Phase A4 — Canonical Evidence to Compiled Shadow Observation Assembly

Contracts:
- Provider runner registration now maps exact provider key and runner/adapter identity to an explicit expected Evidence provenance provider; the namespaces remain separate and immutable.
- Phase 3E requires the exact versioned provider-binding definition, validates its ordered provider lineage against the original Phase 3D result, and preserves exact resolution-policy identity/version.
- Caller-supplied `resolvedAt` and an injected deterministic attestation-identity factory prevent hidden clock, random identity, latest-version, or default-version behavior.
- Each CREATED or DUPLICATE persisted Evidence ID is loaded exactly, checked against the registered provenance provider, and receives an immutable attestation or reuses an exact existing attestation.
- Detailed `RESOLVED`, `DEGRADED_PRIMARY_USED`, `FALLBACK_USED`, and `PROXY_USED` statuses, confidence adjustment, and ordered warnings are preserved without compiled projection.
- Attestation conflict, missing Evidence, provenance mismatch, identity failure, and persistence failure produce typed PARTIAL diagnostics when usable Evidence exists.
- Attestation attempts continue in candidate order for already persisted Evidence IDs; Evidence is never deleted or rolled back and provider execution is never retried.

Runtime integration:
No production runner registrations, provider retries, hidden fallbacks, A4 observation assembly, compiled execution, parity invocation, ScoreCheck integration, API, controller, route, feature-flag change, dependency, or application bootstrap wiring was added. Compiled execution remains default OFF and legacy scoring remains authoritative.

### Phase A4 — Canonical Evidence to Compiled Shadow Observation Assembly

Status:
COMPLETE

Next:
Phase A5 — Standalone Compiled Shadow Orchestrator

Contracts:
- The persisted `EvidenceReadRecord` is distinct from caller creation input and exposes persistence-controlled `createdAt`; repository history reads detach records and clone Dates.
- ADR-056 system-known replay requires source publication, Evidence ingestion, and attestation persistence timestamps at or before the explicit request `asOf`, with equality accepted and no timestamp substitution.
- Historically unavailable observations, revocations, and superseding records are removed before the existing lifecycle resolver runs.
- Every projected observation requires exactly one historical provider-resolution attestation with exact Evidence, provider-binding, resolution-policy, selected-provider, and explicit Evidence-provenance mapping validation.
- Exact versioned factor, provider-binding, and resolution-policy authorities are used; compatibility and freshness reuse existing Evidence semantics and freshness remains based only on `asOf - observedAt`.
- Detailed provider statuses project only as frozen by ADR-057 while degraded status, confidence adjustment, and ordered warnings remain in immutable traces.
- Zero candidates produce typed omissions, multiple eligible candidates fail closed without recency selection, and output preserves compiled binding order.
- The canonical MARKET.PRICE/BTCUSDT/Binance fixture produces one immutable provider-attested `CompiledShadowObservation` without network or persistence access.

Runtime integration:
None. No provider calls, legacy snapshot conversion, A5 orchestration, Phase 4G3 invocation, parity invocation, ScoreCheck integration, feature-flag change, controller, route, API, dependency, persistence write, or production registration was added. Compiled execution remains default OFF and legacy scoring remains authoritative.

### Phase A5 — Standalone Compiled Shadow Orchestrator

Status:
COMPLETE

Next:
Phase A6 — System-Template Replay and Legacy/Compiled Parity Proof

Contracts:
- One caller-supplied immutable request carries exact system-template identity, explicit `asOf`, canonical subject context, deterministic shadow identity, and optional all-or-none legacy parity inputs.
- Exact execution-binding and exact compiled-rulebook reads occur once and validate the complete request/binding/rulebook/compiler lineage chain without latest, most-recent, version inference, or compilation.
- Canonical Evidence histories are read for each distinct compiled factor/subject tuple, incomplete histories fail closed, and exact attestations are read once for every reached Evidence ID without provider execution or fallback.
- Phase A4 assembly runs exactly once even when no Evidence is reached; only completed or partial assembly with observations may invoke Phase 4G3, exactly once and without retry or observation reordering.
- Representable compiled `BLOCKED` and `INSUFFICIENT_INPUT` results remain completed shadow outcomes; compiled `FAILED` is a typed shadow failure and never affects authoritative scoring.
- Optional parity requires an explicit accepted policy, authoritative legacy projection, and explicit numeric eligibility; invalid policy or comparison remains nested unavailable while mismatch remains a valid completed comparison.
- Completed, skipped, and failed outcomes preserve all reached immutable diagnostics and lineage, clone Dates, expose no raw exceptions, and perform no writes or production side effects.

Verification:
- Focused A5 tests: 15 passed.
- Protected A2/A4/Phase 4, Evidence/attestation/provider-resolution, ScoreCheck, and legacy scoring regressions: 355 passed.
- Full backend: 931 passed.
- Typecheck passed; circular dependency gate passed with zero new cycles; `git diff --check` passed.

Runtime integration:
None. No ScoreCheck integration, legacy scoring invocation, provider call, compiler call, persistence write, feature-flag change, controller, route, API, bootstrap wiring, dependency, or production registration was added. Compiled execution remains default OFF and legacy scoring remains authoritative.

### Phase A5.5-B1 — Authoritative Generic-Factor Legacy Scoring Integration

Status:
COMPLETE

Next:
Phase A5.5-B2 — BTC ETF-Flow System Template and Immutable Compilation Authorities

Contracts:
- `ScoringEngineService` recognizes only the exact existing `GENERIC_FACTOR:<registered-factor-key>` syntax and preserves the existing evaluator registry path for every non-generic or malformed key.
- `GENERIC_EVALUATOR_ENABLED` remains default OFF; while disabled, generic keys preserve the prior unknown-evaluator result and neither generic execution nor compatibility dispatch runs.
- Enabled generic evaluation consumes only an explicitly supplied caller-resolved `AssembledFactorInput` and relationship type through an injected deterministic executor; it performs no Evidence, provider, persistence, compiled-runtime, or snapshot read.
- The existing generic compatibility dispatcher projects the deterministic evaluator result into the authoritative legacy evaluator result shape exactly once, with no fallback, retry, inferred factor, or alternate evaluator.
- Missing input remains `BLOCKED` with typed `MISSING_EVIDENCE`, unsupported relationships and factors remain explicit, and the template missing-data policy retains aggregation authority.
- Existing global reward-risk forced rejection remains after evaluator dispatch and all seven existing system-template results remain unchanged.

Verification:
- Focused generic/scoring characterization: 46 passed.
- Protected scoring, ScoreCheck, Evidence/provider-resolution, and compiled-runtime regression selection: 370 passed.
- Full backend: 941 passed.
- Typecheck passed; circular dependency gate passed with zero new cycles; `git diff --check` passed.

Runtime integration:
No new system template, provider, Evidence read, evaluator configuration, compilation mapping, compiled authority, rulebook, execution binding, A4/A5 change, ScoreCheck integration, controller, route, API, feature-default change, or production activation was added. Generic evaluation remains default OFF.

### Phase A5.5-B1.5 — Internal Template Exposure and Non-Live Provider Authority

Status:
ARCHITECTURE_ACCEPTED

Next:
Phase A5.5-B2 — Internal BTC ETF-Flow System Template and Compilation Authorities

Architecture decision:
ADR-058 accepted.

Track A:
- A1–A5 — COMPLETE
- A5.5-B1 — COMPLETE
- A5.5-B1.5 — ARCHITECTURE_ACCEPTED
- A5.5-B2 — NEXT
- A5.5-B3 — PENDING
- A6 — BLOCKED

Contracts:
- The B2 blockers are confirmed: current system registration grants public listing, ScoreCheck selection, and duplication, while compiled mappings require exact provider binding and resolution-policy lineage.
- One system-template identity registry gains independent immutable `listable`, `scoreCheckSelectable`, `duplicable`, and `compileEligible` capabilities; existing templates preserve their current public behavior.
- The future ETF template may be a real SYSTEM identity while remaining non-listable, non-selectable, non-duplicable, and compile eligible.
- Provider authority gains independent compile, live-execution, and replay-fixture capabilities; none implies another.
- One honestly labelled internal characterization provider, exact binding, and exact policy may be compile/replay eligible while live execution remains forbidden.
- No live runner, network adapter, health polling, provider selection, mock promotion, automatic Evidence production, or public provider claim is authorized.
- Exact compiled provider lineage and ADR-057 attestation matching remain mandatory; deterministic replay fixtures may not enter production persistence.
- Future real-provider approval creates new provider, binding, policy, compiled-rulebook, and execution-binding versions without mutating characterization history.
- Existing generic and compiled feature flags remain default OFF; capability enforcement does not depend on them.

Runtime integration:
None. This phase changes documentation only. No source, test, template, provider, runner, feature flag, API, ScoreCheck, dependency, compilation authority, execution binding, A5 registration, B2 implementation, or A6 replay was added. Legacy scoring remains authoritative and compiled execution remains OFF.

### Phase A5.5-B2 — Internal BTC ETF-Flow System Template and Compilation Authorities

Status:
COMPLETE

Next:
Phase A5.5-B3 — Test-Owned ETF Evidence, Exact Execution Binding, and Compiled Runtime Proof

Contracts:
- System-template registrations now carry independent immutable listing, ScoreCheck-selection, duplication, and compilation capabilities.
- All seven existing public system templates retain listing, ScoreCheck-selection, and duplication behavior.
- `CRYPTO_BTC_ETF_FLOW_DAILY_V1` is an internal SYSTEM v1 template that is hidden, ScoreCheck-ineligible, non-duplicable, and compile eligible.
- The template contains one DIRECT `GENERIC_FACTOR:CRYPTO.ETF_NET_FLOW` rule fixed to `ASSET/BTC`; no input inference, provider read, Evidence read, or public integration was added.
- Provider authorities now carry independent compilation, live-execution, and replay-fixture capabilities.
- `YUDIJI_CHARACTERIZATION_BTC_ETF_FLOW` is explicitly internal, non-network, non-live, compilation eligible, and replay-fixture eligible.
- Phase 3 resolution and composition reject the characterization provider before selection or runner lookup. No runner, adapter, scheduler, health source, network URL, authentication, or production Evidence source exists for it.
- Exact v1 provider binding, provider-resolution policy, DIRECT evaluator configuration, template mapping, compiled weighted-mean policy, normalization policy, and five-band decision policy are defined without latest lookup.
- Characterization thresholds `-300/-100/100/300 USD` and contributions `-2/-1/0/1/2` are deterministic characterization-only values and are not production calibrated or claims of trading efficacy.
- The existing compiled generic relationship implementation is reused without arithmetic changes.
- Deterministic compiler proof preserves exact factor, evaluator, provider, aggregation, normalization, and decision lineage and produces an equal canonical hash on repeated compilation.
- Existing global reward-risk forced rejection remains authoritative for direct test-only legacy generic execution.
- `GENERIC_EVALUATOR_ENABLED` and `COMPILED_RULEBOOK_EXECUTION` remain default OFF. Legacy scoring remains authoritative.

Verification:
- Focused B2 capability and compilation proof: 5 passed.
- Focused template/provider/generic regression selection: 53 passed.
- Registry regressions: 93 passed.
- Full backend: 946 passed.
- Typecheck passed; circular-dependency and final diff audits recorded at phase handoff.

Runtime integration:
No execution binding, A5 invocation, A6 replay, production persistence, Evidence or attestation creation, provider runner, network integration, API exposure, controller change, route change, ScoreCheck eligibility, feature-default change, dependency, bootstrap registration, or compiled-runtime activation was added.

### Phase A5.5-B2.5 — Decouple Evidence Provenance Authority from Live Provider Runner Registration

Status:
COMPLETE

Next:
Phase A5.5-B3 — Test-Owned ETF Evidence, Exact Execution Binding, and Compiled Runtime Proof

Contracts:
- Canonical `evidenceProvenanceProvider` now belongs to the immutable provider-authority registration alongside provider identity and independent compile/live/replay capabilities.
- `YUDIJI_CHARACTERIZATION_BTC_ETF_FLOW` maps exactly to `yudiji-internal-btc-etf-flow-characterization` without acquiring a runner or live-execution eligibility.
- A4 observation assembly resolves exact provider authority directly and requires `replayFixtureEligible === true` before accepting replay Evidence.
- A4 no longer imports, receives, or queries `ProviderResolutionRunnerRegistryPort`; replay provenance validation cannot invoke a runner.
- Existing live-provider provenance remains exact when migrated into provider authority; Binance characterization retains `binance-public-price`.
- Phase 3 live resolution and composition retain independent `liveExecutionEligible` validation and runner registration requirements.
- Missing authority, replay-ineligible authority, and provenance mismatch remain explicit fail-closed assembly outcomes.
- No B3 Evidence, attestation, execution-binding, or runtime fixture was created in this phase.

Verification:
- Focused provider-authority, B2, A4, Phase 3, runner, and compiler regressions: 71 passed.
- Typecheck passed before full regression execution.
- Full backend, circular-dependency, and final diff audits recorded at phase handoff.

Runtime integration:
No provider runner, adapter, network access, scheduler, health integration, Evidence creation, attestation creation, execution binding, B3 fixture, A5 invocation, A6 replay, ScoreCheck integration, parity execution, feature-default change, API, controller, route, dependency, persistence, or bootstrap registration was added. Compiled execution remains default OFF and legacy scoring remains authoritative.

### Phase A5.5-B3 — Test-Owned ETF Evidence, Exact Execution Binding, and Compiled Runtime Proof

Status:
COMPLETE

Next:
Phase A6 — System-Template Legacy/Compiled Replay and Parity Proof

Contracts:
- The real internal `CRYPTO_BTC_ETF_FLOW_DAILY_V1` SYSTEM template and complete B2 factor, evaluator, provider, subject, and policy authority chain are used unchanged.
- The deterministic compiler produces the exact `CRYPTO_BTC_ETF_FLOW_DAILY_RULEBOOK` v1 projection with stable compiler lineage, canonical hash, and repeatable deep equality.
- One immutable test-owned `BTC_ETF_FLOW_TEST_EXECUTION_BINDING` v1 binds the exact source template identity to the exact compiled rulebook identity through read-only exact readers.
- Canonical test-owned Evidence uses `CRYPTO.ETF_NET_FLOW`, `ASSET/BTC`, numeric USD values, fixed UTC timestamps, and provenance `yudiji-internal-btc-etf-flow-characterization`.
- Exact historical attestations preserve `BTC_ETF_FLOW_CHARACTERIZATION_BINDING` v1, `BTC_ETF_FLOW_CHARACTERIZATION_RESOLUTION` v1, selected provider `YUDIJI_CHARACTERIZATION_BTC_ETF_FLOW`, detailed resolution status, confidence adjustment, warnings, resolution time, and persistence time.
- A4 validates provider authority provenance and replay eligibility without a provider runner lookup; A5 composes A4 with Phase 4G3 and returns parity `NOT_REQUESTED`.
- Real positive, neutral, and negative characterization paths produce contributions `1/0/-1`, aggregate and normalized scores `75/50/25`, and bands `POSITIVE/NEUTRAL/NEGATIVE`.
- Missing Evidence, missing attestation, future publication, future Evidence persistence, future attestation persistence, provider-binding mismatch, resolution-policy mismatch, provenance mismatch, replay-ineligible authority, and duplicate eligible Evidence all fail closed without compiled execution.
- Repeated compilation, assembly, compiled execution, and A5 outcomes are deeply equal, detached, immutable, and leave test-owned inputs unchanged.

Verification:
- Focused B3 proof: 9 passed.
- B2/B2.5, A2, A4, A5, and Phase 4 focused boundary selection: 63 passed.
- Evidence, attestation, Phase 3 provider, system-template, legacy scoring, and ScoreCheck regression selection: 332 passed.
- Full backend: 957 passed.
- Typecheck passed; circular-dependency and final diff audits recorded at phase handoff.

Runtime integration:
No production source, provider runner, adapter, network access, scheduler, health polling, Evidence ingestion, production Evidence or attestation write, production execution-binding persistence, legacy scoring invocation, parity invocation, ScoreCheck integration, public template exposure, feature-default change, API, controller, route, dependency, bootstrap registration, or compiled-runtime activation was added. Fixtures and exact readers remain test owned; compiled execution remains default OFF and legacy scoring remains authoritative.

### Phase A6 — System-Template Legacy/Compiled Replay and Parity Proof

Status:
COMPLETE

Next:
Track B1 — AI Template Draft Candidate and Legacy DRAFT Projection Architecture

Track A milestone:
COMPLETE

Contracts:
- The real internal `CRYPTO_BTC_ETF_FLOW_DAILY_V1` SYSTEM template executes through the authoritative `ScoringEngineService` using its exact hidden registration and a deterministic test-injected generic evaluator flag.
- Explicit `AssembledFactorInput` values use `CRYPTO.ETF_NET_FLOW` v1, `ASSET/BTC`, DIRECT relationship, numeric USD, and fixed deterministic lineage; the legacy scorer executes the evaluator rather than receiving a compiled contribution.
- The exact B3 compiled rulebook, execution binding, canonical Evidence, historical attestation, A4 assembler, A5 orchestrator, and Phase 4G3 executor are reused without alternate authority identities.
- Test-owned parity policy `BTC_ETF_FLOW_LEGACY_COMPILED_PARITY` v1 compares legacy score to compiled normalized score using exact two-decimal canonicalization and explicit permission/band and score-status/execution-status mappings.
- Positive, neutral, and negative literal inputs `200/0/-200 USD` produce equal legacy and compiled scores `75/50/25`, matching semantic outcomes, and `FULLY_COMPARABLE` results.
- A deliberately asymmetric explicit-input scenario proves a numeric mismatch remains a completed comparable diagnostic; an intentionally absent semantic mapping remains `UNMAPPABLE` and yields mechanical partial comparability.
- Missing legacy generic input preserves typed `MISSING_EVIDENCE`, zero score, `UNAVAILABLE` status, and explicit numeric ineligibility while the compiled side may complete.
- Missing compiled Evidence, missing attestation, and future publication preserve the complete authoritative legacy result while compiled execution is skipped and parity is `NOT_COMPARABLE` without fabricated compiled fields.
- Reward-risk ratio below one preserves the existing forced legacy score `30` and `REJECT` permission after the evaluator produces `75`; numeric parity is explicitly unavailable as a forced legacy value.
- The immutable replay report contains bounded identity, input, legacy, compiled, parity, lineage, and diagnostic projections; repeated runs are deeply equal and clone all Dates.
- Thresholds and values remain characterization-only literal USD units and are not production calibrated.

Verification:
- Focused A6 replay proof: 10 passed.
- Track A, Phase 3/4, Evidence/provider, legacy, and ScoreCheck regression selection: 328 passed.
- Full backend clean rerun: 967 passed.
- Typecheck, circular-dependency, dependency, protected-boundary, and final diff audits recorded at phase handoff.

Runtime integration:
No production source, public template exposure, ScoreCheck integration, provider runner, adapter, network call, provider resolution, Evidence ingestion, production Evidence or attestation write, execution-binding or compiled-rulebook write, replay persistence, API, controller, route, bootstrap registration, dependency, feature-default change, or runtime activation was added. Generic and compiled flags remain default OFF, legacy scoring remains authoritative, and Track A is complete.

### Track B1-B — AI Template Draft Candidate Architecture

Status:
ARCHITECTURE_ACCEPTED

Next:
Track B1-CD — Candidate Contracts, Deterministic Validator and Compact Registry Knowledge Projection

Contracts:
- ADR-059 freezes a dedicated versioned `TemplateDraftCandidate` as a transient, non-authoritative proposal rather than a template, compiled artifact, or executable input.
- The first MVP persists no candidate, prompt body, model response, validation report, review report, or template. Existing metadata-only LLM tracing remains the only permitted operational record.
- A compact immutable versioned registry projection supplies a closed vocabulary; exact runtime authorities are re-resolved by deterministic validation and remain authoritative.
- Every requested concept remains visible as a supported binding, unresolved concept, clarification question, or warning. No unsupported concept may be dropped or silently substituted.
- Multiple deterministic requirements may apply to one concept, including new-factor, new-relationship, provider, and clarification requirements.
- Exact factor versions, relationship support, subject compatibility, units, provider requirements, compilation support, duplicates, bounds, and projection lineage are validator-owned decisions.
- Partial success is approved when valid bindings coexist with explicit unresolved concepts and no fabricated authority is accepted.
- AI-generated weights are disabled initially; no equal-weight default is inferred and `WEIGHT_PROPOSALS_ENABLED` remains default OFF and unwired.
- The initial workflow uses no document ingestion, chunking, embeddings, vector storage, retrieval, reranking, or RAG. Track B2 owns those future capabilities.
- Human review and explicit confirmation are mandatory before future USER/DRAFT projection. Confirmation does not imply activation, compilation, execution, or public listing.
- B1-G must address DRAFT ScoreCheck eligibility, ACTIVE duplication, approval/activation, immutable approved versions, and material-edit behavior before persistence is introduced.
- All future drafting integration remains default OFF. Existing template, ScoreCheck, compiler, persistence, legacy scoring, and compiled runtime behavior remains unchanged.

Optimized Track B plan:
```text
B1-B  — COMPLETE after this phase
B1-CD — Candidate contracts, validator and registry projection
B1-EF — Structured generation and review report
B1-G  — Safe USER/DRAFT lifecycle and projection
B1-H  — End-to-end drafting proof
B2    — Document corpus, chunking, embeddings, retrieval and RAG
```

Runtime integration:
Documentation only. No source, test, configuration, dependency, feature flag, LLM call, prompt implementation, candidate persistence, template persistence, ScoreCheck behavior, lifecycle behavior, compilation behavior, retrieval infrastructure, API, controller, route, bootstrap registration, runtime activation, or deployment was changed.

### Track B1-CD — Candidate Contracts, Deterministic Validator and Compact Registry Knowledge Projection

Status:
COMPLETE

Next:
Track B1-EF — Structured Generation, Prompt Orchestration and Candidate Review Report

Contracts:
- Transient drafting-request, untrusted model-candidate, validated-candidate, validation-report, issue, requirement, policy, and registry-projection contracts are implemented without persistence models.
- The original model proposal and detached validated result remain separate immutable values.
- The compact registry projection contains exact versioned factors, relationship classifications, subject/value/unit constraints, bounded provider capability summaries, compilation-mapping summaries, missing-data policies, validation constraints, and sorted exact-member lineage.
- Projection lineage uses sorted exact member identities because the existing registries expose no single global registry version. SHA-256 canonical hashing includes all material generation constraints and excludes clocks, functions, runtime metadata, and insertion order.
- The deterministic validator reconstructs the projection from caller-supplied current exact authorities and fails closed when supplied projection lineage is stale or inconsistent.
- Exact factor version, relationship execution support, subject, value type, unit, provider availability, compilation mapping, missing-data policy, disabled weights, and concept accounting are validated in fixed order.
- Draft support and compilation support remain separate. A valid legacy-draft binding may report `REQUIRES_COMPILATION_MAPPING` without invoking the compiler.
- Multiple unresolved requirement codes are preserved per concept, deferred relationships are never converted, and partial success remains explicit.
- Model-proposed weights are never accepted or normalized; no equal-weight default is assigned and future projection still requires user weight input.
- The exact ETF-flow characterization proves DIRECT `CRYPTO.ETF_NET_FLOW` v1 with `ASSET/BTC`, USD, replay-only provider capability, and exact compilation-mapping visibility without execution.
- The Tata Steel characterization preserves long buildup, short buildup, quarterly results, and broker research as unsupported concepts requiring new factors/providers without inventing factors, substituting `MARKET.PRICE`, or claiming report access.
- Outputs are deterministically ordered, detached, deeply frozen, repeatable, and use no system clock or random identity.

Verification:
- Focused B1-CD projection and validator tests: 12 passed.
- Factor, relationship/evaluator, provider, template, compilation, compiled-shadow, and Track A regression selection: 123 passed.
- Full backend: 979 passed.
- Typecheck passed.
- Circular-dependency audit passed with 6 approved legacy cycles and 0 new cycles.

Runtime integration:
No LLM client, generation port, prompt, model selection, operational trace integration, review presentation, candidate/template persistence, database model, repository, template lifecycle, ScoreCheck, compiler invocation, scoring execution, compiled execution, Evidence read, provider call, document, chunk, embedding, vector storage, retrieval, citation, RAG, controller, route, API, bootstrap, dependency, feature-default change, activation, deployment, or commit was added.

### Track B1-EF — Structured Generation, Prompt Orchestration and Candidate Review Report

Status:
COMPLETE

Next:
Track B1-G — Template Lifecycle Correction and Safe USER/DRAFT Projection

Contracts:
- A dedicated provider-independent `TemplateDraftGenerationPort` accepts bounded provider-neutral prompt messages/context and returns typed structured output or provider failure without SDK coupling.
- `TEMPLATE_DRAFT_REGISTRY_GROUNDED` v1 instructs the future model to use exact projected authorities, preserve every concept, ask for subject clarification, emit no accepted weights, and return no score, permission, decision, rulebook, or execution instruction.
- The deterministic prompt context contains only the drafting request, requested concepts, compact B1-CD registry projection, schema identity, and disabled-weight/no-RAG constraints.
- Strict Zod structured-output validation runs before B1-CD domain validation. Malformed JSON, invalid schema, provider failure, empty response, request mismatch, projection mismatch, hallucinated authority, unsupported relationship, omitted concept, and disabled weight remain typed and fail closed.
- The B1-CD validator is composed exactly once and remains the authority for factor, version, relationship, subject, unit, provider, compilation mapping, weight, and concept-accounting decisions.
- Fatal candidate-level invariants expose no supported bindings in the validated/review result.
- The deterministic review projector preserves every requested concept, exact supported bindings, unresolved requirements, clarification questions, warnings, limitations, and complete prompt/projection/validation lineage without another model call.
- Review limitations always disclose non-authoritative status, required user weights, no persistence, no RAG, and no runtime or compilation authority.
- The ETF-flow fake-provider proof returns PARTIAL for exact `CRYPTO.ETF_NET_FLOW` v1, DIRECT, `ASSET/BTC`, exact provider/compilation summaries, and rejected model weight.
- The Tata Steel fake-provider proof returns `UNSUPPORTED_REQUEST`, preserves long buildup, short buildup, quarterly results, and broker research, and accepts no invented factor, provider, subject, or `MARKET.PRICE` substitution.
- One finalized metadata-only LLM trace is emitted per reached provider attempt with counts and lineage only; feature-disabled requests emit no provider trace, and trace failure cannot change generation output.
- `RAG_TEMPLATE_DRAFTING_ENABLED` is the only existing declared drafting gate and remains default OFF. Its name conflates drafting generation with future RAG; no new flag was invented in this phase.

Verification:
- Focused B1-CD/B1-EF tests: 20 passed.
- Existing AI, trace, feature, template, ScoreCheck, legacy scoring, compiled-shadow, and Track A regression selection: 180 passed.
- Full backend: 987 passed.
- Typecheck passed.
- Circular-dependency audit passed with 6 approved legacy cycles and 0 new cycles.

Runtime integration:
No production provider adapter, model selection, retry, fallback, tool calling, candidate/review/template persistence, database model, repository, USER/DRAFT creation, approval, template lifecycle, ScoreCheck, compiler, scoring, compiled execution, Evidence read, market-data provider, document, chunk, embedding, vector storage, retrieval, citation, RAG, controller, route, API, UI, bootstrap, dependency, feature-default change, activation, deployment, or commit was added.

### Track B1-GH — Safe USER/DRAFT Projection and End-to-End Drafting Proof

Status:
COMPLETE

Next:
Track B2-A — Document Corpus, Chunk Authority and RAG Architecture

Contracts:
- USER template duplication now creates an owner-scoped, PRIVATE, editable DRAFT; the source SYSTEM template remains unchanged.
- ScoreCheck exact resolution now accepts only ACTIVE templates. USER/DRAFT remains persistable, owner-visible, owner-editable, and non-executable.
- Explicit acceptance is bound to the authenticated owner and exact generation request, candidate, schema, registry projection, and validation lineage.
- Acceptance re-resolves current authorities and reruns deterministic B1-CD validation before projection; stale authority or changed supported-binding results fail closed without persistence.
- The acceptance validator requires a nonempty unique subset of supported bindings and exactly one explicit user weight per accepted binding. Weights must be finite, range from 0 through 100, and total exactly 100.
- AI-proposed weights are never accepted, normalized, or substituted. The USER/DRAFT projection uses only explicitly accepted user weights.
- The pure projector creates one deterministic weighted section from accepted supported bindings, preserves exact factor, relationship, subject, policy, provider-capability, compilation-mapping, candidate, projection, and validation lineage in the detached result, and introduces no execution semantics.
- Partial generation may create a DRAFT from the explicitly accepted supported subset while all unsupported concepts remain visible in the review lineage and are not fabricated as rules.
- The workflow separates generation from acceptance and persists only through the existing scoring-template service as USER/DRAFT. It does not activate, compile, score, execute, retrieve documents, or call a provider during acceptance.
- Cross-user acceptance, stale authorities, unsupported binding selection, missing or duplicate weights, invalid totals, malformed acceptance, and persistence failures produce typed sanitized failures and no template write.
- Repeated acceptance is deliberately characterized as non-idempotent because the existing template schema and authorities provide no durable acceptance identity or uniqueness contract. Durable idempotency requires a future explicit architecture decision.
- Candidate acceptance lineage is returned immutably but is not stored in the existing template document because no approved metadata field exists; no schema change was introduced.
- Outputs are detached and deeply frozen, and Dates are cloned.

Verification:
- Focused B1-GH and lifecycle tests: 14 passed.
- B1, template, ScoreCheck, legacy scoring, Phase 4, shadow, trace, and feature regression selection: 165 passed.
- Full backend: 998 passed.
- Typecheck passed.
- Circular-dependency audit passed with 6 approved legacy cycles and 0 new cycles.
- Dependency, feature-flag, runtime-registration, protected-boundary, and git diff checks passed.

Runtime integration:
No activation service, compiler invocation, ScoreCheck execution of DRAFT, scoring execution, compiled execution, provider adapter, provider call during acceptance, candidate store, review store, new database model, schema change, RAG, document ingestion, embedding, retrieval, API, controller, route, UI, bootstrap registration, dependency, feature-default change, production wiring, deployment, or commit was added. Existing ACTIVE execution remains authoritative and drafting remains default OFF.

### Track B2-A — Document Corpus, Chunk Authority and RAG Architecture

Status:
ARCHITECTURE_ACCEPTED

Next:
Track B2-B — Immutable Document and Chunk Authority

Contracts:
- ADR-060 approves distinct `PLATFORM_KNOWLEDGE`, `MARKET_RESEARCH`, and `USER_PRIVATE_DOCUMENTS` corpora with no implicit cross-corpus, trust, ownership, or tenant search.
- Platform knowledge explains product and template semantics; market research contains attributed claims. Neither can assume the other's authority, and exact registries and Evidence remain authoritative.
- Documents are immutable append-only versions with exact digest, source, ownership, trust, effective-time, parser, and supersession lineage.
- Chunks are immutable citation-bearing projections of one exact document version with exact source spans, strategy lineage, stable digests, inherited access scope, and optional parent-child relationships.
- Independently versioned document-specific strategies replace a universal semantic fixed-token chunker. Platform definitions, ADR summaries, examples, financial tables, broker research, and transcripts retain their distinct structures.
- Every selected passage has an assembler-issued citation bound to exact document/chunk versions, digests, source identity, source span, corpus, and trust. Model-created citation identities are invalid.
- Embeddings and vector indexes are derived versioned artifacts behind provider-neutral ports. No vector database, embedding model, parser, or provider is selected.
- Bounded hybrid retrieval combines exact structured-authority lookup, metadata-filtered vector retrieval, optional lexical retrieval, deduplication, optional reranking, and deterministic context-budget assembly.
- The B1 compact registry projection remains the authority for factor, relationship, subject, unit, provider, compilation, and validation identities. RAG is a separate explanatory envelope.
- USER-private artifacts, indexes, caches, requests, and citations inherit exact authenticated tenant/owner scope and fail closed across tenants.
- Retrieved text is untrusted data. Structured delimiting, instruction isolation, bounded influence, output validation, and citation validation are mandatory prompt-injection defenses.
- The initial implementation rollout is limited to approved `PLATFORM_KNOWLEDGE`; market-research extraction and user-private ingestion are deferred.
- `RAG_TEMPLATE_DRAFTING_ENABLED` remains default OFF and unchanged. Registry-only B1 drafting must survive retrieval rollback.

Progress:
```text
Track A — COMPLETE
Track B1 — COMPLETE

Track B2:
B2-A — ARCHITECTURE_ACCEPTED
B2-B — NEXT
B2-C — PENDING
B2-D — PENDING
B2-E — PENDING
B2-F — PENDING
B2-G — PENDING
```

Runtime integration:
Documentation only. No source, test, model, schema, parser, ingestion, chunking implementation, embedding model, vector database, index, retrieval, reranking, citation implementation, RAG prompt integration, market-research extraction, private-document ingestion, feature change, dependency, API, template, ScoreCheck, Evidence, scoring, compiler, compiled runtime, registration, activation, deployment, or commit was added.

### Track B2-BC — Immutable Platform-Knowledge Document Authority, Admission and Structure-Aware Chunking

Status:
COMPLETE

Next:
Track B2-DE — Embedding, Vector Index, Bounded Retrieval and Citation Context

Contracts:
- Exact corpus, platform-document-type, trust, ownership, normalized-block, source-span, document, chunk, admission, and chunking contracts are implemented.
- Initial admission accepts only `PLATFORM_KNOWLEDGE` owned by `SYSTEM` with `AUTHORITATIVE`, `APPROVED_GUIDANCE`, or `EXPLANATORY` trust. Market research, private documents, USER/ORGANIZATION ownership, and unverified trust fail closed.
- The pure admission service validates bounded identity, source, parser and policy lineage, half-open effective time (`effectiveFrom < effectiveUntil`), direct supersession, dense normalized blocks, exact spans, tables, labels, references, and repository safety bounds without using system time.
- Canonical SHA-256 document digests include material identity, structure, source, trust, parser/policy, effective-time, block order/content, spans, labels, and references while excluding database creation time and object key order.
- Mongoose controls append-only document/chunk `createdAt`; `updatedAt` is disabled. Exact compound identities and document/strategy ordinals have uniqueness indexes.
- Document persistence exposes append-only insert and exact identity read only. Exact duplicates return `ALREADY_EXISTS`; identity/content conflicts, duplicate-key races, corrupted duplicates, and persistence errors are typed and sanitized.
- The exact chunking registry supports immutable ID/version registration, deterministic listing, exact lookup, compatibility checks, and no latest lookup.
- Versioned factor, relationship, ADR-summary, template-example, and validation-guidance strategies operate only on approved normalized text. Factor identity/constraints/limitations/examples, relationship restrictions, ADR decisions/consequences, complete examples, and validation-code guidance remain coherent.
- Chunk candidates preserve exact document and strategy lineage, stable identity/version, ordinal, bounded content, exact merged source span, deterministic bounded metadata, optional direct parent, and canonical SHA-256 digest.
- Complete chunk sets fail before persistence on empty output, duplicate identity/ordinal, non-dense order, lineage mismatch, invalid span/content/metadata, missing parent, parent cycles, incompatible comparable spans, bounds, or digest mismatch.
- Chunk persistence exposes append-only set insertion, exact chunk read, and exact document/version plus strategy/version read in deterministic ordinal order. No update, delete, upsert, latest-document, or latest-strategy authority exists.
- A pure citation-source projection proves every persisted chunk can later expose exact document/chunk identities, digests, source identity/title/span, corpus/trust, parser lineage, and strategy lineage without creating user-visible citation handles.
- All service and repository outputs detach nested values, clone Dates, deep-freeze arrays/objects, preserve deterministic order, and leave inputs unchanged.
- Initial fixtures characterize `CRYPTO.ETF_NET_FLOW`, DIRECT/INVERSE guidance, ADR-060, approved and negative example semantics, and `FACTOR_NOT_REGISTERED` correction guidance without ingesting files.

Progress:
```text
Track A — COMPLETE
Track B1 — COMPLETE

Track B2:
B2-A  — ARCHITECTURE_ACCEPTED
B2-BC — COMPLETE
B2-DE — NEXT
B2-FG — PENDING
```

Verification:
- Focused B2-BC admission, repository, registry, strategy, validation, orchestration, and citation-readiness tests: 17 passed.
- B2-BC, canonicalization, B1, template, ScoreCheck, legacy, Track A, compiled-shadow, trace, and feature regression selection: 185 passed.
- Full backend: 1,015 passed.
- Typecheck passed.
- Circular-dependency audit passed with 6 approved legacy cycles and 0 new cycles.
- Dependency, feature, protected-file, prohibited-boundary, and git diff checks passed.

Known persistence limitation:
The repository performs complete-set validation and preflight before one ordered `insertMany`, but no transaction is opened by this test-local authority. A database failure after a partial server-side bulk write could require invariant diagnosis; production registration should require transaction-backed atomicity or a single immutable chunk-set manifest decision.

Runtime integration:
No raw PDF/DOCX/HTML/URL/upload parser, OCR, file crawler, embedding, vector store, retrieval, reranking, RAG context, LLM call, market-research ingestion, private-document ingestion, API, controller, route, prompt, template, ScoreCheck, Factor Registry, evaluator, provider, Evidence, compiler, compiled runtime, feature, dependency, bootstrap registration, scheduled job, activation, deployment, or commit was added.

### Track B2-BC1 — Immutable Chunk-Set Manifest and Atomic Completeness Authority

Status:
COMPLETE

Next:
Track B2-DE — Embedding, Vector Index, Bounded Retrieval and Citation Context

Contracts:
- The ordered `insertMany` partial-persistence blocker is confirmed: no established MongoDB transaction/session convention exists, and earlier chunk inserts may remain when a later insert fails.
- An immutable chunk-set manifest authority now records exact caller-supplied manifest identity/version, document identity/version, strategy identity/version, expected count, canonically ordered chunk identities/versions/digests, publication-policy identity/version, canonical set digest, and database-controlled `createdAt`.
- The manifest schema enforces unique exact manifest identity and one manifest for one exact document/version plus strategy/version publication identity. It has no status, `updatedAt`, latest, update, delete, replace, or upsert behavior.
- Canonical SHA-256 set digests include the manifest schema/version, exact document and strategy lineage, expected count, ordered entries, and publication-policy lineage while excluding database timestamps and object insertion order.
- The pure manifest builder validates bounded identities, nonempty bounded sets, unique chunk identities, unique dense ordinals, exact document/strategy lineage, and exact chunk digests without using time, randomness, or persistence.
- The append-only manifest repository supports exact identity and exact document/strategy reads, distinguishes exact duplicates, content conflicts, set-publication conflicts, corrupted duplicates, duplicate-key races, and persistence failures, and never sorts to choose a winner.
- Raw stored chunk-set reads are now explicitly named `findStoredSetForVerification`; the former manifest-free `findExactSet` authority no longer exists.
- Authoritative reads require exactly one manifest and verify expected count, canonical manifest order, unique entries, missing chunks, unexpected chunks, exact identities/versions, ordinals, chunk digests, document/strategy lineage, and recalculated set digest.
- Missing manifests return `MANIFEST_NOT_FOUND`; missing, unexpected, ordinal-mismatched, digest-mismatched, lineage-mismatched, and corrupted sets fail closed and never expose `verified: true`.
- Publication validates the complete candidates, builds the manifest, writes chunks, rereads and verifies stored chunks, publishes the manifest last, and requires a final manifest-backed verified reread before returning success.
- Without transactions, failed publication may leave orphan chunks. They remain unpublished, cannot pass the authoritative read, cannot produce citation sources through the verified-set boundary, and are not deleted automatically.
- Citation-source projection now accepts only a manifest-verified set and an exact member identity; arbitrary persisted or orphan chunks are rejected.
- This is a manifest-backed atomic publication boundary, not a claim of transactionally atomic insertion.

Progress:
```text
Track A — COMPLETE
Track B1 — COMPLETE

Track B2:
B2-A   — ARCHITECTURE_ACCEPTED
B2-BC  — COMPLETE
B2-BC1 — COMPLETE
B2-DE  — NEXT
B2-FG  — PENDING
```

Verification:
- Focused B2-BC1 and B2-BC manifest, repository, verification, publication, strategy, and citation-readiness tests: 27 passed.
- B2, canonicalization, B1, template, ScoreCheck, legacy, Track A, compiled-shadow, trace, and feature regression selection: 195 passed.
- Full backend: 1,025 passed.
- Typecheck passed.
- Circular-dependency audit passed with 6 approved legacy cycles and 0 new cycles.
- Dependency, feature, protected-file, prohibited-boundary, and git diff checks passed.

Runtime integration:
No Mongo transaction infrastructure, orphan cleanup, embedding, vector index, retrieval, citation handle, RAG context, LLM call, B1 integration, market/private corpus behavior, API, controller, route, prompt, template, ScoreCheck, scoring, Evidence, provider resolution, compiler, compiled runtime, feature, dependency, bootstrap registration, scheduled job, activation, deployment, or commit was added. B2-DE is unblocked but remains unimplemented.

### Track B2-DE1 — Embedding Authority, Repository, and Versioned Vector Index Authority

Status:
COMPLETE

Next:
Track B2-DE2 — Bounded Retrieval, Hybrid Search, Reranking, Citation Validation and Context Assembly

Contracts:
- Embedding generation reruns the exact B2-BC1 manifest-backed verification boundary; arbitrary, orphaned, incomplete, unexpected, missing, stale-digest, or unmanifested chunks are not eligible.
- An immutable exact-version embedding-schema registry defines provider/model, projector, normalization, vector dimension, metric, corpus, trust, and generation-eligibility lineage without latest-version selection.
- A deterministic text projector produces bounded canonical model inputs and SHA-256 text digests from exact verified chunks and document semantics while excluding timestamps, source URIs, database fields, credentials, and unrelated content.
- A provider-neutral embedding port is invoked once per reached batch. Provider/model identity, exact input correlation, vector count, dimensions, and finite numeric values are validated before persistence.
- Canonical vector digests cover exact embedding, chunk-set, document, chunk, projector, provider/model, schema, normalization, dimension, and ordered vector lineage while excluding database timestamps and operational request identities.
- The immutable embedding model and append-only repository provide exact identity and exact chunk/schema reads, database-controlled `createdAt`, no `updatedAt`, and deterministic duplicate, identity, lineage, content, invariant, race, and persistence outcomes.
- Exact embedding and index-definition versions evolve independently. Existing embeddings are never overwritten or regenerated implicitly, and one exact embedding can be written to multiple exact index-definition versions.
- An immutable exact-version vector-index definition registry validates schema, dimension, metric, namespace, corpus, and trust compatibility without selecting a latest definition.
- The provider-neutral vector-index port is write-only. The indexing service revalidates vector digests and exact manifest/chunk/document lineage before producing bounded metadata and invoking the port once.
- Deterministic test-owned embedding and in-memory vector-index write implementations provide fixed, configurable characterization behavior without network access or production registration.
- The standalone infrastructure remains unregistered and caller-controlled. It does not check or change the default-OFF B1 drafting flag and introduces no new flag.
- Operational results contain metadata-only summaries; raw embedding text, vectors, document content, and source URLs are not persisted as operational traces.

Progress:
```text
Track A — COMPLETE
Track B1 — COMPLETE

Track B2:
B2-A   — ARCHITECTURE_ACCEPTED
B2-BC  — COMPLETE
B2-BC1 — COMPLETE
B2-DE1 — COMPLETE
B2-DE2 — NEXT
B2-FG  — PENDING
```

Verification:
- Focused B2-DE1 schema, text projection, embedding repository/service, vector-index definition, write-port, and indexing tests: 17 passed.
- Focused B2-BC1/B2-BC manifest, verification, admission, repository, strategy, validation, and chunking regression tests: 27 passed.
- Full backend: 1,042 passed.
- Typecheck passed.
- Circular-dependency audit passed with 6 approved legacy cycles and 0 new cycles.
- Dependency, feature, protected-file, prohibited-boundary, and git diff checks passed.

Known limitations:
- Embedding generation and vector-index writes have deterministic test-owned implementations only; no production provider, model, vector database, search, retrieval, lexical search, reranking, context assembly, citation validation, runtime registration, or B1 drafting integration exists.
- Embedding batch persistence is append-only but not transactionally atomic; explicit per-item outcomes prevent partial completion from being represented as complete.
- Durable vector-index publication state and embedding operational-trace persistence are deferred.
- Unpublished/orphan chunk cleanup remains deferred from B2-BC1.

Runtime integration:
No retrieval, vector search, lexical search, reranking, query embedding, context assembly, citation handle, B1 prompt/generation integration, production provider/model, vector database, network call, dependency, API, controller, route, template, ScoreCheck, scoring, Evidence, compiler, compiled runtime, feature-default change, bootstrap registration, scheduled job, activation, deployment, or commit was added.
