import type { KnowledgeChunkIdentity } from "./knowledge-chunk.types.js";
import type { KnowledgeChunkSetManifestIdentity, KnowledgeChunkSetStrategyIdentity } from "./knowledge-chunk-set-manifest.types.js";
import type { KnowledgeCorpus, KnowledgeDocumentIdentity, KnowledgeTrustLevel } from "./knowledge-document.types.js";

export const KNOWLEDGE_SIMILARITY_METRICS = ["COSINE", "DOT_PRODUCT", "EUCLIDEAN"] as const;
export type KnowledgeSimilarityMetric = typeof KNOWLEDGE_SIMILARITY_METRICS[number];

export type KnowledgeEmbeddingIdentity = Readonly<{
  embeddingId: string;
  embeddingVersion: number;
}>;

export type KnowledgeEmbeddingSchemaIdentity = Readonly<{
  embeddingSchemaId: string;
  embeddingSchemaVersion: number;
}>;

export type KnowledgeEmbeddingSchemaDefinition = KnowledgeEmbeddingSchemaIdentity & Readonly<{
  providerId: string;
  providerVersion: number;
  modelId: string;
  modelVersion: string;
  vectorDimension: number;
  similarityMetric: KnowledgeSimilarityMetric;
  normalizationStrategyId: string;
  normalizationStrategyVersion: number;
  embeddingTextProjectorId: string;
  embeddingTextProjectorVersion: number;
  allowedCorpora: readonly KnowledgeCorpus[];
  allowedTrustLevels: readonly KnowledgeTrustLevel[];
  activeForGeneration: boolean;
}>;

export type KnowledgeEmbeddingGenerationPolicy = Readonly<{
  policyId: string;
  policyVersion: number;
  allowedCorpora: readonly KnowledgeCorpus[];
  allowedTrustLevels: readonly KnowledgeTrustLevel[];
  maxBatchSize: number;
  maxTextCharactersPerChunk: number;
  maxTotalCharactersPerBatch: number;
  requireManifestVerifiedChunkSet: true;
  requireExactChunkDigest: true;
}>;

export const KNOWLEDGE_EMBEDDING_GENERATION_POLICY: KnowledgeEmbeddingGenerationPolicy = Object.freeze({
  policyId: "PLATFORM_KNOWLEDGE_EMBEDDING_GENERATION",
  policyVersion: 1,
  allowedCorpora: Object.freeze(["PLATFORM_KNOWLEDGE"] as const),
  allowedTrustLevels: Object.freeze(["AUTHORITATIVE", "APPROVED_GUIDANCE", "EXPLANATORY"] as const),
  maxBatchSize: 100,
  maxTextCharactersPerChunk: 30_000,
  maxTotalCharactersPerBatch: 500_000,
  requireManifestVerifiedChunkSet: true,
  requireExactChunkDigest: true,
});

export type KnowledgeEmbeddingTextProjection = Readonly<{
  projectorId: string;
  projectorVersion: number;
  chunkIdentity: KnowledgeChunkIdentity;
  text: string;
  textDigest: string;
  characterCount: number;
}>;

export type KnowledgeEmbeddingProviderRequest = Readonly<{
  requestId: string;
  requestVersion: number;
  schemaIdentity: KnowledgeEmbeddingSchemaIdentity;
  providerIdentity: Readonly<{ providerId: string; providerVersion: number }>;
  modelIdentity: Readonly<{ modelId: string; modelVersion: string }>;
  inputs: readonly Readonly<{
    inputId: string;
    chunkId: string;
    chunkVersion: number;
    text: string;
    textDigest: string;
  }>[];
}>;

export type KnowledgeEmbeddingProviderResult =
  | Readonly<{
      status: "COMPLETED";
      providerId: string;
      providerVersion: number;
      modelId: string;
      modelVersion: string;
      vectors: readonly Readonly<{ inputId: string; values: readonly number[] }>[];
      usage?: Readonly<{ inputCount: number; totalCharacters?: number }>;
    }>
  | Readonly<{ status: "FAILED"; failureCode: string }>;

