import type { AiRuntimeBudgetPort } from "../ports/ai-runtime-budget.port.js";
import type { AiRuntimeConcurrencyPort } from "../ports/ai-runtime-concurrency.port.js";
import type {
  TemplateDraftRagShadowRequest,
  TemplateDraftRagShadowResult,
} from "../types/template-draft-rag-shadow.types.js";
import { freezeClone } from "./knowledge-document-admission.service.js";
import { TemplateDraftRagRuntimeBindingService } from "./template-draft-rag-runtime-binding.service.js";
import type { TemplateDraftRagGenerationService } from "./template-draft-rag-generation.service.js";
import { AiRuntimeCircuitBreakerService } from "./ai-runtime-circuit-breaker.service.js";
import { TemplateDraftRagShadowComparisonService } from "./template-draft-rag-shadow-comparison.service.js";
import { AiRuntimeDeadlineContextService } from "./ai-runtime-deadline-context.service.js";
import {
  AiRuntimeCallerCancelledError,
  AiRuntimeDeadlineExceededError,
  type AiRuntimeDeadlineContext,
} from "../types/ai-runtime-deadline.types.js";
import { AiProviderCircuitAttributionService } from "./ai-provider-circuit-attribution.service.js";
import { AI_PROVIDER_CIRCUIT_POLICY } from "../registries/ai-runtime-execution-policy.registry.js";
import type { AiGovernedExecutionContext } from "../types/ai-governed-execution-context.types.js";
import type { AiProviderExecutionObserver } from "../types/ai-provider-execution.types.js";
export class TemplateDraftRagRuntimeService {
  public constructor(
    private readonly bindingService: TemplateDraftRagRuntimeBindingService,
    private readonly budget: AiRuntimeBudgetPort,
    private readonly concurrency: AiRuntimeConcurrencyPort,
    private readonly circuits: AiRuntimeCircuitBreakerService,
    private readonly ragGeneration: TemplateDraftRagGenerationService,
    private readonly deadlineMs = 60_000,
    private readonly comparisonService = new TemplateDraftRagShadowComparisonService(),
    private readonly now: () => number = Date.now,
  ) {}

  public async execute(
    input: TemplateDraftRagShadowRequest,
  ): Promise<TemplateDraftRagShadowResult> {
    const startedAt = this.now();
    const base = { authoritativeResultUntouched: true as const };
    if (
      input.features.killSwitch ||
      !input.features.aiTemplateGenerationEnabled ||
      !input.features.knowledgeRetrievalEnabled ||
      !input.features.ragTemplateDraftingEnabled
    ) {
      return out(
        "SKIPPED",
        "FEATURE_DISABLED",
        base,
        input,
        startedAt,
        this.now(),
      );
    }

    if (this.deadlineMs <= 0) {
      return out(
        "SKIPPED",
        "DEADLINE_EXCEEDED",
        base,
        input,
        startedAt,
        this.now(),
      );
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
      return out(
        "FAILED",
        error instanceof AiRuntimeCallerCancelledError
          ? "CALLER_CANCELLED"
          : "DEADLINE_EXCEEDED",
        base,
        input,
        startedAt,
        this.now(),
        "NOT_REACHED",
        "NOT_REACHED",
        deadline.latencies(),
        deadline.failureStage() ?? undefined,
      );
    }

    const resolved = await this.bindingService.resolve(
      input.bindingId,
      input.bindingVersion,
    );
    if (!resolved.valid) {
      deadline.dispose();
      return out(
        "SKIPPED",
        "PUBLICATION_UNAVAILABLE",
        base,
        input,
        startedAt,
        this.now(),
      );
    }
    if (resolved.binding.rolloutMode !== "SHADOW_ONLY") {
      deadline.dispose();
      return out(
        "SKIPPED",
        "ROLLOUT_NOT_ELIGIBLE",
        base,
        input,
        startedAt,
        this.now(),
      );
    }

    for (const providerClass of [
      "GENERATION_PROVIDER",
      "EMBEDDING_PROVIDER",
      "VECTOR_INDEX_PROVIDER",
    ] as const) {
      if (!this.circuits.allow(providerClass, input.requestedAt.getTime())) {
        deadline.dispose();
        return out(
          "SKIPPED",
          `${providerClass}_CIRCUIT_OPEN`,
          base,
          input,
          startedAt,
          this.now(),
        );
      }
    }

    const requestedAt = input.requestedAt.toISOString();
    const budgetDecision = await this.budget.reserve({
      userId: input.caller.userId,
      day: requestedAt.slice(0, 10),
      month: requestedAt.slice(0, 7),
      usage: {
        requestCount: 1,
        generationInputTokens: 0,
        generationOutputTokens: 0,
        embeddingInputs: 1,
        estimatedCostUsd: 0,
      },
    });
    if (!budgetDecision.allowed) {
      deadline.dispose();
      return out(
        "SKIPPED",
        "BUDGET_EXCEEDED",
        base,
        input,
        startedAt,
        this.now(),
        "DENIED",
      );
    }

    const permit = await this.concurrency.acquire("TEMPLATE_DRAFT_RAG");
    if (!permit.acquired) {
      deadline.dispose();
      return out(
        "SKIPPED",
        "CONCURRENCY_LIMIT",
        base,
        input,
        startedAt,
        this.now(),
        "ALLOWED",
        "DENIED",
      );
    }

    try {
      return await this.runAdmitted(
        input,
        resolved.binding,
        deadline,
        startedAt,
      );
    } finally {
      deadline.dispose();
      await this.concurrency.release(permit.permitId);
    }
  }

