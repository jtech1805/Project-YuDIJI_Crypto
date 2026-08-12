import { isDeepStrictEqual } from "node:util";
import { freezeClone } from "../services/knowledge/knowledge-document-admission.service.js";
import { KNOWLEDGE_CORPORA, KNOWLEDGE_TRUST_LEVELS } from "../types/knowledge-document.types.js";
import { KNOWLEDGE_SIMILARITY_METRICS, type KnowledgeEmbeddingSchemaDefinition } from "../types/knowledge-embedding.types.js";
import { KNOWLEDGE_EMBEDDING_PURPOSES } from "../types/knowledge-embedding.types.js";
import { KNOWLEDGE_EMBEDDING_NORMALIZATION_AUTHORITY, type KnowledgeEmbeddingNormalizationRegistry } from "./knowledge-embedding-normalization.registry.js";

export class KnowledgeEmbeddingSchemaRegistry {
  private readonly definitions: ReadonlyMap<string, KnowledgeEmbeddingSchemaDefinition>;

  public constructor(definitions: readonly KnowledgeEmbeddingSchemaDefinition[], normalization: Pick<KnowledgeEmbeddingNormalizationRegistry, "getExact"> = KNOWLEDGE_EMBEDDING_NORMALIZATION_AUTHORITY) {
    const entries = new Map<string, KnowledgeEmbeddingSchemaDefinition>();
    for (const definition of definitions) {
      validate(definition, normalization);
      const key = identityKey(definition.embeddingSchemaId, definition.embeddingSchemaVersion);
      const existing = entries.get(key);
      if (existing) {
        throw new Error(isDeepStrictEqual(existing, definition)
          ? "DUPLICATE_KNOWLEDGE_EMBEDDING_SCHEMA"
          : "CONFLICTING_KNOWLEDGE_EMBEDDING_SCHEMA");
      }
      entries.set(key, freezeClone(definition));
    }
    this.definitions = entries;
  }

  public getExact(schemaId: string, schemaVersion: number): KnowledgeEmbeddingSchemaDefinition | null {
    const definition = this.definitions.get(identityKey(schemaId, schemaVersion));
    return definition ? freezeClone(definition) : null;
  }

  public list(): readonly KnowledgeEmbeddingSchemaDefinition[] {
    return freezeClone([...this.definitions.values()].sort((a, b) =>
      a.embeddingSchemaId.localeCompare(b.embeddingSchemaId)
      || a.embeddingSchemaVersion - b.embeddingSchemaVersion));
  }
}

const validate = (definition: KnowledgeEmbeddingSchemaDefinition, normalization: Pick<KnowledgeEmbeddingNormalizationRegistry, "getExact">): void => {
  const strategy = normalization.getExact(definition.normalizationStrategyId, definition.normalizationStrategyVersion);
  if (!identifier(definition.embeddingSchemaId)
    || !positive(definition.embeddingSchemaVersion)
    || !identifier(definition.providerId)
    || !positive(definition.providerVersion)
    || !bounded(definition.modelId, 120)
    || !bounded(definition.modelVersion, 120)
    || !positive(definition.vectorDimension)
    || definition.vectorDimension > 4_096
    || !KNOWLEDGE_SIMILARITY_METRICS.includes(definition.similarityMetric)
    || !identifier(definition.normalizationStrategyId)
    || !positive(definition.normalizationStrategyVersion)
    || !identifier(definition.embeddingTextProjectorId)
    || !positive(definition.embeddingTextProjectorVersion)
    || !uniqueAllowed(definition.allowedCorpora, KNOWLEDGE_CORPORA)
    || !uniqueAllowed(definition.allowedTrustLevels, KNOWLEDGE_TRUST_LEVELS)
    || !uniqueAllowed(definition.allowedPurposes, KNOWLEDGE_EMBEDDING_PURPOSES)
    || definition.allowedPurposes.some((purpose, index) => purpose !== KNOWLEDGE_EMBEDDING_PURPOSES.filter((item) => definition.allowedPurposes.includes(item))[index])
    || !strategy || strategy.inputDimension !== definition.vectorDimension
    || (definition.similarityMetric === "COSINE" && strategy.algorithm === "NONE" && !definition.normalizationStrategyId.startsWith("TEST_"))
    || !definition.allowedCorpora.includes("PLATFORM_KNOWLEDGE")) {
    throw new Error("INVALID_KNOWLEDGE_EMBEDDING_SCHEMA");
  }
};
const uniqueAllowed = <T extends string>(values: readonly T[], allowed: readonly T[]) =>
  Array.isArray(values) && values.length > 0 && new Set(values).size === values.length
  && values.every((value) => allowed.includes(value));
const identityKey = (id: string, version: number) => `${id}:${version}`;
const identifier = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Z0-9_.:-]{1,160}$/.test(value);
const bounded = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.trim() === value && value.length > 0 && value.length <= max;
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
