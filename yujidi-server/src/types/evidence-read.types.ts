import type {
  EvidenceLifecycleDiagnostic,
  EvidenceLifecycleResolution,
  EvidenceReadRecord,
} from "./evidence-lifecycle.types.js";
import type { EvidenceSubjectType } from "./evidence.types.js";

export const DEFAULT_EVIDENCE_HISTORY_LIMIT = 200;
export const MAX_EVIDENCE_HISTORY_LIMIT = 1000;
export const MAX_EVIDENCE_RELATIONSHIP_LIMIT = 2000;

export type EvidenceHistoryQuery = {
  factorKey: string;
  subjectType: EvidenceSubjectType;
  subjectKey: string;
  asOf: Date;
  limit?: number;
};

export type NormalizedEvidenceHistoryQuery = {
  factorKey: string;
  subjectType: EvidenceSubjectType;
  subjectKey: string;
  asOf: Date;
  limit: number;
};

export type EvidenceReadResult = {
  query: NormalizedEvidenceHistoryQuery;
  history: EvidenceReadRecord[];
  activeObservations: EvidenceReadRecord[];
  resolutions: EvidenceLifecycleResolution[];
  diagnostics: EvidenceLifecycleDiagnostic[];
  historyCount: number;
  relationshipCount: number;
  baseTruncated: boolean;
  relationshipTruncated: boolean;
  truncated: boolean;
  complete: boolean;
};

export const EVIDENCE_READ_ERROR_CODES = [
  "INVALID_FACTOR_KEY",
  "INVALID_SUBJECT_KEY",
  "INVALID_SUBJECT_TYPE",
  "INVALID_AS_OF",
  "INVALID_LIMIT",
] as const;

export type EvidenceReadErrorCode =
  (typeof EVIDENCE_READ_ERROR_CODES)[number];

export class EvidenceReadQueryError extends Error {
  public readonly code: EvidenceReadErrorCode;

  public constructor(code: EvidenceReadErrorCode, message: string) {
    super(message);
    this.name = "EvidenceReadQueryError";
    this.code = code;
  }
}
