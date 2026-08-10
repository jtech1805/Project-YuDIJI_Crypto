import { isDeepStrictEqual } from "node:util";
import { KnowledgeDocumentRepository } from "../repositories/knowledge-document.repository.js";
import { KnowledgeChunkRepository } from "../repositories/knowledge-chunk.repository.js";
import { KnowledgeEmbeddingRepository } from "../repositories/knowledge-embedding.repository.js";
import { KnowledgeChunkSetManifestRepository } from "../repositories/knowledge-chunk-set-manifest.repository.js";
import { KnowledgeVectorIndexProjectionRepository } from "../repositories/knowledge-vector-index-projection.repository.js";
import { KnowledgeChunkSetVerificationService } from "./knowledge-chunk-set-verification.service.js";
import { freezeClone, validSourceSpan } from "./knowledge-document-admission.service.js";
import { calculateKnowledgeEmbeddingVectorDigest } from "./knowledge-embedding.service.js";
import type { KnowledgeCandidateSource, KnowledgeRetrievalCandidate, KnowledgeRetrievalExclusion, KnowledgeRetrievalPolicy, KnowledgeRetrievalRequest, ValidatedKnowledgeRetrievalCandidate } from "../types/knowledge-retrieval.types.js";

type VectorSource = Extract<KnowledgeCandidateSource, { type: "VECTOR" }>;

export class KnowledgeRetrievalCandidateValidationService {
  public constructor(
    private readonly documents = new KnowledgeDocumentRepository(),
    private readonly chunks = new KnowledgeChunkRepository(),
    private readonly embeddings = new KnowledgeEmbeddingRepository(),
    private readonly verifier = new KnowledgeChunkSetVerificationService(),
    private readonly projections = new KnowledgeVectorIndexProjectionRepository(),
    private readonly manifests = new KnowledgeChunkSetManifestRepository(),
  ) {}

