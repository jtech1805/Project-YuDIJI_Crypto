import type { AiProviderStageUsage } from "./ai-provider-usage.types.js";
import type {
  TemplateDraftGenerationRequest,
  TemplateDraftGenerationResult,
} from "./template-draft-generation.types.js";
import type {
  RagRuntimeFeatures,
  TemplateDraftRagShadowComparison,
  TemplateDraftRagShadowResult,
} from "./template-draft-rag-shadow.types.js";
import type { RagTemplateDraftGenerationRequest } from "./template-draft-rag.types.js";

export type TemplateDraftDualPathExecutionStatus =
  | "COMPLETED"
  | "AUTHORITATIVE_AVAILABLE_SHADOW_FAILED"
  | "BASELINE_UNAVAILABLE"
  | "CANCELLED"
  | "DEADLINE_EXCEEDED"
  | "GOVERNANCE_DENIED";

export type TemplateDraftDualPathExecutionRequest = Readonly<{
  executionId: string;
  bindingId: string;
  bindingVersion: number;
  caller: Readonly<{ userId: string; tenantId?: string; isInternal: boolean }>;
  baselineRequest: TemplateDraftGenerationRequest;
  ragRequest: RagTemplateDraftGenerationRequest;
  features: RagRuntimeFeatures;
  requestedAt: Date;
  callerSignal?: AbortSignal;
}>;

export type TemplateDraftDualPathExecutionResult = Readonly<{
  executionId: string;
  status: TemplateDraftDualPathExecutionStatus;
  reason?: string;
  authoritativeBaseline?: TemplateDraftGenerationResult;
  shadow?: TemplateDraftRagShadowResult;
  comparison?: TemplateDraftRagShadowComparison;
  authoritativeResultUntouched: true;
  requestCountAdmission: 0 | 1;
  usage: readonly AiProviderStageUsage[];
  usageAccountingFailure?: "USAGE_RECORDING_FAILED";
  telemetry: Readonly<{
    runtimeBindingId?: string;
    runtimeBindingVersion?: number;
    indexPublicationId?: string;
    indexPublicationVersion?: number;
    rolloutMode?: string;
    budgetAdmission: "NOT_REACHED" | "ALLOWED" | "DENIED";
    concurrencyAdmission: "NOT_REACHED" | "ACQUIRED" | "DENIED";
    baselineOutcome: string;
    ragOutcome: string;
    comparisonOutcome: string;
    circuitStates: Readonly<Record<string, string>>;
    baselineGenerationLatencyMs: number | null;
    embeddingLatencyMs: number | null;
    retrievalLatencyMs: number | null;
    contextAssemblyLatencyMs: number | null;
    ragGenerationLatencyMs: number | null;
    totalLatencyMs: number;
  }>;
}>;
