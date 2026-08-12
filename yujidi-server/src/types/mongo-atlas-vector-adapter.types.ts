import type { KnowledgeVectorIndexDefinition } from "./knowledge-vector-index-definition.types.js";

export const MONGO_ATLAS_VECTOR_FAILURE_CODES = [
  "AUTHENTICATION_FAILED", "PERMISSION_DENIED", "NETWORK_FAILED", "REQUEST_TIMEOUT", "CALLER_ABORTED", "PROVIDER_UNAVAILABLE",
  "DATABASE_NOT_FOUND", "COLLECTION_NOT_FOUND", "INDEX_NOT_FOUND", "INDEX_BUILDING", "INDEX_FAILED", "INDEX_SPECIFICATION_MISMATCH",
  "VECTOR_SEARCH_UNSUPPORTED", "INVALID_VECTOR", "DIMENSION_MISMATCH", "INVALID_FILTER", "FILTER_TOO_LARGE", "INVALID_LIMIT",
  "INVALID_NUM_CANDIDATES", "MALFORMED_RESULT", "DUPLICATE_CANDIDATE", "INVALID_SCORE", "RESULT_BOUND_EXCEEDED", "UNKNOWN_PROVIDER_FAILURE",
] as const;
export type MongoAtlasVectorFailureCode = typeof MONGO_ATLAS_VECTOR_FAILURE_CODES[number];
export type MongoAtlasVectorSearchMode = "ANN" | "ENN_VALIDATION";

export type MongoAtlasVectorAdapterConfigValue = Readonly<{
  providerId: "MONGODB_ATLAS_VECTOR_SEARCH"; adapterVersion: number;
  databaseName: string; collectionName: string; vectorIndexName: string; vectorPath: string;
  dimension: 768; similarityMetric: "COSINE"; requestTimeoutMs: number; totalDeadlineMs: number;
  maxWriteBatchSize: number; maxSearchLimit: number; maxNumCandidates: number; developmentValidationOnly: true;
}>;

export type MongoAtlasVectorIndexField = Readonly<{ type: "vector"; path: string; numDimensions: number; similarity: "cosine" }>
  | Readonly<{ type: "filter"; path: string }>;
export type MongoAtlasVectorIndexSpecification = Readonly<{
  name: string; type: "vectorSearch"; definition: Readonly<{ fields: readonly MongoAtlasVectorIndexField[] }>;
  digest: string; indexDefinition: KnowledgeVectorIndexDefinition;
}>;

export type MongoAtlasVectorIndexStatus = "INDEX_NOT_FOUND" | "INDEX_BUILDING" | "INDEX_QUERYABLE" | "INDEX_FAILED" | "INDEX_SPECIFICATION_MISMATCH" | "INDEX_STATUS_UNKNOWN";
export type MongoAtlasVectorIndexInspection = Readonly<{ status: MongoAtlasVectorIndexStatus; name: string; queryable: boolean; specificationDigest: string; providerStatus?: string }>;
export type MongoAtlasVectorIndexAdministrationResult = MongoAtlasVectorIndexInspection & Readonly<{ action: "INSPECTED" | "CREATED" | "ALREADY_EXISTS" | "NOT_PERFORMED"; failureCode?: MongoAtlasVectorFailureCode }>;

export type MongoAtlasVectorDiagnostic = Readonly<{
  indexId: string; indexVersion: number; namespace: string; atlasIndexName: string; mode: MongoAtlasVectorSearchMode;
  limit: number; numCandidates?: number; filterFieldCount: number; candidateCount: number; latencyMs: number; attemptCount: number;
  failureCode?: MongoAtlasVectorFailureCode;
}>;

export type MongoAtlasAggregateCollection = Readonly<{
  aggregate(pipeline: readonly Record<string, unknown>[], options?: Readonly<{ maxTimeMS?: number; signal?: AbortSignal }>): { toArray(): Promise<Record<string, unknown>[]> };
}>;
export type MongoAtlasSearchIndexCollection = Readonly<{
  listSearchIndexes(name?: string, options?: Readonly<{ maxTimeMS?: number }>): { toArray(): Promise<Record<string, unknown>[]> };
  createSearchIndex(specification: Readonly<{ name: string; type: "vectorSearch"; definition: Readonly<Record<string, unknown>> }>): Promise<string>;
}>;
