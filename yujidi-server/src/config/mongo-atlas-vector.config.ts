import { freezeClone } from "../services/knowledge-document-admission.service.js";
import type { MongoAtlasVectorAdapterConfigValue } from "../types/mongo-atlas-vector-adapter.types.js";

export const MONGO_ATLAS_VECTOR_PROVIDER = "MONGODB_ATLAS_VECTOR_SEARCH" as const;
export const MONGO_ATLAS_VECTOR_ADAPTER_VERSION = 1 as const;
export const MONGO_ATLAS_VECTOR_DIMENSION = 768 as const;
export const MONGO_ATLAS_VECTOR_METRIC = "COSINE" as const;
export const MONGO_ATLAS_PROJECTION_COLLECTION = "knowledgevectorindexprojections" as const;
export const MONGO_ATLAS_VECTOR_INDEX_NAME = "yudiji_atlas_platform_knowledge_gemini_768_v1" as const;

export class MongoAtlasVectorAdapterConfig implements MongoAtlasVectorAdapterConfigValue {
  readonly providerId = MONGO_ATLAS_VECTOR_PROVIDER; readonly adapterVersion = MONGO_ATLAS_VECTOR_ADAPTER_VERSION;
  readonly dimension = MONGO_ATLAS_VECTOR_DIMENSION; readonly similarityMetric = MONGO_ATLAS_VECTOR_METRIC; readonly developmentValidationOnly = true as const;
  readonly databaseName: string; readonly collectionName: string; readonly vectorIndexName: string; readonly vectorPath: string;
  readonly requestTimeoutMs: number; readonly totalDeadlineMs: number; readonly maxWriteBatchSize: number; readonly maxSearchLimit: number; readonly maxNumCandidates: number;
  public constructor(input: Readonly<{ databaseName: string; collectionName: string; vectorIndexName: string; vectorPath: string; dimension: number; similarityMetric: string; requestTimeoutMs: number; totalDeadlineMs: number; maxWriteBatchSize: number; maxSearchLimit: number; maxNumCandidates: number; developmentValidationOnly: boolean }>) {
    if (!mongoName(input.databaseName, 63) || !mongoName(input.collectionName, 120) || !mongoName(input.vectorIndexName, 120) || !path(input.vectorPath)
      || input.dimension !== 768 || input.similarityMetric !== "COSINE" || input.developmentValidationOnly !== true
      || !integer(input.requestTimeoutMs, 100, 120_000) || !integer(input.totalDeadlineMs, input.requestTimeoutMs, 240_000)
      || !integer(input.maxWriteBatchSize, 1, 100) || !integer(input.maxSearchLimit, 1, 100)
      || !integer(input.maxNumCandidates, input.maxSearchLimit, 10_000)) throw new Error("INVALID_MONGO_ATLAS_VECTOR_CONFIG");
    this.databaseName=input.databaseName;this.collectionName=input.collectionName;this.vectorIndexName=input.vectorIndexName;this.vectorPath=input.vectorPath;
    this.requestTimeoutMs=input.requestTimeoutMs;this.totalDeadlineMs=input.totalDeadlineMs;this.maxWriteBatchSize=input.maxWriteBatchSize;this.maxSearchLimit=input.maxSearchLimit;this.maxNumCandidates=input.maxNumCandidates;Object.freeze(this);
  }
  public toJSON(): MongoAtlasVectorAdapterConfigValue { return freezeClone({providerId:this.providerId,adapterVersion:this.adapterVersion,databaseName:this.databaseName,collectionName:this.collectionName,vectorIndexName:this.vectorIndexName,vectorPath:this.vectorPath,dimension:this.dimension,similarityMetric:this.similarityMetric,requestTimeoutMs:this.requestTimeoutMs,totalDeadlineMs:this.totalDeadlineMs,maxWriteBatchSize:this.maxWriteBatchSize,maxSearchLimit:this.maxSearchLimit,maxNumCandidates:this.maxNumCandidates,developmentValidationOnly:this.developmentValidationOnly}); }
}
export const createMongoAtlasVectorAdapterConfig=(env:NodeJS.ProcessEnv)=>new MongoAtlasVectorAdapterConfig({databaseName:env.YUDIJI_ATLAS_VECTOR_DATABASE??"",collectionName:env.YUDIJI_ATLAS_VECTOR_COLLECTION??MONGO_ATLAS_PROJECTION_COLLECTION,vectorIndexName:env.YUDIJI_ATLAS_VECTOR_INDEX_NAME??MONGO_ATLAS_VECTOR_INDEX_NAME,vectorPath:env.YUDIJI_ATLAS_VECTOR_PATH??"vector",dimension:Number(env.YUDIJI_ATLAS_VECTOR_DIMENSION??768),similarityMetric:env.YUDIJI_ATLAS_VECTOR_SIMILARITY??"COSINE",requestTimeoutMs:Number(env.YUDIJI_ATLAS_VECTOR_REQUEST_TIMEOUT_MS??30_000),totalDeadlineMs:Number(env.YUDIJI_ATLAS_VECTOR_TOTAL_DEADLINE_MS??60_000),maxWriteBatchSize:Number(env.YUDIJI_ATLAS_VECTOR_MAX_WRITE_BATCH_SIZE??20),maxSearchLimit:Number(env.YUDIJI_ATLAS_VECTOR_MAX_SEARCH_LIMIT??20),maxNumCandidates:Number(env.YUDIJI_ATLAS_VECTOR_MAX_NUM_CANDIDATES??400),developmentValidationOnly:true});
const integer=(value:unknown,min:number,max:number)=>Number.isSafeInteger(value)&&(value as number)>=min&&(value as number)<=max;
const mongoName=(value:unknown,max:number):value is string=>typeof value==="string"&&value.length>0&&value.length<=max&&/^[A-Za-z0-9_.-]+$/.test(value)&&!value.includes("..")&&!value.startsWith("system.");
const path=(value:unknown):value is string=>typeof value==="string"&&/^[A-Za-z][A-Za-z0-9_.]{0,119}$/.test(value)&&!value.includes("..");
