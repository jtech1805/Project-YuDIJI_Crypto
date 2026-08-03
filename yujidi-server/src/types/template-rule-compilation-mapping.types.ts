import type {
  CompiledEvaluatorBinding,
  CompiledExecutionPolicyLineage,
  CompiledFactorDefinitionLineage,
  CompiledProviderLineage,
  CompiledSubjectBinding,
  CompiledOptionalFactorBehavior,
  FactorRequirementLevel,
} from "./compiled-rulebook.types.js";
import type { GenericFactorRelationshipType } from "./generic-factor-relationship.types.js";
import type { MissingDataPolicy } from "./scoring.types.js";
import type { EvaluatorConfigurationRegistry } from "./evaluator-configuration-registry.types.js";
import type { VersionedProviderBindingRegistry } from "./versioned-provider-binding.types.js";
import type { VersionedFactorDefinitionRegistry } from "./versioned-factor-definition.types.js";
import type { VersionedEvaluatorDeclarationRegistry } from "./versioned-evaluator-declaration.types.js";
import type { VersionedProviderResolutionPolicyRegistry } from "./versioned-provider-resolution-policy.types.js";
import type { VersionedAggregationPolicyRegistry } from "./versioned-aggregation-policy.types.js";
import type { VersionedNormalizationPolicyRegistry } from "./versioned-normalization-policy.types.js";
import type { VersionedDecisionBandPolicyRegistry } from "./versioned-decision-band-policy.types.js";

export type TemplateRuleSourceCoordinate = Readonly<{
  sectionIndex: number;
  sectionKey: string;
  evaluatorIndex: number;
  evaluatorKey: string;
}>;

export type TemplateRuleMissingDataSource = Readonly<{
  sectionPolicy: MissingDataPolicy;
  evaluatorOverride: MissingDataPolicy | null;
  legacyEffectivePolicy: MissingDataPolicy;
}>;

export type TemplateRuleMissingDataMapping = Readonly<{
  sourcePolicy: MissingDataPolicy;
  requirementLevel: FactorRequirementLevel;
  optionalBehavior: CompiledOptionalFactorBehavior | null;
}>;

export type TemplateRuleCompilationMapping = Readonly<{
  identity: Readonly<{ mappingId: string; mappingVersion: number }>;
  source: Readonly<{ evaluatorKey: string }>;
  factor: CompiledFactorDefinitionLineage;
  subjectBinding: CompiledSubjectBinding;
  evaluator: CompiledEvaluatorBinding;
  relationshipType: GenericFactorRelationshipType;
  missingDataMappings: readonly TemplateRuleMissingDataMapping[];
  weightPolicy: Readonly<{ type: "USE_EFFECTIVE_TEMPLATE_WEIGHT" }>;
  provider: CompiledProviderLineage;
  executionPolicies: CompiledExecutionPolicyLineage;
  compileEligible: boolean;
}>;

export type TemplateRuleMappingLookupResult =
  | Readonly<{ status: "NOT_FOUND" }>
  | Readonly<{ status: "UNIQUE"; mapping: TemplateRuleCompilationMapping }>
  | Readonly<{ status: "AMBIGUOUS"; mappings: readonly TemplateRuleCompilationMapping[] }>;

export interface TemplateRuleCompilationMappingRegistry {
  getExact(mappingId: string, mappingVersion: number): TemplateRuleCompilationMapping | null;
  getLatest(mappingId: string): TemplateRuleCompilationMapping | null;
  listVersions(mappingId: string): readonly TemplateRuleCompilationMapping[];
  findBySourceEvaluatorKey(evaluatorKey: string): TemplateRuleMappingLookupResult;
}

export type TemplateRuleCompilationMappingRegistryDependencies = Readonly<{
  factorDefinitions: Pick<VersionedFactorDefinitionRegistry, "getExact">;
  evaluatorDeclarations: Pick<VersionedEvaluatorDeclarationRegistry, "getExact">;
  evaluatorConfigurations: Pick<EvaluatorConfigurationRegistry, "getExact">;
  providerBindings: Pick<VersionedProviderBindingRegistry, "getExact">;
  resolutionPolicies: Pick<VersionedProviderResolutionPolicyRegistry, "getExact">;
  aggregationPolicies: Pick<VersionedAggregationPolicyRegistry, "getExact">;
  normalizationPolicies: Pick<VersionedNormalizationPolicyRegistry, "getExact">;
  decisionBandPolicies: Pick<VersionedDecisionBandPolicyRegistry, "getExact">;
}>;

export const TEMPLATE_RULE_COMPILATION_MAPPING_ERROR_CODES = Object.freeze([
  "INVALID_MAPPING_COLLECTION", "INVALID_MAPPING_ID", "INVALID_MAPPING_VERSION",
  "INVALID_SOURCE_EVALUATOR_KEY", "INVALID_FACTOR_REFERENCE", "INVALID_SUBJECT_BINDING",
  "INVALID_EVALUATOR_REFERENCE", "INVALID_CONFIGURATION_REFERENCE", "INVALID_RELATIONSHIP",
  "INVALID_MISSING_DATA_MAPPING", "DUPLICATE_MISSING_DATA_POLICY",
  "ZERO_MISSING_DATA_POLICY_UNSUPPORTED", "INVALID_WEIGHT_POLICY",
  "INVALID_PROVIDER_BINDING_REFERENCE", "INVALID_RESOLUTION_POLICY_REFERENCE",
  "INVALID_AGGREGATION_POLICY_REFERENCE", "INVALID_NORMALIZATION_POLICY_REFERENCE",
  "INVALID_DECISION_BAND_POLICY_REFERENCE", "INVALID_COMPILE_ELIGIBILITY",
  "FACTOR_NOT_FOUND", "EVALUATOR_DECLARATION_NOT_FOUND", "EVALUATOR_FACTOR_INCOMPATIBLE",
  "EVALUATOR_RELATIONSHIP_INCOMPATIBLE", "CONFIGURATION_NOT_FOUND",
  "CONFIGURATION_EVALUATOR_INCOMPATIBLE", "CONFIGURATION_FACTOR_INCOMPATIBLE",
  "CONFIGURATION_RELATIONSHIP_INCOMPATIBLE", "PROVIDER_BINDING_NOT_FOUND",
  "PROVIDER_BINDING_FACTOR_INCOMPATIBLE", "RESOLUTION_POLICY_NOT_FOUND",
  "AGGREGATION_POLICY_NOT_FOUND", "NORMALIZATION_POLICY_NOT_FOUND",
  "DECISION_BAND_POLICY_NOT_FOUND", "REFERENCE_NOT_COMPILE_ELIGIBLE",
  "DEFERRED_RELATIONSHIP_NOT_COMPILE_ELIGIBLE", "DUPLICATE_MAPPING_VERSION",
  "SEMANTIC_MAPPING_CONFLICT",
] as const);
export type TemplateRuleCompilationMappingErrorCode =
  (typeof TEMPLATE_RULE_COMPILATION_MAPPING_ERROR_CODES)[number];

export class TemplateRuleCompilationMappingRegistryError extends Error {
  public constructor(public readonly code: TemplateRuleCompilationMappingErrorCode) {
    super(`Template-rule compilation mapping authority failed: ${code}`);
    this.name = "TemplateRuleCompilationMappingRegistryError";
  }
}
