import type { CompiledEvaluatorBinding, CompiledExecutionPolicyLineage, CompiledFactorDefinitionLineage, CompiledProviderLineage, CompiledSubjectBinding, FactorRequirementLevel } from "./compiled-rulebook.types.js";
import type { EvaluatorConfigurationRegistry } from "./evaluator-configuration-registry.types.js";
import type { GenericFactorRelationshipType } from "./generic-factor-relationship.types.js";
import type { MissingDataPolicy, ScoringTemplateStatus, ScoringTemplateVisibility } from "./scoring.types.js";
import type { TemplateCompilationSnapshotInput } from "./canonical-template-snapshot.types.js";
import type { CompiledOptionalFactorBehavior, TemplateRuleCompilationMappingRegistry, TemplateRuleSourceCoordinate } from "./template-rule-compilation-mapping.types.js";
import type { VersionedAggregationPolicyRegistry } from "./versioned-aggregation-policy.types.js";
import type { VersionedDecisionBandPolicyRegistry } from "./versioned-decision-band-policy.types.js";
import type { VersionedEvaluatorDeclarationRegistry } from "./versioned-evaluator-declaration.types.js";
import type { VersionedFactorDefinitionRegistry } from "./versioned-factor-definition.types.js";
import type { VersionedNormalizationPolicyRegistry } from "./versioned-normalization-policy.types.js";
import type { VersionedProviderResolutionPolicyRegistry } from "./versioned-provider-resolution-policy.types.js";
import type { VersionedProviderBindingRegistry } from "./versioned-provider-binding.types.js";

export type ResolvedTemplateRuleBinding = Readonly<{
  sourceRule: TemplateRuleSourceCoordinate;
  source: Readonly<{
    sectionWeight: number;
    evaluatorWeight: number;
    effectiveWeight: number;
    sectionMissingDataPolicy: MissingDataPolicy;
    evaluatorMissingDataPolicy: MissingDataPolicy | null;
    legacyEffectiveMissingDataPolicy: MissingDataPolicy;
    sourceConfiguration: Readonly<Record<string, unknown>> | null;
  }>;
  mapping: Readonly<{ mappingId: string; mappingVersion: number }>;
  factor: CompiledFactorDefinitionLineage;
  subjectBinding: CompiledSubjectBinding;
  evaluator: CompiledEvaluatorBinding;
  relationshipType: GenericFactorRelationshipType;
  requirement: Readonly<{ requirementLevel: FactorRequirementLevel; optionalBehavior: CompiledOptionalFactorBehavior | null }>;
  provider: CompiledProviderLineage;
  executionPolicies: CompiledExecutionPolicyLineage;
}>;

export type ResolvedCompilationSpecification = Readonly<{
  sourceTemplate: Readonly<{
    templateId: string;
    templateVersion: number;
    templateSnapshotHash: string;
    templateKind: "SYSTEM" | "USER";
    status: ScoringTemplateStatus;
    visibility: ScoringTemplateVisibility | null;
    scope: TemplateCompilationSnapshotInput["scope"];
    aggregationMode: "WEIGHTED_SUM";
  }>;
  resolvedBindings: readonly ResolvedTemplateRuleBinding[];
  futureCrossFactorPolicy: null;
  futureDecisionPolicy: null;
}>;

