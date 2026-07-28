# YUDIJI Phase Log

This file tracks approved migration phases for the production-grade evolution of YUDIJI scoring architecture. It is an operating log, not a replacement for ADRs, PRDs, HLDs, LLDs, or tests.

## Project Operating Rules

Current active phase:
Phase 0C — LLM Call Inventory And Trace Design

Last completed acceptance gate:
Phase 0B — ADR Foundation and Phase Log

Next smallest task:
Complete Phase 0C by documenting active LLM workflows, freezing the shared trace contract, adding ADR-006, and updating the ADR index.

Characterization-suite requirement:
The scoring characterization suite is mandatory for every later scoring-related implementation. Existing expectations must not be changed merely to make a later implementation pass.

Feature-flag state:
Future scoring architecture feature flags are documented in ADR-004 but are not implemented in Phase 0C. All future meaningful scoring architecture and LLM trace capabilities must default OFF when introduced.

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
IN_PROGRESS

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

## Future Phase Outline

### Phase 0D — Feature-Flag Scaffolding

Status:
PENDING

Objective:
Introduce default-OFF feature-flag scaffolding for future scoring architecture capabilities.

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
