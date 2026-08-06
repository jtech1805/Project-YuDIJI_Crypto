import type { KnowledgeChunkIdentity, KnowledgeChunkMetadata } from "./knowledge-chunk.types.js";
import type { KnowledgeEmbeddingIdentity, KnowledgeEmbeddingSchemaIdentity, KnowledgeSimilarityMetric } from "./knowledge-embedding.types.js";
import type { KnowledgeCorpus, KnowledgeDocumentIdentity, KnowledgeTrustLevel, PlatformKnowledgeDocumentType } from "./knowledge-document.types.js";
import type { KnowledgeVectorIndexDefinitionIdentity } from "./knowledge-vector-index-definition.types.js";

export type KnowledgeRetrievalPolicyIdentity = Readonly<{ policyId: string; policyVersion: number }>;
export type KnowledgeScoreRange = Readonly<{ minimum: number; maximum: number; clamp: boolean }>;
export type KnowledgeRetrievalPolicy = KnowledgeRetrievalPolicyIdentity & Readonly<{
  allowedCorpora: readonly KnowledgeCorpus[]; allowedTrustLevels: readonly KnowledgeTrustLevel[];
  maxQueryCharacters: number; maxQueryConcepts: number; maxEligibleDocuments: number;
  vectorCandidateLimit: number; lexicalCandidateLimit: number; finalTopK: number;
  vectorWeight: number; lexicalWeight: number; metadataMatchWeight: number; trustWeight: number;
  vectorScoreRange: KnowledgeScoreRange; lexicalScoreRange: KnowledgeScoreRange;
  trustScores: Readonly<Partial<Record<KnowledgeTrustLevel, number>>>;
  maxChunksPerDocument: number; maxParentChunks: number; maxSiblingChunks: number;
  contextCharacterBudget: number; maxPassageCharacters: number;
  includeVectorSearch: boolean; includeLexicalSearch: boolean; includeParentContext: boolean; includeSiblingContext: boolean;
  excludeSupersededMembers: boolean;
  vectorFailureFallback: "FAIL" | "LEXICAL_ONLY"; lexicalFailureFallback: "FAIL" | "VECTOR_ONLY";
  noContextBehavior: "NO_CONTEXT" | "COMPLETED_EMPTY";
}>;

export type KnowledgeRetrievalFilters = Readonly<{
  factorKeys?: readonly string[]; relationshipTypes?: readonly string[]; subjectTypes?: readonly string[];
  topics?: readonly string[]; validationCodes?: readonly string[]; adrNumbers?: readonly string[];
  exampleClassifications?: readonly string[];
}>;
export type KnowledgeRetrievalRequest = Readonly<{
  requestId: string; requestVersion: number;
  query: Readonly<{ text: string; concepts: readonly string[] }>;
  scope: Readonly<{ corpus: "PLATFORM_KNOWLEDGE"; trustLevels: readonly KnowledgeTrustLevel[]; documentTypes?: readonly PlatformKnowledgeDocumentType[] }>;
  filters?: KnowledgeRetrievalFilters;
  embeddingSchema: KnowledgeEmbeddingSchemaIdentity; vectorIndex: KnowledgeVectorIndexDefinitionIdentity;
  retrievalPolicy: KnowledgeRetrievalPolicyIdentity; eligibleDocuments: readonly KnowledgeDocumentIdentity[];
  asOf: Date;
}>;
export type KnowledgeQueryTextProjection = Readonly<{ projectorId: string; projectorVersion: number; text: string; textDigest: string; characterCount: number }>;

export type KnowledgeVectorSearchRequest = Readonly<{
  index: KnowledgeVectorIndexDefinitionIdentity; namespace: string;
  indexSchema: Readonly<{ indexSchemaId: string; indexSchemaVersion: number }>;
  queryVector: readonly number[]; vectorDimension: number; metric: KnowledgeSimilarityMetric; candidateLimit: number;
  corpus: "PLATFORM_KNOWLEDGE"; trustLevels: readonly KnowledgeTrustLevel[]; documentTypes?: readonly PlatformKnowledgeDocumentType[];
  filters?: KnowledgeRetrievalFilters; eligibleDocuments: readonly KnowledgeDocumentIdentity[];
}>;
export type KnowledgeUntrustedVectorCandidate = Readonly<{
  indexEntryId: string; indexEntryVersion: number; namespace: string; embeddingIdentity: KnowledgeEmbeddingIdentity;
  documentIdentity: KnowledgeDocumentIdentity; chunkIdentity: KnowledgeChunkIdentity; score: number;
  documentDigest?: string; chunkDigest: string; vectorDigest: string; metadata: KnowledgeChunkMetadata;
}>;
export type KnowledgeVectorSearchResult = Readonly<{
  status: "COMPLETED" | "NO_CANDIDATES" | "VALIDATION_FAILED" | "INDEX_NOT_FOUND" | "INDEX_INELIGIBLE" | "NAMESPACE_MISMATCH" | "DIMENSION_MISMATCH" | "METRIC_NOT_SUPPORTED" | "SEARCH_FAILED";
  candidates: readonly KnowledgeUntrustedVectorCandidate[]; failureCode?: string;
}>;

