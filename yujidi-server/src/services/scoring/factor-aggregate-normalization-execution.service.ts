import type {
  FactorAggregateNormalizationExecutionFailureCode,
  FactorAggregateNormalizationExecutionResult,
} from "../../types/factor-aggregate-normalization-execution.types.js";
import type { ValidatedFactorAggregateNormalizationPolicy } from "../../types/factor-aggregate-normalization.types.js";
import type { FactorContributionAggregationExecutionSuccess } from "../../types/factor-contribution-aggregation-execution.types.js";

const ID = /^[A-Z0-9_]+$/;

export class FactorAggregateNormalizationExecutionService {
  public execute(request: unknown): FactorAggregateNormalizationExecutionResult {
    if (!record(request) || !("policy" in request) || !("aggregation" in request)) {
      return failure("INVALID_REQUEST", null, null, null);
    }
    const policy = request.policy;
    const aggregation = request.aggregation;
    const normalizationId = safeId(policy, "normalizationPolicyId");
    const aggregationId = safeId(aggregation, "policyId");
    const factor = safeString(aggregation, "factorKey");
    if (!validPolicy(policy)) return failure("INVALID_VALIDATED_POLICY", normalizationId, aggregationId, factor);
    if (!validAggregation(aggregation)) return failure("INVALID_AGGREGATION_RESULT", policy.normalizationPolicyId, aggregationId, factor);
    if (policy.aggregationPolicyId !== aggregation.policyId
      || policy.aggregationPolicyVersion !== aggregation.policyVersion) {
      return failure("AGGREGATION_POLICY_MISMATCH", policy.normalizationPolicyId, aggregation.policyId, aggregation.factorKey);
    }
    if (policy.factorKey !== aggregation.factorKey) {
      return failure("FACTOR_MISMATCH", policy.normalizationPolicyId, aggregation.policyId, aggregation.factorKey);
    }
    if (policy.sourceRange.minimumPoints !== aggregation.bounds.declared.minimumPoints
      || policy.sourceRange.maximumPoints !== aggregation.bounds.declared.maximumPoints) {
      return failure("SOURCE_RANGE_MISMATCH", policy.normalizationPolicyId, aggregation.policyId, aggregation.factorKey);
    }
    if (!finite(aggregation.aggregatePoints)) {
      return failure("NON_FINITE_RAW_AGGREGATE", policy.normalizationPolicyId, aggregation.policyId, aggregation.factorKey);
    }
    const raw = aggregation.aggregatePoints;
    if (raw < policy.sourceRange.minimumPoints || raw > policy.sourceRange.maximumPoints) {
      return failure("RAW_AGGREGATE_OUT_OF_RANGE", policy.normalizationPolicyId, aggregation.policyId, aggregation.factorKey);
    }
    if (policy.method !== "PIECEWISE_LINEAR_ZERO_ANCHORED") {
      return failure("UNSUPPORTED_METHOD", policy.normalizationPolicyId, aggregation.policyId, aggregation.factorKey);
    }
    if (policy.outOfRangePolicy !== "FAIL") {
      return failure("UNSUPPORTED_OUT_OF_RANGE_POLICY", policy.normalizationPolicyId, aggregation.policyId, aggregation.factorKey);
    }
    if (policy.precisionPolicy !== "PRESERVE_NATIVE") {
      return failure("UNSUPPORTED_PRECISION_POLICY", policy.normalizationPolicyId, aggregation.policyId, aggregation.factorKey);
    }
    const source = policy.sourceRange;
    const target = policy.targetRange;
    let segment: "LOWER" | "NEUTRAL" | "UPPER";
    let normalizedScore: number;
    if (Object.is(raw, -0) || raw === 0) {
      segment = "NEUTRAL";
      normalizedScore = target.neutralScore;
    } else if (raw === source.minimumPoints) {
      segment = "LOWER";
      normalizedScore = target.minimumScore;
    } else if (raw === source.maximumPoints) {
      segment = "UPPER";
      normalizedScore = target.maximumScore;
    } else if (raw < 0) {
      segment = "LOWER";
      normalizedScore = target.minimumScore
        + ((raw - source.minimumPoints) / (0 - source.minimumPoints))
        * (target.neutralScore - target.minimumScore);
    } else {
      segment = "UPPER";
      normalizedScore = target.neutralScore
        + (raw / source.maximumPoints)
        * (target.maximumScore - target.neutralScore);
    }
    if (!finite(normalizedScore)) return failure("NON_FINITE_NORMALIZED_SCORE", policy.normalizationPolicyId, aggregation.policyId, aggregation.factorKey);
    if (normalizedScore < target.minimumScore || normalizedScore > target.maximumScore) {
      return failure("NORMALIZED_SCORE_OUT_OF_RANGE", policy.normalizationPolicyId, aggregation.policyId, aggregation.factorKey);
    }
    return Object.freeze({
      normalized: true,
      normalizationPolicyId: policy.normalizationPolicyId,
      normalizationPolicyVersion: policy.normalizationPolicyVersion,
      aggregationPolicyId: aggregation.policyId,
      aggregationPolicyVersion: aggregation.policyVersion,
      planId: aggregation.planId,
      planVersion: aggregation.planVersion,
      factorKey: aggregation.factorKey,
      method: "PIECEWISE_LINEAR_ZERO_ANCHORED",
      sourceRange: Object.freeze({ ...source }),
      targetRange: Object.freeze({ ...target }),
      rawAggregatePoints: raw,
      segment,
      normalizedScore,
      outOfRangePolicy: "FAIL",
      precisionPolicy: "PRESERVE_NATIVE",
    });
  }
}

