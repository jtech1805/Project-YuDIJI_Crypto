export const RAG_ROLLOUT_MODES = [
  "DISABLED",
  "SHADOW_ONLY",
  "INTERNAL",
  "LIMITED_PRODUCTION",
] as const;
export type RagRolloutMode = (typeof RAG_ROLLOUT_MODES)[number];
export type TemplateDraftRagRuntimeBinding = Readonly<{
  bindingId: string;
  bindingVersion: number;
  indexPublicationId: string;
  indexPublicationVersion: number;
  retrievalPolicyId: string;
  retrievalPolicyVersion: number;
  promptId: string;
  promptVersion: number;
  candidateSchemaId: "TEMPLATE_DRAFT_CANDIDATE";
  candidateSchemaVersion: number;
  generationProvider: string;
  generationModel: string;
  embeddingSchemaId: string;
  embeddingSchemaVersion: number;
  executionPolicyId: string;
  executionPolicyVersion: number;
  rolloutMode: RagRolloutMode;
  corpus: "PLATFORM_KNOWLEDGE";
}>;
