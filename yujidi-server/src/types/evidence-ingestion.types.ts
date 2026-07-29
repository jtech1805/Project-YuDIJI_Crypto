import type {
  CreateEvidenceObservationInput,
  CreateEvidenceRevocationInput,
} from "./evidence.types.js";

export type EvidenceObservationCandidate = Omit<
  CreateEvidenceObservationInput,
  "evidenceId" | "deduplicationKey"
>;

export type EvidenceRevocationCandidate = Omit<
  CreateEvidenceRevocationInput,
  "evidenceId" | "deduplicationKey"
>;

export type EvidenceCandidate =
  | EvidenceObservationCandidate
  | EvidenceRevocationCandidate;

export const EVIDENCE_INGESTION_STATUSES = [
  "CREATED",
  "DUPLICATE",
  "REJECTED",
  "FAILED",
] as const;

export type EvidenceIngestionStatus =
  (typeof EVIDENCE_INGESTION_STATUSES)[number];

export type EvidenceCreatedResult = {
  status: "CREATED";
  evidenceId: string;
  deduplicationKey: string;
};

export type EvidenceDuplicateResult = {
  status: "DUPLICATE";
  evidenceId: string;
  deduplicationKey: string;
};

export type EvidenceRejectedResult = {
  status: "REJECTED";
  code: "INVALID_CANDIDATE";
};

export type EvidenceFailedResult = {
  status: "FAILED";
  code: "PERSISTENCE_FAILED" | "ADAPTER_FAILED";
  deduplicationKey?: string;
};

export type EvidenceIngestionResult =
  | EvidenceCreatedResult
  | EvidenceDuplicateResult
  | EvidenceRejectedResult
  | EvidenceFailedResult;
