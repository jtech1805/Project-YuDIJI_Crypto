import type { EvidenceSourceResolutionFailureCode } from "./evidence-source-resolution.types.js";
import type { FactorKey } from "./factor-registry.types.js";

export const FACTOR_INPUT_ASSEMBLY_FAILURE_CODES = [
  "INVALID_REQUEST",
  "INVALID_AS_OF",
  "UNSUPPORTED_FACTOR",
  "EVIDENCE_READ_FAILED",
  "INCOMPLETE_EVIDENCE_HISTORY",
  "NO_COMPATIBLE_EVIDENCE",
  "SOURCE_RESOLUTION_FAILED",
  "SELECTED_EVIDENCE_NOT_FOUND",
  "INVALID_SELECTED_EVIDENCE",
  "UNSUPPORTED_VALUE_TYPE",
] as const;

export type FactorInputAssemblyFailureCode =
  (typeof FACTOR_INPUT_ASSEMBLY_FAILURE_CODES)[number];

export type FactorInputAssemblyRequest = {
  factorKey: string;
  subject: {
    type: string;
    key: string;
  };
  asOf: Date;
  allowDeprecatedFactor?: boolean;
};

export type FactorInputValue = {
  type: "NUMBER";
  value: number;
  unit: string;
};

export type AssembledFactorInput = {
  factorKey: FactorKey;
  factorDefinitionVersion: number;
  subject: {
    type: string;
    key: string;
  };
  evidenceId: string;
  value: FactorInputValue;
  source: {
    sourceType: string;
    provider: string;
    sourceId: string;
    priority: number | null;
  };
  observedAt: Date;
  evaluatedAt: Date;
  confidence: number | null;
  freshness:
    | {
        status: "FRESH";
        ageMs: number;
        maxAgeMs: number;
      }
    | {
        status: "NOT_APPLICABLE";
        policy: "VALIDITY_INTERVAL" | "NON_EXPIRING";
      };
};

export type FactorInputAssemblySuccessResult = {
  assembled: true;
  input: AssembledFactorInput;
  resolution: {
    selectedEvidenceId: string;
    candidateCount: number;
    compatibleCandidateCount: number;
    incompatibleCandidateCount: number;
  };
};

export type FactorInputAssemblyFailureResult = {
  assembled: false;
  factorKey: string | null;
  subject: {
    type: string;
    key: string;
  } | null;
  evaluatedAt: Date | null;
  code: FactorInputAssemblyFailureCode;
  sourceResolutionCode?: EvidenceSourceResolutionFailureCode;
};

export type FactorInputAssemblyResult =
  | FactorInputAssemblySuccessResult
  | FactorInputAssemblyFailureResult;
