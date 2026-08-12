import type { FactorEvaluatorExecutionResult } from "./factor-evaluator.types.js";
import type { GenericFactorRelationshipType } from "./generic-factor-relationship.types.js";
import type { ScoringRuleEvaluationResult } from "./scoring.types.js";

export const GENERIC_FACTOR_EVALUATOR_PREFIX = "GENERIC_FACTOR:";

export const GENERIC_FACTOR_LEGACY_FAILURE_CODES = [
  "FEATURE_DISABLED", "INVALID_EVALUATOR_KEY", "UNKNOWN_FACTOR",
  "FACTOR_NOT_SCORING_ELIGIBLE", "MISSING_EVIDENCE", "UNSUPPORTED_RELATIONSHIP",
  "INVALID_EXECUTION_RESULT",
] as const;
export type GenericFactorLegacyFailureCode =
  (typeof GENERIC_FACTOR_LEGACY_FAILURE_CODES)[number];

export type GenericFactorLegacyTranslationResult =
  | { translated: true; result: ScoringRuleEvaluationResult }
  | { translated: false; evaluatorKey: string | null; code: GenericFactorLegacyFailureCode };

export type GenericFactorCompatibilityDispatchRequest = Readonly<{
  evaluatorKey: string;
  relationshipType: GenericFactorRelationshipType;
  execution: FactorEvaluatorExecutionResult;
}>;
