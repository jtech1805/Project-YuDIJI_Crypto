import { EVIDENCE_SUBJECT_TYPES, EVIDENCE_VALUE_TYPES, type EvidenceSubjectType, type EvidenceValueType } from "../types/evidence.types.js";
import { FACTOR_KEYS, type FactorKey } from "../types/factor-registry.types.js";
import { GENERIC_FACTOR_RELATIONSHIP_TYPES, type GenericFactorRelationshipType } from "../types/generic-factor-relationship.types.js";
import { MISSING_DATA_POLICIES, type MissingDataPolicy } from "../types/scoring.types.js";
import { DRAFT_CONCEPT_CATEGORY_HINTS, type DraftClarificationQuestion, type DraftGenerationWarning, type TemplateBindingCandidate, type TemplateDraftValidationPolicy, type ValidatedTemplateBindingCandidate } from "../types/template-draft-candidate.types.js";
import { DRAFT_REQUIREMENT_CODES, type DraftRequirementCode, type TemplateDraftCandidateValidationRequest, type TemplateDraftCandidateValidationResult, type TemplateDraftValidationIssue, type TemplateDraftValidationIssueCode, type ValidatedUnresolvedDraftConcept } from "../types/template-draft-validation.types.js";
import type { DraftFactorKnowledge, TemplateDraftRegistryProjection } from "../types/template-draft-registry-projection.types.js";
import { TemplateDraftRegistryProjectionService } from "./template-draft-registry-projection.service.js";

const IDENTIFIER = /^[A-Z0-9_.:-]{1,160}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const text = (value: unknown, max = 4_000): value is string => typeof value === "string" && value.length > 0 && value.length <= max && value.trim() === value;
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
const dense = (value: readonly unknown[]): boolean => value.every((_, index) => index in value);
const freeze = <T>(value: T): T => deepFreeze(structuredClone(value));
const deepFreeze = <T>(value: T): T => {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
};

export class TemplateDraftCandidateValidatorService {
  public constructor(private readonly projections = new TemplateDraftRegistryProjectionService()) {}

