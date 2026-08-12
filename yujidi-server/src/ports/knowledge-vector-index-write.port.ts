import type { KnowledgeVectorIndexWriteRequest, KnowledgeVectorIndexWriteResult } from "../types/knowledge-vector-index-write.types.js";

export type KnowledgeVectorIndexWritePort = Readonly<{
  write(request: KnowledgeVectorIndexWriteRequest): Promise<KnowledgeVectorIndexWriteResult>;
}>;

