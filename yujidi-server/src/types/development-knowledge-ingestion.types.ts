import type { KnowledgeDocumentIdentity, KnowledgeDocumentMaterial } from "./knowledge-document.types.js";
import type { KnowledgeEmbeddingSchemaDefinition } from "./knowledge-embedding.types.js";

export const DEVELOPMENT_KNOWLEDGE_EMBEDDING_MODES=["DETERMINISTIC_FIXTURE","GEMINI"] as const;
export type DevelopmentKnowledgeEmbeddingMode=typeof DEVELOPMENT_KNOWLEDGE_EMBEDDING_MODES[number];
export const DEV_DETERMINISTIC_EMBEDDING_SCHEMA:KnowledgeEmbeddingSchemaDefinition=Object.freeze({
  embeddingSchemaId:"YUDIJI_DEV_DETERMINISTIC_PLATFORM_KNOWLEDGE_768",embeddingSchemaVersion:1,
  providerId:"YUDIJI_DEVELOPMENT_DETERMINISTIC_EMBEDDING",providerVersion:1,modelId:"SHA256_EXPANSION_768",modelVersion:"1",
  vectorDimension:768,similarityMetric:"COSINE",normalizationStrategyId:"L2_UNIT_VECTOR",normalizationStrategyVersion:1,
  embeddingTextProjectorId:"PLATFORM_KNOWLEDGE_EMBEDDING_TEXT",embeddingTextProjectorVersion:1,
  allowedCorpora:Object.freeze(["PLATFORM_KNOWLEDGE"] as const),allowedTrustLevels:Object.freeze(["AUTHORITATIVE","APPROVED_GUIDANCE","EXPLANATORY"] as const),
  allowedPurposes:Object.freeze(["RETRIEVAL_DOCUMENT"] as const),activeForGeneration:true,
});
export const DEV_DETERMINISTIC_QUERY_EMBEDDING_SCHEMA:KnowledgeEmbeddingSchemaDefinition=Object.freeze({
  ...DEV_DETERMINISTIC_EMBEDDING_SCHEMA,
  embeddingSchemaId:"YUDIJI_DEV_DETERMINISTIC_PLATFORM_KNOWLEDGE_QUERY_768",
  allowedPurposes:Object.freeze(["RETRIEVAL_QUERY"] as const),
  activeForGeneration:false,
});
export type DevelopmentKnowledgeCorpusEntry=Readonly<{document:KnowledgeDocumentMaterial;strategy:Readonly<{strategyId:string;strategyVersion:number}>;manifestIdentity:Readonly<{chunkSetId:string;chunkSetVersion:number}>}>;
export type DevelopmentKnowledgeIngestionRequest=Readonly<{requestId:string;requestVersion:number;mode:DevelopmentKnowledgeEmbeddingMode;corpus:readonly DevelopmentKnowledgeCorpusEntry[]}>;
export type DevelopmentKnowledgeDocumentOutcome=Readonly<{documentIdentity:KnowledgeDocumentIdentity;status:"COMPLETED"|"FAILED";document:"CREATED"|"ALREADY_EXISTS"|"FAILED";chunks:"CREATED"|"ALREADY_EXISTS"|"FAILED";manifest:"CREATED"|"ALREADY_EXISTS"|"FAILED";embeddings:Readonly<{created:number;existing:number;failed:number}>;projections:Readonly<{created:number;existing:number;conflict:number;failed:number}>;failureCode?:string;lineage:Readonly<{chunkSetId:string;chunkSetVersion:number;embeddingSchemaId:string;embeddingSchemaVersion:number;indexId:string;indexVersion:number;namespace:string;embeddingIds:readonly string[];projectionEntryIds:readonly string[]}>}>;
export type DevelopmentKnowledgeIngestionResult=Readonly<{status:"COMPLETED"|"PARTIAL"|"FAILED"|"VALIDATION_FAILED";mode:DevelopmentKnowledgeEmbeddingMode;outcomes:readonly DevelopmentKnowledgeDocumentOutcome[];summary:Readonly<{documents:Readonly<{created:number;existing:number;failed:number}>;chunks:Readonly<{created:number;existing:number;failed:number}>;manifests:Readonly<{created:number;existing:number;failed:number}>;embeddings:Readonly<{created:number;existing:number;failed:number}>;projections:Readonly<{created:number;existing:number;conflict:number;failed:number}>}>;failureCode?:string}>;
