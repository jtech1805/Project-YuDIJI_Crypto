import { KNOWLEDGE_EMBEDDING_NORMALIZATION_AUTHORITY, KnowledgeEmbeddingNormalizationRegistry } from "../../registries/knowledge-embedding-normalization.registry.js";
import { freezeClone } from "./knowledge-document-admission.service.js";
import type { KnowledgeEmbeddingNormalizationIdentity, KnowledgeEmbeddingNormalizationResult } from "../../types/knowledge-embedding-normalization.types.js";

export class KnowledgeEmbeddingNormalizationService {
  public constructor(private readonly registry: Pick<KnowledgeEmbeddingNormalizationRegistry, "getExact"> = KNOWLEDGE_EMBEDDING_NORMALIZATION_AUTHORITY) {}
  public normalize(identity: KnowledgeEmbeddingNormalizationIdentity, values: readonly number[]): KnowledgeEmbeddingNormalizationResult {
    const definition = this.registry.getExact(identity.normalizationStrategyId, identity.normalizationStrategyVersion);
    if (!definition) return failed("NORMALIZATION_STRATEGY_NOT_FOUND");
    if (!Array.isArray(values) || values.length !== definition.inputDimension) return failed("VECTOR_DIMENSION_MISMATCH");
    if (values.some((value) => typeof value !== "number" || !Number.isFinite(value))) return failed("VECTOR_CONTAINS_NON_FINITE_VALUE");
    let squaredMagnitude = 0;
    for (const value of values) { const square = value * value; if (!Number.isFinite(square)) return failed("VECTOR_MAGNITUDE_NON_FINITE"); squaredMagnitude += square; if (!Number.isFinite(squaredMagnitude)) return failed("VECTOR_MAGNITUDE_NON_FINITE"); }
    const inputMagnitude = Math.sqrt(squaredMagnitude);
    if (!Number.isFinite(inputMagnitude)) return failed("VECTOR_MAGNITUDE_NON_FINITE");
    if (definition.algorithm === "L2_UNIT_VECTOR" && inputMagnitude === 0) return failed("VECTOR_MAGNITUDE_ZERO");
    const vector = definition.algorithm === "NONE" ? [...values] : values.map((value) => value / inputMagnitude);
    if (vector.length !== definition.inputDimension) return failed("NORMALIZATION_INVARIANT_VIOLATION");
    if (vector.some((value) => !Number.isFinite(value))) return failed("NORMALIZED_VECTOR_NON_FINITE");
    const outputMagnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    if (!Number.isFinite(outputMagnitude)) return failed("NORMALIZED_VECTOR_NON_FINITE");
    if (definition.algorithm === "L2_UNIT_VECTOR" && Math.abs(outputMagnitude - 1) > definition.validationPolicy.unitMagnitudeTolerance) return failed("NORMALIZED_MAGNITUDE_OUT_OF_TOLERANCE");
    return freezeClone({ status: "COMPLETED", normalizationStrategyId: definition.normalizationStrategyId, normalizationStrategyVersion: definition.normalizationStrategyVersion, inputDimension: values.length, outputDimension: vector.length, inputMagnitude, outputMagnitude, vector });
  }
}
const failed = (failureCode: Extract<KnowledgeEmbeddingNormalizationResult, { status: "FAILED" }>["failureCode"]): KnowledgeEmbeddingNormalizationResult => Object.freeze({ status: "FAILED", failureCode });
