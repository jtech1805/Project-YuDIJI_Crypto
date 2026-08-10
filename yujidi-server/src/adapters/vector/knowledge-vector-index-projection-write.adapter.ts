import type { KnowledgeVectorIndexWritePort } from "../../ports/knowledge-vector-index-write.port.js";
import { KnowledgeVectorIndexProjectionRepository } from "../../repositories/knowledge-vector-index-projection.repository.js";
import { KnowledgeVectorIndexProjectionService } from "../../services/knowledge-vector-index-projection.service.js";
import { freezeClone } from "../../services/knowledge-document-admission.service.js";
import type { KnowledgeVectorIndexWriteRequest, KnowledgeVectorIndexWriteResult } from "../../types/knowledge-vector-index-write.types.js";

export class KnowledgeVectorIndexProjectionWriteAdapter implements KnowledgeVectorIndexWritePort {
  public constructor(private readonly projections = new KnowledgeVectorIndexProjectionService(new KnowledgeVectorIndexProjectionRepository())) {}

  public async write(request: KnowledgeVectorIndexWriteRequest): Promise<KnowledgeVectorIndexWriteResult> {
    if (!Array.isArray(request.entries) || !request.entries.length || request.entries.length > 100
      || new Set(request.entries.map((entry) => `${entry.identity.indexEntryId}:${entry.identity.indexEntryVersion}`)).size !== request.entries.length) {
      return failure("INVALID_WRITE_REQUEST", [], request.entries?.map((entry) => entry.identity.indexEntryId) ?? []);
    }
    const accepted: string[] = [];
    const existing: string[] = [];
    const rejected: string[] = [];
    let firstFailure: string | undefined;
    for (const entry of request.entries) {
      if (entry.indexDefinitionIdentity.indexId !== request.indexDefinitionIdentity.indexId
        || entry.indexDefinitionIdentity.indexVersion !== request.indexDefinitionIdentity.indexVersion
        || entry.namespace !== request.namespace) {
        rejected.push(entry.identity.indexEntryId);
        firstFailure ??= "REQUEST_ENTRY_LINEAGE_MISMATCH";
        continue;
      }
      const outcome = await this.projections.create({
        identity: entry.identity,
        indexDefinitionIdentity: entry.indexDefinitionIdentity,
        namespace: entry.namespace,
        metadataSchema: entry.metadataSchema,
        embeddingIdentity: entry.embeddingIdentity,
        embeddingSchema: entry.embeddingSchema,
        purpose: entry.purpose,
        normalizationStrategy: entry.normalizationStrategy,
        vectorDimension: entry.vector.length,
        similarityMetric: entry.similarityMetric,
        vectorDigest: entry.vectorDigest,
        vector: entry.vector,
        documentIdentity: entry.documentIdentity,
        chunkSetIdentity: entry.chunkSetIdentity,
        chunkIdentity: entry.chunkIdentity,
        chunkDigest: entry.chunkDigest,
        corpus: entry.corpus,
        trustLevel: entry.trustLevel,
        searchableMetadata: entry.searchableMetadata,
      });
      if (outcome.status === "CREATED") accepted.push(entry.identity.indexEntryId);
      else if (outcome.status === "ALREADY_EXISTS") existing.push(entry.identity.indexEntryId);
      else {
        rejected.push(entry.identity.indexEntryId);
        firstFailure ??= outcome.status === "VALIDATION_FAILED" ? outcome.failureCode : outcome.status;
      }
    }
    if (!rejected.length) return freezeClone({ status: "COMPLETED", acceptedEntryIds: accepted, existingEntryIds: existing });
    return failure(firstFailure ?? "PROJECTION_WRITE_FAILED", accepted, rejected);
  }
}

const failure = (failureCode: string, acceptedEntryIds: readonly string[], rejectedEntryIds: readonly string[]): KnowledgeVectorIndexWriteResult => freezeClone({ status: acceptedEntryIds.length ? "PARTIAL" : "FAILED", failureCode, acceptedEntryIds, rejectedEntryIds });
