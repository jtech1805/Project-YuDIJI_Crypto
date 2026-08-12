import { CanonicalCompilationInputService } from "../compiled-rulebook/canonical-compilation-input.service.js";
import { freezeClone } from "./knowledge-document-admission.service.js";
import type { VerifiedKnowledgeChunkSet } from "../../types/knowledge-chunk-set-manifest.types.js";
import type { KnowledgeChunkIdentity } from "../../types/knowledge-chunk.types.js";
import type { PersistedKnowledgeDocument } from "../../types/knowledge-document.types.js";
import type { KnowledgeEmbeddingSchemaDefinition, KnowledgeEmbeddingTextProjection } from "../../types/knowledge-embedding.types.js";

export class KnowledgeEmbeddingTextService {
  public constructor(private readonly canonical = new CanonicalCompilationInputService()) {}

  public project(
    document: PersistedKnowledgeDocument,
    verifiedSet: VerifiedKnowledgeChunkSet,
    chunkIdentity: KnowledgeChunkIdentity,
    schema: KnowledgeEmbeddingSchemaDefinition,
  ): KnowledgeEmbeddingTextProjection | null {
    if (verifiedSet.manifest.documentIdentity.documentId !== document.identity.documentId
      || verifiedSet.manifest.documentIdentity.documentVersion !== document.identity.documentVersion
      || schema.embeddingTextProjectorId.length === 0
      || schema.embeddingTextProjectorVersion < 1) return null;
    const chunk = verifiedSet.chunks.find((candidate) =>
      candidate.identity.chunkId === chunkIdentity.chunkId
      && candidate.identity.chunkVersion === chunkIdentity.chunkVersion);
    if (!chunk) return null;

    const semantic = {
      title: document.title,
      documentType: document.documentType,
      chunkType: chunk.chunkType,
      sectionPath: chunk.sourceSpan.sectionPath ?? [],
      factors: chunk.metadata.factors,
      relationships: chunk.metadata.relationshipTypes,
      subjects: chunk.metadata.subjectTypes,
      topics: chunk.metadata.topics,
      trustLevel: document.trustLevel,
      content: chunk.content,
    };
    const text = [
      `Title: ${semantic.title}`,
      `Document type: ${semantic.documentType}`,
      `Chunk type: ${semantic.chunkType}`,
      `Section: ${semantic.sectionPath.join(" > ")}`,
      `Factors: ${semantic.factors.map((factor) => `${factor.factorKey}@${factor.factorVersion}`).join(", ")}`,
      `Relationships: ${semantic.relationships.join(", ")}`,
      `Subjects: ${semantic.subjects.join(", ")}`,
      `Topics: ${semantic.topics.join(", ")}`,
      `Domain trust: ${semantic.trustLevel}`,
      "Content:",
      semantic.content,
    ].join("\n");
    const hashed = this.canonical.hash({
      projectorId: schema.embeddingTextProjectorId,
      projectorVersion: schema.embeddingTextProjectorVersion,
      semantic,
      text,
    });
    if (!hashed.hashed) return null;
    return freezeClone({
      projectorId: schema.embeddingTextProjectorId,
      projectorVersion: schema.embeddingTextProjectorVersion,
      chunkIdentity: chunk.identity,
      text,
      textDigest: hashed.hash,
      characterCount: text.length,
    });
  }
}
