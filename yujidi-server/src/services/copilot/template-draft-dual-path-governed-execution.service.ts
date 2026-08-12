import type { AiRuntimeUsagePort } from "../../ports/ai-runtime-usage.port.js";
import { AI_PROVIDER_CIRCUIT_POLICY } from "../../registries/ai-runtime-execution-policy.registry.js";
import type {
  AiProviderExecutionObserver,
  AiProviderExecutionOutcome,
} from "../../types/ai-provider-execution.types.js";
import type { AiProviderExecutionStage } from "../../types/ai-provider-stage.types.js";
import type { AiProviderStageUsage } from "../../types/ai-provider-usage.types.js";
import type {
  TemplateDraftDualPathExecutionRequest,
  TemplateDraftDualPathExecutionResult,
  TemplateDraftDualPathExecutionStatus,
} from "../../types/template-draft-dual-path-execution.types.js";
import {
  AiRuntimeCallerCancelledError,
  AiRuntimeDeadlineExceededError,
} from "../../types/ai-runtime-deadline.types.js";
import type { AiGovernedExecutionContextService } from "../ai-runtime/ai-governed-execution-context.service.js";
import { AiProviderCircuitAttributionService } from "../ai-runtime/ai-provider-circuit-attribution.service.js";
import type { AiRuntimeCircuitBreakerService } from "../ai-runtime/ai-runtime-circuit-breaker.service.js";
import {
  ApplicationRagRetrievalAuthorizationService,
  TEMPLATE_DRAFT_APPLICATION_RETRIEVAL_AUTHORIZATION,
} from "../access/application-rag-retrieval-authorization.service.js";
import { freezeClone } from "../knowledge/knowledge-document-admission.service.js";
import type { TemplateDraftRagRuntimeService } from "./template-draft-rag-runtime.service.js";
import type { TemplateDraftRegistryOnlyBaselineService } from "./template-draft-registry-only-baseline.service.js";

export class TemplateDraftDualPathGovernedExecutionService {
  public constructor(
    private readonly governance: AiGovernedExecutionContextService,
    private readonly baseline: TemplateDraftRegistryOnlyBaselineService,
    private readonly ragRuntime: TemplateDraftRagRuntimeService,
    private readonly circuits: AiRuntimeCircuitBreakerService,
    private readonly usagePort?: AiRuntimeUsagePort,
    private readonly authorization = new ApplicationRagRetrievalAuthorizationService(),
    private readonly now: () => number = Date.now,
  ) {}

