import {
  FACTOR_CONTRIBUTION_AGGREGATION_METHODS,
  FACTOR_OUTCOME_AGGREGATION_ELIGIBILITY,
  MAX_AGGREGATION_POLICY_ENTRIES,
  MAX_AGGREGATION_WEIGHT,
  type FactorContributionAggregationPolicyFailureCode,
  type FactorContributionAggregationPolicyValidationResult,
  type ValidatedFactorContributionAggregationEntry,
} from "../../types/factor-contribution-aggregation.types.js";
import type {
  ValidatedFactorEvaluatorExecutionPlan,
} from "../../types/factor-evaluator-execution-plan.types.js";

const MAX_IDENTIFIER_LENGTH = 120;

type SafeEntry = ValidatedFactorContributionAggregationEntry;

export class FactorContributionAggregationPolicyService {
  public validate(params: unknown): FactorContributionAggregationPolicyValidationResult {
    if (!record(params)) return failure("INVALID_POLICY", null);

    const rawPlan = read(params, "plan");
    if (!rawPlan.readable || !validPlanBoundary(rawPlan.value)) {
      return failure("INVALID_PLAN_REFERENCE", null);
    }
    const plan = rawPlan.value;

    const rawPolicy = read(params, "policy");
    if (!rawPolicy.readable || !record(rawPolicy.value)) {
      return failure("INVALID_POLICY", null);
    }
    const policy = rawPolicy.value;

    const policyIdValue = read(policy, "policyId");
    if (!policyIdValue.readable || !identifier(policyIdValue.value)) {
      return failure("INVALID_POLICY_ID", null);
    }
    const policyId = policyIdValue.value;

    const policyVersionValue = read(policy, "policyVersion");
    if (!policyVersionValue.readable
      || !positiveInteger(policyVersionValue.value)) {
      return failure("INVALID_POLICY_VERSION", policyId);
    }

    const planIdValue = read(policy, "planId");
    const planVersionValue = read(policy, "planVersion");
    if (!planIdValue.readable
      || !planVersionValue.readable
      || planIdValue.value !== plan.planId
      || planVersionValue.value !== plan.planVersion) {
      return failure("INVALID_PLAN_REFERENCE", policyId);
    }

    const factorValue = read(policy, "factorKey");
    if (!factorValue.readable || factorValue.value !== plan.factorKey) {
      return failure("FACTOR_MISMATCH", policyId);
    }

    const methodValue = read(policy, "method");
    if (!methodValue.readable
      || !FACTOR_CONTRIBUTION_AGGREGATION_METHODS.includes(
        methodValue.value as never,
      )) {
      return failure("INVALID_AGGREGATION_METHOD", policyId);
    }

    const boundsValue = read(policy, "bounds");
    if (!boundsValue.readable || !validBounds(boundsValue.value)) {
      return failure("INVALID_BOUNDS", policyId);
    }

    const entriesValue = read(policy, "entries");
    if (!entriesValue.readable
      || !Array.isArray(entriesValue.value)
      || !dense(entriesValue.value)) {
      return failure("INVALID_POLICY", policyId);
    }
    if (entriesValue.value.length === 0) {
      return failure("EMPTY_ENTRIES", policyId);
    }
    if (entriesValue.value.length > MAX_AGGREGATION_POLICY_ENTRIES) {
      return failure("TOO_MANY_ENTRIES", policyId);
    }

    const entries: SafeEntry[] = [];
    for (const rawEntry of entriesValue.value as readonly unknown[]) {
      if (!record(rawEntry)
        || !hasOwn(rawEntry, "order")
        || !hasOwn(rawEntry, "evaluatorId")
        || !hasOwn(rawEntry, "evaluatorVersion")
        || !hasOwn(rawEntry, "configurationVersion")
        || !hasOwn(rawEntry, "weight")) {
        return failure("INVALID_ENTRY", policyId);
      }
      const order = read(rawEntry, "order");
      const evaluatorId = read(rawEntry, "evaluatorId");
      const evaluatorVersion = read(rawEntry, "evaluatorVersion");
      const configurationVersion = read(rawEntry, "configurationVersion");
      const weight = read(rawEntry, "weight");
      if (!evaluatorId.readable
        || !identifier(evaluatorId.value)
        || !evaluatorVersion.readable
        || !positiveInteger(evaluatorVersion.value)
        || !configurationVersion.readable
        || !positiveInteger(configurationVersion.value)
        || !weight.readable) {
        return failure("INVALID_ENTRY", policyId);
      }
      if (!order.readable || !positiveInteger(order.value)) {
        return failure(
          "INVALID_ENTRY_ORDER",
          policyId,
          evaluatorId.value,
        );
      }
      if (!validWeight(weight.value)) {
        return failure(
          "INVALID_WEIGHT",
          policyId,
          evaluatorId.value,
          order.value,
        );
      }
      entries.push({
        order: order.value,
        evaluatorId: evaluatorId.value,
        evaluatorVersion: evaluatorVersion.value,
        configurationVersion: configurationVersion.value,
        weight: weight.value,
      });
    }

    const seenOrders = new Set<number>();
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index]!;
      if (seenOrders.has(entry.order)) {
        return failure(
          "DUPLICATE_ENTRY_ORDER",
          policyId,
          entry.evaluatorId,
          entry.order,
        );
      }
      seenOrders.add(entry.order);
      if (entry.order !== index + 1) {
        return failure(
          "INVALID_ENTRY_ORDER",
          policyId,
          entry.evaluatorId,
          entry.order,
        );
      }
    }

    const seenEvaluatorIds = new Set<string>();
    for (const entry of entries) {
      if (seenEvaluatorIds.has(entry.evaluatorId)) {
        return failure(
          "DUPLICATE_EVALUATOR_ID",
          policyId,
          entry.evaluatorId,
          entry.order,
        );
      }
      seenEvaluatorIds.add(entry.evaluatorId);
    }

    if (entries.length !== plan.steps.length) {
      return failure("ENTRY_COUNT_MISMATCH", policyId);
    }
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index]!;
      const step = plan.steps[index]!;
      if (entry.order !== step.order
        || entry.evaluatorId !== step.evaluatorId
        || entry.evaluatorVersion !== step.evaluatorVersion
        || entry.configurationVersion !== step.configurationVersion) {
        return failure(
          "PLAN_ENTRY_MISMATCH",
          policyId,
          entry.evaluatorId,
          entry.order,
        );
      }
    }

    return Object.freeze({
      valid: true,
      policy: Object.freeze({
        policyId,
        policyVersion: policyVersionValue.value,
        planId: plan.planId,
        planVersion: plan.planVersion,
        factorKey: plan.factorKey,
        method: "WEIGHTED_SUM",
        bounds: Object.freeze({
          minimumPoints: boundsValue.value.minimumPoints,
          maximumPoints: boundsValue.value.maximumPoints,
        }),
        outcomeEligibility: Object.freeze({
          ...FACTOR_OUTCOME_AGGREGATION_ELIGIBILITY,
        }),
        entries: Object.freeze(entries.map((entry) => Object.freeze({
          ...entry,
        }))),
      }),
    });
  }
}

