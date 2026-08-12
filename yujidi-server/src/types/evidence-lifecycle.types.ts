import type {
  CreateEvidenceInput,
  CreateEvidenceObservationInput,
} from "./evidence.types.js";

export const EVIDENCE_LIFECYCLE_STATES = [
  "ACTIVE",
  "NOT_YET_VALID",
  "EXPIRED",
  "SUPERSEDED",
  "REVOKED",
] as const;

export type EvidenceLifecycleState =
  (typeof EVIDENCE_LIFECYCLE_STATES)[number];

export const EVIDENCE_LIFECYCLE_DIAGNOSTIC_CODES = [
  "MISSING_SUPERSEDES_TARGET",
  "MISSING_REVOCATION_TARGET",
  "SELF_SUPERSESSION",
  "SELF_REVOCATION",
  "SUPERSESSION_CYCLE",
  "DUPLICATE_EVIDENCE_ID",
] as const;

export type EvidenceLifecycleDiagnosticCode =
  (typeof EVIDENCE_LIFECYCLE_DIAGNOSTIC_CODES)[number];

export type EvidenceLifecycleDiagnostic = {
  code: EvidenceLifecycleDiagnosticCode;
  evidenceId: string;
  relatedEvidenceId?: string;
};

export type EvidenceLifecycleResolution = {
  evidenceId: string;
  state: EvidenceLifecycleState;
  revokedByEvidenceId?: string;
  supersededByEvidenceId?: string;
  diagnostics: EvidenceLifecycleDiagnostic[];
};

export type EvidenceLifecycleBatchResolution = {
  resolutions: EvidenceLifecycleResolution[];
  activeObservations: CreateEvidenceObservationInput[];
  diagnostics: EvidenceLifecycleDiagnostic[];
};

export type EvidenceReadRecord = CreateEvidenceInput & Readonly<{ createdAt: Date }>;
export type EvidenceLifecycleInputRecord = CreateEvidenceInput;
