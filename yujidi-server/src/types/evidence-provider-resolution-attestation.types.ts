import type { ProviderKey, ProviderType } from "./provider-definition.types.js";
import type { ProviderResolutionSelectedResult } from "./provider-resolution-execution.types.js";
import { PROVIDER_RESOLUTION_STATUSES, type ProviderResolutionWarningCode } from "./provider-resolution-policy.types.js";
import type { VersionedProviderBindingIdentity } from "./versioned-provider-binding.types.js";

export const EVIDENCE_PROVIDER_RESOLUTION_ATTESTATION_STATUSES = Object.freeze(
  PROVIDER_RESOLUTION_STATUSES.filter((status): status is ProviderResolutionSelectedResult["resolutionStatus"] => (
    status !== "MANUAL_REQUIRED" && status !== "UNRESOLVED"
  )),
);

export type EvidenceProviderResolutionPolicyIdentity = Readonly<{
  policyId: string;
  policyVersion: number;
}>;

export type CreateEvidenceProviderResolutionAttestation = Readonly<{
  attestationId: string;
  attestationVersion: number;
  evidenceId: string;
  providerBinding: VersionedProviderBindingIdentity;
  resolutionPolicy: EvidenceProviderResolutionPolicyIdentity;
  selectedProviderKey: ProviderKey;
  selectedProviderType: ProviderType;
  resolutionStatus: ProviderResolutionSelectedResult["resolutionStatus"];
  confidenceAdjustment: number;
  warningCodes: readonly ProviderResolutionWarningCode[];
  resolvedAt: Date;
}>;

export type EvidenceProviderResolutionAttestation = Readonly<
  CreateEvidenceProviderResolutionAttestation & Readonly<{ createdAt: Date }>
>;

export const EVIDENCE_PROVIDER_RESOLUTION_ATTESTATION_VALIDATION_FAILURES = Object.freeze([
  "INVALID_ATTESTATION_ID",
  "INVALID_ATTESTATION_VERSION",
  "INVALID_EVIDENCE_ID",
  "INVALID_PROVIDER_BINDING",
  "INVALID_PROVIDER_BINDING_ID",
  "INVALID_PROVIDER_BINDING_VERSION",
  "INVALID_RESOLUTION_POLICY",
  "INVALID_RESOLUTION_POLICY_ID",
  "INVALID_RESOLUTION_POLICY_VERSION",
  "INVALID_SELECTED_PROVIDER",
  "INVALID_SELECTED_PROVIDER_TYPE",
  "UNSUPPORTED_RESOLUTION_STATUS",
  "INVALID_CONFIDENCE_ADJUSTMENT",
  "INVALID_WARNINGS",
  "INVALID_RESOLVED_AT",
  "CALLER_CREATED_AT_FORBIDDEN",
] as const);
export type EvidenceProviderResolutionAttestationValidationFailure =
  (typeof EVIDENCE_PROVIDER_RESOLUTION_ATTESTATION_VALIDATION_FAILURES)[number];

export type InsertEvidenceProviderResolutionAttestationResult =
  | Readonly<{ inserted: true; code: "INSERTED"; attestation: EvidenceProviderResolutionAttestation }>
  | Readonly<{ inserted: false; code: "ALREADY_EXISTS"; attestation: EvidenceProviderResolutionAttestation }>
  | Readonly<{ inserted: false; code: "CONFLICT" | "EVIDENCE_NOT_FOUND" | "PERSISTENCE_ERROR" }>
  | Readonly<{ inserted: false; code: "INVALID_REQUEST"; failure: EvidenceProviderResolutionAttestationValidationFailure }>;

export type EvidenceProviderResolutionAttestationReadResult =
  | Readonly<{ found: true; attestation: EvidenceProviderResolutionAttestation }>
  | Readonly<{ found: false; code: "NOT_FOUND" | "INVALID_REQUEST" | "INVARIANT_VIOLATION" | "PERSISTENCE_ERROR" }>;

export interface EvidenceProviderResolutionAttestationRepositoryPort {
  insert(attestation: CreateEvidenceProviderResolutionAttestation): Promise<InsertEvidenceProviderResolutionAttestationResult>;
  findExactByEvidenceId(evidenceId: string): Promise<EvidenceProviderResolutionAttestationReadResult>;
}
