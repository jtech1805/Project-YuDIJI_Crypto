import type { DeterministicFactorEvaluator } from "../ports/deterministic-factor-evaluator.port.js";
import type { DeterministicFactorEvaluatorRegistry } from "../registries/deterministic-factor-evaluator.registry.js";
import type {
  ExplicitFactorEvaluatorExecutionFailure,
  ExplicitFactorEvaluatorExecutionFailureCode,
  ExplicitFactorEvaluatorExecutionRequest,
  ExplicitFactorEvaluatorExecutionResult,
} from "../types/factor-evaluator-execution.types.js";
import type { FactorEvaluatorExecutionResult } from "../types/factor-evaluator.types.js";
import type { FactorEvaluatorContractService } from "./factor-evaluator-contract.service.js";
import { supportsFactorInput } from "./factor-evaluator-contract.service.js";

export type ExplicitFactorEvaluatorExecutionDependencies = {
  evaluatorRegistry: Pick<DeterministicFactorEvaluatorRegistry, "getById">;
  contractService: Pick<FactorEvaluatorContractService, "validateResult">;
};

export class ExplicitFactorEvaluatorExecutionService {
  public constructor(
    private readonly dependencies: ExplicitFactorEvaluatorExecutionDependencies,
  ) {}

  public execute(
    request: ExplicitFactorEvaluatorExecutionRequest,
  ): ExplicitFactorEvaluatorExecutionResult {
    if (!validRequest(request)) {
      return failure(null, null, "INVALID_REQUEST");
    }

    const evaluator = this.dependencies.evaluatorRegistry.getById(
      request.evaluatorId,
    );
    if (!evaluator) {
      return failure(
        request.evaluatorId,
        request.input.factorKey,
        "EVALUATOR_NOT_FOUND",
      );
    }
    if (!supportsFactorInput(evaluator, request.input)) {
      return failure(
        evaluator.evaluatorId,
        request.input.factorKey,
        "UNSUPPORTED_FACTOR",
      );
    }

    let rawExecution: FactorEvaluatorExecutionResult;
    try {
      rawExecution = evaluator.evaluate(request.input);
    } catch {
      return failure(
        evaluator.evaluatorId,
        request.input.factorKey,
        "EVALUATOR_EXECUTION_FAILED",
      );
    }

    if (promiseLike(rawExecution)) {
      return failure(
        evaluator.evaluatorId,
        request.input.factorKey,
        "INVALID_EVALUATOR_EXECUTION",
      );
    }

    const validation = this.dependencies.contractService.validateResult({
      evaluator,
      input: request.input,
      execution: rawExecution,
    });
    if (!validation.valid) {
      return failure(
        evaluator.evaluatorId,
        request.input.factorKey,
        "INVALID_EVALUATOR_EXECUTION",
      );
    }

    const execution: FactorEvaluatorExecutionResult = "result" in validation
      ? Object.freeze({ evaluated: true, result: validation.result })
      : validation.execution;
    return Object.freeze({
      executed: true,
      evaluatorId: evaluator.evaluatorId,
      evaluatorVersion: evaluator.evaluatorVersion,
      configurationVersion: evaluator.configurationVersion,
      factorKey: request.input.factorKey,
      execution,
    });
  }
}

const validRequest = (
  value: unknown,
): value is ExplicitFactorEvaluatorExecutionRequest => {
  if (!record(value)
    || typeof value.evaluatorId !== "string"
    || value.evaluatorId.length === 0
    || value.evaluatorId.trim() !== value.evaluatorId
    || !record(value.input)) return false;
  return typeof value.input.factorKey === "string"
    && value.input.factorKey.length > 0
    && record(value.input.subject)
    && typeof value.input.evidenceId === "string"
    && value.input.evidenceId.length > 0
    && record(value.input.value);
};

const promiseLike = (value: unknown): boolean => {
  if ((typeof value !== "object" && typeof value !== "function")
    || value === null) return false;
  try {
    return typeof (value as { then?: unknown }).then === "function";
  } catch {
    return true;
  }
};

const failure = (
  evaluatorId: string | null,
  factorKey: string | null,
  code: ExplicitFactorEvaluatorExecutionFailureCode,
): ExplicitFactorEvaluatorExecutionFailure => Object.freeze({
  executed: false,
  evaluatorId,
  factorKey,
  code,
});

const record = (value: unknown): value is Record<string, any> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
