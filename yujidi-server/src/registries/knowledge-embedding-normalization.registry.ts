import { isDeepStrictEqual } from "node:util";
import { freezeClone } from "../services/knowledge/knowledge-document-admission.service.js";
import { KNOWLEDGE_EMBEDDING_NORMALIZATION_ALGORITHMS, L2_UNIT_VECTOR_V1_DEFINITION, TEST_NO_NORMALIZATION_DEFINITION, type KnowledgeEmbeddingNormalizationDefinition } from "../types/knowledge-embedding-normalization.types.js";

export class KnowledgeEmbeddingNormalizationRegistry {
  private readonly definitions: ReadonlyMap<string, KnowledgeEmbeddingNormalizationDefinition>;
  public constructor(definitions: readonly KnowledgeEmbeddingNormalizationDefinition[]) {
    const entries = new Map<string, KnowledgeEmbeddingNormalizationDefinition>();
    for (const definition of definitions) {
      validate(definition); const key = identity(definition.normalizationStrategyId, definition.normalizationStrategyVersion); const existing = entries.get(key);
      if (existing) throw new Error(isDeepStrictEqual(existing, definition) ? "DUPLICATE_KNOWLEDGE_EMBEDDING_NORMALIZATION" : "CONFLICTING_KNOWLEDGE_EMBEDDING_NORMALIZATION");
      entries.set(key, freezeClone(definition));
    }
    this.definitions = entries;
  }
  public getExact(id: string, version: number): KnowledgeEmbeddingNormalizationDefinition | null { const value = this.definitions.get(identity(id, version)); return value ? freezeClone(value) : null; }
  public list(): readonly KnowledgeEmbeddingNormalizationDefinition[] { return freezeClone([...this.definitions.values()].sort((a, b) => a.normalizationStrategyId.localeCompare(b.normalizationStrategyId) || a.normalizationStrategyVersion - b.normalizationStrategyVersion)); }
}
export const KNOWLEDGE_EMBEDDING_NORMALIZATION_AUTHORITY = new KnowledgeEmbeddingNormalizationRegistry([TEST_NO_NORMALIZATION_DEFINITION, L2_UNIT_VECTOR_V1_DEFINITION]);
function validate(v: KnowledgeEmbeddingNormalizationDefinition): void {
  if (!identifier(v.normalizationStrategyId) || !positive(v.normalizationStrategyVersion) || !KNOWLEDGE_EMBEDDING_NORMALIZATION_ALGORITHMS.includes(v.algorithm)
    || !positive(v.inputDimension) || v.inputDimension > 4_096 || v.zeroMagnitudeBehavior !== "FAIL"
    || v.numericPolicy?.requireFiniteInput !== true || v.numericPolicy?.requireFiniteOutput !== true || v.numericPolicy?.rounding !== "NONE" || v.numericPolicy?.clamping !== "NONE"
    || !Number.isFinite(v.validationPolicy?.unitMagnitudeTolerance) || v.validationPolicy.unitMagnitudeTolerance <= 0) throw new Error("INVALID_KNOWLEDGE_EMBEDDING_NORMALIZATION");
}
function identity(id: string, version: number): string { return `${id}:${version}`; }
function identifier(value: unknown): value is string { return typeof value === "string" && /^[A-Z0-9_.:-]{1,160}$/.test(value); }
function positive(value: unknown): value is number { return Number.isSafeInteger(value) && (value as number) > 0; }
