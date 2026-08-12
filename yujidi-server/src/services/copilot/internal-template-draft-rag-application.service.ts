import type {
  InternalTemplateDraftRequest,
  InternalTemplateDraftRagApplicationResult,
} from "../../types/internal-template-draft-rag.types.js";
import type { TemplateDraftDualPathGovernedExecutionService } from "./template-draft-dual-path-governed-execution.service.js";
import type { InternalTemplateDraftRagRequestAssemblyService } from "./internal-template-draft-rag-request-assembly.service.js";
import { freezeClone } from "../knowledge/knowledge-document-admission.service.js";
import {
  NOOP_INTERNAL_RAG_LIFECYCLE_LOGGER,
  type InternalRagLifecycleLogger,
} from "../ai-runtime/internal-rag-lifecycle-logger.service.js";

export class InternalTemplateDraftRagApplicationError extends Error {
  public constructor(
    public readonly code: string,
    public readonly httpStatus: number,
  ) {
    super(code);
    this.name = "InternalTemplateDraftRagApplicationError";
  }
}

export class InternalTemplateDraftRagApplicationService {
  public constructor(
    private readonly assembly: InternalTemplateDraftRagRequestAssemblyService,
    private readonly execution: TemplateDraftDualPathGovernedExecutionService,
    private readonly lifecycle: InternalRagLifecycleLogger = NOOP_INTERNAL_RAG_LIFECYCLE_LOGGER,
    private readonly now: () => number = Date.now,
  ) {}

  public async execute(
    request: InternalTemplateDraftRequest,
    principal: Readonly<{ userId: string }>,
    callerSignal?: AbortSignal,
  ): Promise<InternalTemplateDraftRagApplicationResult> {
    const requestStartedAt = this.now();
    const common = {
      requestId: request?.requestId ?? "UNKNOWN_REQUEST",
      userId: principal.userId,
    };
    this.lifecycle.info({
      ...common,
      event: "INTERNAL_RAG_REQUEST_ACCEPTED",
      stage: "AUTHORIZATION",
      outcome: "AUTHORIZED",
      durationMs: 0,
      details: {
        conceptCount: Array.isArray(request?.requestedConcepts)
          ? request.requestedConcepts.length
          : 0,
        subjectType: request?.subject?.type ?? null,
        runtimeBindingId: request?.runtimeBindingId ?? null,
        runtimeBindingVersion: request?.runtimeBindingVersion ?? null,
      },
    });
    const assemblyStartedAt = this.now();
    this.lifecycle.info({
      ...common,
      event: "INTERNAL_RAG_STAGE_STARTED",
      stage: "REQUEST_ASSEMBLY",
    });
    const assembled = await this.assembly.assemble(
      request,
      { userId: principal.userId, isInternal: true },
      callerSignal,
    );
    if (!assembled.assembled) {
      this.lifecycle.warn({
        ...common,
        event: "INTERNAL_RAG_STAGE_FAILED",
        stage: "REQUEST_ASSEMBLY",
        outcome: assembled.code,
        durationMs: Math.max(0, this.now() - assemblyStartedAt),
      });
      throw new InternalTemplateDraftRagApplicationError(
        assembled.code,
        assembled.code === "RUNTIME_BINDING_UNAVAILABLE" ? 404 : 400,
      );
    }
    this.lifecycle.info({
      ...common,
      executionId: assembled.execution.executionId,
      event: "INTERNAL_RAG_STAGE_COMPLETED",
      stage: "REQUEST_ASSEMBLY",
      outcome: "COMPLETED",
      durationMs: Math.max(0, this.now() - assemblyStartedAt),
      details: {
        bindingId: assembled.execution.bindingId,
        bindingVersion: assembled.execution.bindingVersion,
        eligibleDocumentCount:
          assembled.execution.ragRequest.retrieval?.eligibleDocuments.length ??
          0,
        registryProjectionId:
          assembled.execution.baselineRequest.registryProjection.projectionId,
        registryProjectionVersion:
          assembled.execution.baselineRequest.registryProjection
            .projectionVersion,
        asOf: assembled.execution.requestedAt.toISOString(),
      },
    });
    this.lifecycle.info({
      ...common,
      executionId: assembled.execution.executionId,
      event: "INTERNAL_RAG_STAGE_STARTED",
      stage: "GOVERNED_DUAL_PATH_EXECUTION",
    });
    const result = await this.execution.execute(assembled.execution);
    this.logExecutionStages(common, result);
    if (result.status === "GOVERNANCE_DENIED") {
      const limited = ["BUDGET_EXCEEDED", "CONCURRENCY_LIMIT"].includes(
        result.reason ?? "",
      );
      throw new InternalTemplateDraftRagApplicationError(
        result.reason ?? "GOVERNANCE_DENIED",
        limited ? 429 : 503,
      );
    }
    if (result.status === "DEADLINE_EXCEEDED")
      throw new InternalTemplateDraftRagApplicationError(
        "DEADLINE_EXCEEDED",
        504,
      );
    if (result.status === "CANCELLED")
      throw new InternalTemplateDraftRagApplicationError(
        "CALLER_CANCELLED",
        499,
      );
    const response = freezeClone({
      executionId: result.executionId,
      shadowOnly: true as const,
      authoritativeResultUntouched: true as const,
      status: result.status,
      ...(result.reason ? { reason: result.reason } : {}),
      ...(result.authoritativeBaseline
        ? { authoritativeBaseline: result.authoritativeBaseline }
        : {}),
      ...(result.shadow ? { ragShadow: result.shadow } : {}),
      ...(result.comparison ? { comparison: result.comparison } : {}),
      runtime: {
        bindingId: assembled.execution.bindingId,
        bindingVersion: assembled.execution.bindingVersion,
        ...(result.telemetry.indexPublicationId
          ? { indexPublicationId: result.telemetry.indexPublicationId }
          : {}),
        ...(result.telemetry.indexPublicationVersion
          ? {
              indexPublicationVersion: result.telemetry.indexPublicationVersion,
            }
          : {}),
      },
      telemetry: result.telemetry,
    });
    this.lifecycle.info({
      ...common,
      executionId: result.executionId,
      event: "INTERNAL_RAG_RESPONSE_COMPLETED",
      stage: "HTTP_RESPONSE_PROJECTION",
      outcome: result.status,
      durationMs: Math.max(0, this.now() - requestStartedAt),
      details: {
        authoritativeResultUntouched: result.authoritativeResultUntouched,
        comparisonOutcome: result.comparison?.outcome ?? "NOT_COMPARABLE",
        shadowOnly: true,
      },
    });
    return response;
  }

