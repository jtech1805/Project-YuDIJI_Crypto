import { CanonicalCompilationInputService } from "./canonical-compilation-input.service.js";
import { EVIDENCE_SUBJECT_TYPES, EVIDENCE_VALUE_TYPES } from "../types/evidence.types.js";
import { classifyGenericFactorRelationship, GENERIC_FACTOR_RELATIONSHIP_TYPES } from "../types/generic-factor-relationship.types.js";
import { MISSING_DATA_POLICIES } from "../types/scoring.types.js";
import {
  TemplateDraftProjectionError,
  type DraftFactorKnowledge,
  type DraftRelationshipKnowledge,
  type TemplateDraftRegistryProjection,
  type TemplateDraftRegistryProjectionRequest,
} from "../types/template-draft-registry-projection.types.js";

const ID = /^[A-Z0-9_]{1,120}$/;
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
const dense = (value: readonly unknown[]) => value.every((_, index) => index in value);
const freeze = <T>(value: T): T => deepFreeze(structuredClone(value));
const deepFreeze = <T>(value: T): T => {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
};

export class TemplateDraftRegistryProjectionService {
  public constructor(private readonly canonical = new CanonicalCompilationInputService()) {}

  public create(request: TemplateDraftRegistryProjectionRequest): TemplateDraftRegistryProjection {
    this.validateRequest(request);
    this.rejectDuplicateAuthorities(request);

    const relationships: readonly DraftRelationshipKnowledge[] = GENERIC_FACTOR_RELATIONSHIP_TYPES
      .map((relationship) => {
        const classification = classifyGenericFactorRelationship(relationship)!;
        return {
          relationship,
          supportState: classification.supportState,
          executable: classification.supportState === "SINGLE_FACTOR_EXECUTABLE",
        };
      });

    const factors: readonly DraftFactorKnowledge[] = [...request.factors]
      .sort((left, right) => identity(left.definition.factorKey, left.definition.version)
        .localeCompare(identity(right.definition.factorKey, right.definition.version)))
      .map(({ definition }) => {
        const declarations = request.evaluatorDeclarations
          .filter((declaration) => declaration.supportedFactorKeys.includes(definition.factorKey));
        const supportedRelationships = relationships.filter((knowledge) =>
          declarations.some((declaration) => declaration.supportedRelationshipTypes.includes(knowledge.relationship)));
        const providers = request.providerAuthorities
          .filter((authority) => authority.providerDefinition.enabled
            && authority.providerDefinition.supportedFactorKeys.includes(definition.factorKey))
          .sort((a, b) => a.providerDefinition.providerKey.localeCompare(b.providerDefinition.providerKey))
          .map((authority) => ({
            providerKey: authority.providerDefinition.providerKey,
            compileEligible: authority.capabilities.compileEligible,
            liveExecutionEligible: authority.capabilities.liveExecutionEligible,
            replayFixtureEligible: authority.capabilities.replayFixtureEligible,
          }));
        const compilationMappings = request.compilationMappings
          .filter((mapping) => mapping.compileEligible
            && mapping.factor.factorKey === definition.factorKey
            && mapping.factor.factorVersion === definition.version)
          .sort((a, b) => identity(a.identity.mappingId, a.identity.mappingVersion)
            .localeCompare(identity(b.identity.mappingId, b.identity.mappingVersion)))
          .map((mapping) => ({
            mappingId: mapping.identity.mappingId,
            mappingVersion: mapping.identity.mappingVersion,
            relationship: mapping.relationshipType,
          }));
        return {
          factorKey: definition.factorKey,
          factorVersion: definition.version,
          displayName: definition.displayName,
          description: definition.description,
          subjectTypes: [...definition.subjectTypes].sort(),
          valueTypes: [...definition.valueTypes].sort(),
          unit: definition.unit,
          relationships: supportedRelationships,
          genericEvaluatorAvailable: declarations.length > 0,
          providers,
          compilationMappings,
        };
      });

    const authorityLineage = {
      factorMembers: factors.map((factor) => identity(factor.factorKey, factor.factorVersion)),
      evaluatorMembers: [...request.evaluatorDeclarations]
        .map((value) => identity(value.evaluatorId, value.evaluatorVersion)).sort(),
      providerMembers: [...request.providerAuthorities]
        .map((value) => value.providerDefinition.providerKey).sort(),
      compilationMappingMembers: [...request.compilationMappings]
        .map((value) => identity(value.identity.mappingId, value.identity.mappingVersion)).sort(),
      validationPolicyId: request.validationPolicy.policyId,
      validationPolicyVersion: request.validationPolicy.policyVersion,
    };
    const withoutDigest = {
      projectionSchemaVersion: 1 as const,
      projectionId: request.projectionId,
      projectionVersion: request.projectionVersion,
      factors,
      relationships,
      subjectTypes: [...EVIDENCE_SUBJECT_TYPES].sort(),
      valueTypes: [...EVIDENCE_VALUE_TYPES].sort(),
      units: [...new Set(factors.flatMap((factor) => factor.unit.policy === "ALLOW_LIST"
        ? factor.unit.allowedUnits : []))].sort(),
      missingDataPolicies: [...MISSING_DATA_POLICIES].sort(),
      constraints: {
        weightProposalsEnabled: false as const,
        ragEnabled: false as const,
        maxPromptCharacters: request.validationPolicy.maxPromptCharacters,
        maxRequestedConcepts: request.validationPolicy.maxRequestedConcepts,
        maxBindings: request.validationPolicy.maxProposedBindings,
        maxConceptsPerBinding: request.validationPolicy.maxConceptsPerBinding,
        maxClarificationQuestions: request.validationPolicy.maxClarificationQuestions,
        maxWarnings: request.validationPolicy.maxWarnings,
      },
      authorityLineage,
    };
    const hashed = this.canonical.hash(withoutDigest);
    if (!hashed.hashed) throw new TemplateDraftProjectionError("CANONICAL_DIGEST_FAILED");
    return freeze({ ...withoutDigest, canonicalDigest: hashed.hash });
  }

