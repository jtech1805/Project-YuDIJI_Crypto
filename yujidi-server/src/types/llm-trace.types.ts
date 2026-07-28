export const LLM_TRACE_TASK_TYPES = [
  "ALERT_REPORT",
  "COPILOT_CHAT",
  "POST_TRADE_REVIEW",
] as const;

export type LlmTraceTaskType = (typeof LLM_TRACE_TASK_TYPES)[number];

export const LLM_TRACE_STATUSES = [
  "STARTED",
  "COMPLETED",
  "PROVIDER_FAILED",
  "EMPTY_RESPONSE",
  "PARSE_FAILED",
  "VALIDATION_FAILED",
  "FALLBACK_USED",
  "PERSISTENCE_FAILED",
] as const;

export type LlmTraceStatus = (typeof LLM_TRACE_STATUSES)[number];

export type LlmTraceValidation = {
  parseSucceeded?: boolean;
  schemaSucceeded?: boolean;
  semanticSucceeded?: boolean;
  errors?: string[];
};

export type LlmTraceTokenUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export type LlmTraceInputReference = {
  hash?: string;
  redactedSummary?: Record<string, unknown>;
};

export type LlmTraceOutputReference = {
  hash?: string;
  fieldSummary?: Record<string, unknown>;
};

export type CreateLlmTraceInput = {
  traceId: string;
  correlationId?: string;
  taskType: LlmTraceTaskType;
  status: LlmTraceStatus;
  userId?: string;
  source?: {
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
  tokenUsage?: LlmTraceTokenUsage;
  inputReference?: LlmTraceInputReference;
  outputReference?: LlmTraceOutputReference;
  validation?: LlmTraceValidation;
  fallbackUsed: boolean;
  failureCode?: string;
};
