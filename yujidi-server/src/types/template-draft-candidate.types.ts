import type { EvidenceSubjectType, EvidenceValueType } from "./evidence.types.js";
import type { FactorKey } from "./factor-registry.types.js";
import type { GenericFactorRelationshipType } from "./generic-factor-relationship.types.js";
import type { MissingDataPolicy } from "./scoring.types.js";

export const DRAFT_CONCEPT_CATEGORY_HINTS = Object.freeze([
  "FACTOR", "RELATIONSHIP", "SUBJECT", "POLICY", "DATA_SOURCE", "UNKNOWN",
] as const);
export type DraftConceptCategoryHint = (typeof DRAFT_CONCEPT_CATEGORY_HINTS)[number];

export type RequestedDraftConcept = Readonly<{
  conceptId: string;
  text: string;
  categoryHint?: DraftConceptCategoryHint;
}>;

export type DraftSubjectCandidate = Readonly<{
  type?: string;
  key?: string;
  displayName?: string;
}>;

export type TemplateDraftingRequest = Readonly<{
  requestId: string;
  requestVersion: number;
  userPrompt: string;
  operation: "CREATE_TEMPLATE";
  intendedMarket?: string;
  intendedHoldingPeriod?: string;
  requestedSubject?: DraftSubjectCandidate;
  requestedConcepts: readonly RequestedDraftConcept[];
  projectionIdentity: Readonly<{
    projectionId: string;
    projectionVersion: number;
    projectionDigest: string;
  }>;
}>;

export type DraftSubjectBindingCandidate = Readonly<{
  type?: string;
  key?: string;
  displayName?: string;
}>;

export type TemplateBindingCandidate = Readonly<{
  bindingCandidateId: string;
  requestedConceptIds: readonly string[];
  factorReference?: Readonly<{ factorKey: string; factorVersion: number }>;
  relationship?: string;
  subjectBinding?: DraftSubjectBindingCandidate;
  valueType?: string;
  unit?: string | null;
  missingDataPolicy?: string;
  proposedWeight?: number;
  modelRationale?: string;
  modelSupportClaim?: "SUPPORTED" | "UNSUPPORTED";
}>;

export type ModelProposedUnresolvedConcept = Readonly<{
  conceptId: string;
  requirements: readonly string[];
  explanation?: string;
}>;

export type DraftClarificationQuestion = Readonly<{
  questionId: string;
  requestedConceptIds: readonly string[];
  question: string;
}>;

export type DraftGenerationWarning = Readonly<{
  warningId: string;
  requestedConceptIds: readonly string[];
  warning: string;
}>;

export type TemplateDraftCandidate = Readonly<{
  candidateId: string;
  candidateSchemaVersion: number;
  requestId: string;
  interpretedRequest: Readonly<{
    title?: string;
    description?: string;
    intendedMarket?: string;
    intendedHoldingPeriod?: string;
    subject?: DraftSubjectCandidate;
  }>;
  requestedConceptIds: readonly string[];
  proposedBindings: readonly TemplateBindingCandidate[];
  proposedUnresolvedConcepts: readonly ModelProposedUnresolvedConcept[];
  proposedClarificationQuestions: readonly DraftClarificationQuestion[];
  generationWarnings: readonly DraftGenerationWarning[];
  citationReferences?: readonly import("./template-draft-citation.types.js").DraftCitationReference[];
  generationLineage: Readonly<{
    generationAttemptId: string;
    modelProvider: string;
    modelName: string;
    promptId: string;
    promptVersion: number;
    registryProjectionId: string;
    registryProjectionVersion: number;
    registryProjectionDigest: string;
  }>;
}>;

export type ValidatedTemplateBindingCandidate = Readonly<{
  bindingCandidateId: string;
  requestedConceptIds: readonly string[];
  factorReference: Readonly<{ factorKey: FactorKey; factorVersion: number }>;
  relationship: GenericFactorRelationshipType;
  subjectBinding: Readonly<{ type: EvidenceSubjectType; key: string }>;
  valueType: EvidenceValueType;
  unit: string | null;
  missingDataPolicy: MissingDataPolicy;
  modelRationale: string | null;
  legacyDraftSupport: "SUPPORTED";
  compilationSupport: "SUPPORTED" | "REQUIRES_COMPILATION_MAPPING";
  weightStatus: "REQUIRES_USER_INPUT";
}>;

export type TemplateDraftValidationPolicy = Readonly<{
  policyId: string;
  policyVersion: number;
  maxPromptCharacters: number;
  maxRequestedConcepts: number;
  maxProposedBindings: number;
  maxConceptsPerBinding: number;
  maxClarificationQuestions: number;
  maxWarnings: number;
  weightProposalsEnabled: false;
}>;

export const DEFAULT_TEMPLATE_DRAFT_VALIDATION_POLICY: TemplateDraftValidationPolicy = Object.freeze({
  policyId: "DEFAULT_TEMPLATE_DRAFT_VALIDATION",
  policyVersion: 1,
  maxPromptCharacters: 4_000,
  maxRequestedConcepts: 24,
  maxProposedBindings: 24,
  maxConceptsPerBinding: 8,
  maxClarificationQuestions: 24,
  maxWarnings: 24,
  weightProposalsEnabled: false,
});
