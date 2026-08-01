import type { FactorAggregateNormalizationExecutionSuccess } from "./factor-aggregate-normalization-execution.types.js";
import type { ValidatedFactorAggregateNormalizationPolicy } from "./factor-aggregate-normalization.types.js";
import type { ValidatedFactorContributionAggregationPolicy } from "./factor-contribution-aggregation.types.js";
import type { FactorContributionAggregationExecutionSuccess } from "./factor-contribution-aggregation-execution.types.js";
import type { FactorDecisionBandExecutionSuccess } from "./factor-decision-band-execution.types.js";
import type { ValidatedFactorDecisionBandPolicy } from "./factor-decision-band.types.js";
import type { ValidatedFactorEvaluatorExecutionPlan } from "./factor-evaluator-execution-plan.types.js";
import type { FactorEvaluatorPlanRunReport } from "./factor-evaluator-plan-runner.types.js";
import type { AssembledFactorInput } from "./factor-input-assembly.types.js";
import type { FactorKey } from "./factor-registry.types.js";

export type DeterministicFactorPipelineRequest = { input: AssembledFactorInput; evaluatorPlan: ValidatedFactorEvaluatorExecutionPlan;
  aggregationPolicy: ValidatedFactorContributionAggregationPolicy; normalizationPolicy: ValidatedFactorAggregateNormalizationPolicy;
  decisionBandPolicy: ValidatedFactorDecisionBandPolicy };
export const DETERMINISTIC_FACTOR_PIPELINE_STAGES = ["PREFLIGHT", "EVALUATOR_EXECUTION", "CONTRIBUTION_AGGREGATION", "NORMALIZATION", "DECISION_BAND_CLASSIFICATION"] as const;
export type DeterministicFactorPipelineStage = (typeof DETERMINISTIC_FACTOR_PIPELINE_STAGES)[number];
export type DeterministicFactorPipelineStageStatus = "COMPLETED" | "FAILED" | "SKIPPED";
export type DeterministicFactorPipelineStageTrace = { stage: DeterministicFactorPipelineStage; status: DeterministicFactorPipelineStageStatus };
export const DETERMINISTIC_FACTOR_PIPELINE_FAILURE_CODES = ["INVALID_REQUEST", "INVALID_ASSEMBLED_INPUT", "INVALID_EVALUATOR_PLAN", "INVALID_AGGREGATION_POLICY", "INVALID_NORMALIZATION_POLICY", "INVALID_DECISION_BAND_POLICY", "INPUT_PLAN_FACTOR_MISMATCH", "PLAN_AGGREGATION_POLICY_MISMATCH", "AGGREGATION_NORMALIZATION_POLICY_MISMATCH", "NORMALIZATION_DECISION_BAND_POLICY_MISMATCH", "EVALUATOR_EXECUTION_FAILED", "CONTRIBUTION_AGGREGATION_FAILED", "NORMALIZATION_FAILED", "DECISION_BAND_CLASSIFICATION_FAILED", "UNEXPECTED_STAGE_EXCEPTION"] as const;
export type DeterministicFactorPipelineFailureCode = (typeof DETERMINISTIC_FACTOR_PIPELINE_FAILURE_CODES)[number];
export type DeterministicFactorPipelineSuccess = { completed: true; factorKey: FactorKey; subject: { type: string; key: string }; evidenceId: string;
  identities: { evaluatorPlan: { planId: string; planVersion: number }; aggregationPolicy: { policyId: string; policyVersion: number };
    normalizationPolicy: { normalizationPolicyId: string; normalizationPolicyVersion: number };
    decisionBandPolicy: { decisionBandPolicyId: string; decisionBandPolicyVersion: number } };
  stages: readonly [{ stage: "PREFLIGHT"; status: "COMPLETED" }, { stage: "EVALUATOR_EXECUTION"; status: "COMPLETED" },
    { stage: "CONTRIBUTION_AGGREGATION"; status: "COMPLETED" }, { stage: "NORMALIZATION"; status: "COMPLETED" },
    { stage: "DECISION_BAND_CLASSIFICATION"; status: "COMPLETED" }]; evaluatorExecution: FactorEvaluatorPlanRunReport;
  aggregation: FactorContributionAggregationExecutionSuccess; normalization: FactorAggregateNormalizationExecutionSuccess;
  classification: FactorDecisionBandExecutionSuccess };
export type DeterministicFactorPipelineFailure = { completed: false; factorKey: string | null; evidenceId: string | null;
  failedStage: DeterministicFactorPipelineStage; code: DeterministicFactorPipelineFailureCode; stageFailureCode: string | null;
  identities: { evaluatorPlanId: string | null; aggregationPolicyId: string | null; normalizationPolicyId: string | null; decisionBandPolicyId: string | null };
  stages: readonly DeterministicFactorPipelineStageTrace[] };
export type DeterministicFactorPipelineResult = DeterministicFactorPipelineSuccess | DeterministicFactorPipelineFailure;