const validPlanBoundary = (
  value: unknown,
): value is ValidatedFactorEvaluatorExecutionPlan => {
  if (!record(value)
    || !identifier(value.planId)
    || !positiveInteger(value.planVersion)
    || !trimmed(value.factorKey)
    || !Array.isArray(value.steps)
    || !dense(value.steps)
    || value.steps.length === 0
    || value.steps.length > MAX_AGGREGATION_POLICY_ENTRIES) return false;

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

const validBounds = (
  value: unknown,
): value is { minimumPoints: number; maximumPoints: number } =>
  record(value)
  && finite(value.minimumPoints)
  && finite(value.maximumPoints)
  && value.minimumPoints <= value.maximumPoints
  && value.minimumPoints <= 0
  && value.maximumPoints >= 0;

const validWeight = (value: unknown): value is number =>
  finite(value) && value > 0 && value <= MAX_AGGREGATION_WEIGHT;

const failure = (
  code: FactorContributionAggregationPolicyFailureCode,
  policyId: string | null,
  evaluatorId: string | null = null,
  entryOrder: number | null = null,
): FactorContributionAggregationPolicyValidationResult => Object.freeze({
  valid: false,
  code,
  policyId,
  evaluatorId,
  entryOrder,
});

const read = (
  value: Record<string, unknown>,
  key: string,
): { readable: true; value: any } | { readable: false } => {
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

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const record = (value: unknown): value is Record<string, any> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasOwn = (value: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);
