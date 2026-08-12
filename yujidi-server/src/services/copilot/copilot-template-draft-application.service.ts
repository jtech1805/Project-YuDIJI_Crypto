import type { FeatureFlagService } from "../../config/feature-flags.js";
import type {
  CopilotTemplateDraftRequest,
  CopilotTemplateDraftResult,
} from "../../types/copilot-template-draft.types.js";
import type { InternalRagLifecycleLogger } from "../ai-runtime/internal-rag-lifecycle-logger.service.js";
import { NOOP_INTERNAL_RAG_LIFECYCLE_LOGGER } from "../ai-runtime/internal-rag-lifecycle-logger.service.js";
import type { TemplateDraftPromptApplicationService } from "./template-draft-prompt-application.service.js";
import { CopilotTemplateDraftResponseService } from "./copilot-template-draft-response.service.js";
import { InternalTemplateDraftRagApplicationError } from "./internal-template-draft-rag-application.service.js";
import type { TemplateDraftPromptApplicationResult } from "../../types/template-draft-intent.types.js";
import type { TemplateDraftGenerationResult } from "../../types/template-draft-generation.types.js";
import type { CopilotDraftReviewService } from "./copilot-draft-review.service.js";

export class CopilotTemplateDraftApplicationService {
  public constructor(
    private readonly flags: Pick<FeatureFlagService, "isEnabled">,
    private readonly promptApplication: Pick<
      TemplateDraftPromptApplicationService,
      "execute"
    >,
    private readonly responses = new CopilotTemplateDraftResponseService(),
    private readonly lifecycle: InternalRagLifecycleLogger = NOOP_INTERNAL_RAG_LIFECYCLE_LOGGER,
    private readonly requestId: () => string = () =>
      `COPILOT_${crypto.randomUUID().replaceAll("-", "").toUpperCase()}`,
    private readonly now: () => number = Date.now,
    private readonly reviews?: Pick<CopilotDraftReviewService, "create">,
  ) {}

  public async execute(
    request: CopilotTemplateDraftRequest,
    principal: Readonly<{ userId: string }>,
    signal?: AbortSignal,
  ): Promise<CopilotTemplateDraftResult> {
    if (!this.flags.isEnabled("COPILOT_TEMPLATE_DRAFT_ENABLED"))
      return Object.freeze({
        status: "unavailable",
        code: "COPILOT_UNAVAILABLE",
      });
    const startedAt = this.now();
    const requestId = this.requestId();
    let internal: TemplateDraftPromptApplicationResult;
    try {
      internal = await this.promptApplication.execute(
        request,
        principal,
        signal,
        requestId,
      );
    } catch (error: unknown) {
      const response = Object.freeze({
        status: "unavailable" as const,
        code:
          error instanceof InternalTemplateDraftRagApplicationError &&
          error.code === "CALLER_CANCELLED"
            ? ("CALLER_CANCELLED" as const)
            : error instanceof InternalTemplateDraftRagApplicationError &&
                error.code === "DEADLINE_EXCEEDED"
              ? ("REQUEST_TIMEOUT" as const)
              : ("COPILOT_UNAVAILABLE" as const),
      });
      this.lifecycle.warn({
        requestId,
        userId: principal.userId,
        event: "COPILOT_TEMPLATE_DRAFT_COMPLETED",
        stage: "PRODUCT_RESPONSE",
        outcome: response.status,
        durationMs: Math.max(0, this.now() - startedAt),
        details: { conceptCount: 0, subjectType: null },
      });
      return response;
    }
    const generation = selectPersistableGeneration(internal);
    let persistable:
      | Readonly<{
          generation: TemplateDraftGenerationResult;
          review: Readonly<{ reviewId: string; reviewVersion: 1; expiresAt: Date }>;
          bindings: readonly Readonly<{
            bindingReviewId: string;
            label: string;
            relationship: "DIRECT" | "INVERSE";
          }>[];
        }>
      | undefined;
    if (generation && this.reviews) {
      const created = await this.reviews.create(principal.userId, generation);
      if (created.created) {
        persistable = {
          generation,
          review: {
            reviewId: created.review.reviewId,
            reviewVersion: created.review.reviewVersion,
            expiresAt: created.review.expiresAt,
          },
          bindings: created.review.bindings.map(({ bindingReviewId, label, relationship }) => ({
            bindingReviewId,
            label,
            relationship,
          })),
        };
      }
    }
    const response = this.responses.project(internal, persistable);
    const intent =
      internal.status === "success"
        ? internal.intent
        : internal.status === "needs_clarification"
          ? internal.partialIntent
          : undefined;
    this.lifecycle[response.status === "unavailable" ? "warn" : "info"]({
      requestId,
      userId: principal.userId,
      event: "COPILOT_TEMPLATE_DRAFT_COMPLETED",
      stage: "PRODUCT_RESPONSE",
      outcome: response.status,
      durationMs: Math.max(0, this.now() - startedAt),
      details: {
        conceptCount: intent?.requestedConcepts.length ?? 0,
        subjectType: intent?.subject?.type ?? null,
      },
    });
    return response;
  }
}

const selectPersistableGeneration = (
  result: TemplateDraftPromptApplicationResult,
): TemplateDraftGenerationResult | null => {
  if (result.status !== "success") return null;
  const generation = result.draft.authoritativeBaseline;
  return generation?.status === "COMPLETED" || generation?.status === "PARTIAL"
    ? generation
    : null;
};
import crypto from "node:crypto";
