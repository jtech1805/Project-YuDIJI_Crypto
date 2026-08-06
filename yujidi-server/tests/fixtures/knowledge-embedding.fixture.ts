import { KnowledgeChunkSetManifestService } from "../../src/services/knowledge-chunk-set-manifest.service.js";
import { FactorDocumentationStrategy } from "../../src/strategies/platform-knowledge/factor-documentation.strategy.js";
import type { KnowledgeEmbeddingCommand, KnowledgeEmbeddingGenerationRequest, KnowledgeEmbeddingSchemaDefinition, PersistedKnowledgeEmbedding } from "../../src/types/knowledge-embedding.types.js";
import type { KnowledgeVectorIndexDefinition } from "../../src/types/knowledge-vector-index-definition.types.js";
import { persistedDocument } from "./platform-knowledge.fixture.js";
import { calculateKnowledgeEmbeddingVectorDigest } from "../../src/services/knowledge-embedding.service.js";

export const TEST_EMBEDDING_SCHEMA: KnowledgeEmbeddingSchemaDefinition = Object.freeze({
  embeddingSchemaId: "YUDIJI_PLATFORM_KNOWLEDGE_EMBEDDING_SCHEMA",
  embeddingSchemaVersion: 1,
  providerId: "YUDIJI_DETERMINISTIC_TEST_EMBEDDING_PROVIDER",
  providerVersion: 1,
  modelId: "YUDIJI_DETERMINISTIC_TEST_EMBEDDING_MODEL",
  modelVersion: "CHARACTERIZATION_V1",
  vectorDimension: 4,
  similarityMetric: "COSINE",
  normalizationStrategyId: "TEST_NO_NORMALIZATION",
  normalizationStrategyVersion: 1,
  embeddingTextProjectorId: "PLATFORM_KNOWLEDGE_EMBEDDING_TEXT",
  embeddingTextProjectorVersion: 1,
  allowedCorpora: Object.freeze(["PLATFORM_KNOWLEDGE"] as const),
  allowedTrustLevels: Object.freeze(["AUTHORITATIVE", "APPROVED_GUIDANCE", "EXPLANATORY"] as const),
  activeForGeneration: true,
});

export const TEST_INDEX_DEFINITION: KnowledgeVectorIndexDefinition = Object.freeze({
  indexId: "YUDIJI_PLATFORM_KNOWLEDGE_INDEX",
  indexVersion: 1,
  indexSchemaId: "YUDIJI_TEST_VECTOR_INDEX_SCHEMA",
  indexSchemaVersion: 1,
  namespace: "YUDIJI:PLATFORM_KNOWLEDGE:TEST",
  corpus: "PLATFORM_KNOWLEDGE",
  allowedTrustLevels: Object.freeze(["AUTHORITATIVE", "APPROVED_GUIDANCE", "EXPLANATORY"] as const),
  embeddingSchema: { embeddingSchemaId: TEST_EMBEDDING_SCHEMA.embeddingSchemaId, embeddingSchemaVersion: 1 },
  vectorDimension: 4,
  similarityMetric: "COSINE",
  metadataSchemaId: "PLATFORM_KNOWLEDGE_INDEX_METADATA",
  metadataSchemaVersion: 1,
  writePolicyId: "PLATFORM_KNOWLEDGE_INDEX_WRITE",
  writePolicyVersion: 1,
  retrievalEligible: false,
});

export const verifiedEmbeddingFixture = () => {
  const document = persistedDocument();
  const candidates = FactorDocumentationStrategy.chunk(document);
  const chunks = candidates.map((chunk) => ({ ...chunk, createdAt: new Date("2026-08-06") }));
  const built = new KnowledgeChunkSetManifestService().build({
    identity: { chunkSetId: "ETF_FLOW_CHUNK_SET", chunkSetVersion: 1 },
    documentIdentity: document.identity,
    strategy: candidates[0]!.strategy,
    chunks: candidates,
  });
  if (!built.built) throw new Error(built.code);
  const manifest = { ...built.manifest, createdAt: new Date("2026-08-06") };
  const request: KnowledgeEmbeddingGenerationRequest = {
    requestId: "EMBED_ETF_FLOW",
    requestVersion: 1,
    documentIdentity: document.identity,
    strategy: candidates[0]!.strategy,
    chunkSetIdentity: manifest.identity,
    schemaIdentity: { embeddingSchemaId: TEST_EMBEDDING_SCHEMA.embeddingSchemaId, embeddingSchemaVersion: 1 },
    embeddings: chunks.map((chunk, index) => ({
      chunkIdentity: chunk.identity,
      embeddingIdentity: { embeddingId: `ETF_FLOW_EMBEDDING_${index}`, embeddingVersion: 1 },
    })),
  };
  return { document, chunks, manifest, verifiedSet: { manifest, chunks }, request };
};

export const embeddingCommand = (index = 0): KnowledgeEmbeddingCommand => {
  const fixture = verifiedEmbeddingFixture();
  const chunk = fixture.chunks[index]!;
  const material: Omit<KnowledgeEmbeddingCommand, "vectorDigest"> = {
    identity: fixture.request.embeddings[index]!.embeddingIdentity,
    chunkSetIdentity: fixture.manifest.identity,
    documentIdentity: fixture.document.identity,
    chunkIdentity: chunk.identity,
    chunkContentDigest: chunk.contentDigest,
    embeddingTextProjector: { projectorId: TEST_EMBEDDING_SCHEMA.embeddingTextProjectorId, projectorVersion: 1 },
    embeddingTextDigest: "1".repeat(64),
    provider: { providerId: TEST_EMBEDDING_SCHEMA.providerId, providerVersion: 1 },
    model: { modelId: TEST_EMBEDDING_SCHEMA.modelId, modelVersion: TEST_EMBEDDING_SCHEMA.modelVersion },
    embeddingSchema: { embeddingSchemaId: TEST_EMBEDDING_SCHEMA.embeddingSchemaId, embeddingSchemaVersion: 1 },
    normalizationStrategy: { normalizationStrategyId: TEST_EMBEDDING_SCHEMA.normalizationStrategyId, normalizationStrategyVersion: 1 },
    vectorDimension: 4,
    vector: Object.freeze([0.1, 0.2, 0.3, 0.4]),
    corpus: "PLATFORM_KNOWLEDGE",
    trustLevel: "APPROVED_GUIDANCE",
  };
  const vectorDigest = calculateKnowledgeEmbeddingVectorDigest(material);
  if (!vectorDigest) throw new Error("VECTOR_DIGEST_FAILED");
  return { ...material, vectorDigest };
};

export const persistedEmbedding = (index = 0): PersistedKnowledgeEmbedding => ({ ...embeddingCommand(index), createdAt: new Date("2026-08-06") });
