export const AI_PROVIDER_EXECUTION_STAGES = [
  "BASELINE_GENERATION",
  "QUERY_EMBEDDING",
  "VECTOR_RETRIEVAL",
  "RAG_GENERATION",
] as const;

export type AiProviderExecutionStage =
  (typeof AI_PROVIDER_EXECUTION_STAGES)[number];
