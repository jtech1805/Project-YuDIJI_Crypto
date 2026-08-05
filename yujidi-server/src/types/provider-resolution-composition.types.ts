import type { EvidenceProviderAdapter } from "../ports/evidence-provider-adapter.port.js";
import type { EvidenceProviderRunnerService } from "../services/evidence-provider-runner.service.js";
import type { EvidenceIngestionStatus } from "./evidence-ingestion.types.js";
import type { EvidenceProviderRunStatus } from "./evidence-provider-run.types.js";
import type { InsertEvidenceProviderResolutionAttestationResult } from "./evidence-provider-resolution-attestation.types.js";
import type { ProviderKey, ProviderType } from "./provider-definition.types.js";
import type { ProviderResolutionExecutionResult, ProviderResolutionSelectedResult } from "./provider-resolution-execution.types.js";
import type { ProviderResolutionStatus, ProviderResolutionWarningCode } from "./provider-resolution-policy.types.js";
import type { VersionedProviderBindingDefinition } from "./versioned-provider-binding.types.js";

export type ProviderRunnerPort = Pick<EvidenceProviderRunnerService, "run">;
export type ProviderRunnerRegistration = { providerKey: ProviderKey; runnerId: string; evidenceProvenanceProvider: string; runner: ProviderRunnerPort };
export interface ProviderResolutionRunnerRegistryPort { get(providerKey: ProviderKey): ProviderRunnerRegistration | null }
export type ExistingProviderRunnerInput = { adapter: EvidenceProviderAdapter };

export const PROVIDER_RESOLUTION_COMPOSITION_STAGES = Object.freeze(["RESOLUTION_INPUT", "RUNNER_LOOKUP", "PROVIDER_EXECUTION", "EVIDENCE_INGESTION", "EVIDENCE_ATTESTATION"] as const);
export type ProviderResolutionCompositionStage = (typeof PROVIDER_RESOLUTION_COMPOSITION_STAGES)[number];
export const PROVIDER_RESOLUTION_COMPOSITION_STAGE_STATES = Object.freeze(["COMPLETED", "FAILED", "SKIPPED"] as const);
export type ProviderResolutionCompositionStageState = (typeof PROVIDER_RESOLUTION_COMPOSITION_STAGE_STATES)[number];
export type ProviderResolutionCompositionStageReport = { stage: ProviderResolutionCompositionStage; state: ProviderResolutionCompositionStageState; code: string | null };

export const PROVIDER_RESOLUTION_COMPOSITION_FAILURE_CODES = Object.freeze(["INVALID_REQUEST", "INVALID_RESOLUTION_BOUNDARY", "INVALID_PROVIDER_BINDING", "PROVIDER_BINDING_MISMATCH", "INVALID_RESOLVED_AT", "INVALID_ATTESTATION_BOUNDARY", "INVALID_RUNNER_REGISTRY_BOUNDARY", "INVALID_EXECUTION_INPUT", "FACTOR_MISMATCH", "SELECTED_PROVIDER_MISMATCH", "RUNNER_NOT_REGISTERED", "RUNNER_IDENTITY_MISMATCH", "RUNNER_EXECUTION_FAILED", "RUNNER_EXECUTION_THROWN", "RUNNER_RESULT_INVALID", "EVIDENCE_INGESTION_FAILED", "EVIDENCE_INGESTION_THROWN", "COMPOSITION_RESULT_INVALID"] as const);
export type ProviderResolutionCompositionFailureCode = (typeof PROVIDER_RESOLUTION_COMPOSITION_FAILURE_CODES)[number];

