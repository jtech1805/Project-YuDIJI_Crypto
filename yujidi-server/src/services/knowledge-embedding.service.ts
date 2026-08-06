import type { KnowledgeEmbeddingPort } from "../ports/knowledge-embedding.port.js";
import { KnowledgeEmbeddingRepository } from "../repositories/knowledge-embedding.repository.js";
import { KnowledgeDocumentRepository } from "../repositories/knowledge-document.repository.js";
import { KnowledgeEmbeddingSchemaRegistry } from "../registries/knowledge-embedding-schema.registry.js";
import type { PersistedKnowledgeChunk } from "../types/knowledge-chunk.types.js";
import type {
  KnowledgeEmbeddingCommand,
  KnowledgeEmbeddingGenerationPolicy,
  KnowledgeEmbeddingGenerationRequest,
  KnowledgeEmbeddingGenerationResult,
  KnowledgeEmbeddingProviderResult,
  KnowledgeEmbeddingSchemaDefinition,
  KnowledgeEmbeddingTextProjection,
} from "../types/knowledge-embedding.types.js";
import { KNOWLEDGE_EMBEDDING_GENERATION_POLICY } from "../types/knowledge-embedding.types.js";
import { CanonicalCompilationInputService } from "./canonical-compilation-input.service.js";
import { KnowledgeChunkSetVerificationService } from "./knowledge-chunk-set-verification.service.js";
import { freezeClone } from "./knowledge-document-admission.service.js";
import { KnowledgeEmbeddingTextService } from "./knowledge-embedding-text.service.js";
import { KnowledgeEmbeddingNormalizationService } from "./knowledge-embedding-normalization.service.js";

export class KnowledgeEmbeddingService {
  public constructor(
    private readonly schemas: KnowledgeEmbeddingSchemaRegistry,
    private readonly provider: KnowledgeEmbeddingPort,
    private readonly verifier = new KnowledgeChunkSetVerificationService(),
    private readonly documents = new KnowledgeDocumentRepository(),
    private readonly embeddings = new KnowledgeEmbeddingRepository(),
    private readonly textProjector = new KnowledgeEmbeddingTextService(),
    private readonly policy: KnowledgeEmbeddingGenerationPolicy = KNOWLEDGE_EMBEDDING_GENERATION_POLICY,
    private readonly canonical = new CanonicalCompilationInputService(),
    private readonly normalization = new KnowledgeEmbeddingNormalizationService(),
  ) {}