  private validateRequest(request: TemplateDraftRegistryProjectionRequest): void {
    if (!request || !ID.test(request.projectionId) || !positive(request.projectionVersion)
      || !Array.isArray(request.factors) || request.factors.length === 0 || !dense(request.factors)
      || !Array.isArray(request.evaluatorDeclarations) || !dense(request.evaluatorDeclarations)
      || !Array.isArray(request.providerAuthorities) || !dense(request.providerAuthorities)
      || !Array.isArray(request.compilationMappings) || !dense(request.compilationMappings)
      || !request.validationPolicy || !ID.test(request.validationPolicy.policyId)
      || !positive(request.validationPolicy.policyVersion)
      || request.validationPolicy.weightProposalsEnabled !== false
      || request.capabilities?.weightProposalsEnabled !== false || request.capabilities.ragEnabled !== false) {
      throw new TemplateDraftProjectionError("INVALID_REQUEST");
    }
  }

  private rejectDuplicateAuthorities(request: TemplateDraftRegistryProjectionRequest): void {
    const factorVersions = new Map<string, string>();
    for (const value of request.factors) {
      const exactIdentity = identity(value.definition.factorKey, value.definition.version);
      const serialized = JSON.stringify(value);
      const prior = factorVersions.get(exactIdentity);
      if (prior !== undefined) {
        if (prior !== serialized) throw new TemplateDraftProjectionError("CONFLICTING_FACTOR_IDENTITY");
        throw new TemplateDraftProjectionError("DUPLICATE_FACTOR_AUTHORITY");
      }
      factorVersions.set(exactIdentity, serialized);
    }
    unique(request.evaluatorDeclarations.map((value) => identity(value.evaluatorId, value.evaluatorVersion)), "DUPLICATE_EVALUATOR_AUTHORITY");
    unique(request.providerAuthorities.map((value) => value.providerDefinition.providerKey), "DUPLICATE_PROVIDER_AUTHORITY");
    unique(request.compilationMappings.map((value) => identity(value.identity.mappingId, value.identity.mappingVersion)), "DUPLICATE_COMPILATION_MAPPING");
  }
}

const identity = (id: string, version: number): string => `${id}:${version}`;
const unique = (values: readonly string[], code: ConstructorParameters<typeof TemplateDraftProjectionError>[0]): void => {
  if (new Set(values).size !== values.length) throw new TemplateDraftProjectionError(code);
};
