import { CanonicalCompilationInputService } from "./canonical-compilation-input.service.js";
import { freezeClone } from "./knowledge-document-admission.service.js";
import type {
  CreateKnowledgeVectorIndexProjectionInput,
  KnowledgeVectorIndexProjectionCommand,
  KnowledgeVectorIndexProjectionServiceResult,
  KnowledgeVectorSearchableMetadata,
} from "../types/knowledge-vector-index-projection.types.js";
import { KNOWLEDGE_CHUNK_TYPES, KNOWLEDGE_EXAMPLE_CLASSIFICATIONS } from "../types/knowledge-chunk.types.js";
import { KNOWLEDGE_TRUST_LEVELS, PLATFORM_KNOWLEDGE_DOCUMENT_TYPES } from "../types/knowledge-document.types.js";
import type { KnowledgeVectorIndexProjectionRepository } from "../repositories/knowledge-vector-index-projection.repository.js";

export class KnowledgeVectorIndexProjectionService {
  public constructor(
    private readonly repository: Pick<KnowledgeVectorIndexProjectionRepository, "insertExact">,
    private readonly canonical = new CanonicalCompilationInputService(),
  ) {}

  public async create(input: CreateKnowledgeVectorIndexProjectionInput): Promise<KnowledgeVectorIndexProjectionServiceResult> {
    const failureCode = validateKnowledgeVectorIndexProjectionInput(input);
    if (failureCode) return Object.freeze({ status: "VALIDATION_FAILED", failureCode });
    const projectionDigest = calculateKnowledgeVectorIndexProjectionDigest(input, this.canonical);
    if (!projectionDigest) return Object.freeze({ status: "VALIDATION_FAILED", failureCode: "PROJECTION_DIGEST_FAILED" });
    return this.repository.insertExact(freezeClone({ ...input, searchableMetadata: canonicalMetadata(input.searchableMetadata), projectionDigest }));
  }
}

export const calculateKnowledgeVectorIndexProjectionDigest = (
  input: CreateKnowledgeVectorIndexProjectionInput,
  canonical = new CanonicalCompilationInputService(),
): string | null => {
  const material = {
    ...input,
    vector: undefined,
    searchableMetadata: metadataDigestMaterial(canonicalMetadata(input.searchableMetadata)),
  };
  const { vector: _, ...withoutVector } = material;
  const result = canonical.hash(withoutVector);
  return result.hashed ? result.hash : null;
};

export const validateKnowledgeVectorIndexProjectionInput = (
  input: CreateKnowledgeVectorIndexProjectionInput,
): string | null => {
  const value = input as CreateKnowledgeVectorIndexProjectionInput & Record<string, unknown>;
  if ("createdAt" in value || "_id" in value || "status" in value) return "CALLER_CONTROLLED_PERSISTENCE_FIELD";
  if (!identifier(input?.identity?.indexEntryId) || !positive(input?.identity?.indexEntryVersion)) return "INVALID_ENTRY_IDENTITY";
  if (!identifier(input.indexDefinitionIdentity?.indexId) || !positive(input.indexDefinitionIdentity?.indexVersion)) return "INVALID_INDEX_IDENTITY";
  if (!namespace(input.namespace)) return "INVALID_NAMESPACE";
  if (!identifier(input.metadataSchema?.metadataSchemaId) || !positive(input.metadataSchema?.metadataSchemaVersion)) return "INVALID_METADATA_SCHEMA";
  if (!identifier(input.embeddingIdentity?.embeddingId) || !positive(input.embeddingIdentity?.embeddingVersion)) return "INVALID_EMBEDDING_IDENTITY";
  if (!identifier(input.embeddingSchema?.embeddingSchemaId) || !positive(input.embeddingSchema?.embeddingSchemaVersion)) return "INVALID_EMBEDDING_SCHEMA";
  if (input.purpose !== "RETRIEVAL_DOCUMENT") return "PURPOSE_NOT_SUPPORTED";
  if (!identifier(input.normalizationStrategy?.normalizationStrategyId) || !positive(input.normalizationStrategy?.normalizationStrategyVersion)) return "INVALID_NORMALIZATION_STRATEGY";
  if (!positive(input.vectorDimension) || !Array.isArray(input.vector) || input.vector.length !== input.vectorDimension) return "VECTOR_DIMENSION_MISMATCH";
  if (input.vector.some((number) => !Number.isFinite(number))) return "VECTOR_CONTAINS_NON_FINITE_VALUE";
  if (input.similarityMetric !== "COSINE") return "METRIC_NOT_SUPPORTED";
  if (!digest(input.vectorDigest) || !digest(input.chunkDigest)) return "INVALID_SOURCE_DIGEST";
  if (!identifier(input.documentIdentity?.documentId) || !positive(input.documentIdentity?.documentVersion)
    || !identifier(input.chunkSetIdentity?.chunkSetId) || !positive(input.chunkSetIdentity?.chunkSetVersion)
    || !identifier(input.chunkIdentity?.chunkId) || !positive(input.chunkIdentity?.chunkVersion)) return "INVALID_SOURCE_LINEAGE";
  if (input.corpus !== "PLATFORM_KNOWLEDGE") return "CORPUS_NOT_SUPPORTED";
  if (!KNOWLEDGE_TRUST_LEVELS.includes(input.trustLevel) || !["AUTHORITATIVE", "APPROVED_GUIDANCE", "EXPLANATORY"].includes(input.trustLevel)) return "TRUST_NOT_SUPPORTED";
  return validateMetadata(input.searchableMetadata);
};