  private logExecutionStages(
    common: Readonly<{ requestId: string; userId: string }>,
    result: Awaited<
      ReturnType<TemplateDraftDualPathGovernedExecutionService["execute"]>
    >,
  ): void {
    const telemetry = result.telemetry;
    const event = result.status === "COMPLETED" ? "info" : "warn";
    const emit = (stage: string, outcome: string, durationMs: number | null) =>
      this.lifecycle[event]({
        ...common,
        executionId: result.executionId,
        event: "INTERNAL_RAG_STAGE_COMPLETED",
        stage,
        outcome,
        durationMs,
      });
    emit("GOVERNANCE_ADMISSION", telemetry.budgetAdmission, null);
    emit(
      "BASELINE_GENERATION",
      telemetry.baselineOutcome,
      telemetry.baselineGenerationLatencyMs,
    );
    emit("QUERY_EMBEDDING", telemetry.ragOutcome, telemetry.embeddingLatencyMs);
    emit(
      "VECTOR_RETRIEVAL",
      telemetry.ragOutcome,
      telemetry.retrievalLatencyMs,
    );
    emit(
      "CONTEXT_ASSEMBLY",
      telemetry.ragOutcome,
      telemetry.contextAssemblyLatencyMs,
    );
    emit(
      "RAG_GENERATION",
      telemetry.ragOutcome,
      telemetry.ragGenerationLatencyMs,
    );
    emit("COMPARISON", telemetry.comparisonOutcome, null);
    this.lifecycle[event]({
      ...common,
      executionId: result.executionId,
      event: "INTERNAL_RAG_EXECUTION_COMPLETED",
      stage: "GOVERNED_DUAL_PATH_EXECUTION",
      outcome: result.status,
      durationMs: telemetry.totalLatencyMs,
      details: {
        bindingId: telemetry.runtimeBindingId ?? null,
        bindingVersion: telemetry.runtimeBindingVersion ?? null,
        indexPublicationId: telemetry.indexPublicationId ?? null,
        indexPublicationVersion: telemetry.indexPublicationVersion ?? null,
        rolloutMode: telemetry.rolloutMode ?? null,
        concurrencyAdmission: telemetry.concurrencyAdmission,
        circuitStates: telemetry.circuitStates,
        providerUsage: result.usage.map((usage) => ({
          stage: usage.stage,
          providerClass: usage.providerClass,
          provider: usage.provider ?? null,
          model: usage.model ?? null,
          usage: usage.usage,
        })),
        usageAccountingFailure: result.usageAccountingFailure ?? null,
      },
    });
  }
}
