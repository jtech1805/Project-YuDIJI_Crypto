import type { FactorRegistry } from "../types/factor-registry.types.js";
import type { FactorEvaluatorExecutionResult } from "../types/factor-evaluator.types.js";
import {
  GENERIC_FACTOR_EVALUATOR_PREFIX,
  type GenericFactorCompatibilityDispatchRequest,
  type GenericFactorLegacyTranslationResult,
} from "../types/generic-factor-legacy-compatibility.types.js";
import type { GenericFactorRelationshipType } from "../types/generic-factor-relationship.types.js";

export const parseGenericFactorEvaluatorKey = (
  evaluatorKey: unknown,
): string | null => {
  if (typeof evaluatorKey !== "string"
    || !evaluatorKey.startsWith(GENERIC_FACTOR_EVALUATOR_PREFIX)) return null;
  const factorKey = evaluatorKey.slice(GENERIC_FACTOR_EVALUATOR_PREFIX.length);
  return factorKey.length > 0 && !/\s/.test(factorKey) && !factorKey.includes(":")
    ? factorKey : null;
};

export class GenericFactorLegacyResultAdapter {
  public translate(params: {
    evaluatorKey: string;
    relationshipType: GenericFactorRelationshipType;
    execution: FactorEvaluatorExecutionResult;
  }): GenericFactorLegacyTranslationResult {
    if (params.relationshipType !== "DIRECT" && params.relationshipType !== "INVERSE") {
      return failure(params.evaluatorKey, "UNSUPPORTED_RELATIONSHIP");
    }
    if (!params.execution.evaluated) {
      return failure(params.evaluatorKey,
        params.execution.code === "INVALID_INPUT" ? "MISSING_EVIDENCE" : "INVALID_EXECUTION_RESULT");
    }
    const { result } = params.execution;
    const { points, minimumPoints, maximumPoints } = result.contribution;
    if (![points, minimumPoints, maximumPoints].every(Number.isFinite)
      || minimumPoints >= maximumPoints
      || points < minimumPoints || points > maximumPoints) {
      return failure(params.evaluatorKey, "INVALID_EXECUTION_RESULT");
    }
    const score = ((points - minimumPoints) / (maximumPoints - minimumPoints)) * 100;
    return {
      translated: true,
      result: Object.freeze({
        evaluatorKey: params.evaluatorKey,
        status: result.outcome === "UNAVAILABLE" ? "BLOCKED" : "EXECUTED",
        score,
        maxScore: 100,
        reasonCodes: Object.freeze([result.reasonCode]) as string[],
        warnings: Object.freeze(result.outcome === "UNAVAILABLE"
          ? ["Generic factor input is unavailable."] : []) as string[],
        dataConfidence: result.outcome === "UNAVAILABLE" ? "LOW" : "HIGH",
        metadata: Object.freeze({
          factorKey: result.factorKey,
          relationshipType: params.relationshipType,
          contributionPoints: points,
          minimumPoints,
          maximumPoints,
          evidenceId: result.evidence.evidenceId,
        }),
      }),
    };
  }
}

export class GenericFactorCompatibilityDispatcher {
  public constructor(private readonly dependencies: {
    enabled: boolean;
    factorRegistry: Pick<FactorRegistry, "get">;
    adapter: Pick<GenericFactorLegacyResultAdapter, "translate">;
  }) {}

  public dispatch(
    request: GenericFactorCompatibilityDispatchRequest,
  ): GenericFactorLegacyTranslationResult {
    if (!this.dependencies.enabled) return failure(request.evaluatorKey, "FEATURE_DISABLED");
    const factorKey = parseGenericFactorEvaluatorKey(request.evaluatorKey);
    if (!factorKey) return failure(request.evaluatorKey, "INVALID_EVALUATOR_KEY");
    const definition = this.dependencies.factorRegistry.get(factorKey);
    if (!definition) return failure(request.evaluatorKey, "UNKNOWN_FACTOR");
    if (definition.scoringEligibility !== "ELIGIBLE") {
      return failure(request.evaluatorKey, "FACTOR_NOT_SCORING_ELIGIBLE");
    }
    if (request.execution.evaluated
      && request.execution.result.factorKey !== definition.factorKey) {
      return failure(request.evaluatorKey, "INVALID_EXECUTION_RESULT");
    }
    return this.dependencies.adapter.translate(request);
  }
}

const failure = (
  evaluatorKey: unknown,
  code: Extract<GenericFactorLegacyTranslationResult, { translated: false }>["code"],
): GenericFactorLegacyTranslationResult => Object.freeze({
  translated: false,
  evaluatorKey: typeof evaluatorKey === "string" ? evaluatorKey : null,
  code,
});
