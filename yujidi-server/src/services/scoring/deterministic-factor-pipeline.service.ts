import type { FactorAggregateNormalizationExecutionService } from "./factor-aggregate-normalization-execution.service.js";
import type { FactorContributionAggregationExecutionService } from "./factor-contribution-aggregation-execution.service.js";
import type { FactorDecisionBandExecutionService } from "./factor-decision-band-execution.service.js";
import type { FactorEvaluatorPlanRunnerService } from "./factor-evaluator-plan-runner.service.js";
import { FACTOR_DECISION_BAND_LABELS } from "../../types/factor-decision-band.types.js";
import { FACTOR_EVALUATOR_PLAN_FAILURE_POLICIES } from "../../types/factor-evaluator-execution-plan.types.js";
import type {
  DeterministicFactorPipelineFailureCode,
  DeterministicFactorPipelineResult,
  DeterministicFactorPipelineStage,
  DeterministicFactorPipelineStageStatus,
  DeterministicFactorPipelineStageTrace,
} from "../../types/deterministic-factor-pipeline.types.js";
import type { FactorEvaluatorPlanRunReport } from "../../types/factor-evaluator-plan-runner.types.js";
import type { FactorContributionAggregationExecutionSuccess } from "../../types/factor-contribution-aggregation-execution.types.js";
import type { FactorAggregateNormalizationExecutionSuccess } from "../../types/factor-aggregate-normalization-execution.types.js";
import type { FactorDecisionBandExecutionSuccess } from "../../types/factor-decision-band-execution.types.js";

export type DeterministicFactorPipelineDependencies = {
  evaluatorPlanRunner: Pick<FactorEvaluatorPlanRunnerService, "run">;
  aggregationExecution: Pick<FactorContributionAggregationExecutionService, "execute">;
  normalizationExecution: Pick<FactorAggregateNormalizationExecutionService, "execute">;
  decisionBandExecution: Pick<FactorDecisionBandExecutionService, "execute">;
};

const STAGES = ["PREFLIGHT", "EVALUATOR_EXECUTION", "CONTRIBUTION_AGGREGATION", "NORMALIZATION", "DECISION_BAND_CLASSIFICATION"] as const;
const ID = /^[A-Z0-9_]+$/;

export class DeterministicFactorPipelineService {
  public constructor(private readonly dependencies: DeterministicFactorPipelineDependencies) {}

