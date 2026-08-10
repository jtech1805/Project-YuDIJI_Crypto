import { isDeepStrictEqual } from "node:util";
import { freezeClone } from "../services/knowledge-document-admission.service.js";
import type { KnowledgeVectorIndexDefinition } from "../types/knowledge-vector-index-definition.types.js";
import { KnowledgeEmbeddingSchemaRegistry } from "./knowledge-embedding-schema.registry.js";
import { GEMINI_PLATFORM_KNOWLEDGE_EMBEDDING_SCHEMA } from "../types/gemini-embedding-adapter.types.js";


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

export const MONGO_ATLAS_PLATFORM_KNOWLEDGE_VECTOR_INDEX_DEFINITION: KnowledgeVectorIndexDefinition = Object.freeze({
  indexId:"YUDIJI_ATLAS_PLATFORM_KNOWLEDGE_GEMINI_768",indexVersion:1,indexSchemaId:"YUDIJI_ATLAS_VECTOR_INDEX_SCHEMA",indexSchemaVersion:1,
  namespace:"YUDIJI:PLATFORM_KNOWLEDGE:ATLAS:GEMINI_768:V1",corpus:"PLATFORM_KNOWLEDGE",allowedTrustLevels:Object.freeze(["AUTHORITATIVE","APPROVED_GUIDANCE","EXPLANATORY"] as const),
  embeddingSchema:{embeddingSchemaId:"YUDIJI_GEMINI_PLATFORM_KNOWLEDGE_EMBEDDING",embeddingSchemaVersion:1},vectorDimension:768,similarityMetric:"COSINE",
  metadataSchemaId:"PLATFORM_KNOWLEDGE_INDEX_METADATA",metadataSchemaVersion:1,writePolicyId:"PLATFORM_KNOWLEDGE_INDEX_WRITE",writePolicyVersion:1,retrievalEligible:false,
});
export const MONGO_ATLAS_KNOWLEDGE_VECTOR_INDEX_AUTHORITY = new KnowledgeVectorIndexDefinitionRegistry(
  [MONGO_ATLAS_PLATFORM_KNOWLEDGE_VECTOR_INDEX_DEFINITION], new KnowledgeEmbeddingSchemaRegistry([GEMINI_PLATFORM_KNOWLEDGE_EMBEDDING_SCHEMA]),
);
