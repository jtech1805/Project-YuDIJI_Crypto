import type { KnowledgeEmbeddingIdentity, KnowledgeEmbeddingSchemaIdentity } from "./knowledge-embedding.types.js";
import type { KnowledgeVectorIndexDefinitionIdentity } from "./knowledge-vector-index-definition.types.js";
import type { KnowledgeChunkIdentity, KnowledgeChunkMetadata, KnowledgeChunkType } from "./knowledge-chunk.types.js";
import type { KnowledgeChunkSetManifestIdentity } from "./knowledge-chunk-set-manifest.types.js";
import type { KnowledgeCorpus, KnowledgeDocumentIdentity, KnowledgeSourceSpan, KnowledgeTrustLevel, PlatformKnowledgeDocumentType } from "./knowledge-document.types.js";

export type KnowledgeVectorIndexEntryIdentity = Readonly<{ indexEntryId: string; indexEntryVersion: number }>;
export type KnowledgeVectorIndexEntry = Readonly<{
  identity: KnowledgeVectorIndexEntryIdentity;
  indexDefinitionIdentity: KnowledgeVectorIndexDefinitionIdentity;
  namespace: string;
  embeddingIdentity: KnowledgeEmbeddingIdentity;
  embeddingSchema: KnowledgeEmbeddingSchemaIdentity;
  vectorDigest: string;
  vector: readonly number[];
  documentIdentity: KnowledgeDocumentIdentity;
  chunkSetIdentity: KnowledgeChunkSetManifestIdentity;
  chunkIdentity: KnowledgeChunkIdentity;
  chunkDigest: string;
  corpus: KnowledgeCorpus;
  trustLevel: KnowledgeTrustLevel;
  documentType: PlatformKnowledgeDocumentType;
  chunkType: KnowledgeChunkType;
  metadata: KnowledgeChunkMetadata;
  sourceSpan: KnowledgeSourceSpan;
}>;

export type KnowledgeVectorIndexWriteRequest = Readonly<{
  requestId: string;
  requestVersion: number;
  indexDefinitionIdentity: KnowledgeVectorIndexDefinitionIdentity;
  namespace: string;
  indexSchema: Readonly<{ indexSchemaId: string; indexSchemaVersion: number }>;
  entries: readonly KnowledgeVectorIndexEntry[];
}>;

export type KnowledgeVectorIndexWriteResult =
  | Readonly<{ status: "COMPLETED"; acceptedEntryIds: readonly string[]; existingEntryIds: readonly string[] }>
  | Readonly<{ status: "FAILED" | "PARTIAL"; failureCode: string; acceptedEntryIds: readonly string[]; rejectedEntryIds: readonly string[] }>;

export type KnowledgeVectorIndexingRequest = Readonly<{
  requestId: string;
  requestVersion: number;
  indexDefinitionIdentity: KnowledgeVectorIndexDefinitionIdentity;
  entries: readonly Readonly<{ entryIdentity: KnowledgeVectorIndexEntryIdentity; embeddingIdentity: KnowledgeEmbeddingIdentity }>[];
}>;

export type KnowledgeVectorIndexingResult = Readonly<{
  status: "COMPLETED" | "PARTIAL" | "VALIDATION_FAILED" | "INDEX_DEFINITION_NOT_FOUND" | "INDEX_DEFINITION_INACTIVE" | "EMBEDDING_NOT_FOUND" | "EMBEDDING_SCHEMA_MISMATCH" | "VECTOR_DIMENSION_MISMATCH" | "CORPUS_NOT_ALLOWED" | "TRUST_NOT_ALLOWED" | "CHUNK_SET_NOT_COMPLETE" | "LINEAGE_MISMATCH" | "VECTOR_WRITE_FAILED" | "PROVIDER_RESULT_INVALID" | "INVARIANT_VIOLATION";
  acceptedEntryIds: readonly string[];
  rejectedEntryIds: readonly string[];
  failureCode?: string;
}>;
