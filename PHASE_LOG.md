# YUDIJI Phase Log

This file tracks approved migration phases for the production-grade evolution of YUDIJI scoring architecture. It is an operating log, not a replacement for ADRs, PRDs, HLDs, LLDs, or tests.

## Project Operating Rules

Current active phase:
Phase 0E-4 — Copilot Chat Trace Integration

Last completed acceptance gate:
Phase 0E-3 — Analyzer Alert-Report Trace Integration

Next smallest task:
Complete Phase 0E-4 by emitting one metadata-only trace for each attempted Copilot provider call without changing chat or deterministic trade behavior.

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
IN_PROGRESS

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

### Phase 1 — Evidence Foundation

Status:
PENDING

Objective:
Introduce the initial Evidence foundation beside the legacy scoring path without making it authoritative.
