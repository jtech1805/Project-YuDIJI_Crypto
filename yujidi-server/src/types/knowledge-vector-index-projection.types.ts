import type { KnowledgeChunkType, KnowledgeExampleClassification } from "./knowledge-chunk.types.js";
import type { KnowledgeTrustLevel, PlatformKnowledgeDocumentType } from "./knowledge-document.types.js";

export type KnowledgeVectorIndexProjectionIdentity = Readonly<{
  indexEntryId: string;
  indexEntryVersion: number;
}>;

export type KnowledgeVectorSearchableMetadata = Readonly<{
  documentType: PlatformKnowledgeDocumentType;
  chunkType: KnowledgeChunkType;
  factors: readonly Readonly<{ factorKey: string; factorVersion: number }>[];
  relationshipTypes: readonly string[];
  subjectTypes: readonly string[];
  topics: readonly string[];
  validationCodes: readonly string[];
  exampleClassification?: KnowledgeExampleClassification;
  adr?: Readonly<{ number: number; status: string }>;
  effectiveFrom?: Date;
  effectiveUntil?: Date;
}>;

export type CreateKnowledgeVectorIndexProjectionInput = Readonly<{
  identity: KnowledgeVectorIndexProjectionIdentity;
  indexDefinitionIdentity: Readonly<{ indexId: string; indexVersion: number }>;
  namespace: string;
  metadataSchema: Readonly<{ metadataSchemaId: string; metadataSchemaVersion: number }>;
  embeddingIdentity: Readonly<{ embeddingId: string; embeddingVersion: number }>;
  embeddingSchema: Readonly<{ embeddingSchemaId: string; embeddingSchemaVersion: number }>;
  purpose: "RETRIEVAL_DOCUMENT";
  normalizationStrategy: Readonly<{ normalizationStrategyId: string; normalizationStrategyVersion: number }>;
  vectorDimension: number;
  similarityMetric: "COSINE";
  vectorDigest: string;
  vector: readonly number[];
  documentIdentity: Readonly<{ documentId: string; documentVersion: number }>;
  chunkSetIdentity: Readonly<{ chunkSetId: string; chunkSetVersion: number }>;
  chunkIdentity: Readonly<{ chunkId: string; chunkVersion: number }>;
  chunkDigest: string;
  corpus: "PLATFORM_KNOWLEDGE";
  trustLevel: KnowledgeTrustLevel;
  searchableMetadata: KnowledgeVectorSearchableMetadata;
}>;

export type KnowledgeVectorIndexProjectionCommand = CreateKnowledgeVectorIndexProjectionInput & Readonly<{
  projectionDigest: string;
}>;

export type PersistedKnowledgeVectorIndexProjection = KnowledgeVectorIndexProjectionCommand & Readonly<{
  createdAt: Date;
}>;

export type KnowledgeVectorIndexProjectionReadResult =
  | Readonly<{ found: true; projection: PersistedKnowledgeVectorIndexProjection }>
  | Readonly<{ found: false; code: "NOT_FOUND" | "INVARIANT_VIOLATION" | "PERSISTENCE_FAILED" }>;

export type KnowledgeVectorIndexProjectionInsertResult =
  | Readonly<{ status: "CREATED" | "ALREADY_EXISTS"; projection: PersistedKnowledgeVectorIndexProjection }>
  | Readonly<{ status: "CONFLICT" | "INVARIANT_VIOLATION" | "PERSISTENCE_FAILED" }>;

export type KnowledgeVectorIndexProjectionServiceResult =
  | KnowledgeVectorIndexProjectionInsertResult
  | Readonly<{ status: "VALIDATION_FAILED"; failureCode: string }>;
