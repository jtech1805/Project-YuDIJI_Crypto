import { FACTOR_KEYS, type FactorKey } from "../types/factor-registry.types.js";
import { PROVIDER_HEALTH_STATES, type ProviderHealthState } from "../types/provider-health.types.js";
import type {
  ProviderHealthAcceptanceRule,
  ProviderResolutionConfidenceAdjustments,
  ProviderResolutionPolicy,
  ProviderResolutionPolicyFailureCode,
  ProviderResolutionPolicyValidationResult,
  ValidatedProviderResolutionPolicy,
} from "../types/provider-resolution-policy.types.js";

const IDENTIFIER_PATTERN = /^[A-Z0-9_]+$/;
const POLICY_FIELDS = [
  "policyId", "policyVersion", "factorKey", "preferredProviderRule",
  "fallbackProviderRule", "allowDegradedPreferredProvider",
  "noUsableProviderOutcome", "confidenceAdjustments",
] as const;
const CONFIDENCE_FIELDS = [
  "resolved", "degradedPrimaryUsed", "fallbackUsed", "proxyUsed",
  "manualRequired", "unresolved",
] as const;

type Invalid = Exclude<ProviderResolutionPolicyValidationResult, { valid: true }>;

export class ProviderResolutionPolicyService {
  public validate(request: unknown): ProviderResolutionPolicyValidationResult {
    if (!record(request)) return invalid("INVALID_REQUEST", request);
    if (!POLICY_FIELDS.every((field) => Object.hasOwn(request, field))) {
      return invalid("INVALID_POLICY", request);
    }
    if (!identifier(request.policyId)) return invalid("INVALID_POLICY_ID", request);
    const policyId = request.policyId;
    if (!positiveInteger(request.policyVersion)) return invalid("INVALID_POLICY_VERSION", request);
    if (!isFactorKey(request.factorKey)) return invalid("INVALID_FACTOR_KEY", request);

    const preferred = validateRule(request.preferredProviderRule, "INVALID_PREFERRED_PROVIDER_RULE", policyId, request.factorKey);
    if (!preferred.valid) return preferred;
    const fallback = validateRule(request.fallbackProviderRule, "INVALID_FALLBACK_PROVIDER_RULE", policyId, request.factorKey);
    if (!fallback.valid) return fallback;

    if (typeof request.allowDegradedPreferredProvider !== "boolean") {
      return failure("INVALID_DEGRADED_PRIMARY_FLAG", policyId, request.factorKey);
    }
    if (!request.allowDegradedPreferredProvider
      && preferred.rule.allowedStates.includes("DEGRADED")) {
      return failure("INCONSISTENT_DEGRADED_PRIMARY_RULE", policyId, request.factorKey);
    }
    if (request.noUsableProviderOutcome !== "MANUAL_REQUIRED"
      && request.noUsableProviderOutcome !== "UNRESOLVED") {
      return failure("INVALID_NO_USABLE_PROVIDER_OUTCOME", policyId, request.factorKey);
    }
    if (!confidenceShape(request.confidenceAdjustments)) {
      return failure("INVALID_CONFIDENCE_ADJUSTMENTS", policyId, request.factorKey);
    }
    if (request.confidenceAdjustments.resolved !== 0) {
      return failure("INVALID_RESOLVED_CONFIDENCE_ADJUSTMENT", policyId, request.factorKey);
    }
    if (CONFIDENCE_FIELDS.slice(1).some(
      (field) => request.confidenceAdjustments[field] > 0,
    )) {
      return failure("POSITIVE_CONFIDENCE_ADJUSTMENT", policyId, request.factorKey);
    }

    const policy: ProviderResolutionPolicy = {
      policyId,
      policyVersion: request.policyVersion,
      factorKey: request.factorKey,
      preferredProviderRule: preferred.rule,
      fallbackProviderRule: fallback.rule,
      allowDegradedPreferredProvider: request.allowDegradedPreferredProvider,
      noUsableProviderOutcome: request.noUsableProviderOutcome,
      confidenceAdjustments: request.confidenceAdjustments,
    };
    return { valid: true, policy: freezePolicy(policy) };
  }
}

type RuleResult =
  | { valid: true; rule: ProviderHealthAcceptanceRule }
  | Invalid;

const validateRule = (
  value: unknown,
  malformedCode: "INVALID_PREFERRED_PROVIDER_RULE" | "INVALID_FALLBACK_PROVIDER_RULE",
  policyId: string,
  factorKey: FactorKey,
): RuleResult => {
  if (!record(value) || !Object.hasOwn(value, "allowedStates")
    || !Array.isArray(value.allowedStates)
    || !value.allowedStates.every((state) => PROVIDER_HEALTH_STATES.includes(state as never))) {
    return failure(malformedCode, policyId, factorKey);
  }
  if (value.allowedStates.length === 0) {
    return failure("EMPTY_ALLOWED_HEALTH_STATES", policyId, factorKey);
  }
  if (new Set(value.allowedStates).size !== value.allowedStates.length) {
    return failure("DUPLICATE_ALLOWED_HEALTH_STATE", policyId, factorKey);
  }
  if (value.allowedStates.includes("UNKNOWN") || value.allowedStates.includes("UNAVAILABLE")) {
    return failure("UNUSABLE_HEALTH_STATE_ALLOWED", policyId, factorKey);
  }
  return {
    valid: true,
    rule: { allowedStates: value.allowedStates as ProviderHealthState[] },
  };
};

const confidenceShape = (value: unknown): value is ProviderResolutionConfidenceAdjustments =>
  record(value)
  && CONFIDENCE_FIELDS.every((field) =>
    Object.hasOwn(value, field)
    && typeof value[field] === "number"
    && Number.isFinite(value[field]));

const freezePolicy = (
  policy: ProviderResolutionPolicy,
): ValidatedProviderResolutionPolicy => Object.freeze({
  policyId: policy.policyId,
  policyVersion: policy.policyVersion,
  factorKey: policy.factorKey,
  preferredProviderRule: Object.freeze({
    allowedStates: Object.freeze([...policy.preferredProviderRule.allowedStates]),
  }),
  fallbackProviderRule: Object.freeze({
    allowedStates: Object.freeze([...policy.fallbackProviderRule.allowedStates]),
  }),
  allowDegradedPreferredProvider: policy.allowDegradedPreferredProvider,
  noUsableProviderOutcome: policy.noUsableProviderOutcome,
  confidenceAdjustments: Object.freeze({ ...policy.confidenceAdjustments }),
});

const invalid = (code: ProviderResolutionPolicyFailureCode, request: unknown): Invalid =>
  failure(
    code,
    record(request) && typeof request.policyId === "string" ? request.policyId : null,
    record(request) && typeof request.factorKey === "string" ? request.factorKey : null,
  );
const failure = (
  code: ProviderResolutionPolicyFailureCode,
  policyId: string | null,
  factorKey: string | null,
): Invalid => Object.freeze({ valid: false, code, policyId, factorKey });
const record = (value: unknown): value is Record<string, any> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const identifier = (value: unknown): value is string =>
  typeof value === "string" && value.length >= 1 && value.length <= 120
  && value.trim() === value && IDENTIFIER_PATTERN.test(value);
const positiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;
const isFactorKey = (value: unknown): value is FactorKey =>
  typeof value === "string" && FACTOR_KEYS.includes(value as never);