  public execute(request: unknown): DeterministicFactorPipelineResult {
    if (!record(request) || !["input", "evaluatorPlan", "aggregationPolicy", "normalizationPolicy", "decisionBandPolicy"].every((key) => key in request)) {
      return this.preflightFailure("INVALID_REQUEST", request);
    }
    const input = request.input; const plan = request.evaluatorPlan; const aggregationPolicy = request.aggregationPolicy;
    const normalizationPolicy = request.normalizationPolicy; const decisionBandPolicy = request.decisionBandPolicy;
    if (!validInput(input)) return this.preflightFailure("INVALID_ASSEMBLED_INPUT", request);
    if (!validPlan(plan)) return this.preflightFailure("INVALID_EVALUATOR_PLAN", request);
    if (!validAggregationPolicy(aggregationPolicy)) return this.preflightFailure("INVALID_AGGREGATION_POLICY", request);
    if (!validNormalizationPolicy(normalizationPolicy)) return this.preflightFailure("INVALID_NORMALIZATION_POLICY", request);
    if (!validDecisionPolicy(decisionBandPolicy)) return this.preflightFailure("INVALID_DECISION_BAND_POLICY", request);
    if (input.factorKey !== plan.factorKey) return this.preflightFailure("INPUT_PLAN_FACTOR_MISMATCH", request);
    if (!planAggregationMatch(plan, aggregationPolicy)) return this.preflightFailure("PLAN_AGGREGATION_POLICY_MISMATCH", request);
    if (!aggregationNormalizationMatch(aggregationPolicy, normalizationPolicy)) return this.preflightFailure("AGGREGATION_NORMALIZATION_POLICY_MISMATCH", request);
    if (!normalizationDecisionMatch(normalizationPolicy, decisionBandPolicy)) return this.preflightFailure("NORMALIZATION_DECISION_BAND_POLICY_MISMATCH", request);

    let evaluatorExecution: any;
    try { evaluatorExecution = this.dependencies.evaluatorPlanRunner.run({ plan, input }); }
    catch { return this.stageFailure("EVALUATOR_EXECUTION", "UNEXPECTED_STAGE_EXCEPTION", null, request); }
    if (!record(evaluatorExecution) || evaluatorExecution.ran !== true) {
      return this.stageFailure("EVALUATOR_EXECUTION", "EVALUATOR_EXECUTION_FAILED", safeCode(evaluatorExecution), request);
    }
    evaluatorExecution = evaluatorExecution as FactorEvaluatorPlanRunReport;

    let aggregation: any;
    try { aggregation = this.dependencies.aggregationExecution.execute({ policy: aggregationPolicy, report: evaluatorExecution }); }
    catch { return this.stageFailure("CONTRIBUTION_AGGREGATION", "UNEXPECTED_STAGE_EXCEPTION", null, request); }
    if (!record(aggregation) || aggregation.aggregated !== true) {
      return this.stageFailure("CONTRIBUTION_AGGREGATION", "CONTRIBUTION_AGGREGATION_FAILED", safeCode(aggregation), request);
    }
    aggregation = aggregation as FactorContributionAggregationExecutionSuccess;

    let normalization: any;
    try { normalization = this.dependencies.normalizationExecution.execute({ policy: normalizationPolicy, aggregation }); }
    catch { return this.stageFailure("NORMALIZATION", "UNEXPECTED_STAGE_EXCEPTION", null, request); }
    if (!record(normalization) || normalization.normalized !== true) {
      return this.stageFailure("NORMALIZATION", "NORMALIZATION_FAILED", safeCode(normalization), request);
    }
    normalization = normalization as FactorAggregateNormalizationExecutionSuccess;

    let classification: any;
    try { classification = this.dependencies.decisionBandExecution.execute({ policy: decisionBandPolicy, normalization }); }
    catch { return this.stageFailure("DECISION_BAND_CLASSIFICATION", "UNEXPECTED_STAGE_EXCEPTION", null, request); }
    if (!record(classification) || classification.classified !== true) {
      return this.stageFailure("DECISION_BAND_CLASSIFICATION", "DECISION_BAND_CLASSIFICATION_FAILED", safeCode(classification), request);
    }
    classification = classification as FactorDecisionBandExecutionSuccess;

    return Object.freeze({ completed: true, factorKey: input.factorKey,
      subject: Object.freeze({ type: input.subject.type, key: input.subject.key }), evidenceId: input.evidenceId,
      identities: Object.freeze({
        evaluatorPlan: Object.freeze({ planId: plan.planId, planVersion: plan.planVersion }),
        aggregationPolicy: Object.freeze({ policyId: aggregationPolicy.policyId, policyVersion: aggregationPolicy.policyVersion }),
        normalizationPolicy: Object.freeze({ normalizationPolicyId: normalizationPolicy.normalizationPolicyId, normalizationPolicyVersion: normalizationPolicy.normalizationPolicyVersion }),
        decisionBandPolicy: Object.freeze({ decisionBandPolicyId: decisionBandPolicy.decisionBandPolicyId, decisionBandPolicyVersion: decisionBandPolicy.decisionBandPolicyVersion }),
      }), stages: successTrace(), evaluatorExecution, aggregation, normalization, classification });
  }

  private preflightFailure(code: DeterministicFactorPipelineFailureCode, request: unknown): DeterministicFactorPipelineResult {
    return failure("PREFLIGHT", code, null, request);
  }
  private stageFailure(stage: DeterministicFactorPipelineStage, code: DeterministicFactorPipelineFailureCode,
    stageFailureCode: string | null, request: unknown): DeterministicFactorPipelineResult {
    return failure(stage, code, stageFailureCode, request);
  }
}

