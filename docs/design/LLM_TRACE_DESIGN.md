# LLM Trace Design

Phase 0C freezes the shared LLM trace design. This document is a design contract only. It does not implement tracing, persistence, feature flags, or provider interface changes.

## Problem

YUDIJI has multiple active LLM workflows with different observability depth. Alert reports and copilot chat have limited workflow logging, while post-trade review already records context hash, prompt/schema versions, validation outcomes, fallback behavior, persistence, and audits. Future Evidence and scoring architecture work needs a consistent way to observe LLM calls without storing sensitive prompts or changing production behavior.

## Goals

- Use one provider-independent trace contract for all LLM workflows.
- Capture metadata, correlation, validation, fallback, and persistence outcomes.
- Keep trace persistence best effort.
- Preserve existing workflow behavior if tracing fails.
- Make prompt and schema versions explicit.
- Support future provider changes without changing trace consumers.
- Avoid storing secrets, full prompts, full context, full chat history, and raw model output by default.

## Non-Goals

- Do not implement an LLM trace service in Phase 0C.
- Do not create a Mongoose trace model in Phase 0C.
- Do not change `LLMProvider`.
- Do not change Copilot approval behavior.
- Do not add feature flags in Phase 0C.
- Do not invent retention periods or performance targets.

## Current-State Gaps

- No shared trace entity exists.
- Alert report does not have a persisted LLM trace.
- Copilot chat persists messages but not trace metadata.
- Token usage is not confirmed as currently available.
- Prompt and schema versions are explicit in post-trade review but not uniformly exposed for every workflow.
- Copilot `isApproved` is currently LLM-generated, which conflicts with the future deterministic-permission rule.

## Proposed Boundaries

Trace capture should sit around the LLM operation boundary:

```text
application service/controller
  -> create trace context in memory
  -> LlmService/provider call
  -> parse and validation
  -> fallback handling
  -> functional persistence/response
  -> best-effort trace persistence
```

The trace should observe the functional workflow. It must not become the owner of trade permission, risk state, alert persistence, chat persistence, or AI review fallback.

## Trace Lifecycle

```text
Application workflow starts LLM operation
  -> create trace context in memory
  -> provider call begins
  -> provider response or failure
  -> parse and validation
  -> application fallback where applicable
  -> functional result preserved
  -> trace persisted best effort
```

When trace persistence fails:

```text
Functional workflow succeeds or follows its existing fallback
+ sanitized trace error is logged
+ trace failure does not replace the functional result
```

## Type Contract

```ts
type LlmTaskType =
  | "ALERT_REPORT"
  | "COPILOT_CHAT"
  | "POST_TRADE_REVIEW";

type LlmTraceStatus =
  | "STARTED"
  | "COMPLETED"
  | "PROVIDER_FAILED"
  | "EMPTY_RESPONSE"
  | "PARSE_FAILED"
  | "VALIDATION_FAILED"
  | "FALLBACK_USED"
  | "PERSISTENCE_FAILED";

type LlmTrace = {
  traceId: string;
  correlationId?: string;

  taskType: LlmTaskType;
  status: LlmTraceStatus;

  userId?: string;

  source: {
    entityType?: string;
    entityId?: string;
  };

  provider: string;
  model?: string;

  promptVersion: string;
  schemaVersion?: string;

  startedAt: Date;
  completedAt?: Date;
  latencyMs?: number;

  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };

  inputReference?: {
    hash?: string;
    redactedSummary?: Record<string, unknown>;
  };

  outputReference?: {
    hash?: string;
    fieldSummary?: Record<string, unknown>;
  };

  validation: {
    parseSucceeded?: boolean;
    schemaSucceeded?: boolean;
    semanticSucceeded?: boolean;
    errors?: string[];
  };

  fallbackUsed: boolean;
  failureCode?: string;
};
```

## Status Transitions

Expected terminal statuses:

