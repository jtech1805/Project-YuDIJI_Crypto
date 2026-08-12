import type { AdmittedKnowledgeDocument, KnowledgeCorpus, KnowledgeDocumentMaterial, KnowledgeTrustLevel, PlatformKnowledgeDocumentType } from "./knowledge-document.types.js";

export type KnowledgeDocumentAdmissionPolicy = Readonly<{
  policyId: string; policyVersion: number; allowedCorpora: readonly KnowledgeCorpus[];
  allowedDocumentTypes: readonly PlatformKnowledgeDocumentType[]; allowedTrustLevels: readonly KnowledgeTrustLevel[];
  maxTitleLength: number; maxBlocks: number; maxBlockCharacters: number; maxDocumentCharacters: number;
  requireSystemOwnershipForPlatformKnowledge: true;
}>;
export const PLATFORM_KNOWLEDGE_ADMISSION_POLICY: KnowledgeDocumentAdmissionPolicy = Object.freeze({
  policyId: "PLATFORM_KNOWLEDGE_ADMISSION", policyVersion: 1,
  allowedCorpora: Object.freeze(["PLATFORM_KNOWLEDGE"] as const),
  allowedDocumentTypes: Object.freeze(["FACTOR_DOCUMENTATION", "RELATIONSHIP_DOCUMENTATION", "ADR_SUMMARY", "TEMPLATE_EXAMPLE", "VALIDATION_GUIDANCE", "SUBJECT_GUIDANCE", "UNIT_GUIDANCE", "EVALUATOR_DOCUMENTATION", "PRODUCT_HELP"] as const),
  allowedTrustLevels: Object.freeze(["AUTHORITATIVE", "APPROVED_GUIDANCE", "EXPLANATORY"] as const),
  maxTitleLength: 240, maxBlocks: 500, maxBlockCharacters: 20_000, maxDocumentCharacters: 500_000,
  requireSystemOwnershipForPlatformKnowledge: true,
});
export const KNOWLEDGE_ADMISSION_FAILURE_CODES = ["INVALID_IDENTITY", "UNSUPPORTED_CORPUS", "UNSUPPORTED_DOCUMENT_TYPE", "UNSUPPORTED_TRUST", "INVALID_OWNERSHIP", "INVALID_SOURCE", "INVALID_PARSER", "INVALID_EFFECTIVE_TIME", "INVALID_SUPERSESSION", "INVALID_BLOCKS", "BOUNDS_EXCEEDED", "DIGEST_MISMATCH", "CANONICALIZATION_FAILED"] as const;
export type KnowledgeAdmissionFailureCode = typeof KNOWLEDGE_ADMISSION_FAILURE_CODES[number];
export type KnowledgeDocumentAdmissionRequest = Readonly<{ document: KnowledgeDocumentMaterial; expectedContentDigest?: string }>;
export type KnowledgeDocumentAdmissionResult = Readonly<{ admitted: true; document: AdmittedKnowledgeDocument }> | Readonly<{ admitted: false; code: KnowledgeAdmissionFailureCode }>;
export type KnowledgeDocumentServiceResult = Readonly<{ status: "CREATED" | "ALREADY_EXISTS"; document: import("./knowledge-document.types.js").PersistedKnowledgeDocument }> | Readonly<{ status: "IDENTITY_CONFLICT" | "CONTENT_CONFLICT" | "VALIDATION_FAILED" | "PERSISTENCE_FAILED" | "INVARIANT_VIOLATION"; code?: KnowledgeAdmissionFailureCode }>;
