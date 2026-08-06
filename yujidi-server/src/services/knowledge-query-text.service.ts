import { CanonicalCompilationInputService } from "./canonical-compilation-input.service.js";
import { freezeClone } from "./knowledge-document-admission.service.js";
import type { KnowledgeEmbeddingSchemaDefinition } from "../types/knowledge-embedding.types.js";
import type { KnowledgeQueryTextProjection, KnowledgeRetrievalRequest } from "../types/knowledge-retrieval.types.js";
export class KnowledgeQueryTextService {
  public constructor(private readonly canonical=new CanonicalCompilationInputService()){}
  public project(request: KnowledgeRetrievalRequest, schema: KnowledgeEmbeddingSchemaDefinition): KnowledgeQueryTextProjection | null {
    if(typeof request.query.text!=="string"||!request.query.text.trim()) return null;
    const filters=Object.entries(request.filters??{}).sort(([a],[b])=>a.localeCompare(b)).map(([key,values])=>`${key}: ${[...(values??[])].sort().join(", ")}`);
    const text=[`query: ${normalize(request.query.text)}`,...(request.query.concepts.length?[`concepts: ${[...request.query.concepts].sort().join(", ")}`]:[]),...filters].join("\n");
    const result=this.canonical.hash({projectorId:schema.embeddingTextProjectorId,projectorVersion:schema.embeddingTextProjectorVersion,text});
    return result.hashed?freezeClone({projectorId:schema.embeddingTextProjectorId,projectorVersion:schema.embeddingTextProjectorVersion,text,textDigest:result.hash,characterCount:text.length}):null;
  }
}
const normalize=(v:string)=>v.normalize("NFKC").trim().replace(/\s+/gu," ");
