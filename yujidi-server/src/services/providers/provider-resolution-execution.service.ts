import { FACTOR_KEYS, type FactorKey } from "../../types/factor-registry.types.js";
import { PROVIDER_AUTHORITY_LEVELS, PROVIDER_COST_TIERS, PROVIDER_TYPES, type FactorProviderBinding, type ProviderDefinition, type ValidatedProviderCatalog } from "../../types/provider-definition.types.js";
import { PROVIDER_HEALTH_REASON_CODES, PROVIDER_HEALTH_STATES, type ProviderHealthAssessmentSuccess, type ProviderHealthState } from "../../types/provider-health.types.js";
import { PROVIDER_RESOLUTION_WARNING_CODES, type ProviderResolutionWarningCode, type ValidatedProviderResolutionPolicy } from "../../types/provider-resolution-policy.types.js";
import type { ProviderResolutionAttempt, ProviderResolutionExecutionFailureCode, ProviderResolutionExecutionRequest, ProviderResolutionExecutionResult } from "../../types/provider-resolution-execution.types.js";
import type { ProviderAuthorityRegistry } from "../../types/provider-authority-registration.types.js";
import { createDefaultProviderAuthorityRegistry } from "../../registries/provider-authority.registry.js";

const ID = /^[A-Z0-9_]+$/;
type Safe = ProviderResolutionExecutionRequest;

export class ProviderResolutionExecutionService {
  public constructor(private readonly providerAuthorities: Pick<ProviderAuthorityRegistry, "getExact"> = createDefaultProviderAuthorityRegistry()) {}

  public execute(request: ProviderResolutionExecutionRequest): ProviderResolutionExecutionResult {
    if (!record(request) || !("catalog" in request) || !("binding" in request) || !("policy" in request) || !("healthAssessments" in request)) return failure("INVALID_REQUEST", request);
    if (!catalogBoundary(request.catalog)) return failure("INVALID_CATALOG_BOUNDARY", request);
    if (!bindingBoundary(request.binding)) return failure("INVALID_BINDING_BOUNDARY", request);
    if (!policyBoundary(request.policy)) return failure("INVALID_POLICY_BOUNDARY", request);
    if (!Array.isArray(request.healthAssessments) || !request.healthAssessments.every(healthBoundary)) return failure("INVALID_HEALTH_ASSESSMENTS_BOUNDARY", request);
    const safe = request as Safe;
    if (safe.policy.factorKey !== safe.binding.factorKey) return failure("FACTOR_MISMATCH", request);
    const catalogBinding = safe.catalog.bindings.find((candidate) => bindingEqual(candidate, safe.binding));
    if (!catalogBinding) return failure("BINDING_NOT_IN_CATALOG", request);
    const providers = new Map(safe.catalog.providers.map((provider) => [provider.providerKey, provider]));
    for (const key of safe.binding.orderedProviderKeys) {
      const authority = this.providerAuthorities.getExact(key);
      if (authority && !authority.capabilities.liveExecutionEligible) return failure("PROVIDER_NOT_LIVE_EXECUTION_ELIGIBLE", request);
    }
    for (const key of safe.binding.orderedProviderKeys) if (!providers.has(key)) return failure("BOUND_PROVIDER_MISSING_FROM_CATALOG", request);
    const seen = new Set<string>();
    for (const assessment of safe.healthAssessments) { if (seen.has(assessment.providerKey)) return failure("DUPLICATE_HEALTH_ASSESSMENT", request); seen.add(assessment.providerKey); }
    for (const key of safe.binding.orderedProviderKeys) if (!seen.has(key)) return failure("HEALTH_ASSESSMENT_MISSING", request);
    const bound = new Set(safe.binding.orderedProviderKeys);
    if (safe.healthAssessments.some((assessment) => !bound.has(assessment.providerKey))) return failure("UNEXPECTED_HEALTH_ASSESSMENT", request);
    const health = new Map(safe.healthAssessments.map((assessment) => [assessment.providerKey, assessment]));
    for (const key of safe.binding.orderedProviderKeys) if (health.get(key)?.providerKey !== providers.get(key)?.providerKey) return failure("HEALTH_PROVIDER_MISMATCH", request);
    return this.resolve(safe, providers, health);
  }