  public async generate(request: KnowledgeEmbeddingGenerationRequest): Promise<KnowledgeEmbeddingGenerationResult> {
    if (!validRequest(request, this.policy.maxBatchSize)) return result("VALIDATION_FAILED", [], 0, null);
    const schema = this.schemas.getExact(
      request.schemaIdentity.embeddingSchemaId,
      request.schemaIdentity.embeddingSchemaVersion,
    );
    if (!schema) return result("SCHEMA_NOT_FOUND", [], 0, null);
    if (!schema.activeForGeneration) return result("SCHEMA_INACTIVE", [], 0, schema.vectorDimension);
    if (!schema.allowedPurposes.includes("RETRIEVAL_DOCUMENT")) return result("PURPOSE_NOT_ALLOWED", [], 0, schema.vectorDimension, "PURPOSE_NOT_ALLOWED");

    const verified = await this.verifier.readExactCompleteSet(request.documentIdentity, request.strategy);
    if (!verified.verified) {
      const status = verified.code === "MANIFEST_NOT_FOUND" ? "CHUNK_SET_NOT_FOUND" : "CHUNK_SET_NOT_COMPLETE";
      return result(status, [], 0, schema.vectorDimension, verified.code);
    }
    if (verified.set.manifest.identity.chunkSetId !== request.chunkSetIdentity.chunkSetId
      || verified.set.manifest.identity.chunkSetVersion !== request.chunkSetIdentity.chunkSetVersion) {
      return result("CHUNK_LINEAGE_MISMATCH", [], 0, schema.vectorDimension);
    }
    const documentRead = await this.documents.findExact(
      request.documentIdentity.documentId,
      request.documentIdentity.documentVersion,
    );
    if (!documentRead.found) return result("INVARIANT_VIOLATION", [], 0, schema.vectorDimension, documentRead.code);
    const document = documentRead.document;
    if (!this.policy.allowedCorpora.includes(document.corpus) || !schema.allowedCorpora.includes(document.corpus)) {
      return result("CORPUS_NOT_ALLOWED", [], 0, schema.vectorDimension);
    }
    if (!this.policy.allowedTrustLevels.includes(document.trustLevel)
      || !schema.allowedTrustLevels.includes(document.trustLevel)) {
      return result("TRUST_NOT_ALLOWED", [], 0, schema.vectorDimension);
    }

    const byChunk = new Map(request.embeddings.map((entry) => [chunkKey(entry.chunkIdentity), entry]));
    if (byChunk.size !== request.embeddings.length || request.embeddings.length !== verified.set.chunks.length
      || verified.set.chunks.some((chunk) => !byChunk.has(chunkKey(chunk.identity)))) {
      return result("CHUNK_LINEAGE_MISMATCH", [], 0, schema.vectorDimension);
    }

    const projections: Array<{ chunk: PersistedKnowledgeChunk; projection: KnowledgeEmbeddingTextProjection; embedding: typeof request.embeddings[number] }> = [];
    let totalCharacters = 0;
    for (const chunk of verified.set.chunks) {
      const manifestEntry = verified.set.manifest.orderedChunks.find((entry) =>
        entry.chunkId === chunk.identity.chunkId && entry.chunkVersion === chunk.identity.chunkVersion);
      if (!manifestEntry || manifestEntry.chunkDigest !== chunk.contentDigest) {
        return result("CHUNK_DIGEST_MISMATCH", [], totalCharacters, schema.vectorDimension);
      }
      const projection = this.textProjector.project(document, verified.set, chunk.identity, schema);
      if (!projection) return result("VALIDATION_FAILED", [], totalCharacters, schema.vectorDimension);
      totalCharacters += projection.characterCount;
      if (projection.characterCount > this.policy.maxTextCharactersPerChunk
        || totalCharacters > this.policy.maxTotalCharactersPerBatch) {
        return result("BATCH_LIMIT_EXCEEDED", [], totalCharacters, schema.vectorDimension);
      }
      projections.push({ chunk, projection, embedding: byChunk.get(chunkKey(chunk.identity))! });
    }

    const providerRequest = freezeClone({
      purpose: "RETRIEVAL_DOCUMENT" as const,
      requestId: request.requestId,
      requestVersion: request.requestVersion,
      schemaIdentity: request.schemaIdentity,
      providerIdentity: { providerId: schema.providerId, providerVersion: schema.providerVersion },
      modelIdentity: { modelId: schema.modelId, modelVersion: schema.modelVersion },
      inputs: projections.map(({ chunk, projection, embedding }) => ({
        inputId: embeddingKey(embedding.embeddingIdentity),
        chunkId: chunk.identity.chunkId,
        chunkVersion: chunk.identity.chunkVersion,
        text: projection.text,
        textDigest: projection.textDigest,
      })),
    });
    let providerResult: KnowledgeEmbeddingProviderResult;
    try {
      providerResult = await this.provider.embed(providerRequest);
    } catch {
      return result("PROVIDER_FAILED", [], totalCharacters, schema.vectorDimension, "PROVIDER_THROWN");
    }
    const vectors = validateProviderResult(providerResult, schema, providerRequest.inputs.map((input) => input.inputId));
    if (!vectors.valid) return result(vectors.providerFailed ? "PROVIDER_FAILED" : "PROVIDER_OUTPUT_INVALID", [], totalCharacters, schema.vectorDimension, vectors.code);

    const outcomes: Array<{ identity: typeof request.embeddings[number]["embeddingIdentity"]; chunkIdentity: typeof request.embeddings[number]["chunkIdentity"]; outcome: "CREATED" | "ALREADY_EXISTS" | "FAILED"; code?: string }> = [];
    for (const item of projections) {
      const rawVector = vectors.values.get(embeddingKey(item.embedding.embeddingIdentity))!;
      const normalized = this.normalization.normalize({ normalizationStrategyId: schema.normalizationStrategyId, normalizationStrategyVersion: schema.normalizationStrategyVersion }, rawVector);
      if (normalized.status === "FAILED") { outcomes.push({ identity: item.embedding.embeddingIdentity, chunkIdentity: item.chunk.identity, outcome: "FAILED", code: normalized.failureCode }); continue; }
      const vector = normalized.vector;
      const command = createCommand(request, schema, document.corpus, document.trustLevel, item, vector, this.canonical);
      if (!command) {
        outcomes.push({ identity: item.embedding.embeddingIdentity, chunkIdentity: item.chunk.identity, outcome: "FAILED", code: "VECTOR_DIGEST_FAILED" });
        continue;
      }
      const inserted = await this.embeddings.insert(command);
      outcomes.push(inserted.inserted
        ? { identity: item.embedding.embeddingIdentity, chunkIdentity: item.chunk.identity, outcome: "CREATED" }
        : inserted.code === "ALREADY_EXISTS"
          ? { identity: item.embedding.embeddingIdentity, chunkIdentity: item.chunk.identity, outcome: "ALREADY_EXISTS" }
          : { identity: item.embedding.embeddingIdentity, chunkIdentity: item.chunk.identity, outcome: "FAILED", code: inserted.code });
    }
    const failed = outcomes.filter((outcome) => outcome.outcome === "FAILED").length;
    const normalizationFailures = outcomes.filter((outcome) => outcome.outcome === "FAILED" && (outcome.code?.startsWith("VECTOR_") || outcome.code?.startsWith("NORMALIZ"))).length;
    const status = failed === 0 ? "COMPLETED" : failed === outcomes.length && normalizationFailures === failed ? "NORMALIZATION_FAILED" : failed === outcomes.length ? "PERSISTENCE_FAILED" : "PARTIAL";
    return result(status, outcomes, totalCharacters, schema.vectorDimension);
  }
}

