import type {
  EvidenceSubjectType,
  EvidenceValueType,
} from "./evidence.types.js";

export const FACTOR_KEYS = ["MARKET.PRICE", "CRYPTO.ETF_NET_FLOW"] as const;
export type FactorKey = (typeof FACTOR_KEYS)[number];

export const FACTOR_STATUSES = [
  "ACTIVE",
  "DEPRECATED",
  "DISABLED",
] as const;
export type FactorStatus = (typeof FACTOR_STATUSES)[number];

export const FACTOR_SCORING_ELIGIBILITIES = [
  "ELIGIBLE",
  "INELIGIBLE",
  "EXPLANATION_ONLY",
] as const;
export type FactorScoringEligibility =
  (typeof FACTOR_SCORING_ELIGIBILITIES)[number];

export const FACTOR_UNIT_POLICIES = [
  "REQUIRED",
  "OPTIONAL",
  "FORBIDDEN",
  "ALLOW_LIST",
] as const;
export type FactorUnitPolicy = (typeof FACTOR_UNIT_POLICIES)[number];

export type FactorUnitDefinition =
  | { policy: "REQUIRED" }
  | { policy: "OPTIONAL" }
  | { policy: "FORBIDDEN" }
  | {
      policy: "ALLOW_LIST";
      allowedUnits: readonly string[];
    };

export type FactorFreshnessPolicy =
  | {
      kind: "MAX_AGE";
      maxAgeMs: number;
    }
  | { kind: "VALIDITY_INTERVAL" }
  | { kind: "NON_EXPIRING" };

export type FactorDefinition = {
  factorKey: FactorKey;
  version: number;
  displayName: string;
  description: string;
  status: FactorStatus;
  valueTypes: readonly EvidenceValueType[];
  subjectTypes: readonly EvidenceSubjectType[];
  unit: FactorUnitDefinition;
  freshness: FactorFreshnessPolicy;
  scoringEligibility: FactorScoringEligibility;
};

export const FACTOR_REGISTRY_VALIDATION_CODES = [
  "UNKNOWN_FACTOR",
  "INACTIVE_FACTOR",
  "VALUE_TYPE_NOT_ALLOWED",
  "SUBJECT_TYPE_NOT_ALLOWED",
  "UNIT_REQUIRED",
  "UNIT_FORBIDDEN",
  "UNIT_NOT_ALLOWED",
] as const;
export type FactorRegistryValidationCode =
  (typeof FACTOR_REGISTRY_VALIDATION_CODES)[number];

export type FactorRegistryValidationResult =
  | {
      valid: true;
      definition: FactorDefinition;
    }
  | {
      valid: false;
      code: FactorRegistryValidationCode;
      factorKey: string;
    };

export const FACTOR_REGISTRY_ERROR_CODES = [
  "EMPTY_REGISTRY",
  "DUPLICATE_FACTOR_KEY",
  "INVALID_DEFINITION",
  "UNKNOWN_FACTOR",
] as const;
export type FactorRegistryErrorCode =
  (typeof FACTOR_REGISTRY_ERROR_CODES)[number];

export class FactorRegistryError extends Error {
  public readonly code: FactorRegistryErrorCode;

  public constructor(code: FactorRegistryErrorCode) {
    super(`Factor registry operation failed: ${code}`);
    this.name = "FactorRegistryError";
    this.code = code;
  }
}

export interface FactorRegistry {
  get(factorKey: string): FactorDefinition | null;
  require(factorKey: string): FactorDefinition;
  list(): readonly FactorDefinition[];
  validateCompatibility(params: {
    factorKey: string;
    valueType: EvidenceValueType;
    subjectType: EvidenceSubjectType;
    unit: string | null;
    allowDeprecated?: boolean;
  }): FactorRegistryValidationResult;
}