  private resolve(request: Safe, providers: ReadonlyMap<string, ProviderDefinition>, health: ReadonlyMap<string, ProviderHealthAssessmentSuccess>): ProviderResolutionExecutionResult {
    const attempts: ProviderResolutionAttempt[] = [];
    const warnings = new Set<ProviderResolutionWarningCode>();
    let selected: { provider: ProviderDefinition; assessment: ProviderHealthAssessmentSuccess; order: number } | null = null;
    for (let order = 0; order < request.binding.orderedProviderKeys.length; order += 1) {
      const key = request.binding.orderedProviderKeys[order]!;
      const provider = providers.get(key)!;
      const assessment = health.get(key)!;
      const rule = order === 0 ? request.policy.preferredProviderRule : request.policy.fallbackProviderRule;
      const accepted = rule.allowedStates.includes(assessment.state);
      if (!accepted) {
        if (order === 0) {
          if (assessment.state === "HEALTHY") return failure("INVALID_RESOLUTION_STATE", request);
          addPreferredWarning(warnings, assessment.state);
        }
        attempts.push(attempt(order, provider, assessment.state, "REJECTED_HEALTH"));
        continue;
      }
      if (assessment.state === "UNKNOWN" || assessment.state === "UNAVAILABLE") return failure("INVALID_RESOLUTION_STATE", request);
      if (order === 0 && assessment.state === "DEGRADED" && !request.policy.allowDegradedPreferredProvider) return failure("INVALID_RESOLUTION_STATE", request);
      selected = { provider, assessment, order };
      attempts.push(attempt(order, provider, assessment.state, "SELECTED"));
      for (let later = order + 1; later < request.binding.orderedProviderKeys.length; later += 1) {
        const laterKey = request.binding.orderedProviderKeys[later]!;
        attempts.push(attempt(later, providers.get(laterKey)!, health.get(laterKey)!.state, "NOT_ATTEMPTED"));
      }
      break;
    }
    const common = { factorKey: request.binding.factorKey, policyId: request.policy.policyId, policyVersion: request.policy.policyVersion, requestedProviderKey: request.binding.orderedProviderKeys[0]!, attempts: freezeAttempts(attempts) };
    if (!selected) {
      warnings.add("NO_USABLE_PROVIDER");
      const status = request.policy.noUsableProviderOutcome;
      if (status === "MANUAL_REQUIRED") warnings.add("MANUAL_INTERVENTION_REQUIRED");
      return executed(Object.freeze({ ...common, resolved: false as const, selectedProviderKey: null, selectedProviderType: null, selectedProviderOrder: null, resolutionStatus: status, confidenceAdjustment: status === "MANUAL_REQUIRED" ? request.policy.confidenceAdjustments.manualRequired : request.policy.confidenceAdjustments.unresolved, warningCodes: orderedWarnings(warnings) }));
    }
    const { provider, assessment, order } = selected;
    let status: "RESOLVED" | "DEGRADED_PRIMARY_USED" | "FALLBACK_USED" | "PROXY_USED";
    if (provider.providerType === "PROXY") status = "PROXY_USED";
    else if (order === 0 && provider.providerType === "DIRECT" && assessment.state === "HEALTHY") status = "RESOLVED";
    else if (order === 0 && provider.providerType === "DIRECT" && assessment.state === "DEGRADED") status = "DEGRADED_PRIMARY_USED";
    else status = "FALLBACK_USED";
    if (order > 0) warnings.add("FALLBACK_PROVIDER_SELECTED");
    if (provider.providerType === "PROXY") warnings.add("PROXY_PROVIDER_SELECTED");
    if (provider.providerType === "MANUAL") warnings.add("MANUAL_PROVIDER_SELECTED");
    if (assessment.state === "DEGRADED") { if (order === 0) warnings.add("PREFERRED_PROVIDER_DEGRADED"); warnings.add("DEGRADED_PROVIDER_SELECTED"); }
    const adjustment = status === "RESOLVED" ? request.policy.confidenceAdjustments.resolved : status === "DEGRADED_PRIMARY_USED" ? request.policy.confidenceAdjustments.degradedPrimaryUsed : status === "PROXY_USED" ? request.policy.confidenceAdjustments.proxyUsed : request.policy.confidenceAdjustments.fallbackUsed;
    return executed(Object.freeze({ ...common, resolved: true as const, selectedProviderKey: provider.providerKey, selectedProviderType: provider.providerType, selectedProviderOrder: order, resolutionStatus: status, confidenceAdjustment: adjustment, warningCodes: orderedWarnings(warnings) }));
  }
}