const createCommand = (
  request: KnowledgeEmbeddingGenerationRequest,
  schema: KnowledgeEmbeddingSchemaDefinition,
  corpus: KnowledgeEmbeddingCommand["corpus"],
  trustLevel: KnowledgeEmbeddingCommand["trustLevel"],
  item: { chunk: PersistedKnowledgeChunk; projection: KnowledgeEmbeddingTextProjection; embedding: KnowledgeEmbeddingGenerationRequest["embeddings"][number] },
  vector: readonly number[],
  canonical: CanonicalCompilationInputService,
): KnowledgeEmbeddingCommand | null => {
  const material = {
    identity: item.embedding.embeddingIdentity,
    chunkSetIdentity: request.chunkSetIdentity,
    documentIdentity: request.documentIdentity,
    chunkIdentity: item.chunk.identity,
    chunkContentDigest: item.chunk.contentDigest,
    embeddingTextProjector: { projectorId: item.projection.projectorId, projectorVersion: item.projection.projectorVersion },
    embeddingTextDigest: item.projection.textDigest,
    provider: { providerId: schema.providerId, providerVersion: schema.providerVersion },
    model: { modelId: schema.modelId, modelVersion: schema.modelVersion },
    embeddingSchema: { embeddingSchemaId: schema.embeddingSchemaId, embeddingSchemaVersion: schema.embeddingSchemaVersion },
    normalizationStrategy: { normalizationStrategyId: schema.normalizationStrategyId, normalizationStrategyVersion: schema.normalizationStrategyVersion },
    purpose: "RETRIEVAL_DOCUMENT" as const,
    vectorDimension: schema.vectorDimension,
    vector: [...vector],
    corpus,
    trustLevel,
  };
  const vectorDigest = calculateKnowledgeEmbeddingVectorDigest(material, canonical);
  return vectorDigest ? freezeClone({ ...material, vectorDigest }) : null;
};