- `COMPLETED`: provider output parsed and validated, and the functional workflow completed normally.
- `PROVIDER_FAILED`: provider call failed.
- `EMPTY_RESPONSE`: provider returned no usable content.
- `PARSE_FAILED`: model response could not be parsed.
- `VALIDATION_FAILED`: parsed content failed schema or semantic validation.
- `FALLBACK_USED`: application returned deterministic fallback.
- `PERSISTENCE_FAILED`: trace persistence failed after the functional workflow outcome was preserved.

`STARTED` is the in-memory initial state. A future persistence design may choose whether to persist `STARTED` records.

## Redaction Policy

Never store by default:

- API keys
- Broker credentials
- JWTs
- Cookies
- Authorization headers
- Raw SDK errors
- Full system prompts
- Full user prompts
- Full chat history
- Full post-trade context
- Full raw model responses

Allowed:

- hashes
- lengths
- counts
- versions
- safe enums
- provider and model names
- source entity references
- timings
- validation outcomes
- sanitized failure codes
- selected non-sensitive field names

## Correlation Strategy

Each trace has a `traceId`. Workflows that already use a `correlationId`, such as post-trade review audit flow, should attach it. Source entity references should identify the domain object without copying full object payloads.

Suggested source examples:

- Alert report: `entityType = "MONITOR"` or `"ALERT_PIPELINE"`, `entityId = monitor id when available`.
- Copilot chat: `entityType = "CHAT_SESSION"`, `entityId = session id when available`.
- Post-trade review: `entityType = "TRADE_JOURNAL"`, `entityId = journal id`.

## Failure Handling

Trace creation and persistence are observational. They must not change existing LLM workflow behavior.

- Provider failure follows the existing workflow failure or fallback path.
- Parse and validation failure follows existing workflow behavior.
- Trace persistence failure logs a sanitized trace error and returns the functional result.
- Raw provider errors must be reduced to sanitized failure codes.

## Persistence Strategy

Future persistence should be metadata-first and append-only where practical. It should store trace metadata, hashes, summaries, outcomes, timings, and correlations. It should not store raw prompts, raw model responses, full chat history, or full post-trade context by default.

Phase 0C does not choose a concrete Mongoose schema or retention policy.

## Index And Query Requirements

Future trace persistence should support lookup by:

- `traceId`
- `correlationId`
- `taskType`
- `userId`
- `source.entityType` and `source.entityId`
- `provider`
- `model`
- `status`
- `startedAt`
- `promptVersion`
- `schemaVersion`

These are query requirements, not implemented indexes in Phase 0C.

## Retention Questions

Open questions:

- How long should metadata traces be retained?
- Should retention vary by task type?
- Should failed traces have different retention from completed traces?
- Should users be able to request trace metadata deletion?

No retention period is selected in Phase 0C.

## Metrics

Future metrics should derive from trace metadata:

- LLM calls by task type.
- Provider failures.
- Parse failures.
- Validation failures.
- Fallback usage.
- Latency by task type and provider.
- Model usage by prompt/schema version.

Token metrics may be added only if provider response metadata is available.

## Rollout

1. Keep Phase 0C documentation-only.
2. Add default-OFF feature-flag scaffolding in Phase 0D.
3. Implement trace wrapper in Phase 0E behind feature flags.
4. Start with metadata-only trace capture.
5. Verify characterization and full backend tests for every scoring-related phase.

## Rollback

Rollback means disabling future trace feature flags and preserving current functional workflows. Trace write failure must never become a user-visible workflow failure.

## Testing Strategy

Future tests should cover:

- Trace contract construction for each task type.
- Redaction of disallowed fields.
- Provider failure status mapping.
- Parse and validation failure status mapping.
- Fallback trace metadata.
- Best-effort persistence failure behavior.
- Existing workflow output unchanged when tracing is disabled.

## Open Decisions

- Concrete persistence model and collection name.
- Retention period.
- Whether `STARTED` should be persisted before provider completion.
- Exact prompt/schema version values for alert report and copilot chat.
- Whether token usage is available from the active provider path.

## Planned Phase 0E Integration Points

- `LlmService.generateAlertReport`
- `LlmService.generateCopilotResponse`
- `LlmService.generatePostTradeReview`
- Optional lower provider boundary around `GroqLLMProvider` after the wrapper design is accepted.
