import { isDeepStrictEqual } from "node:util";
import { freezeClone } from "../services/knowledge-document-admission.service.js";
import type { KnowledgeVectorIndexDefinition } from "../types/knowledge-vector-index-definition.types.js";
import { KnowledgeEmbeddingSchemaRegistry } from "./knowledge-embedding-schema.registry.js";

export class KnowledgeVectorIndexDefinitionRegistry {
  private readonly definitions: ReadonlyMap<string, KnowledgeVectorIndexDefinition>;

  public constructor(
    definitions: readonly KnowledgeVectorIndexDefinition[],
    private readonly embeddingSchemas: KnowledgeEmbeddingSchemaRegistry,
  ) {
    const entries = new Map<string, KnowledgeVectorIndexDefinition>();
    for (const definition of definitions) {
      this.validate(definition);
      const key = identityKey(definition.indexId, definition.indexVersion);
      const existing = entries.get(key);
      if (existing) {
        throw new Error(isDeepStrictEqual(existing, definition)
          ? "DUPLICATE_KNOWLEDGE_VECTOR_INDEX_DEFINITION"
          : "CONFLICTING_KNOWLEDGE_VECTOR_INDEX_DEFINITION");
      }
      entries.set(key, freezeClone(definition));
    }
    this.definitions = entries;
  }

  public getExact(indexId: string, indexVersion: number): KnowledgeVectorIndexDefinition | null {
    const definition = this.definitions.get(identityKey(indexId, indexVersion));
    return definition ? freezeClone(definition) : null;
  }

  public list(): readonly KnowledgeVectorIndexDefinition[] {
    return freezeClone([...this.definitions.values()].sort((a, b) =>
      a.indexId.localeCompare(b.indexId) || a.indexVersion - b.indexVersion));
  }

  private validate(definition: KnowledgeVectorIndexDefinition): void {
    const schema = this.embeddingSchemas.getExact(
      definition.embeddingSchema.embeddingSchemaId,
      definition.embeddingSchema.embeddingSchemaVersion,
    );
    if (!identifier(definition.indexId)
      || !positive(definition.indexVersion)
      || !identifier(definition.indexSchemaId)
      || !positive(definition.indexSchemaVersion)
      || !namespace(definition.namespace)
      || definition.corpus !== "PLATFORM_KNOWLEDGE"
      || definition.allowedTrustLevels.length === 0
      || new Set(definition.allowedTrustLevels).size !== definition.allowedTrustLevels.length
      || !identifier(definition.metadataSchemaId)
      || !positive(definition.metadataSchemaVersion)
      || !identifier(definition.writePolicyId)
      || !positive(definition.writePolicyVersion)
      || !schema
      || schema.vectorDimension !== definition.vectorDimension
      || schema.similarityMetric !== definition.similarityMetric
      || !schema.allowedCorpora.includes(definition.corpus)
      || definition.allowedTrustLevels.some((trust) => !schema.allowedTrustLevels.includes(trust))) {
      throw new Error("INVALID_KNOWLEDGE_VECTOR_INDEX_DEFINITION");
    }
  }
}

const identityKey = (id: string, version: number) => `${id}:${version}`;
const identifier = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Z0-9_.:-]{1,160}$/.test(value);
const namespace = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Z0-9_.:-]{1,200}$/.test(value);
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
