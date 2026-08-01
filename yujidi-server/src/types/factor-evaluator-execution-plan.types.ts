import type { FactorKey } from "./factor-registry.types.js";

export const MAX_EVALUATORS_PER_EXECUTION_PLAN = 20;

export type FactorEvaluatorExecutionPlanIdentity = {
  planId: string;
  planVersion: number;
};

export const FACTOR_EVALUATOR_PLAN_FAILURE_POLICIES = [
  "STOP_ON_ANY_FAILURE",
  "CONTINUE_ON_EVALUATOR_FAILURE",
  "CONTINUE_ALWAYS",
] as const;

export type FactorEvaluatorPlanFailurePolicy =
  (typeof FACTOR_EVALUATOR_PLAN_FAILURE_POLICIES)[number];

export type FactorEvaluatorExecutionPlanStep = {
  order: number;
  evaluatorId: string;
};

export type FactorEvaluatorExecutionPlan =
  FactorEvaluatorExecutionPlanIdentity & {
    factorKey: FactorKey;
    failurePolicy: FactorEvaluatorPlanFailurePolicy;
    steps: readonly FactorEvaluatorExecutionPlanStep[];
  };

export type ValidatedFactorEvaluatorExecutionPlanStep = {
  order: number;
  evaluatorId: string;
  evaluatorVersion: number;
  configurationVersion: number;
  supportedFactorKeys: readonly FactorKey[];
};

export type ValidatedFactorEvaluatorExecutionPlan =
  FactorEvaluatorExecutionPlanIdentity & {
    factorKey: FactorKey;
    failurePolicy: FactorEvaluatorPlanFailurePolicy;
    steps: readonly ValidatedFactorEvaluatorExecutionPlanStep[];
  };

export const FACTOR_EVALUATOR_EXECUTION_PLAN_FAILURE_CODES = [
  "INVALID_PLAN",
  "INVALID_PLAN_ID",
  "INVALID_PLAN_VERSION",
  "UNSUPPORTED_FACTOR",
  "EMPTY_PLAN",
  "TOO_MANY_EVALUATORS",
  "INVALID_STEP",
  "INVALID_STEP_ORDER",
  "DUPLICATE_STEP_ORDER",
  "DUPLICATE_EVALUATOR_ID",
  "EVALUATOR_NOT_FOUND",
  "EVALUATOR_DOES_NOT_SUPPORT_FACTOR",
  "INVALID_FAILURE_POLICY",
] as const;

export type FactorEvaluatorExecutionPlanFailureCode =
  (typeof FACTOR_EVALUATOR_EXECUTION_PLAN_FAILURE_CODES)[number];

export type FactorEvaluatorExecutionPlanValidationResult =
  | {
      valid: true;
      plan: ValidatedFactorEvaluatorExecutionPlan;
    }
  | {
      valid: false;
      code: FactorEvaluatorExecutionPlanFailureCode;
      planId: string | null;
      evaluatorId: string | null;
      stepOrder: number | null;
    };