  public async executeWithinGovernedContext(
    context: AiGovernedExecutionContext,
    input: TemplateDraftRagShadowRequest,
    providerObserver?: AiProviderExecutionObserver,
  ): Promise<TemplateDraftRagShadowResult> {
    const startedAt = this.now();
    if (
      context.runtimeBindingId !== input.bindingId ||
      context.runtimeBindingVersion !== input.bindingVersion
    ) {
      return out(
        "SKIPPED",
        "RUNTIME_BINDING_INVALID",
        { authoritativeResultUntouched: true as const },
        input,
        startedAt,
        this.now(),
        "ALLOWED",
        "ACQUIRED",
      );
    }
    for (const providerClass of [
      "GENERATION_PROVIDER",
      "EMBEDDING_PROVIDER",
      "VECTOR_INDEX_PROVIDER",
    ] as const) {
      if (!this.circuits.allow(providerClass, this.now())) {
        return out(
          "SKIPPED",
          `${providerClass}_CIRCUIT_OPEN`,
          { authoritativeResultUntouched: true as const },
          input,
          startedAt,
          this.now(),
          "ALLOWED",
          "ACQUIRED",
          context.deadlineContext.latencies(),
        );
      }
    }
    return this.runAdmitted(
      input,
      {
        bindingId: context.runtimeBindingId,
        bindingVersion: context.runtimeBindingVersion,
        indexPublicationId: context.indexPublicationId,
        indexPublicationVersion: context.indexPublicationVersion,
        rolloutMode: context.rolloutMode,
      },
      context.deadlineContext,
      startedAt,
      providerObserver,
    );
  }

