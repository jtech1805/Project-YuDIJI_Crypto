import type { AiRuntimeBudgetPort } from "../ports/ai-runtime-budget.port.js";
import type { AiRuntimeConcurrencyPort } from "../ports/ai-runtime-concurrency.port.js";
import type {
  AiGovernedExecutionAdmission,
  AiGovernedExecutionContext,
} from "../types/ai-governed-execution-context.types.js";
import type { RagRuntimeFeatures } from "../types/template-draft-rag-shadow.types.js";
import { AiRuntimeCallerCancelledError } from "../types/ai-runtime-deadline.types.js";
import { AiRuntimeDeadlineContextService } from "./ai-runtime-deadline-context.service.js";
import type { TemplateDraftRagRuntimeBindingService } from "./template-draft-rag-runtime-binding.service.js";

export class AiGovernedExecutionContextService {
  private readonly issued = new WeakSet<object>();
  private readonly finalized = new WeakSet<object>();

  public constructor(
    private readonly bindings: TemplateDraftRagRuntimeBindingService,
    private readonly budget: AiRuntimeBudgetPort,
    private readonly concurrency: AiRuntimeConcurrencyPort,
    private readonly deadlineMs = 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  public async create(
    input: Readonly<{
      executionId: string;
      bindingId: string;
      bindingVersion: number;
      userId: string;
      requestedAt: Date;
      features: RagRuntimeFeatures;
      callerSignal?: AbortSignal;
    }>,
  ): Promise<AiGovernedExecutionAdmission> {
    if (
      input.features.killSwitch ||
      !input.features.aiTemplateGenerationEnabled ||
      !input.features.knowledgeRetrievalEnabled ||
      !input.features.ragTemplateDraftingEnabled
    ) {
      return Object.freeze({ admitted: false, code: "FEATURE_DISABLED" });
    }
    if (this.deadlineMs <= 0) {
      return Object.freeze({ admitted: false, code: "DEADLINE_EXCEEDED" });
    }
    const deadline = new AiRuntimeDeadlineContextService(
      this.deadlineMs,
      { now: this.now },
      undefined,
      input.callerSignal,
    );
    try {
      deadline.enter("PRE_EXECUTION");
      deadline.complete("PRE_EXECUTION");
    } catch (error) {
      deadline.dispose();
      return Object.freeze({
        admitted: false,
        code:
          error instanceof AiRuntimeCallerCancelledError
            ? "CALLER_CANCELLED"
            : "DEADLINE_EXCEEDED",
      });
    }
    const resolved = await this.bindings.resolve(
      input.bindingId,
      input.bindingVersion,
    );
    if (!resolved.valid) {
      deadline.dispose();
      return Object.freeze({
        admitted: false,
        code: "RUNTIME_BINDING_INVALID",
      });
    }
    if (
      !(["SHADOW_ONLY", "INTERNAL"] as const).includes(
        resolved.binding.rolloutMode as "SHADOW_ONLY",
      )
    ) {
      deadline.dispose();
      return Object.freeze({ admitted: false, code: "ROLLOUT_NOT_ELIGIBLE" });
    }
    const instant = input.requestedAt.toISOString();
    const budgetAdmission = await this.budget.reserve({
      userId: input.userId,
      day: instant.slice(0, 10),
      month: instant.slice(0, 7),
      usage: {
        requestCount: 1,
        generationInputTokens: 0,
        generationOutputTokens: 0,
        embeddingInputs: 0,
        estimatedCostUsd: 0,
      },
    });
    if (!budgetAdmission.allowed) {
      deadline.dispose();
      return Object.freeze({ admitted: false, code: "BUDGET_EXCEEDED" });
    }
    const concurrencyPermit = await this.concurrency.acquire(
      "TEMPLATE_DRAFT_DUAL_PATH",
    );
    if (!concurrencyPermit.acquired) {
      deadline.dispose();
      return Object.freeze({ admitted: false, code: "CONCURRENCY_LIMIT" });
    }
    const context = Object.freeze({
      executionId: input.executionId,
      runtimeBindingId: resolved.binding.bindingId,
      runtimeBindingVersion: resolved.binding.bindingVersion,
      indexPublicationId: resolved.indexPublication.indexPublicationId,
      indexPublicationVersion:
        resolved.indexPublication.indexPublicationVersion,
      corpusPublicationId: resolved.corpusPublication.publicationId,
      corpusPublicationVersion: resolved.corpusPublication.publicationVersion,
      embeddingSchemaId: resolved.binding.embeddingSchemaId,
      embeddingSchemaVersion: resolved.binding.embeddingSchemaVersion,
      namespace: resolved.indexPublication.namespace,
      corpus: resolved.binding.corpus,
      rolloutMode: resolved.binding.rolloutMode,
      deadlineContext: deadline,
      budgetAdmission,
      concurrencyPermit,
      ...(input.callerSignal ? { callerSignal: input.callerSignal } : {}),
    }) as unknown as AiGovernedExecutionContext;
    this.issued.add(context);
    return Object.freeze({ admitted: true, context });
  }

  public isIssued(context: AiGovernedExecutionContext): boolean {
    return this.issued.has(context);
  }

  public async finalize(context: AiGovernedExecutionContext): Promise<void> {
    if (!this.issued.has(context) || this.finalized.has(context)) return;
    this.finalized.add(context);
    context.deadlineContext.dispose();
    await this.concurrency.release(context.concurrencyPermit.permitId);
  }
}