const validPolicy = (v: unknown): v is ValidatedFactorAggregateNormalizationPolicy => record(v)
  && identifier(v.normalizationPolicyId) && positiveInt(v.normalizationPolicyVersion)
  && identifier(v.aggregationPolicyId) && positiveInt(v.aggregationPolicyVersion)
  && trimmed(v.factorKey) && record(v.sourceRange) && finite(v.sourceRange.minimumPoints)
  && v.sourceRange.minimumPoints < 0 && v.sourceRange.neutralPoints === 0
  && finite(v.sourceRange.maximumPoints) && v.sourceRange.maximumPoints > 0
  && record(v.targetRange) && finite(v.targetRange.minimumScore) && finite(v.targetRange.neutralScore)
  && finite(v.targetRange.maximumScore) && v.targetRange.minimumScore < v.targetRange.neutralScore
  && v.targetRange.neutralScore < v.targetRange.maximumScore;

const validAggregation = (v: unknown): v is FactorContributionAggregationExecutionSuccess => record(v)
  && v.aggregated === true && identifier(v.policyId) && positiveInt(v.policyVersion)
  && identifier(v.planId) && positiveInt(v.planVersion) && trimmed(v.factorKey)
  && v.method === "WEIGHTED_SUM" && record(v.bounds) && record(v.bounds.declared)
  && finite(v.bounds.declared.minimumPoints) && finite(v.bounds.declared.maximumPoints)
  && v.bounds.declared.minimumPoints <= v.bounds.declared.maximumPoints
  && record(v.bounds.theoretical) && finite(v.bounds.theoretical.minimumPoints)
  && finite(v.bounds.theoretical.maximumPoints) && record(v.summary) && Array.isArray(v.steps);

const failure = (code: FactorAggregateNormalizationExecutionFailureCode,
  normalizationPolicyId: string | null, aggregationPolicyId: string | null,
  factorKey: string | null): FactorAggregateNormalizationExecutionResult => Object.freeze({
  normalized: false, normalizationPolicyId, aggregationPolicyId, factorKey, code,
});
const record = (v: unknown): v is Record<string, any> => typeof v === "object" && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const positiveInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0;
const identifier = (v: unknown): v is string => typeof v === "string" && v.length <= 120 && v.length > 0 && v.trim() === v && ID.test(v);
const trimmed = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.trim() === v;
const safeId = (v: unknown, key: string): string | null => record(v) && identifier(v[key]) ? v[key] : null;
const safeString = (v: unknown, key: string): string | null => record(v) && trimmed(v[key]) ? v[key] : null;
