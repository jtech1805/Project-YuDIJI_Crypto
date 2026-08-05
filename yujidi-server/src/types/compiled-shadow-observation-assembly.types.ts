import type { CompiledRulebookExecutionBinding } from "./compiled-rulebook-execution-binding.types.js";
import type { CompiledShadowObservation, CompiledShadowResolutionOutcome } from "./compiled-shadow-observation.types.js";
import type { CompiledRulebookDefinition } from "./compiled-rulebook.types.js";
import type { EvidenceProviderResolutionAttestation } from "./evidence-provider-resolution-attestation.types.js";
import type { EvidenceFreshnessResult } from "./evidence-factor-compatibility.types.js";
import type { EvidenceLifecycleState, EvidenceReadRecord } from "./evidence-lifecycle.types.js";
import type { ProviderResolutionSelectedResult } from "./provider-resolution-execution.types.js";

export const COMPILED_SHADOW_ASSEMBLY_STATUSES = Object.freeze(["COMPLETED", "PARTIAL", "NO_USABLE_EVIDENCE", "INVALID_EVIDENCE_SET", "FAILED"] as const);
export type CompiledShadowObservationAssemblyStatus = (typeof COMPILED_SHADOW_ASSEMBLY_STATUSES)[number];
export const COMPILED_SHADOW_AVAILABILITY_STATUSES = Object.freeze(["ELIGIBLE", "NOT_YET_PUBLISHED", "NOT_YET_INGESTED", "ATTESTATION_NOT_YET_PERSISTED", "PUBLICATION_TIME_MISSING", "INGESTION_TIME_MISSING", "ATTESTATION_CREATED_TIME_MISSING", "INVALID_PUBLICATION_TIME", "INVALID_INGESTION_TIME", "INVALID_ATTESTATION_CREATED_TIME"] as const);
export type CompiledShadowAvailabilityStatus = (typeof COMPILED_SHADOW_AVAILABILITY_STATUSES)[number];
export const COMPILED_SHADOW_ASSEMBLY_REASON_CODES = Object.freeze(["NO_CANDIDATE", "INVALID_EVIDENCE", "DUPLICATE_EVIDENCE_ID", "PROVIDER_ATTESTATION_MISSING", "PROVIDER_ATTESTATION_AMBIGUOUS", "EVIDENCE_ID_MISMATCH", "FACTOR_MISMATCH", "FACTOR_VERSION_MISMATCH", "SUBJECT_MISMATCH", "VALUE_TYPE_MISMATCH", "UNIT_MISMATCH", "PROVIDER_BINDING_MISMATCH", "RESOLUTION_POLICY_MISMATCH", "PROVIDER_BINDING_NOT_FOUND", "RESOLUTION_POLICY_NOT_FOUND", "PROVIDER_AUTHORITY_INELIGIBLE", "SELECTED_PROVIDER_NOT_IN_BINDING", "PROVIDER_REGISTRATION_MISSING", "PROVIDER_PROVENANCE_MISMATCH", "LIFECYCLE_EXCLUDED", "FRESHNESS_REJECTED", "AMBIGUOUS_CANDIDATES"] as const);
export type CompiledShadowAssemblyReasonCode = (typeof COMPILED_SHADOW_ASSEMBLY_REASON_CODES)[number];
export type CompiledShadowAssemblyDisposition = "PROJECTED" | "OMITTED" | "INVALID";
export type CompiledShadowObservationAssemblyRequest = Readonly<{ rulebook: CompiledRulebookDefinition; executionBinding: CompiledRulebookExecutionBinding; asOf: Date; tradedInstrument: Readonly<{ type: "INSTRUMENT"; key: string }>; underlyingAsset?: Readonly<{ type: "ASSET"; key: string }>; evidence: readonly EvidenceReadRecord[]; attestations: readonly EvidenceProviderResolutionAttestation[] }>;
export type CompiledShadowObservationAssemblyTrace = Readonly<{
  bindingIndex: number; bindingId: string; factor: Readonly<{ factorKey: string; factorVersion: number }>; expectedSubject: Readonly<{ type: string; key: string }> | null;
  evidenceId: string | null; observedAt: Date | null; sourcePublishedAt: Date | null; evidenceCreatedAt: Date | null; attestationId: string | null; attestationResolvedAt: Date | null; attestationCreatedAt: Date | null; asOf: Date;
  availabilityStatus: CompiledShadowAvailabilityStatus | null; lifecycleStatus: EvidenceLifecycleState | null; compatibilityStatus: "COMPATIBLE" | "INCOMPATIBLE" | null; freshness: EvidenceFreshnessResult | null;
  selectedProviderKey: string | null; evidenceProvenanceProvider: string | null; providerBinding: Readonly<{ providerBindingId: string; providerBindingVersion: number }> | null; resolutionPolicy: Readonly<{ policyId: string; policyVersion: number }> | null;
  detailedResolutionStatus: ProviderResolutionSelectedResult["resolutionStatus"] | null; compiledResolutionOutcome: CompiledShadowResolutionOutcome | null; confidenceAdjustment: number | null; warningCodes: readonly string[];
  disposition: CompiledShadowAssemblyDisposition; reasonCodes: readonly (CompiledShadowAssemblyReasonCode | CompiledShadowAvailabilityStatus)[];
}>;
export type CompiledShadowObservationAssemblyResult = Readonly<{ status: CompiledShadowObservationAssemblyStatus; rulebook: Readonly<{ rulebookId: string; rulebookVersion: number }> | null; executionBinding: Readonly<{ bindingId: string; bindingVersion: number }> | null; asOf: Date | null; observations: readonly CompiledShadowObservation[]; traces: readonly CompiledShadowObservationAssemblyTrace[]; counts: Readonly<{ bindingCount: number; projectedCount: number; omittedCount: number; invalidCount: number }>; diagnostics: readonly string[]; failureStage: "REQUEST" | "IDENTITY" | "EVIDENCE" | "ASSEMBLY" | null }>;
