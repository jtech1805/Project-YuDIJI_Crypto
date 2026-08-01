import type {
  ExplicitFactorEvaluatorExecutionService,
} from "./explicit-factor-evaluator-execution.service.js";
import {
  EXPLICIT_FACTOR_EVALUATOR_EXECUTION_FAILURE_CODES,
  type ExplicitFactorEvaluatorExecutionFailure,
  type ExplicitFactorEvaluatorExecutionResult,
} from "../types/factor-evaluator-execution.types.js";
import {
  FACTOR_EVALUATOR_PLAN_FAILURE_POLICIES,
  MAX_EVALUATORS_PER_EXECUTION_PLAN,
  type FactorEvaluatorPlanFailurePolicy,
  type ValidatedFactorEvaluatorExecutionPlan,
  type ValidatedFactorEvaluatorExecutionPlanStep,
} from "../types/factor-evaluator-execution-plan.types.js";
import {
  FACTOR_EVALUATOR_FAILURE_CODES,
} from "../types/factor-evaluator.types.js";
import type { AssembledFactorInput } from "../types/factor-input-assembly.types.js";
import type {
  AttemptedFactorEvaluatorPlanStepReport,
  FactorEvaluatorPlanRunFailure,
  FactorEvaluatorPlanRunFailureCode,
  FactorEvaluatorPlanRunResult,
  FactorEvaluatorPlanRunSummary,
  FactorEvaluatorPlanStepDisposition,
  FactorEvaluatorPlanStepReport,
  FactorEvaluatorPlanTerminationReason,
  SkippedFactorEvaluatorPlanStepReport,
} from "../types/factor-evaluator-plan-runner.types.js";

const MAX_IDENTIFIER_LENGTH = 120;
const INVALID_CLONE = Symbol("INVALID_CLONE");

export type FactorEvaluatorPlanRunnerDependencies = {
  executionService: Pick<ExplicitFactorEvaluatorExecutionService, "execute">;
};

type SafeRequest = {
  plan: ValidatedFactorEvaluatorExecutionPlan;
  input: AssembledFactorInput;
};

export class FactorEvaluatorPlanRunnerService {
  public constructor(
    private readonly dependencies: FactorEvaluatorPlanRunnerDependencies,
  ) {}

  public run(request: unknown): FactorEvaluatorPlanRunResult {
    if (!record(request)) return failure("INVALID_REQUEST", null, null);

    const rawPlan = safelyRead(request, "plan");
    const rawInput = safelyRead(request, "input");
    if (!rawPlan.readable || !rawInput.readable
      || rawPlan.value === undefined || rawInput.value === undefined) {
      return failure("INVALID_REQUEST", null, null);
    }

    const planId = safePlanId(rawPlan.value);
    if (!validInputBoundary(rawInput.value)) {
      return failure("INVALID_REQUEST", planId, safeFactorKey(rawInput.value));
    }
    if (!validPlanBoundary(rawPlan.value)) {
      return failure(
        "INVALID_VALIDATED_PLAN",
        planId,
        rawInput.value.factorKey,
      );
    }

    const safeRequest: SafeRequest = {
      plan: rawPlan.value,
      input: rawInput.value,
    };
    if (safeRequest.plan.factorKey !== safeRequest.input.factorKey) {
      return failure(
        "FACTOR_MISMATCH",
        safeRequest.plan.planId,
        safeRequest.input.factorKey,
      );
    }

    return this.execute(safeRequest);
  }

  private execute(request: SafeRequest): FactorEvaluatorPlanRunResult {
    const reports: FactorEvaluatorPlanStepReport[] = [];
    let terminationReason: FactorEvaluatorPlanTerminationReason = "NONE";
    let terminationOrder: number | null = null;
    let terminationEvaluatorId: string | null = null;

    for (let index = 0; index < request.plan.steps.length; index += 1) {
      const step = request.plan.steps[index]!;
      const execution = this.executeSafely(step, request.input);
      const disposition = classify(execution);
      reports.push(attemptedReport(step, disposition, execution));

      if (index < request.plan.steps.length - 1
        && shouldStop(request.plan.failurePolicy, disposition)) {
        terminationReason = disposition === "BOUNDARY_FAILURE"
          ? "BOUNDARY_FAILURE"
          : "TYPED_EVALUATOR_FAILURE";
        terminationOrder = step.order;
        terminationEvaluatorId = step.evaluatorId;
        for (let skippedIndex = index + 1;
          skippedIndex < request.plan.steps.length;
          skippedIndex += 1) {
          reports.push(skippedReport(request.plan.steps[skippedIndex]!));
        }
        break;
      }
    }

    const summary = summarize(reports);
    const stopped = summary.skippedSteps > 0;
    const termination = Object.freeze({
      reason: stopped ? terminationReason : "NONE" as const,
      stepOrder: stopped ? terminationOrder : null,
      evaluatorId: stopped ? terminationEvaluatorId : null,
    });
    return Object.freeze({
      ran: true,
      planId: request.plan.planId,
      planVersion: request.plan.planVersion,
      factorKey: request.plan.factorKey,
      failurePolicy: request.plan.failurePolicy,
      status: stopped ? "STOPPED" : "COMPLETED",
      termination,
      summary,
      steps: Object.freeze(reports),
    });
  }