const validInput = (v: unknown) => record(v) && trimmed(v.factorKey) && record(v.subject) && trimmed(v.subject.type)
  && trimmed(v.subject.key) && trimmed(v.evidenceId) && record(v.value) && v.value.type === "NUMBER" && finite(v.value.value) && trimmed(v.value.unit);
const validPlan = (v: unknown) => record(v) && identifier(v.planId) && positiveInt(v.planVersion) && trimmed(v.factorKey)
  && FACTOR_EVALUATOR_PLAN_FAILURE_POLICIES.includes(v.failurePolicy) && Array.isArray(v.steps) && dense(v.steps)
  && v.steps.length > 0 && v.steps.length <= 20 && v.steps.every((s: unknown, i: number) => record(s) && s.order === i + 1
    && identifier(s.evaluatorId) && positiveInt(s.evaluatorVersion) && positiveInt(s.configurationVersion)
    && Array.isArray(s.supportedFactorKeys) && s.supportedFactorKeys.includes(v.factorKey));
const validAggregationPolicy = (v: unknown) => record(v) && identifier(v.policyId) && positiveInt(v.policyVersion)
  && identifier(v.planId) && positiveInt(v.planVersion) && trimmed(v.factorKey) && v.method === "WEIGHTED_SUM"
  && record(v.bounds) && finite(v.bounds.minimumPoints) && finite(v.bounds.maximumPoints) && v.bounds.minimumPoints <= 0
  && v.bounds.maximumPoints >= 0 && v.bounds.minimumPoints <= v.bounds.maximumPoints && Array.isArray(v.entries) && dense(v.entries)
  && v.entries.length > 0 && v.entries.length <= 20 && v.entries.every((e: unknown, i: number) => record(e) && e.order === i + 1
    && identifier(e.evaluatorId) && positiveInt(e.evaluatorVersion) && positiveInt(e.configurationVersion) && finite(e.weight) && e.weight > 0 && e.weight <= 100);
const validNormalizationPolicy = (v: unknown) => record(v) && identifier(v.normalizationPolicyId) && positiveInt(v.normalizationPolicyVersion)
  && identifier(v.aggregationPolicyId) && positiveInt(v.aggregationPolicyVersion) && trimmed(v.factorKey)
  && v.method === "PIECEWISE_LINEAR_ZERO_ANCHORED" && record(v.sourceRange) && finite(v.sourceRange.minimumPoints)
  && v.sourceRange.minimumPoints < 0 && v.sourceRange.neutralPoints === 0 && finite(v.sourceRange.maximumPoints) && v.sourceRange.maximumPoints > 0
  && record(v.targetRange) && finite(v.targetRange.minimumScore) && finite(v.targetRange.neutralScore) && finite(v.targetRange.maximumScore)
  && v.targetRange.minimumScore < v.targetRange.neutralScore && v.targetRange.neutralScore < v.targetRange.maximumScore
  && v.outOfRangePolicy === "FAIL" && v.precisionPolicy === "PRESERVE_NATIVE";
const validDecisionPolicy = (v: unknown) => record(v) && identifier(v.decisionBandPolicyId) && positiveInt(v.decisionBandPolicyVersion)
  && identifier(v.normalizationPolicyId) && positiveInt(v.normalizationPolicyVersion) && trimmed(v.factorKey)
  && record(v.normalizedRange) && finite(v.normalizedRange.minimumScore) && finite(v.normalizedRange.maximumScore)
  && v.normalizedRange.minimumScore < v.normalizedRange.maximumScore && Array.isArray(v.bands) && dense(v.bands) && v.bands.length === 5
  && v.bands.every((b: unknown, i: number) => record(b) && b.order === i + 1 && b.label === FACTOR_DECISION_BAND_LABELS[i]
    && finite(b.minimumScore) && finite(b.maximumScore) && b.minimumScore < b.maximumScore
    && b.minimumInclusive === true && b.maximumInclusive === (i === 4));
