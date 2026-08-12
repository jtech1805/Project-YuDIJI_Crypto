import type { EvidenceSubjectType } from "./evidence.types.js";
export const COMPILED_SHADOW_RESOLUTION_OUTCOMES = Object.freeze(["RESOLVED", "FALLBACK", "PROXY"] as const);
export type CompiledShadowResolutionOutcome = (typeof COMPILED_SHADOW_RESOLUTION_OUTCOMES)[number];
export type CompiledShadowObservation = Readonly<{
  factor: Readonly<{ factorKey: string; factorVersion: number }>;
  subject: Readonly<{ type: EvidenceSubjectType; key: string }>;
  value: number;
  unit: string;
  observedAt: Date;
  confidence: number | null;
  providerAttestation: Readonly<{
    providerBindingId: string; providerBindingVersion: number;
    resolutionPolicyId: string; resolutionPolicyVersion: number;
    selectedProviderKey: string;
    resolutionOutcome: CompiledShadowResolutionOutcome;
  }>;
}>;
export type CompiledObservationAttestationFailureCode = "INVALID_SHADOW_OBSERVATION" | "OBSERVATION_FACTOR_MISMATCH" | "OBSERVATION_SUBJECT_MISMATCH" | "PROVIDER_BINDING_ATTESTATION_MISMATCH" | "RESOLUTION_POLICY_ATTESTATION_MISMATCH" | "PROVIDER_BINDING_NOT_FOUND" | "RESOLUTION_POLICY_NOT_FOUND" | "SELECTED_PROVIDER_NOT_IN_BINDING" | "UNSUPPORTED_RESOLUTION_OUTCOME" | "PROVIDER_BINDING_NOT_COMPILE_ELIGIBLE" | "RESOLUTION_POLICY_NOT_COMPILE_ELIGIBLE";
export type CompiledObservationAttestationResult =
  | Readonly<{ valid: true; observation: CompiledShadowObservation }>
  | Readonly<{ valid: false; code: CompiledObservationAttestationFailureCode }>;
