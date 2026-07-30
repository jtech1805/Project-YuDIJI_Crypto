import type { FactorKey } from "./factor-registry.types.js";

export type DeterministicFactorEvaluatorIdentity = {
  evaluatorId: string;
  evaluatorVersion: number;
  configurationVersion: number;
};

export const FACTOR_EVALUATION_OUTCOMES = [
  "PASS",
  "FAIL",
  "NEUTRAL",
  "UNAVAILABLE",
] as const;
export type FactorEvaluationOutcome =
  (typeof FACTOR_EVALUATION_OUTCOMES)[number];

export type FactorEvaluationContribution = {
  points: number;
  minimumPoints: number;
  maximumPoints: number;
};

export type FactorEvaluationReasonCode = string;

export type FactorEvaluationDiagnosticValue =
  | string
  | number
  | boolean
  | null;
export type FactorEvaluationDiagnostics = Readonly<Record<
  string,
  FactorEvaluationDiagnosticValue
>>;

export type FactorEvaluationEvidenceReference = {
  evidenceId: string;
  factorDefinitionVersion: number;
  source: {
    sourceType: string;
    provider: string;
    sourceId: string;
  };
  observedAt: Date;
  evaluatedAt: Date;
};

export type FactorEvaluationResult = {
  evaluator: DeterministicFactorEvaluatorIdentity;
  factorKey: FactorKey;
  subject: {
    type: string;
    key: string;
  };
  outcome: FactorEvaluationOutcome;
  contribution: FactorEvaluationContribution;
  reasonCode: FactorEvaluationReasonCode;
  evidence: FactorEvaluationEvidenceReference;
  diagnostics: FactorEvaluationDiagnostics;
};

export const FACTOR_EVALUATOR_FAILURE_CODES = [
  "INVALID_INPUT",
  "UNSUPPORTED_FACTOR",
  "UNSUPPORTED_VALUE_TYPE",
  "INVALID_CONFIGURATION",
  "EVALUATION_FAILED",
  "INVALID_RESULT",
] as const;
export type FactorEvaluatorFailureCode =
  (typeof FACTOR_EVALUATOR_FAILURE_CODES)[number];

export type FactorEvaluatorExecutionResult =
  | {
      evaluated: true;
      result: FactorEvaluationResult;
    }
  | {
      evaluated: false;
      evaluatorId: string | null;
      factorKey: string | null;
      code: FactorEvaluatorFailureCode;
    };

export type DeterministicFactorEvaluatorConfiguration<
  TParameters = Readonly<Record<string, unknown>>,
> = {
  configurationVersion: number;
  parameters: TParameters;
};

export type FactorEvaluatorValidationFailureCode =
  | "INVALID_EVALUATOR_ID"
  | "INVALID_EVALUATOR_VERSION"
  | "INVALID_CONFIGURATION_VERSION"
  | "EMPTY_SUPPORTED_FACTORS"
  | "DUPLICATE_SUPPORTED_FACTOR"
  | "INVALID_SUPPORTED_FACTOR"
  | "INVALID_EVALUATE_FUNCTION";

export type FactorEvaluatorValidationResult =
  | {
      valid: true;
      evaluatorId: string;
    }
  | {
      valid: false;
      code: FactorEvaluatorValidationFailureCode;
    };

export type FactorEvaluatorResultValidationResult =
  | {
      valid: true;
      result: FactorEvaluationResult;
    }
  | {
      valid: true;
      execution: Extract<FactorEvaluatorExecutionResult, { evaluated: false }>;
    }
  | {
      valid: false;
      code: FactorEvaluatorFailureCode;
    };
