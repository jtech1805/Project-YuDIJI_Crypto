import type { KnowledgeVectorIndexWritePort } from "../../ports/knowledge-vector-index-write.port.js";
import { KnowledgeVectorIndexProjectionWriteAdapter } from "./knowledge-vector-index-projection-write.adapter.js";
import { freezeClone } from "../../services/knowledge-document-admission.service.js";
import type { MongoAtlasVectorAdapterConfig } from "../../config/mongo-atlas-vector.config.js";
import type { KnowledgeVectorIndexWriteRequest, KnowledgeVectorIndexWriteResult } from "../../types/knowledge-vector-index-write.types.js";
import type { KnowledgeVectorIndexDefinition } from "../../types/knowledge-vector-index-definition.types.js";

export class MongoAtlasKnowledgeVectorIndexWriteAdapter implements KnowledgeVectorIndexWritePort {
  public constructor(private readonly config:MongoAtlasVectorAdapterConfig,private readonly definition:KnowledgeVectorIndexDefinition,private readonly projections:KnowledgeVectorIndexWritePort=new KnowledgeVectorIndexProjectionWriteAdapter()){}
  public async write(request:KnowledgeVectorIndexWriteRequest):Promise<KnowledgeVectorIndexWriteResult>{
    if(request.entries.length>this.config.maxWriteBatchSize||request.indexDefinitionIdentity.indexId!==this.definition.indexId||request.indexDefinitionIdentity.indexVersion!==this.definition.indexVersion||request.namespace!==this.definition.namespace
      ||this.definition.vectorDimension!==this.config.dimension||this.definition.similarityMetric!==this.config.similarityMetric)return freezeClone({status:"FAILED",failureCode:"ATLAS_WRITE_CONFIGURATION_MISMATCH",acceptedEntryIds:[],rejectedEntryIds:request.entries.map(entry=>entry.identity.indexEntryId)});
    return freezeClone(await this.projections.write(request));
  }
}
