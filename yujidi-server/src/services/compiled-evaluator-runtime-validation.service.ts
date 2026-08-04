import type { CompiledDeterministicEvaluator } from "../ports/compiled-deterministic-evaluator.port.js";
import type { CompiledRawEvaluatorValidationResult } from "../types/compiled-binding-execution.types.js";
import type { CompiledRawEvaluatorResult } from "../types/compiled-evaluator.types.js";
import type { ResolvedExecutionInput } from "../types/resolved-execution-input.types.js";

export class CompiledEvaluatorRuntimeValidationService {
  public validateResult(resolved: ResolvedExecutionInput, implementation: CompiledDeterministicEvaluator, value: unknown): CompiledRawEvaluatorValidationResult {
    if (!record(value) || !record(value.evaluator) || !record(value.factor) || !record(value.subject) || !record(value.contribution)
      || value.evaluator.evaluatorId !== implementation.evaluatorId || value.evaluator.evaluatorVersion !== implementation.evaluatorVersion
      || value.evaluator.configurationId !== resolved.binding.evaluator.configurationId || value.evaluator.configurationVersion !== resolved.binding.evaluator.configurationVersion
      || value.factor.factorKey !== resolved.binding.factor.factorKey || value.factor.factorVersion !== resolved.binding.factor.factorVersion
      || value.subject.type !== resolved.resolvedSubject.type || value.subject.key !== resolved.resolvedSubject.key
      || value.relationshipType !== resolved.binding.relationshipType || !["PASS", "FAIL", "NEUTRAL"].includes(value.outcome)
      || typeof value.reasonCode !== "string" || value.reasonCode.length === 0 || value.reasonCode.length > 160
      || !record(value.diagnostics) || Object.keys(value.diagnostics).length > 20 || !safeDiagnostics(value.diagnostics)
      || !validDate(value.observedAt) || value.observedAt.getTime() !== resolved.input.observedAt.getTime()
      || !validDate(value.evaluatedAt) || value.evaluatedAt.getTime() !== resolved.input.evaluatedAt.getTime()) return fail("INVALID_EVALUATOR_RESULT");
    const { points, minimumPoints, maximumPoints } = value.contribution;
    if (![points, minimumPoints, maximumPoints].every(finite) || minimumPoints >= 0 || maximumPoints <= 0 || points < minimumPoints || points > maximumPoints) return fail("INVALID_CONTRIBUTION_BOUNDS");
    if ((value.outcome === "PASS" && points <= 0) || (value.outcome === "FAIL" && points >= 0) || (value.outcome === "NEUTRAL" && points !== 0)) return fail("INVALID_EVALUATOR_RESULT");
    return Object.freeze({ valid: true, result: deepFreeze(structuredClone(value as CompiledRawEvaluatorResult)) });
  }
}
const safeDiagnostics = (value: Record<string, any>): boolean => Object.entries(value).every(([key, item]) => key.length > 0 && key.length <= 64
  && !/(?:^|_)(?:payload|credential|credentials|password|secret|token|stack|exception)(?:_|$)/i.test(key)
  && (item === null || typeof item === "boolean" || typeof item === "number" && Number.isFinite(item) || typeof item === "string" && item.length <= 500));
const fail = (code: Extract<CompiledRawEvaluatorValidationResult, { valid: false }>["code"]): CompiledRawEvaluatorValidationResult => Object.freeze({ valid: false, code });
const record = (value: unknown): value is Record<string, any> => typeof value === "object" && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const validDate = (value: unknown): value is Date => value instanceof Date && Number.isFinite(value.getTime());
const deepFreeze = <T>(value: T): T => { if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value; for (const nested of Object.values(value)) deepFreeze(nested); return Object.freeze(value); };

