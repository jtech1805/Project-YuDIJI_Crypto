export type KnowledgeRetrievalExecutionAuthorization=Readonly<{
  authorizationId:"YUDIJI_GEMINI_ATLAS_RAG_DEVELOPMENT_VALIDATION";authorizationVersion:1;
  environment:"DEVELOPMENT_VALIDATION";
  indexId:"YUDIJI_ATLAS_PLATFORM_KNOWLEDGE_GEMINI_768";indexVersion:1;
  namespace:"YUDIJI:PLATFORM_KNOWLEDGE:ATLAS:GEMINI_768:V1";
  embeddingSchemaId:"YUDIJI_GEMINI_PLATFORM_KNOWLEDGE_EMBEDDING";embeddingSchemaVersion:1;
  corpus:"PLATFORM_KNOWLEDGE";retrievalAllowed:true;ragGenerationAllowed:true;
}>;
export type KnowledgeRetrievalExecutionAuthorizationRequest=Readonly<Omit<KnowledgeRetrievalExecutionAuthorization,"retrievalAllowed"|"ragGenerationAllowed">>;
export type KnowledgeRetrievalExecutionAuthorizationResult=Readonly<{authorized:true;authorization:KnowledgeRetrievalExecutionAuthorization}>|Readonly<{authorized:false;code:"DEVELOPMENT_ENVIRONMENT_REQUIRED"|"LIVE_CONFIRMATION_REQUIRED"|"GEMINI_CREDENTIAL_REQUIRED"|"AUTHORIZATION_NOT_FOUND"|"AUTHORIZATION_MISMATCH"}>;
