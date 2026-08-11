import crypto from "node:crypto";
import { TEMPLATE_DRAFT_RAG_RUNTIME_V1 } from "../registries/template-draft-rag-runtime-binding.registry.js";
import type {
  TemplateDraftPromptApplicationResult,
  TemplateDraftPromptRequest,
} from "../types/template-draft-intent.types.js";
import type { InternalTemplateDraftRagApplicationService } from "./internal-template-draft-rag-application.service.js";
import type { InternalRagLifecycleLogger } from "./internal-rag-lifecycle-logger.service.js";
import { NOOP_INTERNAL_RAG_LIFECYCLE_LOGGER } from "./internal-rag-lifecycle-logger.service.js";
import { freezeClone } from "./knowledge-document-admission.service.js";
import type { TemplateDraftIntentExtractionService } from "./template-draft-intent-extraction.service.js";

export class TemplateDraftPromptApplicationService {
  public constructor(
    private readonly extraction: TemplateDraftIntentExtractionService,
    private readonly rag: Pick<InternalTemplateDraftRagApplicationService, "execute">,
    private readonly lifecycle: InternalRagLifecycleLogger = NOOP_INTERNAL_RAG_LIFECYCLE_LOGGER,
    private readonly requestId: () => string = () =>
      `PROMPT_${crypto.randomUUID().replaceAll("-", "").toUpperCase()}`,
    private readonly now: () => number = Date.now,
  ) {}

  public async execute(
    request: TemplateDraftPromptRequest,
    principal: Readonly<{ userId: string }>,
    signal?: AbortSignal,
    serverRequestId?: string,
  ): Promise<TemplateDraftPromptApplicationResult> {
    const requestId = serverRequestId ?? this.requestId();
    const startedAt = this.now();
    const extracted = await this.extraction.extract(
      { requestId, prompt: request?.prompt },
      signal,
    );
    const durationMs = Math.max(0, this.now() - startedAt);
    const clarificationIntent =
      extracted.status === "NEEDS_CLARIFICATION"
        ? extracted.partialIntent
        : undefined;
    const conceptCount =
      extracted.status === "COMPLETED" ||
      extracted.status === "UNSUPPORTED_REQUEST"
        ? extracted.requestedConcepts.length
        : extracted.status === "NEEDS_CLARIFICATION"
          ? (clarificationIntent?.requestedConcepts.length ?? 0)
          : 0;
    this.lifecycle[extracted.status === "FAILED" ? "warn" : "info"]({
      requestId,
      userId: principal.userId,
      event: "INTERNAL_RAG_STAGE_COMPLETED",
      stage: "INTENT_EXTRACTION",
      outcome: extracted.status,
      durationMs,
      details: {
        conceptCount,
        subjectType:
          extracted.status === "COMPLETED" ||
          extracted.status === "UNSUPPORTED_REQUEST"
            ? (extracted.subject.type ?? null)
            : (clarificationIntent?.subject?.type ?? null),
        ...(extracted.status === "FAILED"
          ? { providerFailureCode: extracted.code }
          : {}),
      },
    });
    if (extracted.status === "FAILED")
      return Object.freeze({ status: "error", code: extracted.code });
    if (extracted.status === "NEEDS_CLARIFICATION")
      return freezeClone({
        status: "needs_clarification" as const,
        questions: extracted.clarificationQuestions,
        ...(extracted.partialIntent
          ? { partialIntent: extracted.partialIntent }
          : {}),
      });
    const draft = await this.rag.execute(
      {
        requestId,
        requestText: request.prompt,
        requestedConcepts: extracted.requestedConcepts.map((concept) => ({
          conceptId: concept.conceptId,
          label: concept.label,
        })),
        subject: extracted.subject,
        runtimeBindingId: TEMPLATE_DRAFT_RAG_RUNTIME_V1.bindingId,
        runtimeBindingVersion: TEMPLATE_DRAFT_RAG_RUNTIME_V1.bindingVersion,
      },
      principal,
      signal,
    );
    return freezeClone({
      status: "success" as const,
      intent: {
        subject: extracted.subject,
        requestedConcepts: extracted.requestedConcepts,
      },
      draft,
    });
  }
}
