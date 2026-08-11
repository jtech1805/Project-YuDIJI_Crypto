import { isDeepStrictEqual } from "node:util";
import type {
  ApplicationRagRetrievalAuthorization,
  ApplicationRagRetrievalAuthorizationRequest,
  ApplicationRagRetrievalAuthorizationResult,
} from "../types/application-rag-retrieval-authorization.types.js";
import { freezeClone } from "./knowledge-document-admission.service.js";

export const TEMPLATE_DRAFT_APPLICATION_RETRIEVAL_AUTHORIZATION: ApplicationRagRetrievalAuthorization =
  Object.freeze({
    authorizationId: "YUDIJI_TEMPLATE_DRAFT_RAG_APPLICATION_RETRIEVAL",
    authorizationVersion: 1,
    runtimeBindingId: "YUDIJI_TEMPLATE_DRAFT_RAG_RUNTIME",
    runtimeBindingVersion: 1,
    indexPublicationId: "YUDIJI_PLATFORM_KNOWLEDGE_GEMINI_ATLAS_PUBLICATION",
    indexPublicationVersion: 1,
    corpusPublicationId: "YUDIJI_PLATFORM_KNOWLEDGE_DEVELOPMENT_PUBLICATION",
    corpusPublicationVersion: 1,
    embeddingSchemaId: "YUDIJI_GEMINI_PLATFORM_KNOWLEDGE_EMBEDDING",
    embeddingSchemaVersion: 1,
    namespace: "YUDIJI:PLATFORM_KNOWLEDGE:ATLAS:GEMINI_768:V1",
    corpus: "PLATFORM_KNOWLEDGE",
    permittedRolloutModes: Object.freeze(["SHADOW_ONLY", "INTERNAL"] as const),
  });

export class ApplicationRagRetrievalAuthorizationService {
  public authorize(
    request: ApplicationRagRetrievalAuthorizationRequest,
  ): ApplicationRagRetrievalAuthorizationResult {
    if (
      request.authorizationId !==
        TEMPLATE_DRAFT_APPLICATION_RETRIEVAL_AUTHORIZATION.authorizationId ||
      request.authorizationVersion !== 1
    ) {
      return Object.freeze({
        authorized: false,
        code: "AUTHORIZATION_NOT_FOUND",
      });
    }
    const authority = TEMPLATE_DRAFT_APPLICATION_RETRIEVAL_AUTHORIZATION;
    const exact = {
      authorizationId: authority.authorizationId,
      authorizationVersion: authority.authorizationVersion,
      runtimeBindingId: authority.runtimeBindingId,
      runtimeBindingVersion: authority.runtimeBindingVersion,
      indexPublicationId: authority.indexPublicationId,
      indexPublicationVersion: authority.indexPublicationVersion,
      corpusPublicationId: authority.corpusPublicationId,
      corpusPublicationVersion: authority.corpusPublicationVersion,
      embeddingSchemaId: authority.embeddingSchemaId,
      embeddingSchemaVersion: authority.embeddingSchemaVersion,
      namespace: authority.namespace,
      corpus: authority.corpus,
      rolloutMode: request.rolloutMode,
    };
    if (
      !authority.permittedRolloutModes.includes(
        request.rolloutMode as "SHADOW_ONLY" | "INTERNAL",
      ) ||
      !isDeepStrictEqual(request, exact)
    ) {
      return Object.freeze({
        authorized: false,
        code: "AUTHORIZATION_MISMATCH",
      });
    }
    return freezeClone({ authorized: true, authorization: authority });
  }
}