  public async execute(
    input: TemplateDraftDualPathExecutionRequest,
  ): Promise<TemplateDraftDualPathExecutionResult> {
    const startedAt = this.now();
    const admission = await this.governance.create({
      executionId: input.executionId,
      bindingId: input.bindingId,
      bindingVersion: input.bindingVersion,
      userId: input.caller.userId,
      requestedAt: input.requestedAt,
      features: input.features,
      ...(input.callerSignal ? { callerSignal: input.callerSignal } : {}),
    });
    if (!admission.admitted) {
      return this.denied(input, admission.code, startedAt);
    }
    const context = admission.context;
    const stages: AiProviderStageUsage[] = [];
    const circuitObserver = new AiProviderCircuitAttributionService(
      this.circuits,
      AI_PROVIDER_CIRCUIT_POLICY,
      this.now,
    );
    const observer: AiProviderExecutionObserver = {
      record: (stage, outcome) => {
        circuitObserver.record(stage, outcome);
        stages.push(stageUsage(stage, outcome));
      },
    };
    let baselineLatency: number | null = null;
    try {
      const authorized = this.authorization.authorize({
        authorizationId:
          TEMPLATE_DRAFT_APPLICATION_RETRIEVAL_AUTHORIZATION.authorizationId,
        authorizationVersion: 1,
        runtimeBindingId: context.runtimeBindingId,
        runtimeBindingVersion: context.runtimeBindingVersion,
        indexPublicationId: context.indexPublicationId,
        indexPublicationVersion: context.indexPublicationVersion,
        corpusPublicationId: context.corpusPublicationId,
        corpusPublicationVersion: context.corpusPublicationVersion,
        embeddingSchemaId: context.embeddingSchemaId,
        embeddingSchemaVersion: context.embeddingSchemaVersion,
        indexId: TEMPLATE_DRAFT_APPLICATION_RETRIEVAL_AUTHORIZATION.indexId,
        indexVersion:
          TEMPLATE_DRAFT_APPLICATION_RETRIEVAL_AUTHORIZATION.indexVersion,
        namespace: context.namespace,
        corpus: context.corpus,
        rolloutMode: context.rolloutMode,
      });
      if (!authorized.authorized) {
        return await this.result(input, startedAt, stages, {
          status: "GOVERNANCE_DENIED",
          reason: authorized.code,
          context,
          baselineLatency,
        });
      }
      const baselineExecution = await this.baseline.execute(
        context,
        input.baselineRequest,
        observer,
      );
      baselineLatency = baselineExecution.generationLatencyMs;
      const authoritativeBaseline = baselineExecution.result;
      if (!isAuthoritative(authoritativeBaseline)) {
        return await this.result(input, startedAt, stages, {
          status: cancellationStatus(context.deadlineContext.signal),
          reason: authoritativeBaseline.reasonCode,
          context,
          baselineOutcome: authoritativeBaseline.status,
          baselineLatency,
        });
      }
      context.deadlineContext.throwIfExpired("PRE_EXECUTION");
      const beforeShadow = structuredClone(authoritativeBaseline);
      const shadow = await this.ragRuntime.executeWithinGovernedContext(
        context,
        {
          bindingId: input.bindingId,
          bindingVersion: input.bindingVersion,
          caller: input.caller,
          request: input.ragRequest,
          authoritativeResult: authoritativeBaseline,
          features: input.features,
          requestedAt: new Date(input.requestedAt.getTime()),
          ...(input.callerSignal ? { callerSignal: input.callerSignal } : {}),
        },
        observer,
        authorized.authorization,
      );
      const preserved =
        JSON.stringify(beforeShadow) === JSON.stringify(authoritativeBaseline);
      if (!preserved) throw new Error("AUTHORITATIVE_BASELINE_MUTATED");
      return await this.result(input, startedAt, stages, {
        status:
          shadow.status === "COMPLETED"
            ? "COMPLETED"
            : "AUTHORITATIVE_AVAILABLE_SHADOW_FAILED",
        context,
        authoritativeBaseline,
        shadow,
        baselineLatency,
      });
    } catch (error) {
      const status = errorStatus(error, context.deadlineContext.signal);
      return await this.result(input, startedAt, stages, {
        status,
        reason: error instanceof Error ? error.message : "EXECUTION_FAILED",
        context,
        baselineLatency,
      });
    } finally {
      await this.governance.finalize(context);
    }
  }

  private denied(
    input: TemplateDraftDualPathExecutionRequest,
    reason: string,
    startedAt: number,
  ): TemplateDraftDualPathExecutionResult {
    return freezeClone({
      executionId: input.executionId,
      status:
        reason === "CALLER_CANCELLED"
          ? "CANCELLED"
          : reason === "DEADLINE_EXCEEDED"
            ? "DEADLINE_EXCEEDED"
            : "GOVERNANCE_DENIED",
      reason,
      authoritativeResultUntouched: true,
      requestCountAdmission: reason === "CONCURRENCY_LIMIT" ? 1 : 0,
      usage: [],
      telemetry: emptyTelemetry(startedAt, this.now(), reason),
    });
  }

