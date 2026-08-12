import type { DraftClarificationQuestion, DraftGenerationWarning, TemplateDraftCandidate, TemplateDraftingRequest, TemplateDraftValidationPolicy, ValidatedTemplateBindingCandidate } from "./template-draft-candidate.types.js";
import type { TemplateDraftRegistryProjection, TemplateDraftRegistryProjectionRequest } from "./template-draft-registry-projection.types.js";

export const DRAFT_REQUIREMENT_CODES = Object.freeze([
  "REQUIRES_NEW_FACTOR", "REQUIRES_NEW_RELATIONSHIP", "REQUIRES_PROVIDER",
  "REQUIRES_CLARIFICATION", "REQUIRES_SUBJECT_RESOLUTION", "REQUIRES_USER_WEIGHT",
  "REQUIRES_COMPILATION_MAPPING", "REQUIRES_SUPPORTED_UNIT",
] as const);
export type DraftRequirementCode = (typeof DRAFT_REQUIREMENT_CODES)[number];

export const TEMPLATE_DRAFT_VALIDATION_ISSUE_CODES = Object.freeze([
  "INVALID_DRAFTING_REQUEST", "INVALID_CANDIDATE_IDENTITY", "REQUEST_ID_MISMATCH",
  "PROJECTION_IDENTITY_MISMATCH", "PROJECTION_AUTHORITY_MISMATCH", "UNKNOWN_REQUESTED_CONCEPT",
  "REQUESTED_CONCEPT_NOT_ACCOUNTED_FOR", "DUPLICATE_BINDING_ID", "DUPLICATE_CONCEPT_REFERENCE",
  "FACTOR_NOT_REGISTERED", "FACTOR_VERSION_NOT_FOUND", "RELATIONSHIP_NOT_REGISTERED",
  "RELATIONSHIP_NOT_EXECUTABLE", "SUBJECT_TYPE_NOT_ALLOWED", "SUBJECT_KEY_REQUIRED",
  "VALUE_TYPE_INCOMPATIBLE", "UNIT_INCOMPATIBLE", "PROVIDER_AUTHORITY_MISSING",
  "COMPILATION_MAPPING_MISSING", "MISSING_DATA_POLICY_INVALID", "WEIGHT_PROPOSAL_DISABLED",
  "WEIGHT_MISSING_USER_INPUT", "MODEL_SUPPORT_CLAIM_CONTRADICTED", "UNRESOLVED_CONCEPT_MISSING",
  "CANDIDATE_LIMIT_EXCEEDED",
] as const);
export type TemplateDraftValidationIssueCode = (typeof TEMPLATE_DRAFT_VALIDATION_ISSUE_CODES)[number];
export type TemplateDraftValidationIssue = Readonly<{
  code: TemplateDraftValidationIssueCode;
  scope: "REQUEST" | "CANDIDATE" | "PROJECTION" | "BINDING" | "CONCEPT";
  bindingCandidateId: string | null;
  conceptId: string | null;
  explanation: string;
}>;

export type ValidatedUnresolvedDraftConcept = Readonly<{
  conceptId: string;
  text: string;
  requirements: readonly DraftRequirementCode[];
  explanation: string | null;
}>;

export type ValidatedTemplateDraftCandidate = Readonly<{
  candidateId: string;
  candidateSchemaVersion: number;
  requestId: string;
  interpretedRequest: TemplateDraftCandidate["interpretedRequest"];
  supportedBindings: readonly ValidatedTemplateBindingCandidate[];
  unresolvedConcepts: readonly ValidatedUnresolvedDraftConcept[];
  clarificationQuestions: readonly DraftClarificationQuestion[];
  warnings: readonly DraftGenerationWarning[];
  validationLineage: Readonly<{
    validationPolicyId: string;
    validationPolicyVersion: number;
    registryProjectionId: string;
    registryProjectionVersion: number;
    registryProjectionDigest: string;
  }>;
}>;

export type TemplateDraftValidationOutcome = "COMPLETED" | "PARTIAL" | "VALIDATION_FAILED" | "UNSUPPORTED_REQUEST";
export type TemplateDraftValidationReport = Readonly<{
  outcome: TemplateDraftValidationOutcome;
  issues: readonly TemplateDraftValidationIssue[];
  counts: Readonly<{
    requestedConcepts: number;
    supportedBindings: number;
    unresolvedConcepts: number;
    clarificationQuestions: number;
    warnings: number;
    issues: number;
  }>;
}>;

export type TemplateDraftCandidateValidationRequest = Readonly<{
  draftingRequest: TemplateDraftingRequest;
  candidate: TemplateDraftCandidate;
  projection: TemplateDraftRegistryProjection;
  currentAuthorities: TemplateDraftRegistryProjectionRequest;
  validationPolicy: TemplateDraftValidationPolicy;
}>;
export type TemplateDraftCandidateValidationResult = Readonly<{
  validatedCandidate: ValidatedTemplateDraftCandidate;
  report: TemplateDraftValidationReport;
}>;
