import type { KnowledgeEmbeddingSchemaIdentity, KnowledgeSimilarityMetric } from "./knowledge-embedding.types.js";
import type { KnowledgeCorpus, KnowledgeTrustLevel } from "./knowledge-document.types.js";

export type KnowledgeVectorIndexDefinitionIdentity = Readonly<{ indexId: string; indexVersion: number }>;
export type KnowledgeVectorIndexDefinition = KnowledgeVectorIndexDefinitionIdentity & Readonly<{
  indexSchemaId: string;
  indexSchemaVersion: number;
  namespace: string;
  corpus: KnowledgeCorpus;
  allowedTrustLevels: readonly KnowledgeTrustLevel[];
  embeddingSchema: KnowledgeEmbeddingSchemaIdentity;
  vectorDimension: number;
  similarityMetric: KnowledgeSimilarityMetric;
  metadataSchemaId: string;
  metadataSchemaVersion: number;
  writePolicyId: string;
  writePolicyVersion: number;
  retrievalEligible: boolean;
}>;

