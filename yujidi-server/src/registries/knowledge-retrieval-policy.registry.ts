import { isDeepStrictEqual } from "node:util";
import { freezeClone } from "../services/knowledge/knowledge-document-admission.service.js";
import type { KnowledgeRetrievalPolicy } from "../types/knowledge-retrieval.types.js";
export class KnowledgeRetrievalPolicyRegistry {
  private readonly values = new Map<string, KnowledgeRetrievalPolicy>();
  public constructor(policies: readonly KnowledgeRetrievalPolicy[]) { for (const policy of policies) { validate(policy); const key = `${policy.policyId}:${policy.policyVersion}`; const prior = this.values.get(key); if (prior) throw new Error(isDeepStrictEqual(prior, policy) ? "DUPLICATE_KNOWLEDGE_RETRIEVAL_POLICY" : "CONFLICTING_KNOWLEDGE_RETRIEVAL_POLICY"); this.values.set(key, freezeClone(policy)); } }
  public getExact(id: string, version: number): KnowledgeRetrievalPolicy | null { const value = this.values.get(`${id}:${version}`); return value ? freezeClone(value) : null; }
  public list(): readonly KnowledgeRetrievalPolicy[] { return freezeClone([...this.values.values()].sort((a,b)=>a.policyId.localeCompare(b.policyId)||a.policyVersion-b.policyVersion)); }
}
const integer=(v:unknown,min:number,max:number)=>Number.isSafeInteger(v)&&(v as number)>=min&&(v as number)<=max;
const finite=(v:unknown)=>typeof v==="number"&&Number.isFinite(v)&&(v as number)>=0;
const range=(v:any)=>v&&typeof v.minimum==="number"&&Number.isFinite(v.minimum)&&typeof v.maximum==="number"&&Number.isFinite(v.maximum)&&v.minimum<v.maximum&&typeof v.clamp==="boolean";
const validate=(p:KnowledgeRetrievalPolicy)=>{ const weights=[p.vectorWeight,p.lexicalWeight,p.metadataMatchWeight,p.trustWeight]; if(!/^[A-Z0-9_.:-]{1,160}$/.test(p.policyId)||!integer(p.policyVersion,1,1e6)||p.allowedCorpora.length!==1||p.allowedCorpora[0]!=="PLATFORM_KNOWLEDGE"||!p.allowedTrustLevels.length||new Set(p.allowedTrustLevels).size!==p.allowedTrustLevels.length||!integer(p.maxQueryCharacters,1,30_000)||!integer(p.maxQueryConcepts,0,100)||!integer(p.maxEligibleDocuments,1,1000)||!integer(p.vectorCandidateLimit,1,1000)||!integer(p.lexicalCandidateLimit,1,1000)||!integer(p.finalTopK,1,100)||p.finalTopK>Math.max(p.vectorCandidateLimit,p.lexicalCandidateLimit)||weights.some(x=>!finite(x))||!range(p.vectorScoreRange)||!range(p.lexicalScoreRange)||(!p.includeVectorSearch&&!p.includeLexicalSearch)||!integer(p.maxChunksPerDocument,1,100)||!integer(p.maxParentChunks,0,20)||!integer(p.maxSiblingChunks,0,20)||!integer(p.contextCharacterBudget,1,1_000_000)||!integer(p.maxPassageCharacters,1,p.contextCharacterBudget)) throw new Error("INVALID_KNOWLEDGE_RETRIEVAL_POLICY"); };