  public async validate(
    candidates: readonly KnowledgeRetrievalCandidate[],
    request: KnowledgeRetrievalRequest,
    policy?: KnowledgeRetrievalPolicy,
  ): Promise<Readonly<{ valid: readonly ValidatedKnowledgeRetrievalCandidate[]; excluded: readonly KnowledgeRetrievalExclusion[] }>> {
    const valid: ValidatedKnowledgeRetrievalCandidate[] = [];
    const excluded: KnowledgeRetrievalExclusion[] = [];
    const vectorSources = candidates.flatMap((candidate) => candidate.sources.filter((source): source is VectorSource => source.type === "VECTOR"));
    const ordinalsValid = vectorSources.every((source) => Number.isSafeInteger(source.providerOrdinal) && source.providerOrdinal >= 0)
      && new Set(vectorSources.map((source) => source.providerOrdinal)).size === vectorSources.length
      && [...vectorSources.map((source) => source.providerOrdinal)].sort((a, b) => a - b).every((ordinal, index) => ordinal === index);

    for (const candidate of candidates) {
      const sourceTypes = candidate.sources.map((source) => source.type);
      const reject = (code: KnowledgeRetrievalExclusion["code"]) => excluded.push({ code, documentIdentity: candidate.documentIdentity, chunkIdentity: candidate.chunkIdentity, sourceTypes });
      const vector = candidate.sources.find((source): source is VectorSource => source.type === "VECTOR");

      if (vector) {
        if (!ordinalsValid) { reject("PROVIDER_ORDINAL_INVALID"); continue; }
        if (!validVectorStructure(vector, candidate)) { reject("PROJECTION_IDENTITY_MISMATCH"); continue; }
        if (!same(vector.index, request.vectorIndex)) { reject("INDEX_IDENTITY_MISMATCH"); continue; }
        const projectionRead = await this.projections.findExactByEntryIdentity(vector.indexEntryId, vector.indexEntryVersion);
        if (!projectionRead.found) { reject("PROJECTION_NOT_FOUND"); continue; }
        const projection = projectionRead.projection;
        const projectionFailure = correlateProjection(vector, candidate, projection, request);
        if (projectionFailure) { reject(projectionFailure); continue; }

        const embeddingRead = await this.embeddings.findExact(vector.embeddingIdentity);
        if (!embeddingRead.found) { reject("EMBEDDING_NOT_FOUND"); continue; }
        const embedding = embeddingRead.embedding;
        const { vectorDigest, createdAt: _, ...embeddingMaterial } = embedding;
        if (!same(embedding.identity, projection.embeddingIdentity)
          || !same(embedding.embeddingSchema, request.embeddingSchema)
          || !same(embedding.embeddingSchema, projection.embeddingSchema)
          || !same(embedding.normalizationStrategy, projection.normalizationStrategy)
          || embedding.purpose !== "RETRIEVAL_DOCUMENT"
          || embedding.vectorDimension !== projection.vectorDimension
          || embedding.vectorDigest !== projection.vectorDigest
          || calculateKnowledgeEmbeddingVectorDigest(embeddingMaterial) !== vectorDigest) {
          reject("EMBEDDING_LINEAGE_MISMATCH"); continue;
        }

        const documentRead = await this.documents.findExact(candidate.documentIdentity.documentId, candidate.documentIdentity.documentVersion);
        if (!documentRead.found) { reject("DOCUMENT_NOT_FOUND"); continue; }
        const document = documentRead.document;
        const documentFailure = validateDocument(document, request, policy);
        if (documentFailure) { reject(documentFailure); continue; }
        if (policy?.excludeSupersededMembers && await isSuperseded(document.identity, request, this.documents)) { reject("DOCUMENT_SUPERSEDED"); continue; }

        const manifestRead = await this.manifests.findExact(projection.chunkSetIdentity.chunkSetId, projection.chunkSetIdentity.chunkSetVersion);
        if (!manifestRead.found) { reject("MANIFEST_NOT_FOUND"); continue; }
        if (!same(manifestRead.manifest.identity, projection.chunkSetIdentity) || !same(manifestRead.manifest.documentIdentity, document.identity)) { reject("CHUNK_SET_LINEAGE_MISMATCH"); continue; }
        const set = await this.verifier.readExactCompleteSet(document.identity, manifestRead.manifest.strategy);
        if (!set.verified) { reject(set.code === "MANIFEST_NOT_FOUND" ? "MANIFEST_NOT_FOUND" : "CHUNK_SET_INCOMPLETE"); continue; }
        if (!same(set.set.manifest.identity, projection.chunkSetIdentity)) { reject("CHUNK_SET_LINEAGE_MISMATCH"); continue; }

        const chunkRead = await this.chunks.findExact(candidate.chunkIdentity.chunkId, candidate.chunkIdentity.chunkVersion);
        if (!chunkRead.found) { reject("CHUNK_NOT_FOUND"); continue; }
        const chunk = chunkRead.chunk;
        if (!same(chunk.identity, projection.chunkIdentity) || !same(chunk.documentIdentity, document.identity)) { reject("CHUNK_LINEAGE_MISMATCH"); continue; }
        if (!set.set.chunks.some((member) => same(member.identity, chunk.identity))) { reject("CHUNK_NOT_FOUND"); continue; }
        if (chunk.contentDigest !== projection.chunkDigest || vector.indexedChunkDigest !== chunk.contentDigest) { reject("CHUNK_DIGEST_MISMATCH"); continue; }
        if (embedding.chunkContentDigest !== chunk.contentDigest || !same(embedding.chunkIdentity, chunk.identity) || !same(embedding.chunkSetIdentity, projection.chunkSetIdentity)) { reject("EMBEDDING_LINEAGE_MISMATCH"); continue; }
        if (!validSourceSpan(chunk.sourceSpan)) { reject("SOURCE_SPAN_INVALID"); continue; }
        if (!matchesFilters(chunk.metadata, request.filters)) { reject("METADATA_FILTER_MISMATCH"); continue; }
        valid.push({ candidate, document, chunk, verifiedChunks: set.set.chunks, chunkSetIdentity: set.set.manifest.identity });
        continue;
      }

      if (!request.eligibleDocuments.some((identity) => same(identity, candidate.documentIdentity))) { reject("DOCUMENT_NOT_ELIGIBLE"); continue; }
      const documentRead = await this.documents.findExact(candidate.documentIdentity.documentId, candidate.documentIdentity.documentVersion);
      if (!documentRead.found) { reject("DOCUMENT_NOT_FOUND"); continue; }
      const document = documentRead.document;
      const documentFailure = validateDocument(document, request, policy);
      if (documentFailure) { reject(documentFailure); continue; }
      if (policy?.excludeSupersededMembers && await isSuperseded(document.identity, request, this.documents)) { reject("DOCUMENT_SUPERSEDED"); continue; }
      const chunkRead = await this.chunks.findExact(candidate.chunkIdentity.chunkId, candidate.chunkIdentity.chunkVersion);
      if (!chunkRead.found) { reject("CHUNK_NOT_FOUND"); continue; }
      const chunk = chunkRead.chunk;
      if (!same(chunk.documentIdentity, document.identity)) { reject("UNEXPECTED_CHUNK"); continue; }
      const set = await this.verifier.readExactCompleteSet(document.identity, chunk.strategy);
      if (!set.verified) { reject(set.code === "MANIFEST_NOT_FOUND" ? "MANIFEST_NOT_FOUND" : "CHUNK_SET_INCOMPLETE"); continue; }
      if (!set.set.chunks.some((member) => same(member.identity, chunk.identity))) { reject("CHUNK_NOT_FOUND"); continue; }
      if (!validSourceSpan(chunk.sourceSpan)) { reject("SOURCE_SPAN_INVALID"); continue; }
      if (!matchesFilters(chunk.metadata, request.filters)) { reject("METADATA_FILTER_MISMATCH"); continue; }
      valid.push({ candidate, document, chunk, verifiedChunks: set.set.chunks, chunkSetIdentity: set.set.manifest.identity });
    }
    return freezeClone({ valid, excluded });
  }
}

