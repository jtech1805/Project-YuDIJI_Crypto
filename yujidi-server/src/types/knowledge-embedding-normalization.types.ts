export const KNOWLEDGE_EMBEDDING_NORMALIZATION_ALGORITHMS = ["NONE", "L2_UNIT_VECTOR"] as const;
export type KnowledgeEmbeddingNormalizationAlgorithm = typeof KNOWLEDGE_EMBEDDING_NORMALIZATION_ALGORITHMS[number];

export type KnowledgeEmbeddingNormalizationIdentity = Readonly<{
  normalizationStrategyId: string;
  normalizationStrategyVersion: number;
}>;

export type KnowledgeEmbeddingNormalizationDefinition = KnowledgeEmbeddingNormalizationIdentity & Readonly<{
  algorithm: KnowledgeEmbeddingNormalizationAlgorithm;
  inputDimension: number;
  zeroMagnitudeBehavior: "FAIL";
  numericPolicy: Readonly<{ requireFiniteInput: true; requireFiniteOutput: true; rounding: "NONE"; clamping: "NONE" }>;
  validationPolicy: Readonly<{ unitMagnitudeTolerance: number }>;
}>;

export const KNOWLEDGE_EMBEDDING_NORMALIZATION_FAILURE_CODES = [
  "NORMALIZATION_STRATEGY_NOT_FOUND", "VECTOR_DIMENSION_MISMATCH", "VECTOR_CONTAINS_NON_FINITE_VALUE",
  "VECTOR_MAGNITUDE_NON_FINITE", "VECTOR_MAGNITUDE_ZERO", "NORMALIZED_VECTOR_NON_FINITE",
  "NORMALIZED_MAGNITUDE_OUT_OF_TOLERANCE", "NORMALIZATION_INVARIANT_VIOLATION",
] as const;
export type KnowledgeEmbeddingNormalizationFailureCode = typeof KNOWLEDGE_EMBEDDING_NORMALIZATION_FAILURE_CODES[number];

export type KnowledgeEmbeddingNormalizationResult =
  | Readonly<{ status: "COMPLETED"; normalizationStrategyId: string; normalizationStrategyVersion: number; inputDimension: number; outputDimension: number; inputMagnitude: number; outputMagnitude: number; vector: readonly number[] }>
  | Readonly<{ status: "FAILED"; failureCode: KnowledgeEmbeddingNormalizationFailureCode }>;

export const KNOWLEDGE_EMBEDDING_UNIT_MAGNITUDE_TOLERANCE = 1e-12;
export const TEST_NO_NORMALIZATION_DEFINITION: KnowledgeEmbeddingNormalizationDefinition = Object.freeze({
  normalizationStrategyId: "TEST_NO_NORMALIZATION", normalizationStrategyVersion: 1, algorithm: "NONE", inputDimension: 4,
  zeroMagnitudeBehavior: "FAIL", numericPolicy: Object.freeze({ requireFiniteInput: true, requireFiniteOutput: true, rounding: "NONE", clamping: "NONE" }),
  validationPolicy: Object.freeze({ unitMagnitudeTolerance: KNOWLEDGE_EMBEDDING_UNIT_MAGNITUDE_TOLERANCE }),
});
export const L2_UNIT_VECTOR_V1_DEFINITION: KnowledgeEmbeddingNormalizationDefinition = Object.freeze({
  normalizationStrategyId: "L2_UNIT_VECTOR", normalizationStrategyVersion: 1, algorithm: "L2_UNIT_VECTOR", inputDimension: 768,
  zeroMagnitudeBehavior: "FAIL", numericPolicy: Object.freeze({ requireFiniteInput: true, requireFiniteOutput: true, rounding: "NONE", clamping: "NONE" }),
  validationPolicy: Object.freeze({ unitMagnitudeTolerance: KNOWLEDGE_EMBEDDING_UNIT_MAGNITUDE_TOLERANCE }),
});
