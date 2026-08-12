import type { KnowledgeChunkCandidate, PersistedKnowledgeChunk } from "./knowledge-chunk.types.js";
import type { KnowledgeDocumentIdentity } from "./knowledge-document.types.js";

export type KnowledgeChunkSetManifestIdentity = Readonly<{
  chunkSetId: string;
  chunkSetVersion: number;
}>;

export type KnowledgeChunkSetStrategyIdentity = Readonly<{
  strategyId: string;
  strategyVersion: number;
}>;

export type KnowledgeChunkSetManifestEntry = Readonly<{
  ordinal: number;
  chunkId: string;
  chunkVersion: number;
  chunkDigest: string;
}>;

export type KnowledgeChunkSetManifestCommand = Readonly<{
  identity: KnowledgeChunkSetManifestIdentity;
  documentIdentity: KnowledgeDocumentIdentity;
  strategy: KnowledgeChunkSetStrategyIdentity;
  expectedChunkCount: number;
  orderedChunks: readonly KnowledgeChunkSetManifestEntry[];
  chunkSetDigest: string;
  publicationPolicy: Readonly<{ policyId: string; policyVersion: number }>;
}>;

export type PersistedKnowledgeChunkSetManifest = KnowledgeChunkSetManifestCommand & Readonly<{
  createdAt: Date;
}>;

export type KnowledgeChunkSetPublicationPolicy = Readonly<{
  policyId: string;
  policyVersion: number;
  maxChunkCount: number;
  requireDenseOrdinals: true;
  rejectUnexpectedChunks: true;
  requireExactDigestMatch: true;
}>;

export const KNOWLEDGE_CHUNK_SET_PUBLICATION_POLICY: KnowledgeChunkSetPublicationPolicy = Object.freeze({
  policyId: "KNOWLEDGE_CHUNK_SET_PUBLICATION",
  policyVersion: 1,
  maxChunkCount: 1_000,
  requireDenseOrdinals: true,
  rejectUnexpectedChunks: true,
  requireExactDigestMatch: true,
});

export const KNOWLEDGE_CHUNK_SET_BUILD_FAILURE_CODES = [
  "INVALID_MANIFEST_IDENTITY",
  "INVALID_DOCUMENT_IDENTITY",
  "INVALID_STRATEGY_IDENTITY",
  "EMPTY_SET",
  "COUNT_BOUND_EXCEEDED",
  "DUPLICATE_CHUNK_IDENTITY",
  "DUPLICATE_ORDINAL",
  "ORDINAL_GAP",
  "DOCUMENT_LINEAGE_MISMATCH",
  "STRATEGY_LINEAGE_MISMATCH",
  "INVALID_CHUNK_DIGEST",
  "CANONICALIZATION_FAILED",
] as const;
export type KnowledgeChunkSetBuildFailureCode = typeof KNOWLEDGE_CHUNK_SET_BUILD_FAILURE_CODES[number];

export type KnowledgeChunkSetManifestBuildResult =
  | Readonly<{ built: true; manifest: KnowledgeChunkSetManifestCommand }>
  | Readonly<{ built: false; code: KnowledgeChunkSetBuildFailureCode }>;

export type KnowledgeChunkSetManifestInsertResult =
  | Readonly<{ inserted: true; manifest: PersistedKnowledgeChunkSetManifest }>
  | Readonly<{
      inserted: false;
      code: "ALREADY_EXISTS" | "IDENTITY_CONFLICT" | "SET_IDENTITY_CONFLICT" | "CONTENT_CONFLICT" | "PERSISTENCE_FAILED" | "INVARIANT_VIOLATION";
      manifest?: PersistedKnowledgeChunkSetManifest;
    }>;

export type KnowledgeChunkSetManifestReadResult =
  | Readonly<{ found: true; manifest: PersistedKnowledgeChunkSetManifest }>
  | Readonly<{ found: false; code: "NOT_FOUND" | "PERSISTENCE_FAILED" | "INVARIANT_VIOLATION" }>;

export const KNOWLEDGE_CHUNK_SET_VERIFICATION_FAILURE_CODES = [
  "MANIFEST_NOT_FOUND",
  "CHUNK_MISSING",
  "UNEXPECTED_CHUNK",
  "COUNT_MISMATCH",
  "ORDINAL_MISMATCH",
  "CHUNK_DIGEST_MISMATCH",
  "SET_DIGEST_MISMATCH",
  "LINEAGE_MISMATCH",
  "INVARIANT_VIOLATION",
  "PERSISTENCE_FAILED",
] as const;
export type KnowledgeChunkSetVerificationFailureCode = typeof KNOWLEDGE_CHUNK_SET_VERIFICATION_FAILURE_CODES[number];

export type VerifiedKnowledgeChunkSet = Readonly<{
  manifest: PersistedKnowledgeChunkSetManifest;
  chunks: readonly PersistedKnowledgeChunk[];
}>;

export type KnowledgeChunkSetVerificationResult =
  | Readonly<{ verified: true; set: VerifiedKnowledgeChunkSet }>
  | Readonly<{ verified: false; code: KnowledgeChunkSetVerificationFailureCode }>;

export type KnowledgeChunkSetManifestBuildRequest = Readonly<{
  identity: KnowledgeChunkSetManifestIdentity;
  documentIdentity: KnowledgeDocumentIdentity;
  strategy: KnowledgeChunkSetStrategyIdentity;
  chunks: readonly KnowledgeChunkCandidate[];
}>;

