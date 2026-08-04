import { MAX_COMPILED_EXECUTION_OBSERVATIONS } from "../types/compiled-execution-request.types.js";
import type { CompiledObservationSelectionResult } from "../types/compiled-observation-selection.types.js";
import type { CompiledShadowObservation } from "../types/compiled-shadow-observation.types.js";
import type { CompiledFactorBinding, CompiledFixedSubject } from "../types/compiled-rulebook.types.js";

export class CompiledObservationSelectionService {
  public select(request: unknown): CompiledObservationSelectionResult {
    if (!record(request) || !Array.isArray(request.observations) || !dense(request.observations)
      || request.observations.length === 0 || request.observations.length > MAX_COMPILED_EXECUTION_OBSERVATIONS
      || !record(request.binding) || !record(request.resolvedSubject)) return fail("INVALID_OBSERVATION_COLLECTION");
    if (!request.observations.every(validObservation)) return fail("INVALID_SHADOW_OBSERVATION");
    const binding = request.binding as CompiledFactorBinding;
    const subject = request.resolvedSubject as CompiledFixedSubject;
    const matches = (request.observations as CompiledShadowObservation[]).filter((observation) => match(observation, binding, subject));
    if (matches.length === 0) return fail("OBSERVATION_NOT_FOUND");
    if (matches.length > 1) {
      const identities = new Set(matches.map(semanticIdentity));
      return fail(identities.size === 1 ? "DUPLICATE_OBSERVATION" : "AMBIGUOUS_OBSERVATION");
    }
    return Object.freeze({ selected: true, observation: freezeClone(matches[0]!) });
  }
}

const match = (o: CompiledShadowObservation, b: CompiledFactorBinding, s: CompiledFixedSubject): boolean => o.factor.factorKey === b.factor.factorKey
  && o.factor.factorVersion === b.factor.factorVersion && o.subject.type === s.type && o.subject.key === s.key
  && o.providerAttestation.providerBindingId === b.provider.providerBindingId
  && o.providerAttestation.providerBindingVersion === b.provider.providerBindingVersion
  && o.providerAttestation.resolutionPolicyId === b.provider.resolutionPolicyId
  && o.providerAttestation.resolutionPolicyVersion === b.provider.resolutionPolicyVersion;
const semanticIdentity = (o: CompiledShadowObservation): string => JSON.stringify([
  o.factor.factorKey, o.factor.factorVersion, o.subject.type, o.subject.key, o.value, o.unit,
  o.observedAt.toISOString(), o.confidence, o.providerAttestation.providerBindingId,
  o.providerAttestation.providerBindingVersion, o.providerAttestation.resolutionPolicyId,
  o.providerAttestation.resolutionPolicyVersion, o.providerAttestation.selectedProviderKey,
  o.providerAttestation.resolutionOutcome,
]);
const validObservation = (value: unknown): value is CompiledShadowObservation => {
  if (!record(value) || !record(value.factor) || typeof value.factor.factorKey !== "string" || !positive(value.factor.factorVersion)
    || !record(value.subject) || typeof value.subject.type !== "string" || typeof value.subject.key !== "string"
    || typeof value.value !== "number" || !Number.isFinite(value.value) || typeof value.unit !== "string" || value.unit.length === 0
    || !(value.observedAt instanceof Date) || !Number.isFinite(value.observedAt.getTime())
    || !(value.confidence === null || typeof value.confidence === "number" && Number.isFinite(value.confidence))
    || !record(value.providerAttestation)) return false;
  const a = value.providerAttestation;
  return typeof a.providerBindingId === "string" && positive(a.providerBindingVersion)
    && typeof a.resolutionPolicyId === "string" && positive(a.resolutionPolicyVersion)
    && typeof a.selectedProviderKey === "string" && typeof a.resolutionOutcome === "string";
};
const freezeClone = <T>(value: T): T => deepFreeze(structuredClone(value));
const deepFreeze = <T>(value: T): T => { if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value; for (const nested of Object.values(value)) deepFreeze(nested); return Object.freeze(value); };
const fail = (code: Extract<CompiledObservationSelectionResult, { selected: false }>["code"]): CompiledObservationSelectionResult => Object.freeze({ selected: false, code });
const record = (value: unknown): value is Record<string, any> => typeof value === "object" && value !== null && !Array.isArray(value);
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
const dense = (values: readonly unknown[]): boolean => { for (let index = 0; index < values.length; index += 1) if (!(index in values)) return false; return true; };
