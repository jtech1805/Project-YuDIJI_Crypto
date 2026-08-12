import {
  FACTOR_AGGREGATE_NORMALIZATION_METHODS,
  FACTOR_AGGREGATE_NORMALIZATION_OUT_OF_RANGE_POLICIES,
  FACTOR_AGGREGATE_NORMALIZATION_PRECISION_POLICIES,
  type FactorAggregateNormalizationPolicyFailureCode,
  type FactorAggregateNormalizationPolicyValidationResult,
} from "../../types/factor-aggregate-normalization.types.js";
import {
  MAX_AGGREGATION_POLICY_ENTRIES,
  MAX_AGGREGATION_WEIGHT,
  type ValidatedFactorContributionAggregationPolicy,
} from "../../types/factor-contribution-aggregation.types.js";

const MAX_IDENTIFIER_LENGTH = 120;

export class FactorAggregateNormalizationPolicyService {
  public validate(request: unknown): FactorAggregateNormalizationPolicyValidationResult {
    if (!record(request)
      || !("policy" in request)
      || !("aggregationPolicy" in request)) {
      return failure("INVALID_REQUEST", null, null, null);
    }

    const rawPolicy = request.policy;
    const rawAggregationPolicy = request.aggregationPolicy;
    const normalizationPolicyId = safeIdentifier(
      rawPolicy,
      "normalizationPolicyId",
    );
    const referencedAggregationPolicyId = safeIdentifier(
      rawPolicy,
      "aggregationPolicyId",
    );
    const rawFactorKey = safeTrimmed(rawPolicy, "factorKey");

    if (!validAggregationPolicyBoundary(rawAggregationPolicy)) {
      return failure(
        "INVALID_AGGREGATION_POLICY",
        normalizationPolicyId,
        null,
        null,
      );
    }
    const aggregationPolicy = rawAggregationPolicy;

    if (!record(rawPolicy)) {
      return failure(
        "INVALID_NORMALIZATION_POLICY",
        null,
        aggregationPolicy.policyId,
        aggregationPolicy.factorKey,
      );
    }
    if (!identifier(rawPolicy.normalizationPolicyId)) {
      return failure(
        "INVALID_POLICY_ID",
        null,
        referencedAggregationPolicyId,
        rawFactorKey,
      );
    }
    const policyId = rawPolicy.normalizationPolicyId;
    if (!positiveInteger(rawPolicy.normalizationPolicyVersion)) {
      return failure(
        "INVALID_POLICY_VERSION",
        policyId,
        referencedAggregationPolicyId,
        rawFactorKey,
      );
    }
    if (rawPolicy.aggregationPolicyId !== aggregationPolicy.policyId
      || rawPolicy.aggregationPolicyVersion !== aggregationPolicy.policyVersion) {
      return failure(
        "AGGREGATION_POLICY_MISMATCH",
        policyId,
        referencedAggregationPolicyId,
        rawFactorKey,
      );
    }
    if (rawPolicy.factorKey !== aggregationPolicy.factorKey) {
      return failure(
        "FACTOR_MISMATCH",
        policyId,
        aggregationPolicy.policyId,
        rawFactorKey,
      );
    }
    if (!FACTOR_AGGREGATE_NORMALIZATION_METHODS.includes(
      rawPolicy.method as never,
    )) {
      return failure(
        "INVALID_METHOD",
        policyId,
        aggregationPolicy.policyId,
        rawPolicy.factorKey,
      );
    }
    if (!validSourceRange(rawPolicy.sourceRange)) {
      return failure(
        "INVALID_SOURCE_RANGE",
        policyId,
        aggregationPolicy.policyId,
        rawPolicy.factorKey,
      );
    }
    if (rawPolicy.sourceRange.minimumPoints !== aggregationPolicy.bounds.minimumPoints
      || rawPolicy.sourceRange.maximumPoints !== aggregationPolicy.bounds.maximumPoints) {
      return failure(
        "SOURCE_RANGE_MISMATCH",
        policyId,
        aggregationPolicy.policyId,
        rawPolicy.factorKey,
      );
    }
    if (!validTargetRange(rawPolicy.targetRange)) {
      return failure(
        "INVALID_TARGET_RANGE",
        policyId,
        aggregationPolicy.policyId,
        rawPolicy.factorKey,
      );
    }
    if (!FACTOR_AGGREGATE_NORMALIZATION_OUT_OF_RANGE_POLICIES.includes(
      rawPolicy.outOfRangePolicy as never,
    )) {
      return failure(
        "INVALID_OUT_OF_RANGE_POLICY",
        policyId,
        aggregationPolicy.policyId,
        rawPolicy.factorKey,
      );
    }
    if (!FACTOR_AGGREGATE_NORMALIZATION_PRECISION_POLICIES.includes(
      rawPolicy.precisionPolicy as never,
    )) {
      return failure(
        "INVALID_PRECISION_POLICY",
        policyId,
        aggregationPolicy.policyId,
        rawPolicy.factorKey,
      );
    }

    return Object.freeze({
      valid: true,
      policy: Object.freeze({
        normalizationPolicyId: policyId,
        normalizationPolicyVersion: rawPolicy.normalizationPolicyVersion,
        aggregationPolicyId: aggregationPolicy.policyId,
        aggregationPolicyVersion: aggregationPolicy.policyVersion,
        factorKey: aggregationPolicy.factorKey,
        method: "PIECEWISE_LINEAR_ZERO_ANCHORED",
        sourceRange: Object.freeze({
          minimumPoints: rawPolicy.sourceRange.minimumPoints,
          neutralPoints: 0 as const,
          maximumPoints: rawPolicy.sourceRange.maximumPoints,
        }),
        targetRange: Object.freeze({
          minimumScore: rawPolicy.targetRange.minimumScore,
          neutralScore: rawPolicy.targetRange.neutralScore,
          maximumScore: rawPolicy.targetRange.maximumScore,
        }),
        outOfRangePolicy: "FAIL",
        precisionPolicy: "PRESERVE_NATIVE",
      }),
    });
  }
}