const validateMetadata = (metadata: KnowledgeVectorSearchableMetadata): string | null => {
  if (!metadata || Object.keys(metadata).some((key) => !METADATA_KEYS.has(key))) return "METADATA_INVALID";
  if (!PLATFORM_KNOWLEDGE_DOCUMENT_TYPES.includes(metadata.documentType) || !KNOWLEDGE_CHUNK_TYPES.includes(metadata.chunkType)) return "METADATA_INVALID";
  if (!boundedArray(metadata.factors, (factor) => identifier(factor.factorKey) && positive(factor.factorVersion), (factor) => `${factor.factorKey}:${factor.factorVersion}`)) return "METADATA_INVALID";
  for (const values of [metadata.relationshipTypes, metadata.subjectTypes, metadata.topics, metadata.validationCodes]) {
    if (!boundedArray(values, (entry) => bounded(entry, 160), (entry) => entry)) return "METADATA_INVALID";
  }
  if (metadata.exampleClassification !== undefined && !KNOWLEDGE_EXAMPLE_CLASSIFICATIONS.includes(metadata.exampleClassification)) return "METADATA_INVALID";
  if (metadata.adr && (!positive(metadata.adr.number) || !bounded(metadata.adr.status, 160))) return "METADATA_INVALID";
  if (!validDate(metadata.effectiveFrom) || !validDate(metadata.effectiveUntil)
    || (metadata.effectiveFrom && metadata.effectiveUntil && metadata.effectiveFrom.getTime() >= metadata.effectiveUntil.getTime())) return "INVALID_EFFECTIVE_INTERVAL";
  return null;
};

const canonicalMetadata = (metadata: KnowledgeVectorSearchableMetadata): KnowledgeVectorSearchableMetadata => freezeClone({
  documentType: metadata.documentType,
  chunkType: metadata.chunkType,
  factors: [...metadata.factors].sort((a, b) => a.factorKey.localeCompare(b.factorKey) || a.factorVersion - b.factorVersion),
  relationshipTypes: [...metadata.relationshipTypes].sort(),
  subjectTypes: [...metadata.subjectTypes].sort(),
  topics: [...metadata.topics].sort(),
  validationCodes: [...metadata.validationCodes].sort(),
  ...(metadata.exampleClassification ? { exampleClassification: metadata.exampleClassification } : {}),
  ...(metadata.adr ? { adr: metadata.adr } : {}),
  ...(metadata.effectiveFrom ? { effectiveFrom: new Date(metadata.effectiveFrom.getTime()) } : {}),
  ...(metadata.effectiveUntil ? { effectiveUntil: new Date(metadata.effectiveUntil.getTime()) } : {}),
});
const metadataDigestMaterial = (metadata: KnowledgeVectorSearchableMetadata) => ({
  ...metadata,
  effectiveFrom: metadata.effectiveFrom?.toISOString() ?? null,
  effectiveUntil: metadata.effectiveUntil?.toISOString() ?? null,
  exampleClassification: metadata.exampleClassification ?? null,
  adr: metadata.adr ?? null,
});
const METADATA_KEYS = new Set(["documentType", "chunkType", "factors", "relationshipTypes", "subjectTypes", "topics", "validationCodes", "exampleClassification", "adr", "effectiveFrom", "effectiveUntil"]);
const identifier = (value: unknown): value is string => typeof value === "string" && /^[A-Z0-9_.:-]{1,160}$/.test(value);
const namespace = (value: unknown): value is string => typeof value === "string" && /^[A-Z0-9_.:-]{1,200}$/.test(value);
const bounded = (value: unknown, max: number): value is string => typeof value === "string" && value.trim() === value && value.length > 0 && value.length <= max;
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
const digest = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const validDate = (value: unknown) => value === undefined || (value instanceof Date && Number.isFinite(value.getTime()));
const boundedArray = <T>(values: readonly T[], validate: (value: T) => boolean, key: (value: T) => string) => Array.isArray(values) && values.length <= 100 && values.every((_, index) => index in values) && values.every(validate) && new Set(values.map(key)).size === values.length;

export type { KnowledgeVectorIndexProjectionCommand };
