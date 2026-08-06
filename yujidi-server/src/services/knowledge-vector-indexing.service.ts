import type { KnowledgeVectorIndexWritePort } from "../ports/knowledge-vector-index-write.port.js";
import { KnowledgeEmbeddingRepository } from "../repositories/knowledge-embedding.repository.js";
import { KnowledgeDocumentRepository } from "../repositories/knowledge-document.repository.js";
import { KnowledgeChunkSetManifestRepository } from "../repositories/knowledge-chunk-set-manifest.repository.js";
import { KnowledgeEmbeddingSchemaRegistry } from "../registries/knowledge-embedding-schema.registry.js";
import { KnowledgeVectorIndexDefinitionRegistry } from "../registries/knowledge-vector-index-definition.registry.js";
import type { KnowledgeVectorIndexEntry, KnowledgeVectorIndexingRequest, KnowledgeVectorIndexingResult } from "../types/knowledge-vector-index-write.types.js";
import { KnowledgeChunkSetVerificationService } from "./knowledge-chunk-set-verification.service.js";
import { freezeClone } from "./knowledge-document-admission.service.js";
import { calculateKnowledgeEmbeddingVectorDigest } from "./knowledge-embedding.service.js";

export class KnowledgeVectorIndexingService {
  public constructor(
    private readonly indexes: KnowledgeVectorIndexDefinitionRegistry,
    private readonly schemas: KnowledgeEmbeddingSchemaRegistry,
    private readonly writer: KnowledgeVectorIndexWritePort,
    private readonly embeddings = new KnowledgeEmbeddingRepository(),
    private readonly manifests = new KnowledgeChunkSetManifestRepository(),
    private readonly verifier = new KnowledgeChunkSetVerificationService(),
    private readonly documents = new KnowledgeDocumentRepository(),
  ) {}