  private executeSafely(
    step: ValidatedFactorEvaluatorExecutionPlanStep,
    input: AssembledFactorInput,
  ): ExplicitFactorEvaluatorExecutionResult {
    let raw: unknown;
    try {
      raw = this.dependencies.executionService.execute({
        evaluatorId: step.evaluatorId,
        input,
      });
    } catch {
      return boundaryFailure(
        step.evaluatorId,
        input.factorKey,
        "EVALUATOR_EXECUTION_FAILED",
      );
    }
    return normalizeExecution(raw, step, input.factorKey)
      ?? boundaryFailure(
        step.evaluatorId,
        input.factorKey,
        "INVALID_EVALUATOR_EXECUTION",
      );
  }
}

const normalizeExecution = (
  raw: unknown,
  step: ValidatedFactorEvaluatorExecutionPlanStep,
  factorKey: AssembledFactorInput["factorKey"],
): ExplicitFactorEvaluatorExecutionResult | null => {
  if (!record(raw) || typeof raw.executed !== "boolean") return null;
  if (!raw.executed) {
    if ((raw.evaluatorId !== null && typeof raw.evaluatorId !== "string")
      || (raw.factorKey !== null && typeof raw.factorKey !== "string")
      || !EXPLICIT_FACTOR_EVALUATOR_EXECUTION_FAILURE_CODES.includes(raw.code as never)) {
      return null;
    }
    return boundaryFailure(raw.evaluatorId, raw.factorKey, raw.code);
  }
  if (raw.evaluatorId !== step.evaluatorId
    || raw.evaluatorVersion !== step.evaluatorVersion
    || raw.configurationVersion !== step.configurationVersion
    || raw.factorKey !== factorKey
    || !record(raw.execution)
    || typeof raw.execution.evaluated !== "boolean") return null;
  if (!raw.execution.evaluated
    && ((raw.execution.evaluatorId !== null
      && typeof raw.execution.evaluatorId !== "string")
      || (raw.execution.factorKey !== null
        && typeof raw.execution.factorKey !== "string")
      || !FACTOR_EVALUATOR_FAILURE_CODES.includes(raw.execution.code as never))) {
    return null;
  }
  if (raw.execution.evaluated && !record(raw.execution.result)) return null;

  const cloned = cloneFrozen(raw);
  return cloned === INVALID_CLONE
    ? null
    : cloned as ExplicitFactorEvaluatorExecutionResult;
};

const classify = (
  execution: ExplicitFactorEvaluatorExecutionResult,
): Exclude<FactorEvaluatorPlanStepDisposition, "SKIPPED_AFTER_TERMINATION"> => {
  if (!execution.executed) return "BOUNDARY_FAILURE";
  return execution.execution.evaluated
    ? "EVALUATED"
    : "TYPED_EVALUATOR_FAILURE";
};

const shouldStop = (
  policy: FactorEvaluatorPlanFailurePolicy,
  disposition: Exclude<
    FactorEvaluatorPlanStepDisposition,
    "SKIPPED_AFTER_TERMINATION"
  >,
): boolean => {
  if (policy === "CONTINUE_ALWAYS" || disposition === "EVALUATED") return false;
  if (policy === "CONTINUE_ON_EVALUATOR_FAILURE") {
    return disposition === "BOUNDARY_FAILURE";
  }
  return true;
};

const attemptedReport = (
  step: ValidatedFactorEvaluatorExecutionPlanStep,
  disposition: AttemptedFactorEvaluatorPlanStepReport["disposition"],
  execution: ExplicitFactorEvaluatorExecutionResult,
): AttemptedFactorEvaluatorPlanStepReport => Object.freeze({
  order: step.order,
  evaluatorId: step.evaluatorId,
  evaluatorVersion: step.evaluatorVersion,
  configurationVersion: step.configurationVersion,
  status: "ATTEMPTED",
  disposition,
  execution,
});

const skippedReport = (
  step: ValidatedFactorEvaluatorExecutionPlanStep,
): SkippedFactorEvaluatorPlanStepReport => Object.freeze({
  order: step.order,
  evaluatorId: step.evaluatorId,
  evaluatorVersion: step.evaluatorVersion,
  configurationVersion: step.configurationVersion,
  status: "SKIPPED",
  disposition: "SKIPPED_AFTER_TERMINATION",
  execution: null,
});

