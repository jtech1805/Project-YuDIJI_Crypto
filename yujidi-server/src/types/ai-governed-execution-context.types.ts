import type { AiRuntimeBudgetDecision } from "./ai-runtime-budget.types.js";
import type { AiRuntimeDeadlineContext } from "./ai-runtime-deadline.types.js";
import type { RagRolloutMode } from "./template-draft-rag-runtime-binding.types.js";

declare const governedExecutionContextBrand: unique symbol;

export type AiGovernedExecutionContext = Readonly<{
  [governedExecutionContextBrand]: "AI_GOVERNED_EXECUTION_CONTEXT";
  executionId: string;
  runtimeBindingId: string;
  runtimeBindingVersion: number;
  indexPublicationId: string;
  indexPublicationVersion: number;
  corpusPublicationId: string;
  corpusPublicationVersion: number;
  embeddingSchemaId: string;
  embeddingSchemaVersion: number;
  namespace: string;
  corpus: "PLATFORM_KNOWLEDGE";
  rolloutMode: RagRolloutMode;
  deadlineContext: AiRuntimeDeadlineContext;
  budgetAdmission: Extract<AiRuntimeBudgetDecision, { allowed: true }>;
  concurrencyPermit: Readonly<{ acquired: true; permitId: string }>;
  callerSignal?: AbortSignal;
}>;

export type AiGovernedExecutionDenialCode =
  | "FEATURE_DISABLED"
  | "DEADLINE_EXCEEDED"
  | "CALLER_CANCELLED"
  | "RUNTIME_BINDING_INVALID"
  | "ROLLOUT_NOT_ELIGIBLE"
  | "BUDGET_EXCEEDED"
  | "CONCURRENCY_LIMIT";

export type AiGovernedExecutionAdmission =
  | Readonly<{ admitted: true; context: AiGovernedExecutionContext }>
  | Readonly<{ admitted: false; code: AiGovernedExecutionDenialCode }>;
