import type {
  EvidenceProviderRunFailureCode,
  EvidenceProviderRunStatus,
} from "./evidence-provider-run.types.js";

export const EVIDENCE_ADAPTER_HEALTH_STATES = [
  "UNKNOWN",
  "HEALTHY",
  "DEGRADED",
  "UNHEALTHY",
] as const;

export type EvidenceAdapterHealthState =
  (typeof EVIDENCE_ADAPTER_HEALTH_STATES)[number];

export type EvidenceProviderRunSummary = {
  adapterId: string;
  status: EvidenceProviderRunStatus;
  candidateCount: number;
  createdCount: number;
  duplicateCount: number;
  rejectedCount: number;
  failedCount: number;
  failureCode?: EvidenceProviderRunFailureCode;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
};

export type EvidenceAdapterHealthSnapshot = {
  adapterId: string;
  health: EvidenceAdapterHealthState;
  totalRuns: number;
  completedRuns: number;
  partialRuns: number;
  failedRuns: number;
  totalCandidates: number;
  createdCandidates: number;
  duplicateCandidates: number;
  rejectedCandidates: number;
  failedCandidates: number;
  consecutiveFailedRuns: number;
  lastRunAt: Date | null;
  lastSuccessAt: Date | null;
  lastStatus: EvidenceProviderRunStatus | null;
  lastFailureCode: EvidenceProviderRunFailureCode | null;
  lastDurationMs: number | null;
};

export type EvidencePipelineHealthSnapshot = {
  generatedAt: Date;
  adapters: EvidenceAdapterHealthSnapshot[];
};

export const MAX_TRACKED_EVIDENCE_ADAPTERS = 100;

export const EVIDENCE_OBSERVABILITY_ERROR_CODES = [
  "INVALID_ADAPTER_ID",
  "INVALID_TIME_RANGE",
  "INVALID_RUN_RESULT",
  "ADAPTER_LIMIT_EXCEEDED",
] as const;

export type EvidenceObservabilityErrorCode =
  (typeof EVIDENCE_OBSERVABILITY_ERROR_CODES)[number];

export class EvidenceObservabilityError extends Error {
  public readonly code: EvidenceObservabilityErrorCode;

  public constructor(code: EvidenceObservabilityErrorCode) {
    super(`Evidence observability operation failed: ${code}`);
    this.name = "EvidenceObservabilityError";
    this.code = code;
  }
}