  public validate(input: TemplateDraftCandidateValidationRequest): TemplateDraftCandidateValidationResult {
    const issues: TemplateDraftValidationIssue[] = [];
    const policy = input.validationPolicy;
    const request = input.draftingRequest;
    const candidate = input.candidate;
    let fatal = false;

    if (!this.validRequest(request, policy)) {
      add(issues, "INVALID_DRAFTING_REQUEST", "REQUEST", null, null, "Drafting request violates the validation policy.");
      fatal = true;
    }
    if (!this.validCandidateIdentity(candidate)) {
      add(issues, "INVALID_CANDIDATE_IDENTITY", "CANDIDATE", null, null, "Candidate identity or schema is invalid.");
      fatal = true;
    }
    if (candidate.requestId !== request.requestId) {
      add(issues, "REQUEST_ID_MISMATCH", "CANDIDATE", null, null, "Candidate request identity does not match.");
      fatal = true;
    }
    if (candidate.generationLineage?.registryProjectionId !== request.projectionIdentity.projectionId
      || candidate.generationLineage?.registryProjectionVersion !== request.projectionIdentity.projectionVersion
      || candidate.generationLineage?.registryProjectionDigest !== request.projectionIdentity.projectionDigest
      || input.projection.projectionId !== request.projectionIdentity.projectionId
      || input.projection.projectionVersion !== request.projectionIdentity.projectionVersion
      || input.projection.canonicalDigest !== request.projectionIdentity.projectionDigest) {
      add(issues, "PROJECTION_IDENTITY_MISMATCH", "PROJECTION", null, null, "Candidate, request, and projection lineage differ.");
      fatal = true;
    }

    let currentProjection: TemplateDraftRegistryProjection | null = null;
    try { currentProjection = this.projections.create(input.currentAuthorities); } catch {
      add(issues, "PROJECTION_AUTHORITY_MISMATCH", "PROJECTION", null, null, "Current exact authorities cannot reproduce a valid projection.");
      fatal = true;
    }
    if (currentProjection && (currentProjection.projectionId !== input.projection.projectionId
      || currentProjection.projectionVersion !== input.projection.projectionVersion
      || currentProjection.canonicalDigest !== input.projection.canonicalDigest)) {
      add(issues, "PROJECTION_AUTHORITY_MISMATCH", "PROJECTION", null, null, "Projection is stale relative to current exact authorities.");
      fatal = true;
    }

    const conceptById = new Map(request.requestedConcepts.map((concept) => [concept.conceptId, concept]));
    for (const id of candidate.requestedConceptIds ?? []) {
      if (!conceptById.has(id)) {
        add(issues, "UNKNOWN_REQUESTED_CONCEPT", "CONCEPT", null, id, "Candidate references a concept outside the request.");
        fatal = true;
      }
    }
    const oversized = candidate.proposedBindings.length > policy.maxProposedBindings
      || candidate.proposedClarificationQuestions.length > policy.maxClarificationQuestions
      || candidate.generationWarnings.length > policy.maxWarnings;
    if (oversized) {
      add(issues, "CANDIDATE_LIMIT_EXCEEDED", "CANDIDATE", null, null, "Candidate exceeds a deterministic collection bound.");
      fatal = true;
    }
    if (duplicates(candidate.proposedBindings.map((binding) => binding.bindingCandidateId))) {
      add(issues, "DUPLICATE_BINDING_ID", "CANDIDATE", null, null, "Binding candidate identities must be unique.");
      fatal = true;
    }

    const supported: ValidatedTemplateBindingCandidate[] = [];
    const requirements = new Map<string, Set<DraftRequirementCode>>();
    const explanations = new Map<string, string>();
    const accounted = new Set<string>();
    const effectiveProjection = currentProjection ?? input.projection;

    for (const binding of candidate.proposedBindings) {
      const result = this.validateBinding(binding, conceptById, effectiveProjection, issues, requirements, explanations, policy);
      if (result.fatal) fatal = true;
      for (const id of result.accounted) accounted.add(id);
      if (result.binding) supported.push(result.binding);
    }

    for (const proposed of candidate.proposedUnresolvedConcepts) {
      if (!conceptById.has(proposed.conceptId)) {
        add(issues, "UNKNOWN_REQUESTED_CONCEPT", "CONCEPT", null, proposed.conceptId, "Unresolved entry references an unknown concept.");
        fatal = true;
        continue;
      }
      accounted.add(proposed.conceptId);
      const target = requireSet(requirements, proposed.conceptId);
      for (const requirement of proposed.requirements) {
        if (DRAFT_REQUIREMENT_CODES.includes(requirement as DraftRequirementCode)) target.add(requirement as DraftRequirementCode);
      }
      if (target.size === 0) target.add("REQUIRES_CLARIFICATION");
      if (proposed.explanation && text(proposed.explanation, 500)) explanations.set(proposed.conceptId, proposed.explanation);
    }

    const clarifications = this.validLinkedItems(candidate.proposedClarificationQuestions, conceptById, accounted, issues, "clarification");
    for (const item of clarifications) for (const id of item.requestedConceptIds) requireSet(requirements, id).add("REQUIRES_CLARIFICATION");
    const warnings = this.validLinkedItems(candidate.generationWarnings, conceptById, accounted, issues, "warning");

    for (const concept of request.requestedConcepts) {
      if (!accounted.has(concept.conceptId)) {
        add(issues, "REQUESTED_CONCEPT_NOT_ACCOUNTED_FOR", "CONCEPT", null, concept.conceptId, "Requested concept is absent from all candidate outcomes.");
        fatal = true;
      }
    }

    const unresolved: ValidatedUnresolvedDraftConcept[] = request.requestedConcepts.flatMap((concept) => {
      const found = requirements.get(concept.conceptId);
      return found && found.size > 0 ? [{
        conceptId: concept.conceptId,
        text: concept.text,
        requirements: [...found].sort(),
        explanation: explanations.get(concept.conceptId) ?? null,
      }] : [];
    });
    const validatedCandidate = {
      candidateId: validId(candidate.candidateId) ? candidate.candidateId : "INVALID_CANDIDATE",
      candidateSchemaVersion: positive(candidate.candidateSchemaVersion) ? candidate.candidateSchemaVersion : 1,
      requestId: request.requestId,
      interpretedRequest: candidate.interpretedRequest ?? {},
      supportedBindings: supported,
      unresolvedConcepts: unresolved,
      clarificationQuestions: clarifications,
      warnings,
      validationLineage: {
        validationPolicyId: policy.policyId,
        validationPolicyVersion: policy.policyVersion,
        registryProjectionId: input.projection.projectionId,
        registryProjectionVersion: input.projection.projectionVersion,
        registryProjectionDigest: input.projection.canonicalDigest,
      },
    };
    const outcome = fatal ? "VALIDATION_FAILED" as const
      : supported.length === 0 ? "UNSUPPORTED_REQUEST" as const
        : unresolved.length > 0 || clarifications.length > 0 ? "PARTIAL" as const : "COMPLETED" as const;
    return freeze({
      validatedCandidate,
      report: {
        outcome,
        issues,
        counts: {
          requestedConcepts: request.requestedConcepts.length,
          supportedBindings: supported.length,
          unresolvedConcepts: unresolved.length,
          clarificationQuestions: clarifications.length,
          warnings: warnings.length,
          issues: issues.length,
        },
      },
    });
  }

