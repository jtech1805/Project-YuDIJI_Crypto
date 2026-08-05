export const KNOWLEDGE_CORPORA = ["PLATFORM_KNOWLEDGE", "MARKET_RESEARCH", "USER_PRIVATE_DOCUMENTS"] as const;
export type KnowledgeCorpus = typeof KNOWLEDGE_CORPORA[number];

export const PLATFORM_KNOWLEDGE_DOCUMENT_TYPES = ["FACTOR_DOCUMENTATION", "RELATIONSHIP_DOCUMENTATION", "ADR_SUMMARY", "TEMPLATE_EXAMPLE", "VALIDATION_GUIDANCE", "SUBJECT_GUIDANCE", "UNIT_GUIDANCE", "EVALUATOR_DOCUMENTATION", "PRODUCT_HELP"] as const;
export type PlatformKnowledgeDocumentType = typeof PLATFORM_KNOWLEDGE_DOCUMENT_TYPES[number];

export const KNOWLEDGE_TRUST_LEVELS = ["AUTHORITATIVE", "APPROVED_GUIDANCE", "EXPLANATORY", "USER_PROVIDED", "UNVERIFIED"] as const;
export type KnowledgeTrustLevel = typeof KNOWLEDGE_TRUST_LEVELS[number];
export const KNOWLEDGE_OWNER_TYPES = ["SYSTEM", "USER", "ORGANIZATION"] as const;
export type KnowledgeOwnerType = typeof KNOWLEDGE_OWNER_TYPES[number];
export const NORMALIZED_KNOWLEDGE_BLOCK_TYPES = ["HEADING", "PARAGRAPH", "LIST", "DEFINITION", "EXAMPLE", "TABLE", "CODE_OR_SCHEMA", "DECISION", "CONSEQUENCE", "LIMITATION"] as const;
export type NormalizedKnowledgeBlockType = typeof NORMALIZED_KNOWLEDGE_BLOCK_TYPES[number];

export type KnowledgeDocumentIdentity = Readonly<{ documentId: string; documentVersion: number }>;
export type KnowledgeParserIdentity = Readonly<{ parserId: string; parserVersion: number }>;
export type KnowledgeSourceSpan = Readonly<{
  pageStart?: number; pageEnd?: number; sectionPath?: readonly string[];
  paragraphStart?: number; paragraphEnd?: number; characterStart?: number; characterEnd?: number;
  tableId?: string; rowIds?: readonly string[]; timestampStartMs?: number; timestampEndMs?: number;
}>;
export type KnowledgeAuthorityReference = Readonly<{ authorityType: string; authorityId: string; authorityVersion?: number }>;
export type NormalizedKnowledgeTable = Readonly<{ headers: readonly string[]; rows: readonly Readonly<{ rowId: string; cells: readonly string[] }>[] }>;
export type NormalizedKnowledgeBlock = Readonly<{
  blockId: string; ordinal: number; blockType: NormalizedKnowledgeBlockType; text?: string;
  table?: NormalizedKnowledgeTable; sectionPath: readonly string[]; sourceSpan: KnowledgeSourceSpan;
  semanticLabels: readonly string[]; authorityReferences: readonly KnowledgeAuthorityReference[];
}>;
export type NormalizedKnowledgeDocument = Readonly<{ documentIdentity: KnowledgeDocumentIdentity; title: string; blocks: readonly NormalizedKnowledgeBlock[] }>;

export type KnowledgeDocumentMaterial = Readonly<{
  identity: KnowledgeDocumentIdentity; corpus: KnowledgeCorpus; documentType: PlatformKnowledgeDocumentType; title: string;
  ownership: Readonly<{ ownerType: KnowledgeOwnerType; ownerId?: string }>;
  source: Readonly<{ sourceType: string; sourceIdentity: string; sourceUri?: string }>;
  trustLevel: KnowledgeTrustLevel; effectiveFrom?: Date; effectiveUntil?: Date;
  parser: KnowledgeParserIdentity; admissionPolicy: Readonly<{ policyId: string; policyVersion: number }>;
  supersedes?: KnowledgeDocumentIdentity; blocks: readonly NormalizedKnowledgeBlock[];
}>;
export type AdmittedKnowledgeDocument = KnowledgeDocumentMaterial & Readonly<{ contentDigest: string }>;
export type PersistedKnowledgeDocument = AdmittedKnowledgeDocument & Readonly<{ createdAt: Date }>;

export type KnowledgeDocumentReadResult = Readonly<{ found: true; document: PersistedKnowledgeDocument }> | Readonly<{ found: false; code: "NOT_FOUND" | "PERSISTENCE_FAILED" | "INVARIANT_VIOLATION" }>;
export type KnowledgeDocumentInsertResult = Readonly<{ inserted: true; document: PersistedKnowledgeDocument }> | Readonly<{ inserted: false; code: "ALREADY_EXISTS" | "IDENTITY_CONFLICT" | "CONTENT_CONFLICT" | "PERSISTENCE_FAILED" | "INVARIANT_VIOLATION"; document?: PersistedKnowledgeDocument }>;