export const COMPILATION_COMPATIBILITY_FAILURE_CODES = Object.freeze([
  "INVALID_COMPATIBILITY_REQUEST", "INVALID_TEMPLATE_SNAPSHOT", "INVALID_TEMPLATE_ID", "INVALID_TEMPLATE_VERSION",
  "INVALID_TEMPLATE_KIND", "TEMPLATE_STATUS_NOT_COMPILE_ELIGIBLE", "INVALID_TEMPLATE_VISIBILITY", "INVALID_TEMPLATE_SCOPE",
  "UNSUPPORTED_AGGREGATION_MODE", "INVALID_SECTION", "INVALID_EVALUATOR_ENTRY", "INVALID_TEMPLATE_SNAPSHOT_VALUE",
  "TEMPLATE_SNAPSHOT_HASH_FAILED", "NO_ENABLED_SECTIONS", "NO_ENABLED_EVALUATORS", "TEMPLATE_RULE_MAPPING_NOT_FOUND",
  "TEMPLATE_RULE_MAPPING_AMBIGUOUS", "TEMPLATE_RULE_MAPPING_NOT_COMPILE_ELIGIBLE", "FACTOR_DEFINITION_NOT_FOUND",
  "EVALUATOR_DECLARATION_NOT_FOUND", "EVALUATOR_CONFIGURATION_NOT_FOUND", "PROVIDER_BINDING_NOT_FOUND",
  "RESOLUTION_POLICY_NOT_FOUND", "AGGREGATION_POLICY_NOT_FOUND", "NORMALIZATION_POLICY_NOT_FOUND",
  "DECISION_BAND_POLICY_NOT_FOUND", "FACTOR_REFERENCE_NOT_COMPILE_ELIGIBLE", "EVALUATOR_REFERENCE_NOT_COMPILE_ELIGIBLE",
  "CONFIGURATION_REFERENCE_NOT_COMPILE_ELIGIBLE", "PROVIDER_BINDING_NOT_COMPILE_ELIGIBLE",
  "RESOLUTION_POLICY_NOT_COMPILE_ELIGIBLE", "AGGREGATION_POLICY_NOT_COMPILE_ELIGIBLE",
  "NORMALIZATION_POLICY_NOT_COMPILE_ELIGIBLE", "DECISION_BAND_POLICY_NOT_COMPILE_ELIGIBLE",
  "EVALUATOR_FACTOR_INCOMPATIBLE", "EVALUATOR_RELATIONSHIP_INCOMPATIBLE", "CONFIGURATION_EVALUATOR_INCOMPATIBLE",
  "CONFIGURATION_FACTOR_INCOMPATIBLE", "CONFIGURATION_RELATIONSHIP_INCOMPATIBLE", "PROVIDER_BINDING_FACTOR_INCOMPATIBLE",
  "DEFERRED_RELATIONSHIP_NOT_EXECUTABLE", "UNSUPPORTED_LEGACY_ZERO_MISSING_DATA", "MISSING_DATA_MAPPING_NOT_FOUND",
  "INVALID_EFFECTIVE_WEIGHT", "SEMANTIC_BINDING_DUPLICATE", "SEMANTIC_BINDING_WEIGHT_CONFLICT", "RESOLVED_SPECIFICATION_INVALID",
] as const);
export type CompilationCompatibilityFailureCode = (typeof COMPILATION_COMPATIBILITY_FAILURE_CODES)[number];
export type CompilationCompatibilityResult =
  | Readonly<{ compatible: true; specification: ResolvedCompilationSpecification }>
  | Readonly<{ compatible: false; code: CompilationCompatibilityFailureCode; path: string }>;

export type CompilationCompatibilityDependencies = Readonly<{
  mappings: Pick<TemplateRuleCompilationMappingRegistry, "findBySourceEvaluatorKey">;
  factorDefinitions: Pick<VersionedFactorDefinitionRegistry, "getExact">;
  evaluatorDeclarations: Pick<VersionedEvaluatorDeclarationRegistry, "getExact">;
  evaluatorConfigurations: Pick<EvaluatorConfigurationRegistry, "getExact">;
  providerBindings: Pick<VersionedProviderBindingRegistry, "getExact">;
  resolutionPolicies: Pick<VersionedProviderResolutionPolicyRegistry, "getExact">;
  aggregationPolicies: Pick<VersionedAggregationPolicyRegistry, "getExact">;
  normalizationPolicies: Pick<VersionedNormalizationPolicyRegistry, "getExact">;
  decisionBandPolicies: Pick<VersionedDecisionBandPolicyRegistry, "getExact">;
}>;
