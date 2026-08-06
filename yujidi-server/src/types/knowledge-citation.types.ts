import type { KnowledgeChunkIdentity } from "./knowledge-chunk.types.js";
import type { KnowledgeChunkSetManifestIdentity } from "./knowledge-chunk-set-manifest.types.js";
import type { KnowledgeCorpus, KnowledgeDocumentIdentity, KnowledgeSourceSpan, KnowledgeTrustLevel } from "./knowledge-document.types.js";
import type { KnowledgeRetrievalPolicyIdentity } from "./knowledge-retrieval.types.js";
export type KnowledgeCitationMaterial = Readonly<{ contextId: string; contextVersion: number; requestId: string; requestVersion: number; policy: KnowledgeRetrievalPolicyIdentity; documentIdentity: KnowledgeDocumentIdentity; documentDigest: string; chunkSetIdentity: KnowledgeChunkSetManifestIdentity; chunkIdentity: KnowledgeChunkIdentity; chunkDigest: string; sourceIdentity: string; sourceSpan: KnowledgeSourceSpan; corpus: KnowledgeCorpus; trustLevel: KnowledgeTrustLevel }>;
export type KnowledgeCitationValidation = Readonly<{ handle: string; status: "VALID" | "UNKNOWN_HANDLE" | "DUPLICATE_HANDLE" | "HANDLE_NOT_SELECTED" | "CONTEXT_ID_MISMATCH" | "DOCUMENT_LINEAGE_MISMATCH" | "CHUNK_LINEAGE_MISMATCH" | "SOURCE_SPAN_MISMATCH" }>;