  public async index(request: KnowledgeVectorIndexingRequest): Promise<KnowledgeVectorIndexingResult> {
    if (!validRequest(request)) return result("VALIDATION_FAILED", [], []);
    const definition = this.indexes.getExact(
      request.indexDefinitionIdentity.indexId,
      request.indexDefinitionIdentity.indexVersion,
    );
    if (!definition) return result("INDEX_DEFINITION_NOT_FOUND", [], []);
    const schema = this.schemas.getExact(
      definition.embeddingSchema.embeddingSchemaId,
      definition.embeddingSchema.embeddingSchemaVersion,
    );
    if (!schema) return result("INVARIANT_VIOLATION", [], [], "EMBEDDING_SCHEMA_NOT_FOUND");

    const entries: KnowledgeVectorIndexEntry[] = [];
    for (const requested of [...request.entries].sort((a, b) =>
      a.entryIdentity.indexEntryId.localeCompare(b.entryIdentity.indexEntryId)
      || a.entryIdentity.indexEntryVersion - b.entryIdentity.indexEntryVersion)) {
      const embeddingRead = await this.embeddings.findExact(requested.embeddingIdentity);
      if (!embeddingRead.found) return result("EMBEDDING_NOT_FOUND", [], request.entries.map(entryId), embeddingRead.code);
      const embedding = embeddingRead.embedding;
      if (embedding.embeddingSchema.embeddingSchemaId !== definition.embeddingSchema.embeddingSchemaId
        || embedding.embeddingSchema.embeddingSchemaVersion !== definition.embeddingSchema.embeddingSchemaVersion) {
        return result("EMBEDDING_SCHEMA_MISMATCH", [], request.entries.map(entryId));
      }
      if (embedding.vectorDimension !== definition.vectorDimension
        || embedding.vector.length !== definition.vectorDimension) {
        return result("VECTOR_DIMENSION_MISMATCH", [], request.entries.map(entryId));
      }
      if (embedding.corpus !== definition.corpus) return result("CORPUS_NOT_ALLOWED", [], request.entries.map(entryId));
      if (!definition.allowedTrustLevels.includes(embedding.trustLevel)) {
        return result("TRUST_NOT_ALLOWED", [], request.entries.map(entryId));
      }
      const { vectorDigest, createdAt: _, ...embeddingMaterial } = embedding;
      if (calculateKnowledgeEmbeddingVectorDigest(embeddingMaterial) !== vectorDigest) {
        return result("LINEAGE_MISMATCH", [], request.entries.map(entryId), "VECTOR_DIGEST_MISMATCH");
      }

      const manifestRead = await this.manifests.findExact(
        embedding.chunkSetIdentity.chunkSetId,
        embedding.chunkSetIdentity.chunkSetVersion,
      );
      if (!manifestRead.found) return result("CHUNK_SET_NOT_COMPLETE", [], request.entries.map(entryId), manifestRead.code);
      const verified = await this.verifier.readExactCompleteSet(
        manifestRead.manifest.documentIdentity,
        manifestRead.manifest.strategy,
      );
      if (!verified.verified
        || verified.set.manifest.identity.chunkSetId !== embedding.chunkSetIdentity.chunkSetId
        || verified.set.manifest.identity.chunkSetVersion !== embedding.chunkSetIdentity.chunkSetVersion) {
        return result("CHUNK_SET_NOT_COMPLETE", [], request.entries.map(entryId), verified.verified ? "MANIFEST_IDENTITY_MISMATCH" : verified.code);
      }
      const chunk = verified.set.chunks.find((candidate) =>
        candidate.identity.chunkId === embedding.chunkIdentity.chunkId
        && candidate.identity.chunkVersion === embedding.chunkIdentity.chunkVersion);
      if (!chunk || chunk.contentDigest !== embedding.chunkContentDigest) {
        return result("LINEAGE_MISMATCH", [], request.entries.map(entryId));
      }
      const documentRead = await this.documents.findExact(
        embedding.documentIdentity.documentId,
        embedding.documentIdentity.documentVersion,
      );
      if (!documentRead.found
        || documentRead.document.identity.documentId !== verified.set.manifest.documentIdentity.documentId
        || documentRead.document.identity.documentVersion !== verified.set.manifest.documentIdentity.documentVersion
        || documentRead.document.corpus !== embedding.corpus
        || documentRead.document.trustLevel !== embedding.trustLevel) {
        return result("LINEAGE_MISMATCH", [], request.entries.map(entryId));
      }
      entries.push(freezeClone({
        identity: requested.entryIdentity,
        indexDefinitionIdentity: request.indexDefinitionIdentity,
        namespace: definition.namespace,
        embeddingIdentity: embedding.identity,
        embeddingSchema: embedding.embeddingSchema,
        vectorDigest: embedding.vectorDigest,
        vector: embedding.vector,
        documentIdentity: embedding.documentIdentity,
        chunkSetIdentity: embedding.chunkSetIdentity,
        chunkIdentity: embedding.chunkIdentity,
        chunkDigest: embedding.chunkContentDigest,
        corpus: embedding.corpus,
        trustLevel: embedding.trustLevel,
        documentType: documentRead.document.documentType,
        chunkType: chunk.chunkType,
        metadata: chunk.metadata,
        sourceSpan: chunk.sourceSpan,
      }));
    }

    let writeResult;
    try {
      writeResult = await this.writer.write(freezeClone({
        requestId: request.requestId,
        requestVersion: request.requestVersion,
        indexDefinitionIdentity: request.indexDefinitionIdentity,
        namespace: definition.namespace,
        indexSchema: {
          indexSchemaId: definition.indexSchemaId,
          indexSchemaVersion: definition.indexSchemaVersion,
        },
        entries,
      }));
    } catch {
      return result("VECTOR_WRITE_FAILED", [], entries.map((entry) => entry.identity.indexEntryId), "PORT_THROWN");
    }
    if (writeResult.status === "COMPLETED") {
      const accepted = [...writeResult.acceptedEntryIds, ...writeResult.existingEntryIds];
      if (!exactIds(accepted, entries.map((entry) => entry.identity.indexEntryId))) {
        return result("PROVIDER_RESULT_INVALID", [], entries.map((entry) => entry.identity.indexEntryId));
      }
      return result("COMPLETED", accepted, []);
    }
    if (!writeResult.acceptedEntryIds.every((id) => entries.some((entry) => entry.identity.indexEntryId === id))
      || !writeResult.rejectedEntryIds.every((id) => entries.some((entry) => entry.identity.indexEntryId === id))) {
      return result("PROVIDER_RESULT_INVALID", [], entries.map((entry) => entry.identity.indexEntryId));
    }
    return result(
      writeResult.acceptedEntryIds.length ? "PARTIAL" : "VECTOR_WRITE_FAILED",
      writeResult.acceptedEntryIds,
      writeResult.rejectedEntryIds,
      writeResult.failureCode,
    );
  }
}

const validRequest = (request: KnowledgeVectorIndexingRequest) =>
  identifier(request?.requestId) && positive(request.requestVersion)
  && identifier(request.indexDefinitionIdentity?.indexId) && positive(request.indexDefinitionIdentity?.indexVersion)
  && Array.isArray(request.entries) && request.entries.length > 0 && request.entries.length <= 100
  && new Set(request.entries.map((entry) => `${entry.entryIdentity.indexEntryId}:${entry.entryIdentity.indexEntryVersion}`)).size === request.entries.length
  && new Set(request.entries.map((entry) => `${entry.embeddingIdentity.embeddingId}:${entry.embeddingIdentity.embeddingVersion}`)).size === request.entries.length;
const result = (
  status: KnowledgeVectorIndexingResult["status"],
  acceptedEntryIds: readonly string[],
  rejectedEntryIds: readonly string[],
  failureCode?: string,
): KnowledgeVectorIndexingResult => freezeClone({ status, acceptedEntryIds, rejectedEntryIds, ...(failureCode ? { failureCode } : {}) });
const entryId = (entry: KnowledgeVectorIndexingRequest["entries"][number]) => entry.entryIdentity.indexEntryId;
const exactIds = (actual: readonly string[], expected: readonly string[]) =>
  actual.length === expected.length && new Set(actual).size === actual.length && expected.every((id) => actual.includes(id));
const identifier = (value: unknown): value is string => typeof value === "string" && /^[A-Z0-9_.:-]{1,160}$/.test(value);
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