  private async runAdmitted(
    input: TemplateDraftRagShadowRequest,
    binding: Readonly<{
      bindingId: string;
      bindingVersion: number;
      indexPublicationId: string;
      indexPublicationVersion: number;
      rolloutMode: string;
    }>,
    deadline: AiRuntimeDeadlineContext,
    startedAt: number,
    providerObserver?: AiProviderExecutionObserver,
  ): Promise<TemplateDraftRagShadowResult> {
    const base = { authoritativeResultUntouched: true as const };
    try {
      const result = await this.ragGeneration.generate(
        input.request,
        undefined,
        deadline,
        providerObserver ??
          new AiProviderCircuitAttributionService(
            this.circuits,
            AI_PROVIDER_CIRCUIT_POLICY,
            this.now,
          ),
      );
      const comparison = this.comparisonService.compare(
        input.authoritativeResult,
        result,
      );
      const citations = result.citations ?? [];
      const stageLatencies = deadline.latencies();
      return freezeClone({
        status: "COMPLETED",
        ...base,
        ragResult: result,
        comparison,
        trace: {
          bindingId: binding.bindingId,
          bindingVersion: binding.bindingVersion,
          indexPublicationId: binding.indexPublicationId,
          indexPublicationVersion: binding.indexPublicationVersion,
          rolloutMode: binding.rolloutMode,
          featureControls: input.features,
          budgetDecision: "ALLOWED",
          concurrencyDecision: "ACQUIRED",
          circuitStates: circuitStates(
            this.circuits,
            input.requestedAt.getTime(),
          ),
          totalLatencyMs: Math.max(0, this.now() - startedAt),
          ...stageLatencies,
          contextPassageCount: result.retrievalContext?.passages.length ?? 0,
          citationCount: citations.length,
          validCitationCount: citations.filter(
            (citation) => citation.claimValid,
          ).length,
          provider: result.generationLineage?.provider ?? null,
          model: result.generationLineage?.model ?? null,
          registryOnlyOutcome: outcome(input.authoritativeResult) ?? "UNKNOWN",
          ragOutcome: result.status,
          comparisonOutcome: comparison.outcome,
        },
      });
    } catch (error) {
      const stageLatencies = deadline.latencies();
      const deadlineFailure =
        error instanceof AiRuntimeDeadlineExceededError ||
        (deadline.signal.aborted &&
          deadline.signal.reason === "RUNTIME_DEADLINE_EXCEEDED");
      const callerCancellation =
        error instanceof AiRuntimeCallerCancelledError ||
        deadline.signal.reason === "CALLER_CANCELLED";
      return out(
        "FAILED",
        callerCancellation
          ? "CALLER_CANCELLED"
          : deadlineFailure
            ? "DEADLINE_EXCEEDED"
            : "PROVIDER_FAILURE",
        base,
        input,
        startedAt,
        this.now(),
        "ALLOWED",
        "ACQUIRED",
        stageLatencies,
        deadline.failureStage() ?? undefined,
      );
    }
  }
}

const out = (
  status: "SKIPPED" | "FAILED",
  reason: string,
  base: any,
  input: TemplateDraftRagShadowRequest,
  startedAt: number,
  completedAt: number,
  budgetDecision: "NOT_REACHED" | "ALLOWED" | "DENIED" = "NOT_REACHED",
  concurrencyDecision: "NOT_REACHED" | "ACQUIRED" | "DENIED" = "NOT_REACHED",
  stageLatencies: import("../types/ai-runtime-deadline.types.js").AiRuntimeStageLatencies = {
    embeddingLatencyMs: null,
    retrievalLatencyMs: null,
    contextAssemblyLatencyMs: null,
    generationLatencyMs: null,
  },
  failureStage?: import("../types/ai-runtime-deadline.types.js").AiRuntimeStage,
): TemplateDraftRagShadowResult =>
  freezeClone({
    status,
    reason,
    ...base,
    trace: {
      featureControls: input.features,
      budgetDecision,
      concurrencyDecision,
      circuitStates: {},
      totalLatencyMs: Math.max(0, completedAt - startedAt),
      ...stageLatencies,
      contextPassageCount: 0,
      citationCount: 0,
      validCitationCount: 0,
      registryOnlyOutcome: outcome(input.authoritativeResult) ?? "UNKNOWN",
      failureCode: reason,
      ...(failureStage ? { failureStage } : {}),
    },
  });

const circuitStates = (
  circuits: AiRuntimeCircuitBreakerService,
  now: number,
) => ({
  GENERATION_PROVIDER: circuits.state("GENERATION_PROVIDER", now),
  EMBEDDING_PROVIDER: circuits.state("EMBEDDING_PROVIDER", now),
  VECTOR_INDEX_PROVIDER: circuits.state("VECTOR_INDEX_PROVIDER", now),
});

const outcome = (value: unknown): string | undefined =>
  typeof value === "object" && value !== null && "status" in value
    ? String((value as { status: unknown }).status)
    : undefined;