const summarize = (
  reports: readonly FactorEvaluatorPlanStepReport[],
): FactorEvaluatorPlanRunSummary => {
  const attemptedSteps = count(reports, "ATTEMPTED");
  const skippedSteps = count(reports, "SKIPPED");
  const evaluatedSteps = dispositionCount(reports, "EVALUATED");
  const typedEvaluatorFailures = dispositionCount(
    reports,
    "TYPED_EVALUATOR_FAILURE",
  );
  const boundaryFailures = dispositionCount(reports, "BOUNDARY_FAILURE");
  return Object.freeze({
    totalSteps: reports.length,
    attemptedSteps,
    skippedSteps,
    evaluatedSteps,
    typedEvaluatorFailures,
    boundaryFailures,
  });
};

const count = (
  reports: readonly FactorEvaluatorPlanStepReport[],
  status: FactorEvaluatorPlanStepReport["status"],
): number => reports.reduce(
  (total, report) => total + (report.status === status ? 1 : 0),
  0,
);

const dispositionCount = (
  reports: readonly FactorEvaluatorPlanStepReport[],
  disposition: FactorEvaluatorPlanStepDisposition,
): number => reports.reduce(
  (total, report) => total + (report.disposition === disposition ? 1 : 0),
  0,
);

const validInputBoundary = (value: unknown): value is AssembledFactorInput =>
  record(value)
  && trimmed(value.factorKey)
  && record(value.subject)
  && trimmed(value.evidenceId)
  && record(value.value);

const validPlanBoundary = (
  value: unknown,
): value is ValidatedFactorEvaluatorExecutionPlan => {
  if (!record(value)
    || !identifier(value.planId)
    || !positiveInteger(value.planVersion)
    || !trimmed(value.factorKey)
    || !FACTOR_EVALUATOR_PLAN_FAILURE_POLICIES.includes(
      value.failurePolicy as never,
    )
    || !Array.isArray(value.steps)
    || !dense(value.steps)
    || value.steps.length === 0
    || value.steps.length > MAX_EVALUATORS_PER_EXECUTION_PLAN) return false;

  for (let index = 0; index < value.steps.length; index += 1) {
    const step = value.steps[index];
    if (!record(step)
      || step.order !== index + 1
      || !identifier(step.evaluatorId)
      || !positiveInteger(step.evaluatorVersion)
      || !positiveInteger(step.configurationVersion)) return false;
  }
  return true;
};

const boundaryFailure = (
  evaluatorId: string | null,
  factorKey: string | null,
  code: ExplicitFactorEvaluatorExecutionFailure["code"],
): ExplicitFactorEvaluatorExecutionFailure => Object.freeze({
  executed: false,
  evaluatorId,
  factorKey,
  code,
});

const failure = (
  code: FactorEvaluatorPlanRunFailureCode,
  planId: string | null,
  factorKey: string | null,
): FactorEvaluatorPlanRunFailure => Object.freeze({
  ran: false,
  planId,
  factorKey,
  code,
});

const cloneFrozen = (
  value: unknown,
  seen = new Set<object>(),
): unknown | typeof INVALID_CLONE => {
  if (value === null
    || typeof value === "string"
    || typeof value === "number"
    || typeof value === "boolean") return value;
  if (value instanceof Date) {
    return Number.isFinite(value.getTime())
      ? Object.freeze(new Date(value.getTime()))
      : INVALID_CLONE;
  }
  if (typeof value !== "object" || seen.has(value)) return INVALID_CLONE;
  seen.add(value);
  if (Array.isArray(value)) {
    const cloned: unknown[] = [];
    for (const item of value) {
      const nested = cloneFrozen(item, seen);
      if (nested === INVALID_CLONE) return INVALID_CLONE;
      cloned.push(nested);
    }
    seen.delete(value);
    return Object.freeze(cloned);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return INVALID_CLONE;
  const cloned: Record<string, unknown> = {};
  try {
    for (const [key, item] of Object.entries(value)) {
      const nested = cloneFrozen(item, seen);
      if (nested === INVALID_CLONE) return INVALID_CLONE;
      cloned[key] = nested;
    }
  } catch {
    return INVALID_CLONE;
  }
  seen.delete(value);
  return Object.freeze(cloned);
};

const safePlanId = (value: unknown): string | null =>
  record(value) && identifier(value.planId) ? value.planId : null;

const safeFactorKey = (value: unknown): string | null =>
  record(value) && trimmed(value.factorKey) ? value.factorKey : null;

const safelyRead = (
  value: Record<string, unknown>,
  key: string,
): { readable: true; value: unknown } | { readable: false } => {
  try {
    return { readable: true, value: value[key] };
  } catch {
    return { readable: false };
  }
};

const dense = (values: readonly unknown[]): boolean => {
  for (let index = 0; index < values.length; index += 1) {
    if (!(index in values)) return false;
  }
  return true;
};

const identifier = (value: unknown): value is string =>
  typeof value === "string"
  && value.length > 0
  && value.length <= MAX_IDENTIFIER_LENGTH
  && value.trim() === value
  && /^[A-Z0-9_]+$/.test(value);

const trimmed = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.trim() === value;

const positiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

const record = (value: unknown): value is Record<string, any> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
