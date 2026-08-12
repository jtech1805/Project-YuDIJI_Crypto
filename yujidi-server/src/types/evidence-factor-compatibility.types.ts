import type {
  FactorKey,
  FactorRegistryValidationCode,
  FactorScoringEligibility,
} from "./factor-registry.types.js";

export const EVIDENCE_FACTOR_COMPATIBILITY_FAILURE_CODES = [
  "INVALID_EVIDENCE",
  "REVOCATION_NOT_SUPPORTED",
  "INVALID_AS_OF",
  "UNKNOWN_FACTOR",
  "INACTIVE_FACTOR",
  "VALUE_TYPE_NOT_ALLOWED",
  "SUBJECT_TYPE_NOT_ALLOWED",
  "UNIT_REQUIRED",
  "UNIT_FORBIDDEN",
  "UNIT_NOT_ALLOWED",
  "NOT_YET_VALID",
  "EXPIRED",
  "OBSERVED_IN_FUTURE",
  "STALE_EVIDENCE",
  "INVALID_FRESHNESS_POLICY",
] as const;

type BoundaryFailureCode =
  | "INVALID_EVIDENCE"
  | "REVOCATION_NOT_SUPPORTED"
  | "INVALID_AS_OF"
  | "NOT_YET_VALID"
  | "EXPIRED"
  | "OBSERVED_IN_FUTURE"
  | "STALE_EVIDENCE"
  | "INVALID_FRESHNESS_POLICY";

export type EvidenceFactorCompatibilityFailureCode =
  | FactorRegistryValidationCode
  | BoundaryFailureCode;

export const EVIDENCE_FRESHNESS_STATUSES = [
  "FRESH",
  "STALE",
  "NOT_APPLICABLE",
] as const;
export type EvidenceFreshnessStatus =
  (typeof EVIDENCE_FRESHNESS_STATUSES)[number];

export type EvidenceFreshnessResult =
  | {
      status: "FRESH";
      ageMs: number;
      maxAgeMs: number;
    }
  | {
      status: "STALE";
      ageMs: number;
      maxAgeMs: number;
    }
  | {
      status: "NOT_APPLICABLE";
      policy: "VALIDITY_INTERVAL" | "NON_EXPIRING";
    };

export type EvidenceFactorCompatibleResult = {
  compatible: true;
  evidenceId: string;
  factorKey: FactorKey;
  factorDefinitionVersion: number;
  scoringEligibility: FactorScoringEligibility;
  evaluatedAt: Date;
  freshness: EvidenceFreshnessResult;
};

export type EvidenceFactorIncompatibleResult = {
  compatible: false;
  evidenceId: string | null;
  factorKey: string | null;
  code: EvidenceFactorCompatibilityFailureCode;
  factorDefinitionVersion: number | null;
  evaluatedAt: Date | null;
  freshness?: {
    status: "STALE";
    ageMs: number;
    maxAgeMs: number;
  };
};

export type EvidenceFactorCompatibilityResult =
  | EvidenceFactorCompatibleResult
  | EvidenceFactorIncompatibleResult;