const validVectorStructure = (source: VectorSource, candidate: KnowledgeRetrievalCandidate) => /^[A-Z0-9_.:-]{1,160}$/.test(source.indexEntryId)
  && positive(source.indexEntryVersion) && /^[A-Z0-9_.:-]{1,160}$/.test(source.index.indexId) && positive(source.index.indexVersion)
  && typeof source.namespace === "string" && source.namespace.length > 0 && source.namespace.length <= 200
  && Number.isFinite(source.rawScore) && Number.isSafeInteger(source.providerOrdinal) && source.providerOrdinal >= 0
  && domainIdentity(candidate.documentIdentity.documentId, candidate.documentIdentity.documentVersion)
  && domainIdentity(candidate.chunkIdentity.chunkId, candidate.chunkIdentity.chunkVersion)
  && domainIdentity(source.embeddingIdentity.embeddingId, source.embeddingIdentity.embeddingVersion)
  && domainIdentity(source.chunkSetIdentity.chunkSetId, source.chunkSetIdentity.chunkSetVersion)
  && /^[a-f0-9]{64}$/.test(source.indexedChunkDigest) && /^[a-f0-9]{64}$/.test(source.indexedVectorDigest);

const correlateProjection = (
  source: VectorSource,
  candidate: KnowledgeRetrievalCandidate,
  projection: import("../types/knowledge-vector-index-projection.types.js").PersistedKnowledgeVectorIndexProjection,
  request: KnowledgeRetrievalRequest,
): KnowledgeRetrievalExclusion["code"] | null => {
  if (projection.identity.indexEntryId !== source.indexEntryId || projection.identity.indexEntryVersion !== source.indexEntryVersion) return "PROJECTION_IDENTITY_MISMATCH";
  if (!same(projection.indexDefinitionIdentity, source.index) || !same(projection.indexDefinitionIdentity, request.vectorIndex)) return "INDEX_IDENTITY_MISMATCH";
  if (projection.namespace !== source.namespace) return "NAMESPACE_MISMATCH";
  if (!same(projection.embeddingIdentity, source.embeddingIdentity)) return "EMBEDDING_LINEAGE_MISMATCH";
  if (!same(projection.documentIdentity, candidate.documentIdentity)) return "DOCUMENT_LINEAGE_MISMATCH";
  if (!same(projection.chunkSetIdentity, source.chunkSetIdentity)) return "CHUNK_SET_LINEAGE_MISMATCH";
  if (!same(projection.chunkIdentity, candidate.chunkIdentity)) return "CHUNK_LINEAGE_MISMATCH";
  if (projection.vectorDigest !== source.indexedVectorDigest) return "VECTOR_DIGEST_MISMATCH";
  if (source.searchableMetadata && !isDeepStrictEqual(source.searchableMetadata, projection.searchableMetadata)) return "SEARCHABLE_METADATA_MISMATCH";
  if (projection.corpus !== request.scope.corpus) return "CORPUS_MISMATCH";
  if (!request.scope.trustLevels.includes(projection.trustLevel)) return "TRUST_MISMATCH";
  if (!request.eligibleDocuments.some((identity) => same(identity, projection.documentIdentity))) return "DOCUMENT_NOT_ELIGIBLE";
  return null;
};

