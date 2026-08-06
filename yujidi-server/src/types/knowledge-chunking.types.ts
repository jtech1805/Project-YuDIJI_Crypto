import type { PersistedKnowledgeDocument, PlatformKnowledgeDocumentType } from "./knowledge-document.types.js";
import type { KnowledgeChunkCandidate, PersistedKnowledgeChunk } from "./knowledge-chunk.types.js";
import type { PersistedKnowledgeChunkSetManifest, KnowledgeChunkSetManifestIdentity, KnowledgeChunkSetVerificationFailureCode } from "./knowledge-chunk-set-manifest.types.js";

export type KnowledgeChunkingStrategy = Readonly<{
  strategyId: string; strategyVersion: number; supportedDocumentTypes: readonly PlatformKnowledgeDocumentType[];
  chunk(document: PersistedKnowledgeDocument): readonly KnowledgeChunkCandidate[];
}>;
export type KnowledgeChunkValidationPolicy = Readonly<{ maxChunks: number; maxChunkCharacters: number; requireDenseOrdinals: true }>;
export const KNOWLEDGE_CHUNK_VALIDATION_POLICY: KnowledgeChunkValidationPolicy = Object.freeze({ maxChunks: 1_000, maxChunkCharacters: 30_000, requireDenseOrdinals: true });
export const KNOWLEDGE_CHUNK_VALIDATION_FAILURE_CODES = ["EMPTY_SET", "DUPLICATE_IDENTITY", "DUPLICATE_ORDINAL", "NON_DENSE_ORDINALS", "DOCUMENT_LINEAGE_MISMATCH", "STRATEGY_LINEAGE_MISMATCH", "INVALID_CHUNK", "INVALID_SPAN", "MISSING_PARENT", "PARENT_CYCLE", "PARENT_SPAN_MISMATCH", "BOUNDS_EXCEEDED", "DIGEST_MISMATCH"] as const;
export type KnowledgeChunkValidationFailureCode = typeof KNOWLEDGE_CHUNK_VALIDATION_FAILURE_CODES[number];
export type KnowledgeChunkValidationResult = Readonly<{ valid: true; chunks: readonly KnowledgeChunkCandidate[] }> | Readonly<{ valid: false; code: KnowledgeChunkValidationFailureCode }>;
export type KnowledgeChunkPublicationRequest = Readonly<{
  strategyId: string;
  strategyVersion: number;
  manifestIdentity: KnowledgeChunkSetManifestIdentity;
}>;
export type KnowledgeChunkingServiceResult =
  | Readonly<{
      status: "CREATED" | "ALREADY_EXISTS";
      manifest: PersistedKnowledgeChunkSetManifest;
      chunks: readonly PersistedKnowledgeChunk[];
      completenessVerified: true;
    }>
  | Readonly<{
      status: "STRATEGY_NOT_FOUND" | "STRATEGY_INCOMPATIBLE" | "CHUNKING_FAILED" | "VALIDATION_FAILED" | "MANIFEST_BUILD_FAILED" | "CONTENT_CONFLICT" | "SET_IDENTITY_CONFLICT" | "PERSISTENCE_FAILED" | "INVARIANT_VIOLATION" | "COMPLETENESS_VERIFICATION_FAILED";
      code?: KnowledgeChunkValidationFailureCode | KnowledgeChunkSetVerificationFailureCode | string;
    }>;
