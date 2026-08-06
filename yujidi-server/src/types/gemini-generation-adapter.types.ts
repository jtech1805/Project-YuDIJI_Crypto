export const GEMINI_GENERATION_MODEL = "gemini-3.1-flash-lite" as const;
export const GEMINI_GENERATION_PROVIDER = "GOOGLE_GEMINI" as const;
export const GEMINI_GENERATION_ADAPTER_VERSION = 1 as const;
export const GEMINI_GENERATION_API_VERSION = "v1" as const;

export const GEMINI_ADAPTER_FAILURE_CODES = Object.freeze([
  "AUTHENTICATION_FAILED", "PERMISSION_DENIED", "RATE_LIMITED", "REQUEST_TIMEOUT", "CALLER_ABORTED",
  "NETWORK_FAILED", "PROVIDER_UNAVAILABLE", "CONTENT_REJECTED", "EMPTY_RESPONSE", "MALFORMED_RESPONSE",
  "SCHEMA_VALIDATION_FAILED", "INPUT_TOO_LARGE", "MODEL_NOT_FOUND", "MODEL_DEPRECATED",
  "MODEL_IDENTITY_MISMATCH", "UNKNOWN_PROVIDER_FAILURE",
] as const);
export type GeminiAdapterFailureCode = typeof GEMINI_ADAPTER_FAILURE_CODES[number];

export type GeminiAdapterDiagnostic = Readonly<{
  correlationId: string; provider: typeof GEMINI_GENERATION_PROVIDER; requestedModel: typeof GEMINI_GENERATION_MODEL;
  providerReportedModel: string | null; adapterVersion: typeof GEMINI_GENERATION_ADAPTER_VERSION;
  apiVersion: typeof GEMINI_GENERATION_API_VERSION; responseId: string | null; attempts: number;
  status: "COMPLETED" | "FAILED"; latencyMs: number; failureCode: GeminiAdapterFailureCode | null;
  usage: Readonly<{ promptTokens?: number; completionTokens?: number; totalTokens?: number; cachedInputTokens?: number; reasoningTokens?: number }>;
}>;