const validateDocument = (document: import("../types/knowledge-document.types.js").PersistedKnowledgeDocument, request: KnowledgeRetrievalRequest, policy?: KnowledgeRetrievalPolicy): KnowledgeRetrievalExclusion["code"] | null => {
  if (!request.eligibleDocuments.some((identity) => same(identity, document.identity))) return "DOCUMENT_NOT_ELIGIBLE";
  if (document.corpus !== request.scope.corpus) return "CORPUS_MISMATCH";
  if (!request.scope.trustLevels.includes(document.trustLevel)) return "TRUST_MISMATCH";
  if (request.scope.documentTypes && !request.scope.documentTypes.includes(document.documentType)) return "DOCUMENT_TYPE_MISMATCH";
  if ((document.effectiveFrom && document.effectiveFrom.getTime() > request.asOf.getTime()) || (document.effectiveUntil && request.asOf.getTime() >= document.effectiveUntil.getTime())) return "DOCUMENT_OUTSIDE_EFFECTIVE_TIME";
  return null;
};

const isSuperseded = async (identity: import("../types/knowledge-document.types.js").KnowledgeDocumentIdentity, request: KnowledgeRetrievalRequest, documents: Pick<KnowledgeDocumentRepository, "findExact">) => {
  for (const otherIdentity of request.eligibleDocuments) {
    if (same(otherIdentity, identity)) continue;
    const other = await documents.findExact(otherIdentity.documentId, otherIdentity.documentVersion);
    if (other.found && other.document.supersedes && same(other.document.supersedes, identity)) return true;
  }
  return false;
};

const same = (a: object, b: object) => isDeepStrictEqual(a, b);
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
const domainIdentity = (id: unknown, version: unknown) => typeof id === "string" && /^[A-Z0-9_.:-]{1,160}$/.test(id) && positive(version);
const matchesFilters = (metadata: any, filters: any) => !filters
  || (!filters.factorKeys || filters.factorKeys.every((value: string) => metadata.factors.some((factor: any) => factor.factorKey === value)))
  && (!filters.relationshipTypes || filters.relationshipTypes.every((value: string) => metadata.relationshipTypes.includes(value)))
  && (!filters.subjectTypes || filters.subjectTypes.every((value: string) => metadata.subjectTypes.includes(value)))
  && (!filters.topics || filters.topics.every((value: string) => metadata.topics.includes(value)))
  && (!filters.validationCodes || filters.validationCodes.every((value: string) => metadata.validationCodes.includes(value)))
  && (!filters.adrNumbers || filters.adrNumbers.every((value: string) => String(metadata.adr?.number) === value))
  && (!filters.exampleClassifications || filters.exampleClassifications.includes(metadata.exampleClassification));
