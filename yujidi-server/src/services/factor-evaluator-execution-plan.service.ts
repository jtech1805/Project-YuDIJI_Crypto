import type {
  DeterministicFactorEvaluatorRegistry,
} from "../registries/deterministic-factor-evaluator.registry.js";
import {
  FACTOR_EVALUATOR_PLAN_FAILURE_POLICIES,
  MAX_EVALUATORS_PER_EXECUTION_PLAN,
  type FactorEvaluatorExecutionPlanFailureCode,
  type FactorEvaluatorExecutionPlanValidationResult,
  type FactorEvaluatorPlanFailurePolicy,
  type ValidatedFactorEvaluatorExecutionPlanStep,
} from "../types/factor-evaluator-execution-plan.types.js";
import {
  FACTOR_KEYS,
  type FactorKey,
} from "../types/factor-registry.types.js";

const MAX_PLAN_ID_LENGTH = 120;

export type FactorEvaluatorExecutionPlanDependencies = {
  evaluatorRegistry: Pick<DeterministicFactorEvaluatorRegistry, "getById">;
};

type SafeStep = {
  order: number;
  evaluatorId: string;
};

export class FactorEvaluatorExecutionPlanService {
  public constructor(
    private readonly dependencies: FactorEvaluatorExecutionPlanDependencies,
  ) {}

  public validate(plan: unknown): FactorEvaluatorExecutionPlanValidationResult {
    if (!record(plan)) return failure("INVALID_PLAN", null);

    const planIdValue = read(plan, "planId");
    if (!planIdValue.readable || !identifier(planIdValue.value)) {
      return failure("INVALID_PLAN_ID", null);
    }
    const planId = planIdValue.value;

    const planVersionValue = read(plan, "planVersion");
    if (!planVersionValue.readable || !positiveInteger(planVersionValue.value)) {
      return failure("INVALID_PLAN_VERSION", planId);
    }

    const factorValue = read(plan, "factorKey");
    if (!factorValue.readable || !FACTOR_KEYS.includes(factorValue.value as never)) {
      return failure("UNSUPPORTED_FACTOR", planId);
    }
    const factorKey = factorValue.value as FactorKey;

    const policyValue = read(plan, "failurePolicy");
    if (!policyValue.readable
      || !FACTOR_EVALUATOR_PLAN_FAILURE_POLICIES.includes(policyValue.value as never)) {
      return failure("INVALID_FAILURE_POLICY", planId);
    }
    const failurePolicy = policyValue.value as FactorEvaluatorPlanFailurePolicy;

    const stepsValue = read(plan, "steps");
    if (!stepsValue.readable
      || !Array.isArray(stepsValue.value)
      || !dense(stepsValue.value)) {
      return failure("INVALID_PLAN", planId);
    }
    if (stepsValue.value.length === 0) return failure("EMPTY_PLAN", planId);
    if (stepsValue.value.length > MAX_EVALUATORS_PER_EXECUTION_PLAN) {
      return failure("TOO_MANY_EVALUATORS", planId);
    }

    const steps: SafeStep[] = [];
    for (const rawStep of stepsValue.value as readonly unknown[]) {
      if (!record(rawStep)) return failure("INVALID_STEP", planId);
      const orderValue = read(rawStep, "order");
      const evaluatorIdValue = read(rawStep, "evaluatorId");
      if (!evaluatorIdValue.readable || !trimmed(evaluatorIdValue.value)) {
        return failure("INVALID_STEP", planId);
      }
      if (!orderValue.readable || !positiveInteger(orderValue.value)) {
        return failure(
          "INVALID_STEP_ORDER",
          planId,
          evaluatorIdValue.value,
        );
      }
      steps.push({
        order: orderValue.value,
        evaluatorId: evaluatorIdValue.value,
      });
    }

    const seenOrders = new Set<number>();
    for (let index = 0; index < steps.length; index += 1) {
      const step = steps[index]!;
      if (seenOrders.has(step.order)) {
        return failure(
          "DUPLICATE_STEP_ORDER",
          planId,
          step.evaluatorId,
          step.order,
        );
      }
      seenOrders.add(step.order);
      if (step.order !== index + 1) {
        return failure(
          "INVALID_STEP_ORDER",
          planId,
          step.evaluatorId,
          step.order,
        );
      }
    }

    const seenEvaluatorIds = new Set<string>();
    for (const step of steps) {
      if (seenEvaluatorIds.has(step.evaluatorId)) {
        return failure(
          "DUPLICATE_EVALUATOR_ID",
          planId,
          step.evaluatorId,
          step.order,
        );
      }
      seenEvaluatorIds.add(step.evaluatorId);
    }

    const validatedSteps: ValidatedFactorEvaluatorExecutionPlanStep[] = [];
    for (const step of steps) {
      const evaluator = this.dependencies.evaluatorRegistry.getById(step.evaluatorId);
      if (!evaluator) {
        return failure(
          "EVALUATOR_NOT_FOUND",
          planId,
          step.evaluatorId,
          step.order,
        );
      }
      if (!Array.isArray(evaluator.supportedFactorKeys)
        || !evaluator.supportedFactorKeys.includes(factorKey)) {
        return failure(
          "EVALUATOR_DOES_NOT_SUPPORT_FACTOR",
          planId,
          step.evaluatorId,
          step.order,
        );
      }
      validatedSteps.push(Object.freeze({
        order: step.order,
        evaluatorId: step.evaluatorId,
        evaluatorVersion: evaluator.evaluatorVersion,
        configurationVersion: evaluator.configurationVersion,
        supportedFactorKeys: Object.freeze([...evaluator.supportedFactorKeys]),
      }));
    }

    return Object.freeze({
      valid: true,
      plan: Object.freeze({
        planId,
        planVersion: planVersionValue.value,
        factorKey,
        failurePolicy,
        steps: Object.freeze(validatedSteps),
      }),
    });
  }
}

const failure = (
  code: FactorEvaluatorExecutionPlanFailureCode,
  planId: string | null,
  evaluatorId: string | null = null,
  stepOrder: number | null = null,
): FactorEvaluatorExecutionPlanValidationResult => Object.freeze({
  valid: false,
  code,
  planId,
  evaluatorId,
  stepOrder,
});

const read = (
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
  && value.length <= MAX_PLAN_ID_LENGTH
  && value.trim() === value
  && /^[A-Z0-9_]+$/.test(value);

const trimmed = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.trim() === value;

const positiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