  private async result(
    input: TemplateDraftDualPathExecutionRequest,
    startedAt: number,
    stages: readonly AiProviderStageUsage[],
    value: Readonly<{
      status: TemplateDraftDualPathExecutionStatus;
      reason?: string;
      context: import("../../types/ai-governed-execution-context.types.js").AiGovernedExecutionContext;
      authoritativeBaseline?: import("../../types/template-draft-generation.types.js").TemplateDraftGenerationResult;
      baselineOutcome?: string;
      shadow?: import("../../types/template-draft-rag-shadow.types.js").TemplateDraftRagShadowResult;
      baselineLatency: number | null;
    }>,
  ): Promise<TemplateDraftDualPathExecutionResult> {
    const shadowTrace = value.shadow?.trace;
    let usageAccountingFailure: "USAGE_RECORDING_FAILED" | undefined;
    if (this.usagePort) {
      try {
        await this.usagePort.recordUsage({
          executionId: input.executionId,
          userId: input.caller.userId,
          stages,
        });
      } catch {
        usageAccountingFailure = "USAGE_RECORDING_FAILED";
      }
    }
    return freezeClone({
      executionId: input.executionId,
      status: value.status,
      ...(value.reason ? { reason: value.reason } : {}),
      ...(value.authoritativeBaseline
        ? { authoritativeBaseline: value.authoritativeBaseline }
        : {}),
      ...(value.shadow ? { shadow: value.shadow } : {}),
      ...(value.shadow?.comparison
        ? { comparison: value.shadow.comparison }
        : {}),
      authoritativeResultUntouched: true,
      requestCountAdmission: 1,
      usage: stages,
      ...(usageAccountingFailure ? { usageAccountingFailure } : {}),
      telemetry: {
        runtimeBindingId: value.context.runtimeBindingId,
        runtimeBindingVersion: value.context.runtimeBindingVersion,
        indexPublicationId: value.context.indexPublicationId,
        indexPublicationVersion: value.context.indexPublicationVersion,
        rolloutMode: value.context.rolloutMode,
        budgetAdmission: "ALLOWED",
        concurrencyAdmission: "ACQUIRED",
        baselineOutcome:
          value.authoritativeBaseline?.status ??
          value.baselineOutcome ??
          "UNAVAILABLE",
        ragOutcome: value.shadow?.status ?? "NOT_STARTED",
        comparisonOutcome:
          value.shadow?.comparison?.outcome ?? "NOT_COMPARABLE",
        circuitStates: circuitStates(this.circuits, this.now()),
        baselineGenerationLatencyMs: value.baselineLatency,
        embeddingLatencyMs: shadowTrace?.embeddingLatencyMs ?? null,
        retrievalLatencyMs: shadowTrace?.retrievalLatencyMs ?? null,
        contextAssemblyLatencyMs: shadowTrace?.contextAssemblyLatencyMs ?? null,
        ragGenerationLatencyMs: shadowTrace?.generationLatencyMs ?? null,
        totalLatencyMs: Math.max(0, this.now() - startedAt),
      },
    });
  }
}

const isAuthoritative = (
  result: import("../../types/template-draft-generation.types.js").TemplateDraftGenerationResult,
): result is Extract<
  import("../../types/template-draft-generation.types.js").TemplateDraftGenerationResult,
  { status: "COMPLETED" | "PARTIAL" }
> => result.status === "COMPLETED" || result.status === "PARTIAL";

const cancellationStatus = (
  signal: AbortSignal,
): TemplateDraftDualPathExecutionStatus =>
  signal.reason === "CALLER_CANCELLED"
    ? "CANCELLED"
    : signal.reason === "RUNTIME_DEADLINE_EXCEEDED"
      ? "DEADLINE_EXCEEDED"
      : "BASELINE_UNAVAILABLE";

const errorStatus = (
  error: unknown,
  signal: AbortSignal,
): TemplateDraftDualPathExecutionStatus =>
  error instanceof AiRuntimeCallerCancelledError ||
  signal.reason === "CALLER_CANCELLED"
    ? "CANCELLED"
    : error instanceof AiRuntimeDeadlineExceededError ||
        signal.reason === "RUNTIME_DEADLINE_EXCEEDED"
      ? "DEADLINE_EXCEEDED"
      : "BASELINE_UNAVAILABLE";

const stageUsage = (
  stage: AiProviderExecutionStage,
  outcome: AiProviderExecutionOutcome,
): AiProviderStageUsage => {
  const identity = outcome.completed ? outcome.success : outcome.failure;
  return freezeClone({
    stage,
    providerClass: identity.providerClass,
    ...(identity.provider ? { provider: identity.provider } : {}),
    ...(identity.model ? { model: identity.model } : {}),
    usage: outcome.usage ?? {},
  });
};

const circuitStates = (circuits: AiRuntimeCircuitBreakerService, now: number) =>
  freezeClone({
    GENERATION_PROVIDER: circuits.state("GENERATION_PROVIDER", now),
    EMBEDDING_PROVIDER: circuits.state("EMBEDDING_PROVIDER", now),
    VECTOR_INDEX_PROVIDER: circuits.state("VECTOR_INDEX_PROVIDER", now),
  });

const emptyTelemetry = (startedAt: number, now: number, reason: string) => ({
  budgetAdmission:
    reason === "BUDGET_EXCEEDED"
      ? ("DENIED" as const)
      : ("NOT_REACHED" as const),
  concurrencyAdmission:
    reason === "CONCURRENCY_LIMIT"
      ? ("DENIED" as const)
      : ("NOT_REACHED" as const),
  baselineOutcome: "NOT_STARTED",
  ragOutcome: "NOT_STARTED",
  comparisonOutcome: "NOT_COMPARABLE",
  circuitStates: {},
  baselineGenerationLatencyMs: null,
  embeddingLatencyMs: null,
  retrievalLatencyMs: null,
  contextAssemblyLatencyMs: null,
  ragGenerationLatencyMs: null,
  totalLatencyMs: Math.max(0, now - startedAt),
});
