import type { CompiledRawEvaluatorResult } from "../../types/compiled-evaluator.types.js";

export type CompiledBindingScoreProjectionResult = Readonly<{ projected: true; score: number }> | Readonly<{ projected: false; code: "INVALID_CONTRIBUTION_BOUNDS" | "INVALID_BINDING_SCORE" }>;
export class CompiledBindingScoreProjectionService {
  public project(result: unknown): CompiledBindingScoreProjectionResult {
    if (!record(result) || !record(result.contribution)) return fail("INVALID_CONTRIBUTION_BOUNDS");
    const { points, minimumPoints, maximumPoints } = result.contribution as CompiledRawEvaluatorResult["contribution"];
    if (![points, minimumPoints, maximumPoints].every(finite) || minimumPoints >= 0 || maximumPoints <= 0
      || points < minimumPoints || points > maximumPoints) return fail("INVALID_CONTRIBUTION_BOUNDS");
    const score = points < 0 ? 50 * (points - minimumPoints) / (0 - minimumPoints) : points === 0 ? 50 : 50 + 50 * points / maximumPoints;
    return finite(score) && score >= 0 && score <= 100 ? Object.freeze({ projected: true, score }) : fail("INVALID_BINDING_SCORE");
  }
}
const fail = (code: Extract<CompiledBindingScoreProjectionResult, { projected: false }>["code"]): CompiledBindingScoreProjectionResult => Object.freeze({ projected: false, code });
const record = (value: unknown): value is Record<string, any> => typeof value === "object" && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
