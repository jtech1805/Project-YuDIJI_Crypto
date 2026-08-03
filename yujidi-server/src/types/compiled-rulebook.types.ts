import type { EvidenceSubject, EvidenceSubjectType } from "./evidence.types.js";
import type { FactorKey } from "./factor-registry.types.js";
import type { GenericFactorRelationshipType } from "./generic-factor-relationship.types.js";

export const COMPILED_SUBJECT_BINDING_TYPES = Object.freeze([
  "FIXED",
  "TRADED_INSTRUMENT",
  "UNDERLYING_ASSET",
] as const);
export type CompiledSubjectBindingType =
  (typeof COMPILED_SUBJECT_BINDING_TYPES)[number];

export const FACTOR_REQUIREMENT_LEVELS = Object.freeze([
  "MANDATORY",
  "OPTIONAL",
] as const);
export type FactorRequirementLevel =
  (typeof FACTOR_REQUIREMENT_LEVELS)[number];

export const MIN_COMPILED_RULEBOOK_FACTOR_BINDINGS = 1;
export const MAX_COMPILED_RULEBOOK_FACTOR_BINDINGS = 100;
export const MAX_COMPILED_RULEBOOK_IDENTIFIER_LENGTH = 120;
export const MAX_COMPILED_SUBJECT_KEY_LENGTH = 160;
export const MAX_COMPILED_RULEBOOK_WEIGHT = 100;

export type CompiledRulebookIdentity = Readonly<{
  rulebookId: string;
  rulebookVersion: number;
}>;

export type CompiledRulebookSourceLineage = Readonly<{
  templateId: string;
  templateVersion: number;
}>;

export type CompiledRulebookCompilationLineage = Readonly<{
  compilerId: string;
  compilerVersion: number;
  compilationInputHash: string;
  compiledAt: Date;
}>;

export type CompiledFixedSubject = Readonly<
  Pick<EvidenceSubject, "type" | "key">
>;

export type CompiledSubjectBinding =
  | Readonly<{
      type: "FIXED";
      subject: CompiledFixedSubject;
    }>
  | Readonly<{
      type: "TRADED_INSTRUMENT";
    }>
  | Readonly<{
      type: "UNDERLYING_ASSET";
    }>;

export type CompiledFactorDefinitionLineage = Readonly<{
  factorKey: FactorKey;
  factorVersion: number;
}>;

export type CompiledEvaluatorBinding = Readonly<{
  evaluatorId: string;
  evaluatorVersion: number;
  configurationId: string;
  configurationVersion: number;
}>;

export type CompiledProviderLineage = Readonly<{
  providerBindingId: string;
  providerBindingVersion: number;
  resolutionPolicyId: string;
  resolutionPolicyVersion: number;
}>;

export type CompiledExecutionPolicyLineage = Readonly<{
  aggregationPolicyId: string;
  aggregationPolicyVersion: number;
  normalizationPolicyId: string;
  normalizationPolicyVersion: number;
  decisionBandPolicyId: string;
  decisionBandPolicyVersion: number;
}>;

export type CompiledPolicyLineage = Readonly<{
  policyId: string;
  policyVersion: number;
}>;

export type CompiledFactorBinding = Readonly<{
  bindingId: string;
  order: number;
  factor: CompiledFactorDefinitionLineage;
  subjectBinding: CompiledSubjectBinding;
  evaluator: CompiledEvaluatorBinding;
  relationshipType: GenericFactorRelationshipType;
  requirementLevel: FactorRequirementLevel;
  weight: number;
  provider: CompiledProviderLineage;
  executionPolicies: CompiledExecutionPolicyLineage;
}>;

export type CompiledRulebookDefinition = Readonly<{
  identity: CompiledRulebookIdentity;
  source: CompiledRulebookSourceLineage;
  compilation: CompiledRulebookCompilationLineage;
  factorBindings: readonly CompiledFactorBinding[];
  crossFactorPolicy: CompiledPolicyLineage | null;
  decisionPolicy: CompiledPolicyLineage | null;
}>;

export const COMPILED_RULEBOOK_VALIDATION_FAILURE_CODES = Object.freeze([
  "INVALID_RULEBOOK",
  "INVALID_RULEBOOK_ID",
  "INVALID_RULEBOOK_VERSION",
  "INVALID_SOURCE_TEMPLATE_ID",
  "INVALID_SOURCE_TEMPLATE_VERSION",
  "INVALID_COMPILER_ID",
  "INVALID_COMPILER_VERSION",
  "INVALID_COMPILATION_INPUT_HASH",
  "INVALID_COMPILED_AT",
  "INVALID_FACTOR_BINDINGS",
  "EMPTY_FACTOR_BINDINGS",
  "TOO_MANY_FACTOR_BINDINGS",
  "INVALID_BINDING_ORDER",
  "DUPLICATE_BINDING_ID",
  "DUPLICATE_BINDING_ORDER",
  "NON_CONTIGUOUS_BINDING_ORDER",
  "INVALID_BINDING_ID",
  "INVALID_FACTOR_LINEAGE",
  "UNKNOWN_FACTOR",
  "INVALID_FACTOR_VERSION",
  "INVALID_SUBJECT_BINDING",
  "UNKNOWN_SUBJECT_BINDING_TYPE",
  "INVALID_FIXED_SUBJECT",
  "INVALID_EVALUATOR_ID",
  "INVALID_EVALUATOR_VERSION",
  "INVALID_CONFIGURATION_ID",
  "INVALID_CONFIGURATION_VERSION",
  "UNKNOWN_RELATIONSHIP_TYPE",
  "UNKNOWN_REQUIREMENT_LEVEL",
  "INVALID_WEIGHT",
  "INVALID_PROVIDER_BINDING_ID",
  "INVALID_PROVIDER_BINDING_VERSION",
  "INVALID_RESOLUTION_POLICY_ID",
  "INVALID_RESOLUTION_POLICY_VERSION",
  "INVALID_AGGREGATION_POLICY_ID",
  "INVALID_AGGREGATION_POLICY_VERSION",
  "INVALID_NORMALIZATION_POLICY_ID",
  "INVALID_NORMALIZATION_POLICY_VERSION",
  "INVALID_DECISION_BAND_POLICY_ID",
  "INVALID_DECISION_BAND_POLICY_VERSION",
  "DUPLICATE_SEMANTIC_BINDING",
  "INVALID_CROSS_FACTOR_POLICY",
  "INVALID_DECISION_POLICY",
] as const);
export type CompiledRulebookValidationFailureCode =
  (typeof COMPILED_RULEBOOK_VALIDATION_FAILURE_CODES)[number];

export type CompiledRulebookValidationResult =
  | Readonly<{
      valid: true;
      rulebook: CompiledRulebookDefinition;
    }>
  | Readonly<{
      valid: false;
      code: CompiledRulebookValidationFailureCode;
      path: string;
    }>;

// Retained as a type-level alias for consumers that need the closed subject vocabulary.
export type CompiledFixedSubjectType = EvidenceSubjectType;
