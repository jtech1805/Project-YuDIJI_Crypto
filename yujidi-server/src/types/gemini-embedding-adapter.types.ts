import type { KnowledgeEmbeddingPurpose, KnowledgeEmbeddingSchemaDefinition } from "./knowledge-embedding.types.js";

export const GEMINI_EMBEDDING_PROVIDER = "GOOGLE_GEMINI" as const;
export const GEMINI_EMBEDDING_PROVIDER_VERSION = 1 as const;
export const GEMINI_EMBEDDING_MODEL = "gemini-embedding-001" as const;
export const GEMINI_EMBEDDING_DIMENSION = 768 as const;
export const GEMINI_EMBEDDING_API_VERSION = "v1" as const;
export const GEMINI_EMBEDDING_ADAPTER_VERSION = 1 as const;
export const GEMINI_EMBEDDING_SDK_VERSION = "2.16.0" as const;

export const GEMINI_EMBEDDING_FAILURE_CODES = ["AUTHENTICATION_FAILED", "PERMISSION_DENIED", "RATE_LIMITED", "REQUEST_TIMEOUT", "CALLER_ABORTED", "NETWORK_FAILED", "PROVIDER_UNAVAILABLE", "INPUT_TOO_LARGE", "MODEL_NOT_FOUND", "MODEL_DEPRECATED", "EMPTY_RESPONSE", "VECTOR_COUNT_MISMATCH", "MALFORMED_VECTOR_RESPONSE", "MODEL_IDENTITY_MISMATCH", "UNKNOWN_PROVIDER_FAILURE"] as const;
export type GeminiEmbeddingFailureCode = typeof GEMINI_EMBEDDING_FAILURE_CODES[number];
export type GeminiEmbeddingDiagnostic = Readonly<{ requestId: string; schemaId: string; schemaVersion: number; providerId: typeof GEMINI_EMBEDDING_PROVIDER; requestedModel: typeof GEMINI_EMBEDDING_MODEL; providerReportedModel: string | null; adapterVersion: number; sdkVersion: string; apiVersion: typeof GEMINI_EMBEDDING_API_VERSION; requestedDimension: typeof GEMINI_EMBEDDING_DIMENSION; purpose: KnowledgeEmbeddingPurpose; inputCount: number; totalCharacters: number; attempts: number; latencyMs: number; status: "COMPLETED" | "FAILED"; failureCode: GeminiEmbeddingFailureCode | null; usage: Readonly<{ inputTokens?: number; totalTokens?: number }> }>;

export const GEMINI_PLATFORM_KNOWLEDGE_EMBEDDING_SCHEMA: KnowledgeEmbeddingSchemaDefinition = Object.freeze({
  embeddingSchemaId: "YUDIJI_GEMINI_PLATFORM_KNOWLEDGE_EMBEDDING", embeddingSchemaVersion: 1,
  providerId: GEMINI_EMBEDDING_PROVIDER, providerVersion: GEMINI_EMBEDDING_PROVIDER_VERSION,
  modelId: GEMINI_EMBEDDING_MODEL, modelVersion: GEMINI_EMBEDDING_MODEL, vectorDimension: GEMINI_EMBEDDING_DIMENSION,
  similarityMetric: "COSINE", normalizationStrategyId: "L2_UNIT_VECTOR", normalizationStrategyVersion: 1,
  embeddingTextProjectorId: "PLATFORM_KNOWLEDGE_EMBEDDING_TEXT", embeddingTextProjectorVersion: 1,
  allowedCorpora: Object.freeze(["PLATFORM_KNOWLEDGE"] as const), allowedTrustLevels: Object.freeze(["AUTHORITATIVE", "APPROVED_GUIDANCE", "EXPLANATORY"] as const),
  allowedPurposes: Object.freeze(["RETRIEVAL_DOCUMENT", "RETRIEVAL_QUERY"] as const), activeForGeneration: true,
});
