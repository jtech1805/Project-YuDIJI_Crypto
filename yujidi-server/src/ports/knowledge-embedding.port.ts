import type { KnowledgeEmbeddingProviderRequest, KnowledgeEmbeddingProviderResult } from "../types/knowledge-embedding.types.js";

export type KnowledgeEmbeddingPort = Readonly<{
  embed(request: KnowledgeEmbeddingProviderRequest): Promise<KnowledgeEmbeddingProviderResult>;
}>;

