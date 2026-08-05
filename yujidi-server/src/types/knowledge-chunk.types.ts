import type { KnowledgeDocumentIdentity, KnowledgeSourceSpan, PersistedKnowledgeDocument, PlatformKnowledgeDocumentType } from "./knowledge-document.types.js";

export const KNOWLEDGE_CHUNK_TYPES = ["IDENTITY_AND_MEANING", "CONSTRAINTS", "INTERPRETATION", "LIMITATIONS", "EXAMPLE", "NEGATIVE_EXAMPLE", "DECISION_SUMMARY", "CONSEQUENCE_SUMMARY", "VALIDATION_GUIDANCE", "SUBJECT_GUIDANCE", "UNIT_GUIDANCE", "PARENT_SUMMARY"] as const;
export type KnowledgeChunkType = typeof KNOWLEDGE_CHUNK_TYPES[number];
export const KNOWLEDGE_EXAMPLE_CLASSIFICATIONS = ["APPROVED_EXAMPLE", "NEGATIVE_EXAMPLE", "CHARACTERIZATION_ONLY"] as const;
export type KnowledgeExampleClassification = typeof KNOWLEDGE_EXAMPLE_CLASSIFICATIONS[number];
export type KnowledgeChunkIdentity = Readonly<{ chunkId: string; chunkVersion: number }>;
export type KnowledgeChunkMetadata = Readonly<{
  factors: readonly Readonly<{ factorKey: string; factorVersion: number }>[]; relationshipTypes: readonly string[];
  subjectTypes: readonly string[]; markets: readonly string[]; topics: readonly string[];
  exampleClassification?: KnowledgeExampleClassification; validationCodes: readonly string[]; adr?: Readonly<{ number: number; status: string }>;
}>;
export type KnowledgeChunkCandidate = Readonly<{
  identity: KnowledgeChunkIdentity; documentIdentity: KnowledgeDocumentIdentity;
  strategy: Readonly<{ strategyId: string; strategyVersion: number }>;
  chunkType: KnowledgeChunkType; ordinal: number; content: string; sourceSpan: KnowledgeSourceSpan;
  parent?: KnowledgeChunkIdentity; metadata: KnowledgeChunkMetadata; contentDigest: string;
}>;
export type PersistedKnowledgeChunk = KnowledgeChunkCandidate & Readonly<{ createdAt: Date }>;
export type KnowledgeChunkCitationSource = Readonly<{
  document: Readonly<{ identity: KnowledgeDocumentIdentity; sourceIdentity: string; title: string; contentDigest: string; corpus: "PLATFORM_KNOWLEDGE"; trustLevel: string; parser: Readonly<{ parserId: string; parserVersion: number }> }>;
  chunk: Readonly<{ identity: KnowledgeChunkIdentity; sourceSpan: KnowledgeSourceSpan; contentDigest: string; strategy: Readonly<{ strategyId: string; strategyVersion: number }> }>;
}>;
export type KnowledgeChunkReadResult = Readonly<{ found: true; chunk: PersistedKnowledgeChunk }> | Readonly<{ found: false; code: "NOT_FOUND" | "PERSISTENCE_FAILED" | "INVARIANT_VIOLATION" }>;
export type KnowledgeChunkSetReadResult = Readonly<{ found: true; chunks: readonly PersistedKnowledgeChunk[] }> | Readonly<{ found: false; code: "NOT_FOUND" | "PERSISTENCE_FAILED" | "INVARIANT_VIOLATION" }>;
export type KnowledgeChunkInsertResult = Readonly<{ inserted: true; chunks: readonly PersistedKnowledgeChunk[] }> | Readonly<{ inserted: false; code: "ALREADY_EXISTS" | "CONTENT_CONFLICT" | "PERSISTENCE_FAILED" | "INVARIANT_VIOLATION"; chunks?: readonly PersistedKnowledgeChunk[] }>;
export type KnowledgeChunkingContext = Readonly<{ document: PersistedKnowledgeDocument; documentType: PlatformKnowledgeDocumentType }>;

