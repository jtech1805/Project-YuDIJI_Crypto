import type { FactorKey } from "./factor-registry.types.js";
import type { GenericFactorRelationshipType } from "./generic-factor-relationship.types.js";
import type { GenericRelationshipEvaluatorConfiguration } from "./generic-relationship-evaluator.types.js";

export const MAX_EVALUATOR_CONFIGURATION_IDENTIFIER_LENGTH = 120;
export const MAX_EVALUATOR_CONFIGURATION_SUPPORTED_FACTORS = 20;
export const MAX_EVALUATOR_CONFIGURATION_SUPPORTED_RELATIONSHIPS = 6;

export type EvaluatorConfigurationIdentity = Readonly<{
  configurationId: string;
  configurationVersion: number;
}>;

export type GenericRelationshipEvaluatorConfigurationDefinition = Readonly<{
  configurationType: "GENERIC_RELATIONSHIP";
  configurationId: string;
  configurationVersion: number;
  evaluatorId: "GENERIC_RELATIONSHIP_FACTOR_EVALUATOR";
  evaluatorVersion: 1;
  supportedFactorKeys: readonly FactorKey[];
  supportedRelationshipTypes: readonly GenericFactorRelationshipType[];
  compileEligible: boolean;
  configuration: GenericRelationshipEvaluatorConfiguration;
}>;

export type EvaluatorConfigurationDefinition =
  GenericRelationshipEvaluatorConfigurationDefinition;

export const EVALUATOR_CONFIGURATION_REGISTRY_ERROR_CODES = Object.freeze([
  "INVALID_CONFIGURATION_COLLECTION",
  "INVALID_CONFIGURATION_DEFINITION",
  "INVALID_CONFIGURATION_ID",
  "INVALID_CONFIGURATION_VERSION",
  "INVALID_EVALUATOR_ID",
  "INVALID_EVALUATOR_VERSION",
  "INVALID_SUPPORTED_FACTORS",
  "DUPLICATE_SUPPORTED_FACTOR",
  "INVALID_SUPPORTED_RELATIONSHIPS",
  "DUPLICATE_SUPPORTED_RELATIONSHIP",
  "INVALID_COMPILE_ELIGIBILITY",
  "INVALID_CONFIGURATION_CONTENT",
  "CONFIGURATION_NOT_COMPILE_ELIGIBLE",
  "DUPLICATE_CONFIGURATION_VERSION",
] as const);
export type EvaluatorConfigurationRegistryErrorCode =
  (typeof EVALUATOR_CONFIGURATION_REGISTRY_ERROR_CODES)[number];

export class EvaluatorConfigurationRegistryError extends Error {
  public readonly code: EvaluatorConfigurationRegistryErrorCode;
  public readonly configurationId: string | null;
  public readonly configurationVersion: number | null;

  public constructor(params: {
    code: EvaluatorConfigurationRegistryErrorCode;
    configurationId?: string | null;
    configurationVersion?: number | null;
  }) {
    super(`Evaluator configuration registry failed: ${params.code}`);
    this.name = "EvaluatorConfigurationRegistryError";
    this.code = params.code;
    this.configurationId = params.configurationId ?? null;
    this.configurationVersion = params.configurationVersion ?? null;
  }
}

export interface EvaluatorConfigurationRegistry {
  getExact(configurationId: string, configurationVersion: number):
    EvaluatorConfigurationDefinition | null;
  getLatest(configurationId: string): EvaluatorConfigurationDefinition | null;
  listVersions(configurationId: string): readonly EvaluatorConfigurationDefinition[];
}