  private validRequest(request: TemplateDraftCandidateValidationRequest["draftingRequest"], policy: TemplateDraftValidationPolicy): boolean {
    if (!request || !validId(request.requestId) || !positive(request.requestVersion)
      || request.operation !== "CREATE_TEMPLATE" || !text(request.userPrompt, policy.maxPromptCharacters)
      || !Array.isArray(request.requestedConcepts) || request.requestedConcepts.length === 0
      || request.requestedConcepts.length > policy.maxRequestedConcepts || !dense(request.requestedConcepts)
      || duplicates(request.requestedConcepts.map((concept) => concept.conceptId))
      || !request.projectionIdentity || !validId(request.projectionIdentity.projectionId)
      || !positive(request.projectionIdentity.projectionVersion) || !DIGEST.test(request.projectionIdentity.projectionDigest)) return false;
    return request.requestedConcepts.every((concept) => validId(concept.conceptId) && text(concept.text, 500)
      && (concept.categoryHint === undefined || DRAFT_CONCEPT_CATEGORY_HINTS.includes(concept.categoryHint)));
  }

  private validCandidateIdentity(candidate: TemplateDraftCandidateValidationRequest["candidate"]): boolean {
    return !!candidate && validId(candidate.candidateId) && positive(candidate.candidateSchemaVersion)
      && validId(candidate.requestId) && Array.isArray(candidate.requestedConceptIds) && dense(candidate.requestedConceptIds)
      && !duplicates(candidate.requestedConceptIds) && Array.isArray(candidate.proposedBindings) && dense(candidate.proposedBindings)
      && Array.isArray(candidate.proposedUnresolvedConcepts) && dense(candidate.proposedUnresolvedConcepts)
      && Array.isArray(candidate.proposedClarificationQuestions) && dense(candidate.proposedClarificationQuestions)
      && Array.isArray(candidate.generationWarnings) && dense(candidate.generationWarnings)
      && !!candidate.generationLineage && validId(candidate.generationLineage.generationAttemptId)
      && text(candidate.generationLineage.modelProvider, 120) && text(candidate.generationLineage.modelName, 120)
      && validId(candidate.generationLineage.promptId) && positive(candidate.generationLineage.promptVersion)
      && validId(candidate.generationLineage.registryProjectionId)
      && positive(candidate.generationLineage.registryProjectionVersion)
      && DIGEST.test(candidate.generationLineage.registryProjectionDigest);
  }

