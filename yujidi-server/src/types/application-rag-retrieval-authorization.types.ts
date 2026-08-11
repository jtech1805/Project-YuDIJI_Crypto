import type { RagRolloutMode } from "./template-draft-rag-runtime-binding.types.js";

export type ApplicationRagRetrievalAuthorization = Readonly<{
  authorizationId: "YUDIJI_TEMPLATE_DRAFT_RAG_APPLICATION_RETRIEVAL";
  authorizationVersion: 1;
  runtimeBindingId: "YUDIJI_TEMPLATE_DRAFT_RAG_RUNTIME";
  runtimeBindingVersion: 1;
  indexPublicationId: "YUDIJI_PLATFORM_KNOWLEDGE_GEMINI_ATLAS_PUBLICATION";
  indexPublicationVersion: 1;
  corpusPublicationId: string;
  corpusPublicationVersion: number;
  embeddingSchemaId: "YUDIJI_GEMINI_PLATFORM_KNOWLEDGE_EMBEDDING";
  embeddingSchemaVersion: 1;
  indexId: "YUDIJI_ATLAS_PLATFORM_KNOWLEDGE_GEMINI_768";
  indexVersion: 1;
  namespace: string;
  corpus: "PLATFORM_KNOWLEDGE";
  retrievalAllowed: true;
  ragGenerationAllowed: true;
  permittedRolloutModes: readonly Extract<
    RagRolloutMode,
    "SHADOW_ONLY" | "INTERNAL"
  >[];
}>;

export type ApplicationRagRetrievalAuthorizationRequest = Readonly<{
  authorizationId: string;
  authorizationVersion: number;
  runtimeBindingId: string;
  runtimeBindingVersion: number;
  indexPublicationId: string;
  indexPublicationVersion: number;
  corpusPublicationId: string;
  corpusPublicationVersion: number;
  embeddingSchemaId: string;
  embeddingSchemaVersion: number;
  indexId: string;
  indexVersion: number;
  namespace: string;
  corpus: string;
  rolloutMode: RagRolloutMode;
}>;

export type ApplicationRagRetrievalAuthorizationResult =
  | Readonly<{
      authorized: true;
      authorization: ApplicationRagRetrievalAuthorization;
    }>
  | Readonly<{
      authorized: false;
      code: "AUTHORIZATION_NOT_FOUND" | "AUTHORIZATION_MISMATCH";
    }>;
