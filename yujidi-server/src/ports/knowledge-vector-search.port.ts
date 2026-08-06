import type { KnowledgeVectorSearchRequest, KnowledgeVectorSearchResult } from "../types/knowledge-retrieval.types.js";
export type KnowledgeVectorSearchPort = Readonly<{ search(request: KnowledgeVectorSearchRequest): Promise<KnowledgeVectorSearchResult> }>;
