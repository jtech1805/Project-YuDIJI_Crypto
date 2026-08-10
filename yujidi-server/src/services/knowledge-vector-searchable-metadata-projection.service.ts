import type { PersistedKnowledgeChunk } from "../types/knowledge-chunk.types.js";
import type { PersistedKnowledgeDocument } from "../types/knowledge-document.types.js";
import type { KnowledgeVectorSearchableMetadata } from "../types/knowledge-vector-index-projection.types.js";
import { freezeClone } from "./knowledge-document-admission.service.js";

export class KnowledgeVectorSearchableMetadataProjectionService {
  public project(
    document: PersistedKnowledgeDocument,
    chunk: PersistedKnowledgeChunk,
  ): KnowledgeVectorSearchableMetadata {
    const factors = [...chunk.metadata.factors]
      .sort((a, b) => a.factorKey.localeCompare(b.factorKey) || a.factorVersion - b.factorVersion);
    return freezeClone({
      documentType: document.documentType,
      chunkType: chunk.chunkType,
      factors,
      relationshipTypes: canonicalStrings(chunk.metadata.relationshipTypes),
      subjectTypes: canonicalStrings(chunk.metadata.subjectTypes),
      topics: canonicalStrings(chunk.metadata.topics),
      validationCodes: canonicalStrings(chunk.metadata.validationCodes),
      ...(chunk.metadata.exampleClassification
        ? { exampleClassification: chunk.metadata.exampleClassification }
        : {}),
      ...(chunk.metadata.adr ? { adr: chunk.metadata.adr } : {}),
      ...(document.effectiveFrom ? { effectiveFrom: new Date(document.effectiveFrom.getTime()) } : {}),
      ...(document.effectiveUntil ? { effectiveUntil: new Date(document.effectiveUntil.getTime()) } : {}),
    });
  }
}

const canonicalStrings = (values: readonly string[]) => [...values].sort((a, b) => a.localeCompare(b));
