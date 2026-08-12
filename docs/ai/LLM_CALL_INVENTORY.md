# LLM Call Inventory

This document records the current active LLM workflows in YUDIJI for Phase 0C. It is current-state documentation plus future trace integration notes. It does not claim LLM tracing exists today.

Active workflows found:

1. Alert report
2. Copilot chat
3. Post-trade review

Commented-out LLM calls are excluded from this inventory.

## 1. Alert Report

Purpose:
Generate an AI explanation for a market alert after the analyzer detects a configured monitor threshold breach.

Trigger:
Analyzer threshold breach for a monitor.

HTTP/event entry point:
Binance or provider market stream event handled by the backend WebSocket/analyzer path.

Application call path:

```text
AnalyzerEngine threshold breach
  -> fetchRecentHeadlines
  -> findStructuralSupportResistance
  -> LlmService.generateAlertReport
  -> LLMProvider.generateAlertReport
  -> GroqLLMProvider.generateAlertReport
  -> validated AlertReportOutput
  -> Alert persistence
  -> WebSocket delivery
```

Main files:

- `yujidi-server/src/services/trading/analyzer.service.ts`
- `yujidi-server/src/services/ai-runtime/llm.service.ts`
- `yujidi-server/src/ports/llm-provider.port.ts`
- `yujidi-server/src/integrations/llm/groq/groq-llm.provider.ts`
- `yujidi-server/src/models/Alert.ts`

Provider method:
`generateAlertReport`

Input categories:
- Symbol and movement context.
- Trigger type and direction.
- Change percentage and trigger price.
- Monitor time window.
- Running CVD.
- Structural support and resistance.
- Recent news context.

Output contract:

```text
catalyst
threatLevel
support
resistance
summary
```

Validation:
The provider port defines `alertReportOutputSchema`. The current provider path is expected to return data matching that schema before the alert is persisted.

Persistence:
The alert report is persisted as part of the `Alert` document.

Consumer:
Frontend dashboard and alert detail views consume persisted alerts and real-time WebSocket `NEW_ALERT` delivery.

Failure behavior:
Current analyzer behavior catches failures in the trigger pipeline and logs sanitized analyzer errors. The exact alert persistence outcome depends on the failing step; Phase 0C does not change it.

Existing logs/audits:
Analyzer logs include LLM report start and success events. No dedicated LLM trace record exists yet.

Sensitive-data risks:
- News context and generated summaries may include externally sourced text.
- Full prompt and raw provider response should not be stored in the future trace by default.
- Provider errors must be sanitized before trace persistence.

Architectural concerns:
- LLM output is part of a user-visible market alert.
- Trace failures must not block alert workflow behavior.
- Prompt and schema versions should become explicit when tracing is implemented.

Future trace integration point:
Wrap the `LlmService.generateAlertReport` call or provider call boundary with a metadata-first trace context using task type `ALERT_REPORT`.

## 2. Copilot Chat

Purpose:
Respond to user chat prompts with general education or trade-plan analysis using deterministic trade calculations plus LLM explanation.

Trigger:
Authenticated user sends a chat request.

HTTP/event entry point:
`POST /api/chat`

Application call path:

```text
POST /api/chat
  -> chat.controller.handleCopilotChat
  -> deterministic trade calculations
  -> ChatSession last-six-message history
  -> LlmService.generateCopilotResponse
  -> GroqLLMProvider.generateCopilotResponse
  -> CopilotOutput validation
  -> ChatSession persistence
  -> HTTP response
```

Main files:

- `yujidi-server/src/routes/chat.routes.ts`
- `yujidi-server/src/controllers/chat.controller.ts`
- `yujidi-server/src/services/ai-runtime/llm.service.ts`
- `yujidi-server/src/ports/llm-provider.port.ts`
- `yujidi-server/src/integrations/llm/groq/groq-llm.provider.ts`
- `yujidi-server/src/models/chatSession.ts`

Provider method:
`generateCopilotResponse`

Input categories:
- System instruction built by the controller.
- User prompt.
- Symbol.
- Last six persisted chat messages for that user and symbol.
- Deterministic trade math embedded in the instruction.
- Live CVD/support/resistance context where available from the controller path.

