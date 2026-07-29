import type { EvidenceIngestionResult } from "./evidence-ingestion.types.js";

export const MAX_EVIDENCE_PROVIDER_BATCH_SIZE = 500;

export const EVIDENCE_PROVIDER_RUN_STATUSES = [
  "COMPLETED",
  "PARTIAL",
  "FAILED",
] as const;

export type EvidenceProviderRunStatus =
  (typeof EVIDENCE_PROVIDER_RUN_STATUSES)[number];

export const EVIDENCE_PROVIDER_RUN_FAILURE_CODES = [
  "INVALID_PROVIDER_KEY",
  "ADAPTER_EXECUTION_FAILED",
  "INVALID_ADAPTER_RESULT",
  "BATCH_SIZE_EXCEEDED",
] as const;

export type EvidenceProviderRunFailureCode =
  (typeof EVIDENCE_PROVIDER_RUN_FAILURE_CODES)[number];

export type EvidenceProviderCandidateRunResult = {
  index: number;
  result: EvidenceIngestionResult;
};

export type EvidenceProviderRunCompletedResult = {
  providerKey: string;
  status: "COMPLETED" | "PARTIAL";
  candidateCount: number;
  createdCount: number;
  duplicateCount: number;
  rejectedCount: number;
  failedCount: number;
  results: EvidenceProviderCandidateRunResult[];
};

export type EvidenceProviderRunFailedResult = {
  providerKey: string | null;
  status: "FAILED";
  failureCode: EvidenceProviderRunFailureCode;
  candidateCount: 0;
  createdCount: 0;
  duplicateCount: 0;
  rejectedCount: 0;
  failedCount: 0;
  results: [];
};

export type EvidenceProviderRunResult =
  | EvidenceProviderRunCompletedResult
  | EvidenceProviderRunFailedResult;