export type KnowledgeEmbeddingCommand = Readonly<{
  identity: KnowledgeEmbeddingIdentity;
  chunkSetIdentity: KnowledgeChunkSetManifestIdentity;
  documentIdentity: KnowledgeDocumentIdentity;
  chunkIdentity: KnowledgeChunkIdentity;
  chunkContentDigest: string;
  embeddingTextProjector: Readonly<{ projectorId: string; projectorVersion: number }>;
  embeddingTextDigest: string;
  provider: Readonly<{ providerId: string; providerVersion: number }>;
  model: Readonly<{ modelId: string; modelVersion: string }>;
  embeddingSchema: KnowledgeEmbeddingSchemaIdentity;
  normalizationStrategy: Readonly<{ normalizationStrategyId: string; normalizationStrategyVersion: number }>;
  vectorDimension: number;
  vector: readonly number[];
  vectorDigest: string;
  corpus: KnowledgeCorpus;
  trustLevel: KnowledgeTrustLevel;
}>;

export type PersistedKnowledgeEmbedding = KnowledgeEmbeddingCommand & Readonly<{ createdAt: Date }>;

export type KnowledgeEmbeddingInsertResult =
  | Readonly<{ inserted: true; embedding: PersistedKnowledgeEmbedding }>
  | Readonly<{
      inserted: false;
      code: "ALREADY_EXISTS" | "IDENTITY_CONFLICT" | "LINEAGE_CONFLICT" | "CONTENT_CONFLICT" | "PERSISTENCE_FAILED" | "INVARIANT_VIOLATION";
      embedding?: PersistedKnowledgeEmbedding;
    }>;

export type KnowledgeEmbeddingReadResult =
  | Readonly<{ found: true; embedding: PersistedKnowledgeEmbedding }>
  | Readonly<{ found: false; code: "NOT_FOUND" | "PERSISTENCE_FAILED" | "INVARIANT_VIOLATION" }>;

export type KnowledgeEmbeddingListResult =
  | Readonly<{ found: true; embeddings: readonly PersistedKnowledgeEmbedding[] }>
  | Readonly<{ found: false; code: "NOT_FOUND" | "PERSISTENCE_FAILED" | "INVARIANT_VIOLATION" }>;

export type KnowledgeEmbeddingGenerationRequest = Readonly<{
  requestId: string;
  requestVersion: number;
  documentIdentity: KnowledgeDocumentIdentity;
  strategy: KnowledgeChunkSetStrategyIdentity;
  chunkSetIdentity: KnowledgeChunkSetManifestIdentity;
  schemaIdentity: KnowledgeEmbeddingSchemaIdentity;
  embeddings: readonly Readonly<{ chunkIdentity: KnowledgeChunkIdentity; embeddingIdentity: KnowledgeEmbeddingIdentity }>[];
}>;

export type KnowledgeEmbeddingGenerationResult = Readonly<{
  status: "COMPLETED" | "PARTIAL" | "VALIDATION_FAILED" | "SCHEMA_NOT_FOUND" | "SCHEMA_INACTIVE" | "CHUNK_SET_NOT_FOUND" | "CHUNK_SET_NOT_COMPLETE" | "CHUNK_LINEAGE_MISMATCH" | "CHUNK_DIGEST_MISMATCH" | "CORPUS_NOT_ALLOWED" | "TRUST_NOT_ALLOWED" | "BATCH_LIMIT_EXCEEDED" | "PROVIDER_FAILED" | "PROVIDER_OUTPUT_INVALID" | "PERSISTENCE_FAILED" | "INVARIANT_VIOLATION";
  embeddings: readonly Readonly<{ identity: KnowledgeEmbeddingIdentity; chunkIdentity: KnowledgeChunkIdentity; outcome: "CREATED" | "ALREADY_EXISTS" | "FAILED"; code?: string }>[];
  summary: Readonly<{ requested: number; created: number; existing: number; failed: number; totalCharacters: number; vectorDimension: number | null }>;
  failureCode?: string;
}>;