Output contract:

```ts
{
  intent: "TRADE" | "GENERAL";
  isApproved: boolean;
  reply: string;
}
```

Validation:
The provider port defines `copilotOutputSchema`.

Persistence:
The user prompt and assistant reply are appended to `ChatSession`. The full trace is not currently persisted.

Consumer:
The chat HTTP response is consumed by the frontend copilot UI.

Failure behavior:
The controller catches errors and returns the existing HTTP error response. Phase 0C does not change this behavior.

Existing logs/audits:
The controller currently logs copilot execution errors to the server console. No dedicated LLM trace record exists.

Sensitive-data risks:
- Full user prompts and chat history may contain personal or sensitive trading context.
- Full system instruction includes deterministic trade math.
- Future traces must not store full prompts or full history by default.

Architectural concerns:
The current LLM-generated `isApproved` field conflicts with the future architecture rule that deterministic systems must own trade permission. This is architectural debt recorded in Phase 0C, not corrected here.

Future trace integration point:
Wrap `LlmService.generateCopilotResponse` with task type `COPILOT_CHAT`, storing metadata, hashes, versions, validation outcome, and sanitized failure codes only.

## 3. Post-Trade Review

Purpose:
Generate a structured AI explanation for a finalized trade journal.

Trigger:
Authenticated user requests AI review for a finalized journal.

HTTP/event entry point:
`POST /api/trade-journals/:id/ai-review`

Application call path:

```text
POST /api/trade-journals/:id/ai-review
  -> AiTradeReviewService.generateReview
  -> deterministic context and context hash
  -> LlmService.generatePostTradeReview
  -> GroqLLMProvider.generatePostTradeReview
  -> schema and semantic validation
  -> valid output or deterministic fallback
  -> AiExplanation persistence
  -> TradeJournal linkage
  -> audit records
```

Main files:

- `yujidi-server/src/controllers/ai-explanation.controller.ts`
- `yujidi-server/src/services/ai-runtime/ai-trade-review.service.ts`
- `yujidi-server/src/services/ai-runtime/ai-trade-review-context.service.ts`
- `yujidi-server/src/services/ai-runtime/llm.service.ts`
- `yujidi-server/src/ports/llm-provider.port.ts`
- `yujidi-server/src/integrations/llm/groq/groq-llm.provider.ts`
- `yujidi-server/src/models/ai-explanation.model.ts`
- `yujidi-server/src/types/ai.types.ts`

Provider method:
`generatePostTradeReview`

Input categories:
- Deterministic trade journal AI context.
- Prompt version.
- Schema version.

Output contract:
Post-trade review output is validated by AI review validation code before storage. Stored fields include summary, strengths, mistakes, suggestions, process quality, risk notes, validation errors, warnings, provider metadata, and generated time.

Validation:
The service runs schema and semantic validation. Invalid model output creates deterministic fallback output.

Persistence:
`AiExplanation` is created. `TradeJournal` is linked to the generated explanation. Audit records are written around request, rejection, validation, fallback, and storage events.

Consumer:
Frontend journal and AI review views consume the stored AI explanation and journal AI reference fields.

Failure behavior:
Provider failure or invalid output uses deterministic fallback. The user still receives a persisted explanation where possible.

Existing logs/audits:
The service creates audit records including request, output rejection, output validation, fallback use, and explanation storage. It also records context hash, prompt version, and schema version.

Sensitive-data risks:
- Full post-trade context may include detailed user trading behavior.
- Full raw model output may include unsafe or rejected content.
- Future trace must prefer hashes, summaries, validation outcomes, and entity references.

Architectural concerns:
- This workflow is closest to the future trace shape because it already has context hash, prompt version, schema version, validation, fallback, persistence, and audit events.
- Trace persistence must remain best effort and must not replace deterministic fallback behavior.

Future trace integration point:
Wrap the post-trade LLM operation with task type `POST_TRADE_REVIEW`, reusing context hash and correlation id while avoiding full context and raw output storage by default.
