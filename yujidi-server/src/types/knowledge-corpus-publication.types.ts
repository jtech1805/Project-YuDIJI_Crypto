import type { KnowledgeCorpus, KnowledgeOwnerType } from "./knowledge-document.types.js";

export type PublishedCorpusDocument = Readonly<{ documentId:string; documentVersion:number; documentDigest:string; chunkSetId:string; chunkSetVersion:number; chunkSetDigest:string; chunkingStrategyId:string; chunkingStrategyVersion:number; chunkCount:number }>;
export type KnowledgeCorpusPublicationCommand = Readonly<{ publicationId:string; publicationVersion:number; corpus:KnowledgeCorpus; ownerType:KnowledgeOwnerType; ownerId?:string; publicationPolicyId:string; publicationPolicyVersion:number; documents:readonly PublishedCorpusDocument[]; corpusDigest:string; effectiveFrom?:Date; effectiveUntil?:Date }>;
export type PersistedKnowledgeCorpusPublication = KnowledgeCorpusPublicationCommand & Readonly<{ createdAt:Date }>;
export type KnowledgeCorpusPublicationResult = Readonly<{status:"CREATED"|"ALREADY_EXISTS";publication:PersistedKnowledgeCorpusPublication}>|Readonly<{status:"CONFLICT"|"VALIDATION_FAILED"|"INVARIANT_VIOLATION"|"PERSISTENCE_FAILED";failureCode?:string}>;
export type KnowledgeCorpusPublicationReadResult = Readonly<{found:true;publication:PersistedKnowledgeCorpusPublication}>|Readonly<{found:false;code:"NOT_FOUND"|"INVARIANT_VIOLATION"|"PERSISTENCE_FAILED"}>;
