import type { CompiledObservationAttestationFailureCode, CompiledObservationAttestationResult, CompiledShadowObservation } from "../types/compiled-shadow-observation.types.js";
import type { CompiledFactorBinding, CompiledFixedSubject } from "../types/compiled-rulebook.types.js";
import type { VersionedProviderBindingRegistry } from "../types/versioned-provider-binding.types.js";
import type { VersionedProviderResolutionPolicyRegistry } from "../types/versioned-provider-resolution-policy.types.js";
export type CompiledObservationAttestationDependencies = Readonly<{
  providerBindings: Pick<VersionedProviderBindingRegistry, "getExact">;
  resolutionPolicies: Pick<VersionedProviderResolutionPolicyRegistry, "getExact">;
}>;
export class CompiledObservationAttestationValidationService {
  public constructor(private readonly dependencies: CompiledObservationAttestationDependencies) {}
  public validate(request: unknown): CompiledObservationAttestationResult {
    if (!structure(request)) return fail("INVALID_SHADOW_OBSERVATION");
    const { observation, binding, resolvedSubject } = request;
    if (observation.factor.factorKey !== binding.factor.factorKey || observation.factor.factorVersion !== binding.factor.factorVersion) return fail("OBSERVATION_FACTOR_MISMATCH");
    if (observation.subject.type !== resolvedSubject.type || observation.subject.key !== resolvedSubject.key) return fail("OBSERVATION_SUBJECT_MISMATCH");
    const attestation = observation.providerAttestation;
    if (attestation.providerBindingId !== binding.provider.providerBindingId || attestation.providerBindingVersion !== binding.provider.providerBindingVersion) return fail("PROVIDER_BINDING_ATTESTATION_MISMATCH");
    if (attestation.resolutionPolicyId !== binding.provider.resolutionPolicyId || attestation.resolutionPolicyVersion !== binding.provider.resolutionPolicyVersion) return fail("RESOLUTION_POLICY_ATTESTATION_MISMATCH");
    const providerBinding = this.dependencies.providerBindings.getExact(attestation.providerBindingId, attestation.providerBindingVersion);
    if (!providerBinding) return fail("PROVIDER_BINDING_NOT_FOUND");
    const resolution = this.dependencies.resolutionPolicies.getExact(attestation.resolutionPolicyId, attestation.resolutionPolicyVersion);
    if (!resolution) return fail("RESOLUTION_POLICY_NOT_FOUND");
    if (!providerBinding.compileEligible) return fail("PROVIDER_BINDING_NOT_COMPILE_ELIGIBLE");
    if (!resolution.compileEligible) return fail("RESOLUTION_POLICY_NOT_COMPILE_ELIGIBLE");
    if (!providerBinding.orderedProviderKeys.includes(attestation.selectedProviderKey as any)) return fail("SELECTED_PROVIDER_NOT_IN_BINDING");
    if (!["RESOLVED", "FALLBACK", "PROXY"].includes(attestation.resolutionOutcome)) return fail("UNSUPPORTED_RESOLUTION_OUTCOME");
    return Object.freeze({ valid: true, observation: freezeClone(observation) });
  }
}
const record = (value: unknown): value is Record<string, any> => typeof value === "object" && value !== null && !Array.isArray(value);
const structure = (value: unknown): value is { observation: CompiledShadowObservation; binding: CompiledFactorBinding; resolvedSubject: CompiledFixedSubject } => {
  if (!record(value) || !record(value.observation) || !record(value.binding) || !record(value.resolvedSubject)) return false;
  const o = value.observation; const a = o.providerAttestation;
  return record(o.factor) && typeof o.factor.factorKey === "string" && Number.isSafeInteger(o.factor.factorVersion) && record(o.subject) && typeof o.subject.type === "string" && typeof o.subject.key === "string" && typeof o.value === "number" && Number.isFinite(o.value) && typeof o.unit === "string" && o.unit.length > 0 && o.observedAt instanceof Date && Number.isFinite(o.observedAt.getTime()) && (o.confidence === null || typeof o.confidence === "number" && Number.isFinite(o.confidence)) && record(a) && typeof a.providerBindingId === "string" && Number.isSafeInteger(a.providerBindingVersion) && typeof a.resolutionPolicyId === "string" && Number.isSafeInteger(a.resolutionPolicyVersion) && typeof a.selectedProviderKey === "string" && typeof a.resolutionOutcome === "string" && record(value.binding.factor) && record(value.binding.provider) && typeof value.resolvedSubject.type === "string" && typeof value.resolvedSubject.key === "string";
};
const freezeClone = <T>(value: T): T => deepFreeze(structuredClone(value));
const deepFreeze = <T>(value: T): T => { if (!record(value) || Object.isFrozen(value)) return value; for (const nested of Object.values(value)) deepFreeze(nested); return Object.freeze(value); };
const fail = (code: CompiledObservationAttestationFailureCode): CompiledObservationAttestationResult => Object.freeze({ valid: false, code });
