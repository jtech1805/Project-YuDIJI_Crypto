import { isDeepStrictEqual } from "node:util";
import { freezeClone } from "./knowledge-document-admission.service.js";
import type { MongoAtlasVectorIndexAdministrationResult, MongoAtlasVectorIndexInspection, MongoAtlasVectorIndexSpecification, MongoAtlasSearchIndexCollection } from "../../types/mongo-atlas-vector-adapter.types.js";

export class MongoAtlasVectorIndexAdministrationService {
  public constructor(private readonly collection:MongoAtlasSearchIndexCollection,private readonly requestTimeoutMs:number,private readonly totalDeadlineMs:number){}
  public async inspect(specification:MongoAtlasVectorIndexSpecification):Promise<MongoAtlasVectorIndexInspection>{
    try{const rows=await this.collection.listSearchIndexes(specification.name,{maxTimeMS:this.requestTimeoutMs}).toArray();if(!rows.length)return freezeClone({status:"INDEX_NOT_FOUND",name:specification.name,queryable:false,specificationDigest:specification.digest});if(rows.length!==1)return freezeClone({status:"INDEX_STATUS_UNKNOWN",name:specification.name,queryable:false,specificationDigest:specification.digest});const row=rows[0]!;const providerStatus=typeof row.status==="string"?row.status:"UNKNOWN";const actual=row.latestDefinition??row.definition;if(!isDeepStrictEqual(actual,specification.definition))return freezeClone({status:"INDEX_SPECIFICATION_MISMATCH",name:specification.name,queryable:false,specificationDigest:specification.digest,providerStatus});const queryable=row.queryable===true;const status=queryable?"INDEX_QUERYABLE":providerStatus==="FAILED"?"INDEX_FAILED":["BUILDING","PENDING"].includes(providerStatus)?"INDEX_BUILDING":"INDEX_STATUS_UNKNOWN";return freezeClone({status,name:specification.name,queryable,specificationDigest:specification.digest,providerStatus});}catch{return freezeClone({status:"INDEX_STATUS_UNKNOWN",name:specification.name,queryable:false,specificationDigest:specification.digest});}
  }
  public async ensure(specification:MongoAtlasVectorIndexSpecification,authorized:boolean,pollIntervalMs=250):Promise<MongoAtlasVectorIndexAdministrationResult>{
    const first=await this.inspect(specification);if(first.status==="INDEX_QUERYABLE")return freezeClone({...first,action:"ALREADY_EXISTS"});if(first.status!=="INDEX_NOT_FOUND")return freezeClone({...first,action:"NOT_PERFORMED"});if(!authorized)return freezeClone({...first,action:"NOT_PERFORMED"});
    try{await this.collection.createSearchIndex({name:specification.name,type:"vectorSearch",definition:specification.definition});}catch{return freezeClone({...first,status:"INDEX_STATUS_UNKNOWN",action:"NOT_PERFORMED",failureCode:"VECTOR_SEARCH_UNSUPPORTED"});}
    const deadline=Date.now()+this.totalDeadlineMs;do{const state=await this.inspect(specification);if(state.status==="INDEX_QUERYABLE"||state.status==="INDEX_FAILED"||state.status==="INDEX_SPECIFICATION_MISMATCH")return freezeClone({...state,action:"CREATED"});await delay(Math.min(pollIntervalMs,Math.max(0,deadline-Date.now())));}while(Date.now()<deadline);
    return freezeClone({status:"INDEX_BUILDING",name:specification.name,queryable:false,specificationDigest:specification.digest,action:"CREATED",failureCode:"REQUEST_TIMEOUT"});
  }
}
const delay=(milliseconds:number)=>new Promise<void>(resolve=>setTimeout(resolve,milliseconds));