const catalogBoundary = (value: unknown): value is ValidatedProviderCatalog => {
  if (!record(value) || !Array.isArray(value.providers) || !Array.isArray(value.bindings)) return false;
  if (!value.providers.every(providerBoundary) || !value.bindings.every(bindingBoundary)) return false;
  if (new Set(value.providers.map((p: any) => p.providerKey)).size !== value.providers.length) return false;
  return new Set(value.bindings.map((b: any) => b.factorKey)).size === value.bindings.length;
};
const providerBoundary = (p: any): p is ProviderDefinition => record(p) && identifier(p.providerKey) && trimmed(p.displayName, 160) && PROVIDER_TYPES.includes(p.providerType) && PROVIDER_AUTHORITY_LEVELS.includes(p.authorityLevel) && PROVIDER_COST_TIERS.includes(p.costTier) && Array.isArray(p.supportedFactorKeys) && p.supportedFactorKeys.length > 0 && p.supportedFactorKeys.every(factor) && new Set(p.supportedFactorKeys).size === p.supportedFactorKeys.length && typeof p.enabled === "boolean";
const bindingBoundary = (b: any): b is FactorProviderBinding => record(b) && factor(b.factorKey) && Array.isArray(b.orderedProviderKeys) && b.orderedProviderKeys.length > 0 && b.orderedProviderKeys.every(identifier) && new Set(b.orderedProviderKeys).size === b.orderedProviderKeys.length;
const policyBoundary = (p: any): p is ValidatedProviderResolutionPolicy => record(p) && identifier(p.policyId) && positiveInt(p.policyVersion) && factor(p.factorKey) && rule(p.preferredProviderRule) && rule(p.fallbackProviderRule) && typeof p.allowDegradedPreferredProvider === "boolean" && (p.allowDegradedPreferredProvider || !p.preferredProviderRule.allowedStates.includes("DEGRADED")) && (p.noUsableProviderOutcome === "MANUAL_REQUIRED" || p.noUsableProviderOutcome === "UNRESOLVED") && confidence(p.confidenceAdjustments);
const rule = (r: any) => record(r) && Array.isArray(r.allowedStates) && r.allowedStates.length > 0 && r.allowedStates.every((s: any) => s === "HEALTHY" || s === "DEGRADED") && new Set(r.allowedStates).size === r.allowedStates.length;
const confidence = (c: any) => record(c) && [c.resolved, c.degradedPrimaryUsed, c.fallbackUsed, c.proxyUsed, c.manualRequired, c.unresolved].every((n) => typeof n === "number" && Number.isFinite(n)) && c.resolved === 0 && [c.degradedPrimaryUsed, c.fallbackUsed, c.proxyUsed, c.manualRequired, c.unresolved].every((n) => n <= 0);
const healthBoundary = (h: any): h is ProviderHealthAssessmentSuccess => record(h) && h.assessed === true && identifier(h.providerKey) && identifier(h.policyId) && positiveInt(h.policyVersion) && PROVIDER_HEALTH_STATES.includes(h.state) && Array.isArray(h.reasonCodes) && h.reasonCodes.every((r: any) => PROVIDER_HEALTH_REASON_CODES.includes(r)) && record(h.metrics) && [h.metrics.errorRate, h.metrics.telemetryAgeMs, h.metrics.successAgeMs].every((n) => n === null || (typeof n === "number" && Number.isFinite(n) && n >= 0));
const bindingEqual = (a: FactorProviderBinding, b: FactorProviderBinding) => a.factorKey === b.factorKey && a.orderedProviderKeys.length === b.orderedProviderKeys.length && a.orderedProviderKeys.every((key, i) => key === b.orderedProviderKeys[i]);
const attempt = (order: number, provider: ProviderDefinition, healthState: ProviderHealthState, outcome: ProviderResolutionAttempt["outcome"]): ProviderResolutionAttempt => Object.freeze({ order, providerKey: provider.providerKey, providerType: provider.providerType, healthState, outcome });
const freezeAttempts = (a: ProviderResolutionAttempt[]) => Object.freeze([...a]);
const addPreferredWarning = (w: Set<ProviderResolutionWarningCode>, s: ProviderHealthState) => { if (s === "DEGRADED") w.add("PREFERRED_PROVIDER_DEGRADED"); else if (s === "UNAVAILABLE") w.add("PREFERRED_PROVIDER_UNAVAILABLE"); else if (s === "UNKNOWN") w.add("PREFERRED_PROVIDER_UNKNOWN"); };
const orderedWarnings = (w: Set<ProviderResolutionWarningCode>) => Object.freeze(PROVIDER_RESOLUTION_WARNING_CODES.filter((code) => w.has(code)));
const executed = (result: any): ProviderResolutionExecutionResult => Object.freeze({ executed: true, result });
const failure = (code: ProviderResolutionExecutionFailureCode, r: unknown): ProviderResolutionExecutionResult => Object.freeze({ executed: false, code, factorKey: record(r) && record(r.binding) && typeof r.binding.factorKey === "string" ? r.binding.factorKey : null, policyId: record(r) && record(r.policy) && typeof r.policy.policyId === "string" ? r.policy.policyId : null });
const record = (v: unknown): v is Record<string, any> => typeof v === "object" && v !== null && !Array.isArray(v);
const identifier = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 120 && v.trim() === v && ID.test(v);
const trimmed = (v: unknown, max: number): v is string => typeof v === "string" && v.length > 0 && v.length <= max && v.trim() === v;
const factor = (v: unknown): v is FactorKey => typeof v === "string" && FACTOR_KEYS.includes(v as never);
const positiveInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0;
