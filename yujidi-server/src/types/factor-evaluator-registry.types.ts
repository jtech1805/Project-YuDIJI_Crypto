import type { FactorKey } from "./factor-registry.types.js";

export const FACTOR_EVALUATOR_REGISTRY_ERROR_CODES = [
  "INVALID_EVALUATOR_COLLECTION",
  "INVALID_EVALUATOR",
  "DUPLICATE_EVALUATOR_ID",
] as const;
export type FactorEvaluatorRegistryErrorCode =
  (typeof FACTOR_EVALUATOR_REGISTRY_ERROR_CODES)[number];

export class FactorEvaluatorRegistryError extends Error {
  public readonly code: FactorEvaluatorRegistryErrorCode;
  public readonly evaluatorId: string | null;

  public constructor(params: {
    code: FactorEvaluatorRegistryErrorCode;
    evaluatorId?: string | null;
  }) {
    super(`Deterministic factor evaluator registry failed: ${params.code}`);
    this.name = "FactorEvaluatorRegistryError";
    this.code = params.code;
    this.evaluatorId = params.evaluatorId ?? null;
  }
}

export type RegisteredFactorEvaluatorSummary = {
  evaluatorId: string;
  evaluatorVersion: number;
  configurationVersion: number;
  supportedFactorKeys: readonly FactorKey[];
};
