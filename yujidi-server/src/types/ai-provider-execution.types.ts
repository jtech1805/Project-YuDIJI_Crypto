import type { AiProviderClass } from "./ai-runtime-circuit.types.js";
import type { AiProviderUsage } from "./ai-provider-usage.types.js";
import type { AiProviderExecutionStage } from "./ai-provider-stage.types.js";

export const AI_PROVIDER_FAILURE_CODES = [
  "REQUEST_TIMEOUT",
  "NETWORK_FAILED",
  "PROVIDER_UNAVAILABLE",
  "CALLER_ABORTED",
  "AUTHENTICATION_FAILED",
  "PERMISSION_DENIED",
  "RATE_LIMITED",
  "MODEL_NOT_FOUND",
  "CONTENT_BLOCKED",
  "EMPTY_RESPONSE",
  "MALFORMED_RESPONSE",
  "VALIDATION_FAILED",
  "RESPONSE_SIZE_EXCEEDED",
  "IDENTITY_MISMATCH",
  "UNKNOWN_PROVIDER_FAILURE",
] as const;

export type AiProviderFailureCode = (typeof AI_PROVIDER_FAILURE_CODES)[number];

export type AiProviderExecutionSuccess = Readonly<{
  providerClass: AiProviderClass;
  provider?: string;
  model?: string;
}>;

export type AiProviderExecutionFailure = Readonly<{
  providerClass: AiProviderClass;
  failureCode: AiProviderFailureCode;
  provider?: string;
  model?: string;
  retryAfterMs?: number;
}>;

export type AiProviderExecutionOutcome =
  | Readonly<{
      completed: true;
      success: AiProviderExecutionSuccess;
      usage?: AiProviderUsage;
    }>
  | Readonly<{
      completed: false;
      failure: AiProviderExecutionFailure;
      usage?: AiProviderUsage;
    }>;

export interface AiProviderExecutionObserver {
  record(
    stage: AiProviderExecutionStage,
    outcome: AiProviderExecutionOutcome,
  ): void;
}
