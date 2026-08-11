import type {
  KnowledgeVectorSearchRequest,
  KnowledgeVectorSearchResult,
} from "../types/knowledge-retrieval.types.js";
export type KnowledgeVectorSearchPort = Readonly<{
  search(
    request: KnowledgeVectorSearchRequest,
    execution?: Readonly<{ signal: AbortSignal }>,
  ): Promise<KnowledgeVectorSearchResult>;
}>;
