import type { KnowledgeLexicalSearchRequest, KnowledgeLexicalSearchResult } from "../types/knowledge-retrieval.types.js";
export type KnowledgeLexicalSearchPort = Readonly<{ search(request: KnowledgeLexicalSearchRequest): Promise<KnowledgeLexicalSearchResult> }>;
