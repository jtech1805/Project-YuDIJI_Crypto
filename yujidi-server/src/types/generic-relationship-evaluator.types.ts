import type { GenericFactorRelationshipType } from "./generic-factor-relationship.types.js";

export type GenericRelationshipThresholds = Readonly<{
  strongNegativeMax: number;
  negativeMax: number;
  positiveMin: number;
  strongPositiveMin: number;
}>;

export type GenericRelationshipContributions = Readonly<{
  strongNegative: number;
  negative: number;
  neutral: number;
  positive: number;
  strongPositive: number;
}>;

export type GenericRelationshipEvaluatorConfiguration = Readonly<{
  relationshipType: GenericFactorRelationshipType;
  expectedUnit: string;
  thresholds: GenericRelationshipThresholds;
  contributions: GenericRelationshipContributions;
  minimumPoints: number;
  maximumPoints: number;
}>;

export const GENERIC_RELATIONSHIP_CONFIGURATION_FAILURE_CODES = [
  "UNSUPPORTED_RELATIONSHIP",
  "UNSUPPORTED_FACTOR",
  "INVALID_UNIT",
  "NON_FINITE_THRESHOLD",
  "UNORDERED_THRESHOLDS",
  "NON_FINITE_CONTRIBUTION",
  "INVALID_CONTRIBUTION_BOUNDS",
  "CONDITION_BINDING_REQUIRED",
] as const;
export type GenericRelationshipConfigurationFailureCode =
  (typeof GENERIC_RELATIONSHIP_CONFIGURATION_FAILURE_CODES)[number];

export type GenericRelationshipConfigurationValidationResult =
  | { valid: true }
  | { valid: false; code: GenericRelationshipConfigurationFailureCode };

export type GenericRelationshipDeferredFixtureResult = Readonly<{
  executionStatus: "DEFERRED";
  relationshipType: "CONDITIONAL" | "CONFIRMATION_ONLY" | "RISK_ONLY" | "VETO";
  directionalPoints: null;
  reasonCode:
    | "CONDITION_BINDING_REQUIRED"
    | "DEFERRED_TO_CROSS_FACTOR"
    | "DEFERRED_TO_RISK_AXIS"
    | "DEFERRED_TO_VETO_CHANNEL";
}>;

export type GenericConditionalBindingValidationResult =
  | { valid: true; condition: boolean; executionStatus: "DEFERRED"; reasonCode: "CONDITIONAL_EXECUTION_DEFERRED" }
  | { valid: false; condition: null; executionStatus: "DEFERRED"; reasonCode: "CONDITION_BINDING_REQUIRED" };