export type KnowledgeLexicalSearchDocument = Readonly<{ documentId: string; documentVersion: number; title: string; documentType: PlatformKnowledgeDocumentType; trustLevel: KnowledgeTrustLevel }>;
export type KnowledgeLexicalSearchChunk = Readonly<{ document: KnowledgeLexicalSearchDocument; chunkIdentity: KnowledgeChunkIdentity; content: string; metadata: KnowledgeChunkMetadata }>;
export type KnowledgeLexicalSearchRequest = Readonly<{
  queryText: string; concepts: readonly string[]; candidateLimit: number; filters?: KnowledgeRetrievalFilters;
  eligibleDocuments: readonly KnowledgeDocumentIdentity[];
}>; 
export type KnowledgeUntrustedLexicalCandidate = Readonly<{ documentIdentity: KnowledgeDocumentIdentity; chunkIdentity: KnowledgeChunkIdentity; score: number; matchedFilters: readonly string[] }>;
export type KnowledgeLexicalSearchResult = Readonly<{ status: "COMPLETED" | "NO_CANDIDATES" | "VALIDATION_FAILED" | "SEARCH_FAILED"; candidates: readonly KnowledgeUntrustedLexicalCandidate[]; failureCode?: string }>;

export type KnowledgeCandidateSource = Readonly<{ type: "VECTOR"; rawScore: number; indexEntryId: string; indexEntryVersion: number; embeddingIdentity: KnowledgeEmbeddingIdentity; indexedChunkDigest: string; indexedVectorDigest: string; indexedDocumentDigest?: string }> | Readonly<{ type: "LEXICAL"; rawScore: number }>;
export type KnowledgeRetrievalCandidate = Readonly<{ documentIdentity: KnowledgeDocumentIdentity; chunkIdentity: KnowledgeChunkIdentity; sources: readonly KnowledgeCandidateSource[]; matchedFilters: readonly string[] }>;
export const KNOWLEDGE_RETRIEVAL_EXCLUSION_CODES = ["DOCUMENT_NOT_ELIGIBLE","DOCUMENT_NOT_FOUND","DOCUMENT_OUTSIDE_EFFECTIVE_TIME","DOCUMENT_SUPERSEDED","MANIFEST_NOT_FOUND","CHUNK_SET_INCOMPLETE","CHUNK_NOT_FOUND","UNEXPECTED_CHUNK","DOCUMENT_DIGEST_MISMATCH","CHUNK_DIGEST_MISMATCH","EMBEDDING_NOT_FOUND","EMBEDDING_LINEAGE_MISMATCH","VECTOR_DIGEST_MISMATCH","INDEX_LINEAGE_MISMATCH","CORPUS_MISMATCH","TRUST_MISMATCH","DOCUMENT_TYPE_MISMATCH","METADATA_FILTER_MISMATCH","SOURCE_SPAN_INVALID","DUPLICATE_CANDIDATE","PER_DOCUMENT_LIMIT","CONTEXT_BUDGET_EXCLUDED"] as const;
export type KnowledgeRetrievalExclusionCode = typeof KNOWLEDGE_RETRIEVAL_EXCLUSION_CODES[number];
export type KnowledgeRetrievalExclusion = Readonly<{ code: KnowledgeRetrievalExclusionCode; documentIdentity: KnowledgeDocumentIdentity; chunkIdentity?: KnowledgeChunkIdentity; sourceTypes: readonly ("VECTOR" | "LEXICAL")[] }>;
export type ValidatedKnowledgeRetrievalCandidate = Readonly<{ candidate: KnowledgeRetrievalCandidate; document: import("./knowledge-document.types.js").PersistedKnowledgeDocument; chunk: import("./knowledge-chunk.types.js").PersistedKnowledgeChunk; verifiedChunks: readonly import("./knowledge-chunk.types.js").PersistedKnowledgeChunk[]; chunkSetIdentity: import("./knowledge-chunk-set-manifest.types.js").KnowledgeChunkSetManifestIdentity }>;
export type RankedKnowledgeRetrievalCandidate = ValidatedKnowledgeRetrievalCandidate & Readonly<{ ranking: Readonly<{ finalScore: number; vectorScore?: number; lexicalScore?: number; metadataScore: number; trustScore: number }> }>;

export type KnowledgeRetrievalResult = Readonly<{
  status: "COMPLETED" | "PARTIAL" | "NO_CONTEXT" | "FEATURE_DISABLED" | "VALIDATION_FAILED" | "EMBEDDING_SCHEMA_NOT_FOUND" | "INDEX_DEFINITION_NOT_FOUND" | "INDEX_INELIGIBLE" | "QUERY_EMBEDDING_FAILED" | "VECTOR_SEARCH_FAILED" | "LEXICAL_SEARCH_FAILED" | "CANDIDATE_VALIDATION_FAILED" | "CONTEXT_BUDGET_EXHAUSTED" | "CITATION_ASSEMBLY_FAILED" | "INVARIANT_VIOLATION";
  context: import("./knowledge-context.types.js").KnowledgeRetrievalContext | null; failureCode?: string;
  summary: Readonly<{ eligibleDocumentCount: number; vectorCandidateCount: number; lexicalCandidateCount: number; validatedCandidateCount: number; selectedPassageCount: number; excludedCount: number }>;
}>;