  private validateBinding(binding: TemplateBindingCandidate, concepts: Map<string, unknown>, projection: TemplateDraftRegistryProjection,
    issues: TemplateDraftValidationIssue[], requirements: Map<string, Set<DraftRequirementCode>>, explanations: Map<string, string>, policy: TemplateDraftValidationPolicy): { binding: ValidatedTemplateBindingCandidate | null; accounted: readonly string[]; fatal: boolean } {
    let invalid = false; let fatal = false;
    const ids = binding.requestedConceptIds ?? [];
    if (!validId(binding.bindingCandidateId) || !Array.isArray(ids) || ids.length === 0 || ids.length > policy.maxConceptsPerBinding || !dense(ids)) invalid = true;
    if (duplicates(ids)) { add(issues, "DUPLICATE_CONCEPT_REFERENCE", "BINDING", binding.bindingCandidateId, null, "Binding repeats a concept reference."); fatal = true; }
    for (const id of ids) if (!concepts.has(id)) { add(issues, "UNKNOWN_REQUESTED_CONCEPT", "BINDING", binding.bindingCandidateId, id, "Binding references an unknown concept."); fatal = true; }
    const knownIds = ids.filter((id) => concepts.has(id));
    const requireAll = (code: DraftRequirementCode): void => { for (const id of knownIds) requireSet(requirements, id).add(code); };
    if (!binding.factorReference || !FACTOR_KEYS.includes(binding.factorReference.factorKey as FactorKey)) {
      add(issues, "FACTOR_NOT_REGISTERED", "BINDING", binding.bindingCandidateId, knownIds[0] ?? null, "Exact factor is not registered."); requireAll("REQUIRES_NEW_FACTOR"); invalid = true;
    }
    const factor = binding.factorReference ? projection.factors.find((item) => item.factorKey === binding.factorReference!.factorKey
      && item.factorVersion === binding.factorReference!.factorVersion) : undefined;
    if (binding.factorReference && FACTOR_KEYS.includes(binding.factorReference.factorKey as FactorKey) && !factor) {
      add(issues, "FACTOR_VERSION_NOT_FOUND", "BINDING", binding.bindingCandidateId, knownIds[0] ?? null, "Exact factor version is unavailable."); requireAll("REQUIRES_NEW_FACTOR"); invalid = true;
    }
    if (!binding.relationship || !GENERIC_FACTOR_RELATIONSHIP_TYPES.includes(binding.relationship as GenericFactorRelationshipType)) {
      add(issues, "RELATIONSHIP_NOT_REGISTERED", "BINDING", binding.bindingCandidateId, knownIds[0] ?? null, "Relationship is outside the registered vocabulary."); requireAll("REQUIRES_NEW_RELATIONSHIP"); invalid = true; fatal = true;
    }
    const relationship = binding.relationship as GenericFactorRelationshipType;
    const relationshipKnowledge = factor?.relationships.find((item) => item.relationship === relationship);
    if (factor && binding.relationship && !relationshipKnowledge?.executable) {
      add(issues, "RELATIONSHIP_NOT_EXECUTABLE", "BINDING", binding.bindingCandidateId, knownIds[0] ?? null, "Relationship is unavailable for this exact evaluator path."); requireAll("REQUIRES_NEW_RELATIONSHIP"); invalid = true;
    }
    if (!binding.subjectBinding?.key || !text(binding.subjectBinding.key, 160)) {
      add(issues, "SUBJECT_KEY_REQUIRED", "BINDING", binding.bindingCandidateId, knownIds[0] ?? null, "Exact subject key requires clarification."); requireAll("REQUIRES_SUBJECT_RESOLUTION"); requireAll("REQUIRES_CLARIFICATION"); invalid = true;
    }
    if (!binding.subjectBinding?.type || !EVIDENCE_SUBJECT_TYPES.includes(binding.subjectBinding.type as EvidenceSubjectType)
      || (factor && !factor.subjectTypes.includes(binding.subjectBinding.type as EvidenceSubjectType))) {
      add(issues, "SUBJECT_TYPE_NOT_ALLOWED", "BINDING", binding.bindingCandidateId, knownIds[0] ?? null, "Subject type is not allowed by the factor."); requireAll("REQUIRES_SUBJECT_RESOLUTION"); invalid = true;
    }
    const valueType = binding.valueType ?? (factor?.valueTypes.length === 1 ? factor.valueTypes[0] : undefined);
    if (!valueType || !EVIDENCE_VALUE_TYPES.includes(valueType as EvidenceValueType) || (factor && !factor.valueTypes.includes(valueType as EvidenceValueType))) {
      add(issues, "VALUE_TYPE_INCOMPATIBLE", "BINDING", binding.bindingCandidateId, knownIds[0] ?? null, "Value type is incompatible with the exact factor."); invalid = true;
    }
    if (factor && !unitCompatible(factor, binding.unit)) {
      add(issues, "UNIT_INCOMPATIBLE", "BINDING", binding.bindingCandidateId, knownIds[0] ?? null, "Unit does not satisfy the factor unit policy."); requireAll("REQUIRES_SUPPORTED_UNIT"); invalid = true;
    }
    if (factor && factor.providers.length === 0) {
      add(issues, "PROVIDER_AUTHORITY_MISSING", "BINDING", binding.bindingCandidateId, knownIds[0] ?? null, "No provider authority supports this factor."); requireAll("REQUIRES_PROVIDER");
    }
    const compilation = !!factor?.compilationMappings.some((mapping) => mapping.relationship === relationship);
    if (factor && !compilation) {
      add(issues, "COMPILATION_MAPPING_MISSING", "BINDING", binding.bindingCandidateId, knownIds[0] ?? null, "Legacy drafting is possible but no exact compilation mapping exists."); requireAll("REQUIRES_COMPILATION_MAPPING");
    }
    if (!binding.missingDataPolicy || !MISSING_DATA_POLICIES.includes(binding.missingDataPolicy as MissingDataPolicy)) {
      add(issues, "MISSING_DATA_POLICY_INVALID", "BINDING", binding.bindingCandidateId, knownIds[0] ?? null, "Missing-data policy is invalid."); requireAll("REQUIRES_CLARIFICATION"); invalid = true;
    }
    if (binding.proposedWeight !== undefined) {
      add(issues, "WEIGHT_PROPOSAL_DISABLED", "BINDING", binding.bindingCandidateId, knownIds[0] ?? null, "Model-proposed weight is disabled and was not accepted.");
      requireAll("REQUIRES_USER_WEIGHT");
    }
    add(issues, "WEIGHT_MISSING_USER_INPUT", "BINDING", binding.bindingCandidateId, knownIds[0] ?? null, "A user-supplied weight is required before future projection.");
    if ((binding.modelSupportClaim === "SUPPORTED" && invalid) || (binding.modelSupportClaim === "UNSUPPORTED" && !invalid)) {
      add(issues, "MODEL_SUPPORT_CLAIM_CONTRADICTED", "BINDING", binding.bindingCandidateId, knownIds[0] ?? null, "Deterministic validation contradicts the model support claim.");
    }
    if (binding.modelRationale && text(binding.modelRationale, 500)) for (const id of knownIds) explanations.set(id, binding.modelRationale);
    if (invalid || !factor || !relationshipKnowledge?.executable || !binding.subjectBinding?.key || !binding.subjectBinding.type || !valueType || !binding.missingDataPolicy) return { binding: null, accounted: knownIds, fatal };
    return { accounted: knownIds, fatal, binding: {
      bindingCandidateId: binding.bindingCandidateId,
      requestedConceptIds: knownIds,
      factorReference: { factorKey: factor.factorKey, factorVersion: factor.factorVersion },
      relationship,
      subjectBinding: { type: binding.subjectBinding.type as EvidenceSubjectType, key: binding.subjectBinding.key },
      valueType: valueType as EvidenceValueType,
      unit: binding.unit ?? null,
      missingDataPolicy: binding.missingDataPolicy as MissingDataPolicy,
      modelRationale: binding.modelRationale && text(binding.modelRationale, 500) ? binding.modelRationale : null,
      legacyDraftSupport: "SUPPORTED",
      compilationSupport: compilation ? "SUPPORTED" : "REQUIRES_COMPILATION_MAPPING",
      weightStatus: "REQUIRES_USER_INPUT",
    } };
  }