export const calculateKnowledgeEmbeddingVectorDigest = (
  material: Omit<KnowledgeEmbeddingCommand, "vectorDigest">,
  canonical = new CanonicalCompilationInputService(),
): string | null => {
  const hashed = canonical.hash(material);
  return hashed.hashed ? hashed.hash : null;
};

const validateProviderResult = (
  output: KnowledgeEmbeddingProviderResult,
  schema: KnowledgeEmbeddingSchemaDefinition,
  expectedIds: readonly string[],
): { valid: true; values: ReadonlyMap<string, readonly number[]> } | { valid: false; code: string; providerFailed: boolean } => {
  if (output.status === "FAILED") return { valid: false, code: output.failureCode, providerFailed: true };
  if (output.providerId !== schema.providerId || output.providerVersion !== schema.providerVersion) return { valid: false, code: "PROVIDER_IDENTITY_MISMATCH", providerFailed: false };
  if (output.modelId !== schema.modelId || output.modelVersion !== schema.modelVersion) return { valid: false, code: "MODEL_IDENTITY_MISMATCH", providerFailed: false };
  if (output.vectors.length !== expectedIds.length) return { valid: false, code: "VECTOR_COUNT_MISMATCH", providerFailed: false };
  const values = new Map<string, readonly number[]>();
  for (const vector of output.vectors) {
    if (values.has(vector.inputId) || !expectedIds.includes(vector.inputId)) return { valid: false, code: "VECTOR_INPUT_MISMATCH", providerFailed: false };
    if (!Array.isArray(vector.values) || vector.values.length !== schema.vectorDimension) return { valid: false, code: "VECTOR_DIMENSION_MISMATCH", providerFailed: false };
    if (vector.values.some((value) => typeof value !== "number" || !Number.isFinite(value))) return { valid: false, code: "VECTOR_INVALID", providerFailed: false };
    values.set(vector.inputId, freezeClone(vector.values));
  }
  return expectedIds.every((id) => values.has(id)) ? { valid: true, values } : { valid: false, code: "VECTOR_INPUT_MISMATCH", providerFailed: false };
};

const validRequest = (request: KnowledgeEmbeddingGenerationRequest, maxBatch: number) =>
  identifier(request?.requestId) && positive(request.requestVersion)
  && identifier(request.documentIdentity?.documentId) && positive(request.documentIdentity?.documentVersion)
  && identifier(request.strategy?.strategyId) && positive(request.strategy?.strategyVersion)
  && identifier(request.chunkSetIdentity?.chunkSetId) && positive(request.chunkSetIdentity?.chunkSetVersion)
  && identifier(request.schemaIdentity?.embeddingSchemaId) && positive(request.schemaIdentity?.embeddingSchemaVersion)
  && Array.isArray(request.embeddings) && request.embeddings.length > 0 && request.embeddings.length <= maxBatch
  && new Set(request.embeddings.map((entry) => embeddingKey(entry.embeddingIdentity))).size === request.embeddings.length;
const result = (
  status: KnowledgeEmbeddingGenerationResult["status"],
  embeddings: KnowledgeEmbeddingGenerationResult["embeddings"],
  totalCharacters: number,
  vectorDimension: number | null,
  failureCode?: string,
): KnowledgeEmbeddingGenerationResult => freezeClone({
  status,
  embeddings,
  summary: {
    requested: embeddings.length,
    created: embeddings.filter((entry) => entry.outcome === "CREATED").length,
    existing: embeddings.filter((entry) => entry.outcome === "ALREADY_EXISTS").length,
    failed: embeddings.filter((entry) => entry.outcome === "FAILED").length,
    totalCharacters,
    vectorDimension,
  },
  ...(failureCode ? { failureCode } : {}),
});
const embeddingKey = (identity: { embeddingId: string; embeddingVersion: number }) => `${identity.embeddingId}:${identity.embeddingVersion}`;
const chunkKey = (identity: { chunkId: string; chunkVersion: number }) => `${identity.chunkId}:${identity.chunkVersion}`;
const identifier = (value: unknown): value is string => typeof value === "string" && /^[A-Z0-9_.:-]{1,160}$/.test(value);
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
