import type {
  ExplicitFactorEvaluatorExecutionResult,
} from "./factor-evaluator-execution.types.js";
import type {
  FactorEvaluatorPlanFailurePolicy,
  ValidatedFactorEvaluatorExecutionPlan,
} from "./factor-evaluator-execution-plan.types.js";
import type { AssembledFactorInput } from "./factor-input-assembly.types.js";
import type { FactorKey } from "./factor-registry.types.js";

export type FactorEvaluatorPlanRunRequest = {
  plan: ValidatedFactorEvaluatorExecutionPlan;
  input: AssembledFactorInput;
};

export const FACTOR_EVALUATOR_PLAN_RUN_FAILURE_CODES = [
  "INVALID_REQUEST",
  "INVALID_VALIDATED_PLAN",
  "FACTOR_MISMATCH",
] as const;

export type FactorEvaluatorPlanRunFailureCode =
  (typeof FACTOR_EVALUATOR_PLAN_RUN_FAILURE_CODES)[number];

export const FACTOR_EVALUATOR_PLAN_RUN_STATUSES = [
  "COMPLETED",
  "STOPPED",
] as const;

export type FactorEvaluatorPlanRunStatus =
  (typeof FACTOR_EVALUATOR_PLAN_RUN_STATUSES)[number];

export const FACTOR_EVALUATOR_PLAN_STEP_STATUSES = [
  "ATTEMPTED",
  "SKIPPED",
] as const;

export type FactorEvaluatorPlanStepStatus =
  (typeof FACTOR_EVALUATOR_PLAN_STEP_STATUSES)[number];

export const FACTOR_EVALUATOR_PLAN_STEP_DISPOSITIONS = [
  "EVALUATED",
  "TYPED_EVALUATOR_FAILURE",
  "BOUNDARY_FAILURE",
  "SKIPPED_AFTER_TERMINATION",
] as const;

export type FactorEvaluatorPlanStepDisposition =
  (typeof FACTOR_EVALUATOR_PLAN_STEP_DISPOSITIONS)[number];

export const FACTOR_EVALUATOR_PLAN_TERMINATION_REASONS = [
  "NONE",
  "BOUNDARY_FAILURE",
  "TYPED_EVALUATOR_FAILURE",
] as const;

export type FactorEvaluatorPlanTerminationReason =
  (typeof FACTOR_EVALUATOR_PLAN_TERMINATION_REASONS)[number];

export type AttemptedFactorEvaluatorPlanStepReport = {
  order: number;
  evaluatorId: string;
  evaluatorVersion: number;
  configurationVersion: number;
  status: "ATTEMPTED";
  disposition:
    | "EVALUATED"
    | "TYPED_EVALUATOR_FAILURE"
    | "BOUNDARY_FAILURE";
  execution: ExplicitFactorEvaluatorExecutionResult;
};

export type SkippedFactorEvaluatorPlanStepReport = {
  order: number;
  evaluatorId: string;
  evaluatorVersion: number;
  configurationVersion: number;
  status: "SKIPPED";
  disposition: "SKIPPED_AFTER_TERMINATION";
  execution: null;
};

export type FactorEvaluatorPlanStepReport =
  | AttemptedFactorEvaluatorPlanStepReport
  | SkippedFactorEvaluatorPlanStepReport;

export type FactorEvaluatorPlanRunSummary = {
  totalSteps: number;
  attemptedSteps: number;
  skippedSteps: number;
  evaluatedSteps: number;
  typedEvaluatorFailures: number;
  boundaryFailures: number;
};

export type FactorEvaluatorPlanRunReport = {
  ran: true;
  planId: string;
  planVersion: number;
  factorKey: FactorKey;
  failurePolicy: FactorEvaluatorPlanFailurePolicy;
  status: FactorEvaluatorPlanRunStatus;
  termination: {
    reason: FactorEvaluatorPlanTerminationReason;
    stepOrder: number | null;
    evaluatorId: string | null;
  };
  summary: FactorEvaluatorPlanRunSummary;
  steps: readonly FactorEvaluatorPlanStepReport[];
};

export type FactorEvaluatorPlanRunFailure = {
  ran: false;
  planId: string | null;
  factorKey: string | null;
  code: FactorEvaluatorPlanRunFailureCode;
};

export type FactorEvaluatorPlanRunResult =
  | FactorEvaluatorPlanRunReport
  | FactorEvaluatorPlanRunFailure;
