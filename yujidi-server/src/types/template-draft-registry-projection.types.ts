import type { EvidenceSubjectType, EvidenceValueType } from "./evidence.types.js";
import type { FactorKey, FactorUnitDefinition } from "./factor-registry.types.js";
import type { GenericFactorRelationshipSupportState, GenericFactorRelationshipType } from "./generic-factor-relationship.types.js";
import type { MissingDataPolicy } from "./scoring.types.js";
import type { VersionedFactorDefinition } from "./versioned-factor-definition.types.js";
import type { VersionedEvaluatorDeclaration } from "./versioned-evaluator-declaration.types.js";
import type { ProviderAuthorityRegistration } from "./provider-authority-registration.types.js";
import type { TemplateRuleCompilationMapping } from "./template-rule-compilation-mapping.types.js";
import type { TemplateDraftValidationPolicy } from "./template-draft-candidate.types.js";

export type DraftRelationshipKnowledge = Readonly<{
  relationship: GenericFactorRelationshipType;
  supportState: GenericFactorRelationshipSupportState;
  executable: boolean;
}>;

export type DraftProviderAvailability = Readonly<{
  providerKey: string;
  compileEligible: boolean;
  liveExecutionEligible: boolean;
  replayFixtureEligible: boolean;
}>;

export type DraftFactorKnowledge = Readonly<{
  factorKey: FactorKey;
  factorVersion: number;
  displayName: string;
  description: string;
  subjectTypes: readonly EvidenceSubjectType[];
  valueTypes: readonly EvidenceValueType[];
  unit: FactorUnitDefinition;
  relationships: readonly DraftRelationshipKnowledge[];
  genericEvaluatorAvailable: boolean;
  providers: readonly DraftProviderAvailability[];
  compilationMappings: readonly Readonly<{
    mappingId: string;
    mappingVersion: number;
    relationship: GenericFactorRelationshipType;
  }>[];
}>;

export type TemplateDraftRegistryProjection = Readonly<{
  projectionSchemaVersion: 1;
  projectionId: string;
  projectionVersion: number;
  factors: readonly DraftFactorKnowledge[];
  relationships: readonly DraftRelationshipKnowledge[];
  subjectTypes: readonly EvidenceSubjectType[];
  valueTypes: readonly EvidenceValueType[];
  units: readonly string[];
  missingDataPolicies: readonly MissingDataPolicy[];
  constraints: Readonly<{
    weightProposalsEnabled: false;
    ragEnabled: false;
    maxPromptCharacters: number;
    maxRequestedConcepts: number;
    maxBindings: number;
    maxConceptsPerBinding: number;
    maxClarificationQuestions: number;
    maxWarnings: number;
  }>;
  authorityLineage: Readonly<{
    factorMembers: readonly string[];
    evaluatorMembers: readonly string[];
    providerMembers: readonly string[];
    compilationMappingMembers: readonly string[];
    validationPolicyId: string;
    validationPolicyVersion: number;
  }>;
  canonicalDigest: string;
}>;

export type TemplateDraftRegistryProjectionRequest = Readonly<{
  projectionId: string;
  projectionVersion: number;
  factors: readonly VersionedFactorDefinition[];
  evaluatorDeclarations: readonly VersionedEvaluatorDeclaration[];
  providerAuthorities: readonly ProviderAuthorityRegistration[];
  compilationMappings: readonly TemplateRuleCompilationMapping[];
  validationPolicy: TemplateDraftValidationPolicy;
  capabilities: Readonly<{ weightProposalsEnabled: false; ragEnabled: false }>;
}>;

export const TEMPLATE_DRAFT_PROJECTION_ERROR_CODES = Object.freeze([
  "INVALID_REQUEST", "DUPLICATE_FACTOR_AUTHORITY", "CONFLICTING_FACTOR_IDENTITY",
  "DUPLICATE_EVALUATOR_AUTHORITY", "DUPLICATE_PROVIDER_AUTHORITY",
  "DUPLICATE_COMPILATION_MAPPING", "CANONICAL_DIGEST_FAILED",
] as const);
export type TemplateDraftProjectionErrorCode = (typeof TEMPLATE_DRAFT_PROJECTION_ERROR_CODES)[number];
export class TemplateDraftProjectionError extends Error {
  public constructor(public readonly code: TemplateDraftProjectionErrorCode) {
    super(`Template draft registry projection failed: ${code}`);
    this.name = "TemplateDraftProjectionError";
  }
}
