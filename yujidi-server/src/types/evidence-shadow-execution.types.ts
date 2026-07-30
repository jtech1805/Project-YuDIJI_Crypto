import type { EvidenceAdapterHealthSnapshot } from "./evidence-observability.types.js";
import type {
  EvidenceProviderRunFailureCode,
  EvidenceProviderRunStatus,
} from "./evidence-provider-run.types.js";

export const EVIDENCE_SHADOW_EXECUTION_STATUSES = [
  "RECORDED",
  "OBSERVABILITY_FAILED",
  "EXECUTION_FAILED",
] as const;

export type EvidenceShadowExecutionStatus =
  (typeof EVIDENCE_SHADOW_EXECUTION_STATUSES)[number];

export const EVIDENCE_SHADOW_EXECUTION_FAILURE_CODES = [
  "RUNNER_EXECUTION_FAILED",
  "OBSERVABILITY_RECORDING_FAILED",
  "INVALID_CLOCK",
] as const;

export type EvidenceShadowExecutionFailureCode =
  (typeof EVIDENCE_SHADOW_EXECUTION_FAILURE_CODES)[number];

export class EvidenceShadowExecutionError extends Error {
  public readonly code: "INVALID_CLOCK";

  public constructor() {
    super("Evidence shadow execution clock is invalid");
    this.name = "EvidenceShadowExecutionError";
    this.code = "INVALID_CLOCK";
  }
}

export type EvidenceShadowRunSummary = {
  adapterId: string | null;
  status: EvidenceProviderRunStatus;
  candidateCount: number;
  createdCount: number;
  duplicateCount: number;
  rejectedCount: number;
  failedCount: number;
  failureCode: EvidenceProviderRunFailureCode | null;
};

export type EvidenceShadowExecutionRecordedResult = {
  executionStatus: "RECORDED";
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  run: EvidenceShadowRunSummary;
  health: EvidenceAdapterHealthSnapshot;
};

export type EvidenceShadowExecutionObservabilityFailedResult = {
  executionStatus: "OBSERVABILITY_FAILED";
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  run: EvidenceShadowRunSummary;
  failureCode: "OBSERVABILITY_RECORDING_FAILED";
};

export type EvidenceShadowExecutionFailedResult = {
  executionStatus: "EXECUTION_FAILED";
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  adapterId: string | null;
  failureCode: "RUNNER_EXECUTION_FAILED" | "INVALID_CLOCK";
};

export type EvidenceShadowExecutionResult =
  | EvidenceShadowExecutionRecordedResult
  | EvidenceShadowExecutionObservabilityFailedResult
  | EvidenceShadowExecutionFailedResult;
