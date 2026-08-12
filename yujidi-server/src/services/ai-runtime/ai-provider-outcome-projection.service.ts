import type {
  AiProviderExecutionFailure,
  AiProviderFailureCode,
} from "../../types/ai-provider-execution.types.js";
import type { AiProviderClass } from "../../types/ai-runtime-circuit.types.js";

const CODE_MAP: Readonly<Record<string, AiProviderFailureCode>> = Object.freeze(
  {
    REQUEST_TIMEOUT: "REQUEST_TIMEOUT",
    NETWORK_FAILED: "NETWORK_FAILED",
    PROVIDER_UNAVAILABLE: "PROVIDER_UNAVAILABLE",
    CALLER_ABORTED: "CALLER_ABORTED",
    AUTHENTICATION_FAILED: "AUTHENTICATION_FAILED",
    PERMISSION_DENIED: "PERMISSION_DENIED",
    RATE_LIMITED: "RATE_LIMITED",
    MODEL_NOT_FOUND: "MODEL_NOT_FOUND",
    CONTENT_REJECTED: "CONTENT_BLOCKED",
    EMPTY_RESPONSE: "EMPTY_RESPONSE",
    MALFORMED_RESPONSE: "MALFORMED_RESPONSE",
    SCHEMA_VALIDATION_FAILED: "VALIDATION_FAILED",
    MALFORMED_VECTOR_RESPONSE: "MALFORMED_RESPONSE",
    VECTOR_COUNT_MISMATCH: "MALFORMED_RESPONSE",
    INPUT_TOO_LARGE: "RESPONSE_SIZE_EXCEEDED",
    RESULT_BOUND_EXCEEDED: "RESPONSE_SIZE_EXCEEDED",
    MODEL_IDENTITY_MISMATCH: "IDENTITY_MISMATCH",
    INDEX_SPECIFICATION_MISMATCH: "IDENTITY_MISMATCH",
    UNKNOWN_PROVIDER_FAILURE: "UNKNOWN_PROVIDER_FAILURE",
  },
);

export const projectAiProviderFailure = (
  providerClass: AiProviderClass,
  adapterFailureCode: string,
  identity: Readonly<{ provider?: string; model?: string }> = {},
): AiProviderExecutionFailure =>
  Object.freeze({
    providerClass,
    failureCode:
      CODE_MAP[adapterFailureCode] ?? classifyUnknown(adapterFailureCode),
    ...identity,
  });

const classifyUnknown = (code: string): AiProviderFailureCode => {
  if (/AUTHENTICATION/.test(code)) return "AUTHENTICATION_FAILED";
  if (/PERMISSION/.test(code)) return "PERMISSION_DENIED";
  if (/TIMEOUT/.test(code)) return "REQUEST_TIMEOUT";
  if (/NETWORK/.test(code)) return "NETWORK_FAILED";
  if (/UNAVAILABLE|INDEX_BUILDING|INDEX_FAILED/.test(code))
    return "PROVIDER_UNAVAILABLE";
  if (/MALFORMED|INVALID|MISMATCH|DUPLICATE/.test(code))
    return "VALIDATION_FAILED";
  return "UNKNOWN_PROVIDER_FAILURE";
};
