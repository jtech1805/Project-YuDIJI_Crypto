# YUDIJI Phase Log

This file tracks approved migration phases for the production-grade evolution of YUDIJI scoring architecture. It is an operating log, not a replacement for ADRs, PRDs, HLDs, LLDs, or tests.

## Project Operating Rules

Current active phase:
Phase 0D — Feature-Flag Scaffolding

Last completed acceptance gate:
Phase 0C — LLM Call Inventory And Trace Design

Next smallest task:
Complete Phase 0D by adding typed default-OFF feature flags, startup validation, and focused config tests without connecting flags to product behavior.

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
IN_PROGRESS

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

### Phase 0E — LLM Trace Wrapper Implementation

Status:
PENDING

Objective:
Implement approved LLM trace wrapper behavior after inventory and design are accepted.

### Phase 1 — Evidence Foundation

Status:
PENDING

Objective:
Introduce the initial Evidence foundation beside the legacy scoring path without making it authoritative.