  private validLinkedItems<T extends DraftClarificationQuestion | DraftGenerationWarning>(items: readonly T[], concepts: Map<string, unknown>, accounted: Set<string>, issues: TemplateDraftValidationIssue[], kind: "clarification" | "warning"): readonly T[] {
    const valid: T[] = [];
    for (const item of items) {
      const body = kind === "clarification" ? (item as DraftClarificationQuestion).question : (item as DraftGenerationWarning).warning;
      if (!validId(kind === "clarification" ? (item as DraftClarificationQuestion).questionId : (item as DraftGenerationWarning).warningId)
        || !Array.isArray(item.requestedConceptIds) || !dense(item.requestedConceptIds) || duplicates(item.requestedConceptIds) || !text(body, 500)) continue;
      let unknown = false;
      for (const id of item.requestedConceptIds) if (!concepts.has(id)) { add(issues, "UNKNOWN_REQUESTED_CONCEPT", "CONCEPT", null, id, `${kind} references an unknown concept.`); unknown = true; }
      if (!unknown) { valid.push(item); for (const id of item.requestedConceptIds) accounted.add(id); }
    }
    return valid;
  }
}

const unitCompatible = (factor: DraftFactorKnowledge, unit: string | null | undefined): boolean => {
  if (factor.unit.policy === "FORBIDDEN") return unit === null || unit === undefined;
  if (factor.unit.policy === "OPTIONAL") return unit === null || unit === undefined || text(unit, 40);
  if (factor.unit.policy === "REQUIRED") return text(unit, 40);
  return text(unit, 40) && factor.unit.allowedUnits.includes(unit);
};
const validId = (value: unknown): value is string => typeof value === "string" && IDENTIFIER.test(value) && value.trim() === value;
const duplicates = (values: readonly string[]): boolean => new Set(values).size !== values.length;
const requireSet = (values: Map<string, Set<DraftRequirementCode>>, id: string): Set<DraftRequirementCode> => {
  const found = values.get(id) ?? new Set<DraftRequirementCode>(); values.set(id, found); return found;
};
const add = (issues: TemplateDraftValidationIssue[], code: TemplateDraftValidationIssueCode, scope: TemplateDraftValidationIssue["scope"], bindingCandidateId: string | null, conceptId: string | null, explanation: string): void => {
  issues.push({ code, scope, bindingCandidateId, conceptId, explanation });
};
