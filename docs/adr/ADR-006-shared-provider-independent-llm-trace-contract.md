# ADR-006: Shared Provider-Independent LLM Trace Contract

Status:
ACCEPTED

Date:
2026-07-28

Phase:
Phase 0C

Context:
YUDIJI has three active LLM workflows: analyzer alert report, copilot chat, and post-trade review. These workflows use the provider abstraction through `LlmService` and the current Groq provider. Observability is inconsistent across workflows, and future Evidence/scoring architecture work needs traceability without storing sensitive prompts or changing production behavior.

Decision:
YUDIJI will use a shared provider-independent, metadata-first LLM trace contract across all active LLM workflows.

The trace contract records task type, status, correlation, source entity reference, provider/model metadata, prompt/schema versions, timing, optional token usage, redacted input/output references, validation outcomes, fallback usage, and sanitized failure codes.

Consequences:
- One trace shape can cover alert reports, copilot chat, and post-trade reviews.
- The trace contract remains independent of Groq-specific SDK details.
- Trace persistence must be best effort.
- Trace failure must not change existing workflow behavior.
- Raw prompts, raw user text, full chat history, full context, full model output, secrets, credentials, JWTs, cookies, and raw SDK errors are not stored by default.
- Current LLM behavior is not changed by Phase 0C.
- Current Copilot LLM-generated `isApproved` remains architectural debt and is not silently corrected in this task.

Alternatives considered:
1. Provider-specific Groq logging only.
2. Full raw prompt and output persistence.
3. Workflow-specific trace models.
4. Synchronous mandatory trace persistence.

Why rejected:
- Provider-specific Groq logging would couple observability to one provider and make future provider changes harder.
- Full raw prompt and output persistence creates unnecessary sensitive-data exposure.
- Workflow-specific trace models would fragment querying and make cross-workflow analysis harder.
- Synchronous mandatory trace persistence could turn observability failures into user-visible workflow failures.

Migration and rollback:
Introduce trace implementation later behind default-OFF feature flags. When disabled, existing LLM behavior must remain unchanged. If trace persistence fails while enabled, the functional workflow returns its existing result or fallback, and only a sanitized trace error is logged. Rollback is performed by disabling the trace flag and preserving current workflows.

Related artifacts:
- `docs/ai/LLM_CALL_INVENTORY.md`
- `docs/design/LLM_TRACE_DESIGN.md`
- `docs/adr/ADR-004-new-capabilities-require-default-off-feature-flags.md`
- `PHASE_LOG.md`
- `yujidi-server/src/services/llm.service.ts`
- `yujidi-server/src/ports/llm-provider.port.ts`
