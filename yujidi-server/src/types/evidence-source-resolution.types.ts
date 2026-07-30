import type {
  EvidenceFactorCompatibilityFailureCode,
  EvidenceFreshnessStatus,
} from "./evidence-factor-compatibility.types.js";
import type { FactorKey } from "./factor-registry.types.js";

export const MAX_EVIDENCE_SOURCE_CANDIDATES = 100;

export const EVIDENCE_SOURCE_RESOLUTION_FAILURE_CODES = [
  "INVALID_REQUEST",
  "INVALID_AS_OF",
  "INCOMPLETE_EVIDENCE_HISTORY",
  "TOO_MANY_CANDIDATES",
  "MIXED_FACTOR_KEYS",
  "MIXED_SUBJECTS",
  "UNSUPPORTED_FACTOR",
  "NO_COMPATIBLE_EVIDENCE",
  "UNRESOLVED_CONFLICT",
] as const;
export type EvidenceSourceResolutionFailureCode =
  (typeof EVIDENCE_SOURCE_RESOLUTION_FAILURE_CODES)[number];

export const EVIDENCE_SOURCE_CANDIDATE_DISPOSITIONS = [
  "SELECTED",
  "INCOMPATIBLE",
  "LOWER_SOURCE_PRIORITY",
  "OLDER_OBSERVATION",
  "LOWER_CONFIDENCE",
  "TIE_BREAK_LOST",
] as const;
export type EvidenceSourceCandidateDisposition =
  (typeof EVIDENCE_SOURCE_CANDIDATE_DISPOSITIONS)[number];

export type EvidenceSourceResolutionCompleteness = {
  complete: boolean;
  baseTruncated: boolean;
  relationshipTruncated: boolean;
};

export type EvidenceSourceAuthorityRule = {
  factorKey: FactorKey;
  sourceType: string;
  provider: string;
  priority: number;
};

export interface EvidenceSourceAuthorityRegistry {
  getPriority(params: {
    factorKey: string;
    sourceType: string;
    provider: string;
  }): number | null;
  list(): readonly EvidenceSourceAuthorityRule[];
}

export type EvidenceSourceCandidateTrace = {
  evidenceId: string;
  factorKey: string;
  subjectType: string;
  subjectKey: string;
  sourceType: string;
  provider: string;
  sourceId: string;
  observedAt: Date;
  confidence: number | null;
  compatibility:
    | {
        compatible: true;
        factorDefinitionVersion: number;
        freshnessStatus: EvidenceFreshnessStatus;
      }
    | {
        compatible: false;
        code: EvidenceFactorCompatibilityFailureCode;
      };
  sourcePriority: number | null;
  disposition: EvidenceSourceCandidateDisposition;
};

export type EvidenceSourceResolutionSelectedResult = {
  resolved: true;
  factorKey: FactorKey;
  subject: { type: string; key: string };
  asOf: Date;
  factorDefinitionVersion: number;
  selectedEvidenceId: string;
  selectedSource: {
    sourceType: string;
    provider: string;
    sourceId: string;
    priority: number | null;
  };
  selectedObservedAt: Date;
  selectedConfidence: number | null;
  trace: readonly EvidenceSourceCandidateTrace[];
};

export type EvidenceSourceResolutionNoSelectionResult = {
  resolved: false;
  factorKey: string | null;
  subject: { type: string; key: string } | null;
  asOf: Date | null;
  code: EvidenceSourceResolutionFailureCode;
  trace: readonly EvidenceSourceCandidateTrace[];
};

export type EvidenceSourceResolutionResult =
  | EvidenceSourceResolutionSelectedResult
  | EvidenceSourceResolutionNoSelectionResult;

export type EvidenceSourceResolutionRequest = {
  factorKey: string;
  subject: { type: string; key: string };
  observations: readonly unknown[];
  completeness: EvidenceSourceResolutionCompleteness;
  asOf: Date;
  allowDeprecatedFactor?: boolean;
};