const validAggregationPolicyBoundary = (
  value: unknown,
): value is ValidatedFactorContributionAggregationPolicy => {
  if (!record(value)
    || !identifier(value.policyId)
    || !positiveInteger(value.policyVersion)
    || !trimmed(value.factorKey)
    || value.method !== "WEIGHTED_SUM"
    || !validAggregateBounds(value.bounds)
    || !record(value.outcomeEligibility)
    || value.outcomeEligibility.PASS !== "ELIGIBLE"
    || value.outcomeEligibility.FAIL !== "ELIGIBLE"
    || value.outcomeEligibility.NEUTRAL !== "ELIGIBLE"
    || value.outcomeEligibility.UNAVAILABLE !== "INELIGIBLE"
    || !Array.isArray(value.entries)
    || !dense(value.entries)
    || value.entries.length === 0
    || value.entries.length > MAX_AGGREGATION_POLICY_ENTRIES) return false;
  for (let index = 0; index < value.entries.length; index += 1) {
    const entry = value.entries[index];
    if (!record(entry)
      || entry.order !== index + 1
      || !identifier(entry.evaluatorId)
      || !positiveInteger(entry.evaluatorVersion)
      || !positiveInteger(entry.configurationVersion)
      || !finite(entry.weight)
      || entry.weight <= 0
      || entry.weight > MAX_AGGREGATION_WEIGHT) return false;
  }
  return true;
};

const validAggregateBounds = (value: unknown): boolean => record(value)
  && finite(value.minimumPoints)
  && finite(value.maximumPoints)
  && value.minimumPoints <= value.maximumPoints
  && value.minimumPoints <= 0
  && value.maximumPoints >= 0;

const validSourceRange = (value: unknown): value is {
  minimumPoints: number;
  neutralPoints: 0;
  maximumPoints: number;
} => record(value)
  && finite(value.minimumPoints)
  && value.minimumPoints < 0
  && value.neutralPoints === 0
  && finite(value.maximumPoints)
  && value.maximumPoints > 0;

const validTargetRange = (value: unknown): value is {
  minimumScore: number;
  neutralScore: number;
  maximumScore: number;
} => record(value)
  && finite(value.minimumScore)
  && finite(value.neutralScore)
  && finite(value.maximumScore)
  && value.minimumScore < value.neutralScore
  && value.neutralScore < value.maximumScore;

const failure = (
  code: FactorAggregateNormalizationPolicyFailureCode,
  normalizationPolicyId: string | null,
  aggregationPolicyId: string | null,
  factorKey: string | null,
): FactorAggregateNormalizationPolicyValidationResult => Object.freeze({
  valid: false,
  code,
  normalizationPolicyId,
  aggregationPolicyId,
  factorKey,
});

const safeIdentifier = (value: unknown, key: string): string | null =>
  record(value) && identifier(value[key]) ? value[key] : null;

const safeTrimmed = (value: unknown, key: string): string | null =>
  record(value) && trimmed(value[key]) ? value[key] : null;

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
