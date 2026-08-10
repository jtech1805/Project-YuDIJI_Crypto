import { createHash } from "node:crypto";
import { freezeClone } from "./knowledge-document-admission.service.js";
import type { MongoAtlasVectorAdapterConfig } from "../config/mongo-atlas-vector.config.js";
import type { MongoAtlasVectorIndexField, MongoAtlasVectorIndexSpecification } from "../types/mongo-atlas-vector-adapter.types.js";
import type { KnowledgeVectorIndexDefinition } from "../types/knowledge-vector-index-definition.types.js";

export const MONGO_ATLAS_VECTOR_FILTER_PATHS = Object.freeze([
  "indexId","indexVersion","namespace","embeddingSchema.embeddingSchemaId","embeddingSchema.embeddingSchemaVersion","corpus","trustLevel",
  "documentIdentity.documentId","documentIdentity.documentVersion","searchableMetadata.documentType","searchableMetadata.chunkType",
  "searchableMetadata.factors.factorKey","searchableMetadata.relationshipTypes","searchableMetadata.subjectTypes","searchableMetadata.topics",
  "searchableMetadata.validationCodes","searchableMetadata.exampleClassification","searchableMetadata.adr.number","searchableMetadata.effectiveFrom","searchableMetadata.effectiveUntil",
] as const);

export class MongoAtlasVectorIndexSpecificationService {
  public create(definition:KnowledgeVectorIndexDefinition,config:MongoAtlasVectorAdapterConfig,filterPaths:readonly string[]=MONGO_ATLAS_VECTOR_FILTER_PATHS):MongoAtlasVectorIndexSpecification {
    if(config.vectorPath!=="vector"||definition.vectorDimension!==config.dimension||definition.similarityMetric!==config.similarityMetric
      ||definition.embeddingSchema.embeddingSchemaId!=="YUDIJI_GEMINI_PLATFORM_KNOWLEDGE_EMBEDDING"||definition.embeddingSchema.embeddingSchemaVersion!==1
      ||definition.corpus!=="PLATFORM_KNOWLEDGE")throw new Error("ATLAS_VECTOR_INDEX_DEFINITION_MISMATCH");
    if(new Set(filterPaths).size!==filterPaths.length)throw new Error("DUPLICATE_ATLAS_VECTOR_FILTER_PATH");
    if(filterPaths.some(path=>!MONGO_ATLAS_VECTOR_FILTER_PATHS.includes(path as typeof MONGO_ATLAS_VECTOR_FILTER_PATHS[number])))throw new Error("UNKNOWN_ATLAS_VECTOR_FILTER_PATH");
    const filters=[...filterPaths].sort().map(path=>({type:"filter",path}) as const);
    const fields:readonly MongoAtlasVectorIndexField[]=[{type:"vector",path:config.vectorPath,numDimensions:config.dimension,similarity:"cosine"},...filters];
    const material={name:config.vectorIndexName,type:"vectorSearch" as const,definition:{fields}};
    const digest=createHash("sha256").update(stable(material)).digest("hex");
    return freezeClone({...material,digest,indexDefinition:definition});
  }
}
const stable=(value:unknown):string=>Array.isArray(value)?`[${value.map(stable).join(",")}]`:value&&typeof value==="object"?`{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>`${JSON.stringify(key)}:${stable(item)}`).join(",")}}`:JSON.stringify(value);