const planAggregationMatch = (p: any, a: any) => a.planId === p.planId && a.planVersion === p.planVersion
  && a.factorKey === p.factorKey && a.entries.length === p.steps.length && a.entries.every((e: any, i: number) => {
    const s = p.steps[i]; return e.order === s.order && e.evaluatorId === s.evaluatorId && e.evaluatorVersion === s.evaluatorVersion && e.configurationVersion === s.configurationVersion;
  });
const aggregationNormalizationMatch = (a: any, n: any) => n.aggregationPolicyId === a.policyId
  && n.aggregationPolicyVersion === a.policyVersion && n.factorKey === a.factorKey
  && n.sourceRange.minimumPoints === a.bounds.minimumPoints && n.sourceRange.maximumPoints === a.bounds.maximumPoints;
const normalizationDecisionMatch = (n: any, d: any) => d.normalizationPolicyId === n.normalizationPolicyId
  && d.normalizationPolicyVersion === n.normalizationPolicyVersion && d.factorKey === n.factorKey
  && d.normalizedRange.minimumScore === n.targetRange.minimumScore && d.normalizedRange.maximumScore === n.targetRange.maximumScore;
const failure = (failedStage: DeterministicFactorPipelineStage, code: DeterministicFactorPipelineFailureCode,
  stageFailureCode: string | null, request: unknown): DeterministicFactorPipelineResult => {
  const r = record(request) ? request : {};
  return Object.freeze({ completed: false, factorKey: safeString(r.input, "factorKey"), evidenceId: safeString(r.input, "evidenceId"),
    failedStage, code, stageFailureCode, identities: Object.freeze({ evaluatorPlanId: safeId(r.evaluatorPlan, "planId"),
      aggregationPolicyId: safeId(r.aggregationPolicy, "policyId"), normalizationPolicyId: safeId(r.normalizationPolicy, "normalizationPolicyId"),
      decisionBandPolicyId: safeId(r.decisionBandPolicy, "decisionBandPolicyId") }), stages: trace(failedStage) });
};
const trace = (failed: DeterministicFactorPipelineStage | null): readonly DeterministicFactorPipelineStageTrace[] => {
  const failedIndex = failed === null ? STAGES.length : STAGES.indexOf(failed);
  return Object.freeze(STAGES.map((stage, i) => Object.freeze({ stage, status: (failed === null || i < failedIndex ? "COMPLETED" : i === failedIndex ? "FAILED" : "SKIPPED") as DeterministicFactorPipelineStageStatus })));
};
const successTrace = () => Object.freeze([
  Object.freeze({ stage: "PREFLIGHT" as const, status: "COMPLETED" as const }),
  Object.freeze({ stage: "EVALUATOR_EXECUTION" as const, status: "COMPLETED" as const }),
  Object.freeze({ stage: "CONTRIBUTION_AGGREGATION" as const, status: "COMPLETED" as const }),
  Object.freeze({ stage: "NORMALIZATION" as const, status: "COMPLETED" as const }),
  Object.freeze({ stage: "DECISION_BAND_CLASSIFICATION" as const, status: "COMPLETED" as const }),
] as const);
const safeCode = (v: unknown) => record(v) && typeof v.code === "string" ? v.code : null;
const record = (v: unknown): v is Record<string, any> => typeof v === "object" && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const positiveInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0;
const identifier = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 120 && v.trim() === v && ID.test(v);
const trimmed = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.trim() === v;
const dense = (v: readonly unknown[]) => { for (let i = 0; i < v.length; i += 1) if (!(i in v)) return false; return true; };
const safeId = (v: unknown, key: string): string | null => record(v) && identifier(v[key]) ? v[key] : null;
const safeString = (v: unknown, key: string): string | null => record(v) && trimmed(v[key]) ? v[key] : null;