export type SafeEvidenceCandidateOutcome = { index: number; status: EvidenceIngestionStatus; evidenceId: string | null };
export type SafeEvidenceIngestionProjection = { createdCount: number; duplicateCount: number; rejectedCount: number; failedCount: number; evidenceIds: readonly string[]; results: readonly SafeEvidenceCandidateOutcome[] };
export type ProviderResolutionAttestationIdentity = Readonly<{ attestationId: string; attestationVersion: number }>;
export interface ProviderResolutionAttestationIdentityFactoryPort { create(input: Readonly<{ evidenceId: string; candidateIndex: number }>): ProviderResolutionAttestationIdentity }
export interface ProviderResolutionEvidenceLookupPort { findByEvidenceId(evidenceId: string): Promise<{ evidenceId?: unknown; provenance?: { provider?: unknown } } | null> }
export interface ProviderResolutionAttestationInsertPort { insert(candidate: unknown): Promise<InsertEvidenceProviderResolutionAttestationResult> }
export type SafeEvidenceAttestationOutcome = Readonly<{ index: number; evidenceId: string | null; attestationId: string | null; status: "INSERTED" | "ALREADY_EXISTS" | "SKIPPED" | "FAILED"; code: "INSERTED" | "ALREADY_EXISTS" | "INGESTION_NOT_PERSISTED" | "EVIDENCE_NOT_FOUND" | "EVIDENCE_LOOKUP_FAILED" | "PROVENANCE_MISMATCH" | "IDENTITY_CREATION_FAILED" | "ATTESTATION_INSERT_FAILED" | "ATTESTATION_CONFLICT" }>;
export type SafeEvidenceAttestationProjection = Readonly<{ attemptedCount: number; insertedCount: number; alreadyExistsCount: number; failedCount: number; results: readonly SafeEvidenceAttestationOutcome[] }>;
export type ProviderResolutionCompositionRequest = { resolution: ProviderResolutionExecutionResult; providerBinding: VersionedProviderBindingDefinition; resolvedAt: Date; runnerRegistry: ProviderResolutionRunnerRegistryPort; executionInput: ExistingProviderRunnerInput; evidenceRepository: ProviderResolutionEvidenceLookupPort; attestationService: ProviderResolutionAttestationInsertPort; attestationIdentityFactory: ProviderResolutionAttestationIdentityFactoryPort };
type Lineage = { factorKey: ProviderResolutionSelectedResult["factorKey"]; requestedProviderKey: ProviderKey; providerBinding: Readonly<{ providerBindingId: string; providerBindingVersion: number }>; resolutionPolicy: Readonly<{ policyId: string; policyVersion: number }>; confidenceAdjustment: number; warningCodes: readonly ProviderResolutionWarningCode[]; resolvedAt: Date };
export type ProviderResolutionCompositionSuccess = Lineage & { composed: true; status: "COMPLETED" | "PARTIAL" | "FAILED"; resolved: true; selectedProviderKey: ProviderKey; selectedProviderType: ProviderType; resolutionStatus: "RESOLVED" | "DEGRADED_PRIMARY_USED" | "FALLBACK_USED" | "PROXY_USED"; runnerId: string; evidenceProvenanceProvider: string; providerExecutionStatus: Extract<EvidenceProviderRunStatus, "COMPLETED" | "PARTIAL">; candidateCount: number; evidenceOutcome: SafeEvidenceIngestionProjection; attestationOutcome: SafeEvidenceAttestationProjection; stages: readonly ProviderResolutionCompositionStageReport[] };
export type ProviderResolutionCompositionNoProvider = Lineage & { composed: true; status: "FAILED"; resolved: false; selectedProviderKey: null; resolutionStatus: "MANUAL_REQUIRED" | "UNRESOLVED"; runnerId: null; providerExecutionStatus: "SKIPPED"; candidateCount: 0; evidenceOutcome: null; attestationOutcome: null; stages: readonly ProviderResolutionCompositionStageReport[] };
export type ProviderResolutionCompositionFailure = { composed: false; status: "FAILED"; code: ProviderResolutionCompositionFailureCode; factorKey: string | null; selectedProviderKey: string | null; resolutionStatus: ProviderResolutionStatus | null; stages: readonly ProviderResolutionCompositionStageReport[] };
export type ProviderResolutionCompositionResult = ProviderResolutionCompositionSuccess | ProviderResolutionCompositionNoProvider | ProviderResolutionCompositionFailure;

export const PROVIDER_RESOLUTION_RUNNER_REGISTRY_FAILURE_CODES = Object.freeze(["INVALID_REGISTRATIONS", "INVALID_REGISTRATION", "DUPLICATE_PROVIDER_KEY", "DUPLICATE_RUNNER_ID"] as const);
export type ProviderResolutionRunnerRegistryFailureCode = (typeof PROVIDER_RESOLUTION_RUNNER_REGISTRY_FAILURE_CODES)[number];
export class ProviderResolutionRunnerRegistryError extends Error {
  public readonly code: ProviderResolutionRunnerRegistryFailureCode;
  public constructor(code: ProviderResolutionRunnerRegistryFailureCode) { super(code); this.name = "ProviderResolutionRunnerRegistryError"; this.code = code; }
}
