import type { FactorEvaluatorExecutionResult } from "./factor-evaluator.types.js";
import type { AssembledFactorInput } from "./factor-input-assembly.types.js";
import type { FactorKey } from "./factor-registry.types.js";

export type ExplicitFactorEvaluatorExecutionRequest = {
  evaluatorId: string;
  input: AssembledFactorInput;
};

export const EXPLICIT_FACTOR_EVALUATOR_EXECUTION_FAILURE_CODES = [
  "INVALID_REQUEST",
  "EVALUATOR_NOT_FOUND",
  "UNSUPPORTED_FACTOR",
  "EVALUATOR_EXECUTION_FAILED",
  "INVALID_EVALUATOR_EXECUTION",
] as const;

export type ExplicitFactorEvaluatorExecutionFailureCode =
  (typeof EXPLICIT_FACTOR_EVALUATOR_EXECUTION_FAILURE_CODES)[number];

export type ExplicitFactorEvaluatorExecutionSuccess = {
  executed: true;
  evaluatorId: string;
  evaluatorVersion: number;
  configurationVersion: number;
  factorKey: FactorKey;
  execution: FactorEvaluatorExecutionResult;
};

export type ExplicitFactorEvaluatorExecutionFailure = {
  executed: false;
  evaluatorId: string | null;
  factorKey: string | null;
  code: ExplicitFactorEvaluatorExecutionFailureCode;
};

export type ExplicitFactorEvaluatorExecutionResult =
  | ExplicitFactorEvaluatorExecutionSuccess
  | ExplicitFactorEvaluatorExecutionFailure;
