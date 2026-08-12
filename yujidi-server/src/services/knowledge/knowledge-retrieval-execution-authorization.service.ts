import { isDeepStrictEqual } from "node:util";
import { KnowledgeRetrievalExecutionAuthorizationRegistry } from "../../registries/knowledge-retrieval-execution-authorization.registry.js";
import type {
  KnowledgeRetrievalExecutionAuthorization,
  KnowledgeRetrievalExecutionAuthorizationRequest,
  KnowledgeRetrievalExecutionAuthorizationResult,
} from "../../types/knowledge-retrieval-execution-authorization.types.js";
import { freezeClone } from "./knowledge-document-admission.service.js";
export class KnowledgeRetrievalExecutionAuthorizationService {
  public constructor(
    private readonly registry = new KnowledgeRetrievalExecutionAuthorizationRegistry(),
  ) {}
  public authorize(
    request: KnowledgeRetrievalExecutionAuthorizationRequest,
    env: NodeJS.ProcessEnv,
  ): KnowledgeRetrievalExecutionAuthorizationResult {
    if (env.NODE_ENV !== "development")
      return Object.freeze({
        authorized: false,
        code: "DEVELOPMENT_ENVIRONMENT_REQUIRED",
      });
    if (
      env.YUDIJI_GEMINI_RAG_LIVE_VALIDATION_CONFIRMED !== "true" ||
      env.YUDIJI_ATLAS_VECTOR_LIVE_VALIDATION_CONFIRMED !== "true" ||
      env.YUDIJI_GEMINI_EMBEDDING_LIVE_VALIDATION_CONFIRMED !== "true" ||
      env.YUDIJI_GEMINI_LIVE_VALIDATION_CONFIRMED !== "true"
    )
      return Object.freeze({
        authorized: false,
        code: "LIVE_CONFIRMATION_REQUIRED",
      });
    if (!env.YUDIJI_GEMINI_API_KEY?.trim())
      return Object.freeze({
        authorized: false,
        code: "GEMINI_CREDENTIAL_REQUIRED",
      });
    const authority = this.registry.getExact(
      request.authorizationId,
      request.authorizationVersion,
    );
    if (!authority)
      return Object.freeze({
        authorized: false,
        code: "AUTHORIZATION_NOT_FOUND",
      });
    const material: KnowledgeRetrievalExecutionAuthorizationRequest = {
      authorizationId: authority.authorizationId,
      authorizationVersion: authority.authorizationVersion,
      environment: authority.environment,
      indexId: authority.indexId,
      indexVersion: authority.indexVersion,
      namespace: authority.namespace,
      embeddingSchemaId: authority.embeddingSchemaId,
      embeddingSchemaVersion: authority.embeddingSchemaVersion,
      corpus: authority.corpus,
    };
    return isDeepStrictEqual(request, material)
      ? freezeClone({ authorized: true, authorization: authority })
      : Object.freeze({ authorized: false, code: "AUTHORIZATION_MISMATCH" });
  }
}
export const authorizesRetrieval = (
  authorization:
    | KnowledgeRetrievalExecutionAuthorization
    | import("../../types/application-rag-retrieval-authorization.types.js").ApplicationRagRetrievalAuthorization
    | undefined,
  index: {
    indexId: string;
    indexVersion: number;
    namespace: string;
    embeddingSchema: {
      embeddingSchemaId: string;
      embeddingSchemaVersion: number;
    };
    corpus: string;
  },
) =>
  !!authorization &&
  authorization.retrievalAllowed &&
  ("environment" in authorization
    ? authorization.environment === "DEVELOPMENT_VALIDATION"
    : authorization.authorizationId ===
      "YUDIJI_TEMPLATE_DRAFT_RAG_APPLICATION_RETRIEVAL") &&
  authorization.indexId === index.indexId &&
  authorization.indexVersion === index.indexVersion &&
  authorization.namespace === index.namespace &&
  authorization.embeddingSchemaId === index.embeddingSchema.embeddingSchemaId &&
  authorization.embeddingSchemaVersion ===
    index.embeddingSchema.embeddingSchemaVersion &&
  authorization.corpus === index.corpus;
