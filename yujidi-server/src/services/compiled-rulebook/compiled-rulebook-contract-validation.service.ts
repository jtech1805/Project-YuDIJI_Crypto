import {
  EVIDENCE_SUBJECT_TYPES,
  type EvidenceSubjectType,
} from "../../types/evidence.types.js";
import { FACTOR_KEYS, type FactorKey } from "../../types/factor-registry.types.js";
import { GENERIC_FACTOR_RELATIONSHIP_TYPES } from "../../types/generic-factor-relationship.types.js";
import {
  COMPILED_SUBJECT_BINDING_TYPES,
  COMPILED_OPTIONAL_FACTOR_BEHAVIORS,
  FACTOR_REQUIREMENT_LEVELS,
  MAX_COMPILED_RULEBOOK_FACTOR_BINDINGS,
  MAX_COMPILED_RULEBOOK_IDENTIFIER_LENGTH,
  MAX_COMPILED_RULEBOOK_WEIGHT,
  MAX_COMPILED_SUBJECT_KEY_LENGTH,
  MIN_COMPILED_RULEBOOK_FACTOR_BINDINGS,
  type CompiledFactorBinding,
  type CompiledPolicyLineage,
  type CompiledRulebookDefinition,
  type CompiledRulebookValidationFailureCode,
  type CompiledRulebookValidationResult,
  type CompiledSubjectBinding,
} from "../../types/compiled-rulebook.types.js";

const IDENTIFIER_PATTERN = /^[A-Z0-9_]+$/;
const SUBJECT_KEY_PATTERN = /^[A-Z0-9._:-]+$/;
const SHA_256_PATTERN = /^[a-f0-9]{64}$/;

type UnknownRecord = Record<string, unknown>;

export class CompiledRulebookContractValidationService {
  public validate(request: unknown): CompiledRulebookValidationResult {
    if (!record(request) || !record(request.rulebook)) {
      return failure("INVALID_RULEBOOK", "rulebook");
    }
    const rulebook = request.rulebook;

    if (!record(rulebook.identity)) return failure("INVALID_RULEBOOK_ID", "identity");
    if (!identifier(rulebook.identity.rulebookId)) return failure("INVALID_RULEBOOK_ID", "identity.rulebookId");
    if (!positiveInteger(rulebook.identity.rulebookVersion)) return failure("INVALID_RULEBOOK_VERSION", "identity.rulebookVersion");

    if (!record(rulebook.source)) return failure("INVALID_SOURCE_TEMPLATE_ID", "source");
    if (!identifier(rulebook.source.templateId)) return failure("INVALID_SOURCE_TEMPLATE_ID", "source.templateId");
    if (!positiveInteger(rulebook.source.templateVersion)) return failure("INVALID_SOURCE_TEMPLATE_VERSION", "source.templateVersion");

    if (!record(rulebook.compilation)) return failure("INVALID_COMPILER_ID", "compilation");
    if (!identifier(rulebook.compilation.compilerId)) return failure("INVALID_COMPILER_ID", "compilation.compilerId");
    if (!positiveInteger(rulebook.compilation.compilerVersion)) return failure("INVALID_COMPILER_VERSION", "compilation.compilerVersion");
    if (typeof rulebook.compilation.compilationInputHash !== "string"
      || !SHA_256_PATTERN.test(rulebook.compilation.compilationInputHash)) {
      return failure("INVALID_COMPILATION_INPUT_HASH", "compilation.compilationInputHash");
    }
    if (!validDate(rulebook.compilation.compiledAt)) return failure("INVALID_COMPILED_AT", "compilation.compiledAt");

    if (!Array.isArray(rulebook.factorBindings)) return failure("INVALID_FACTOR_BINDINGS", "factorBindings");
    if (rulebook.factorBindings.length < MIN_COMPILED_RULEBOOK_FACTOR_BINDINGS) {
      return failure("EMPTY_FACTOR_BINDINGS", "factorBindings");
    }
    if (rulebook.factorBindings.length > MAX_COMPILED_RULEBOOK_FACTOR_BINDINGS) {
      return failure("TOO_MANY_FACTOR_BINDINGS", "factorBindings");
    }

    for (let index = 0; index < rulebook.factorBindings.length; index += 1) {
      const binding = rulebook.factorBindings[index];
      if (!record(binding) || !nonNegativeInteger(binding.order)) {
        return failure("INVALID_BINDING_ORDER", `factorBindings[${index}].order`);
      }
    }

    const ids = new Set<string>();
    for (let index = 0; index < rulebook.factorBindings.length; index += 1) {
      const binding = rulebook.factorBindings[index] as UnknownRecord;
      if (typeof binding.bindingId === "string" && ids.has(binding.bindingId)) {
        return failure("DUPLICATE_BINDING_ID", `factorBindings[${index}].bindingId`);
      }
      if (typeof binding.bindingId === "string") ids.add(binding.bindingId);
    }

    const orders = new Set<number>();
    for (let index = 0; index < rulebook.factorBindings.length; index += 1) {
      const binding = rulebook.factorBindings[index] as UnknownRecord;
      const order = binding.order as number;
      if (orders.has(order)) return failure("DUPLICATE_BINDING_ORDER", `factorBindings[${index}].order`);
      orders.add(order);
    }
    for (let order = 0; order < rulebook.factorBindings.length; order += 1) {
      if (!orders.has(order)) return failure("NON_CONTIGUOUS_BINDING_ORDER", "factorBindings");
    }

    const sortedBindings = [...rulebook.factorBindings]
      .sort((left, right) => (left as UnknownRecord).order as number - ((right as UnknownRecord).order as number));
    const semanticBindings = new Set<string>();
    for (const [index, binding] of sortedBindings.entries()) {
      const path = `factorBindings[${index}]`;
      const invalid = validateBinding(binding, path);
      if (invalid) return invalid;
      const semanticIdentity = semanticBindingIdentity(binding as unknown as CompiledFactorBinding);
      if (semanticBindings.has(semanticIdentity)) return failure("DUPLICATE_SEMANTIC_BINDING", path);
      semanticBindings.add(semanticIdentity);
    }

    const crossFactorFailure = validateOptionalPolicy(rulebook.crossFactorPolicy, "crossFactorPolicy", "INVALID_CROSS_FACTOR_POLICY");
    if (crossFactorFailure) return crossFactorFailure;
    const decisionFailure = validateOptionalPolicy(rulebook.decisionPolicy, "decisionPolicy", "INVALID_DECISION_POLICY");
    if (decisionFailure) return decisionFailure;

    return Object.freeze({
      valid: true,
      rulebook: cloneRulebook(rulebook as unknown as CompiledRulebookDefinition),
    });
  }
}

const validateBinding = (value: unknown, path: string): CompiledRulebookValidationResult | null => {
  if (!record(value) || !identifier(value.bindingId)) return failure("INVALID_BINDING_ID", `${path}.bindingId`);
  if (!nonNegativeInteger(value.order)) return failure("INVALID_BINDING_ORDER", `${path}.order`);

  if (!record(value.factor)) return failure("INVALID_FACTOR_LINEAGE", `${path}.factor`);
  if (!FACTOR_KEYS.includes(value.factor.factorKey as FactorKey)) return failure("UNKNOWN_FACTOR", `${path}.factor.factorKey`);
  if (!positiveInteger(value.factor.factorVersion)) return failure("INVALID_FACTOR_VERSION", `${path}.factor.factorVersion`);

  const subjectFailure = validateSubjectBinding(value.subjectBinding, `${path}.subjectBinding`);
  if (subjectFailure) return subjectFailure;

  if (!record(value.evaluator) || !identifier(value.evaluator.evaluatorId)) return failure("INVALID_EVALUATOR_ID", `${path}.evaluator.evaluatorId`);
  if (!positiveInteger(value.evaluator.evaluatorVersion)) return failure("INVALID_EVALUATOR_VERSION", `${path}.evaluator.evaluatorVersion`);
  if (!identifier(value.evaluator.configurationId)) return failure("INVALID_CONFIGURATION_ID", `${path}.evaluator.configurationId`);
  if (!positiveInteger(value.evaluator.configurationVersion)) return failure("INVALID_CONFIGURATION_VERSION", `${path}.evaluator.configurationVersion`);

  if (!GENERIC_FACTOR_RELATIONSHIP_TYPES.includes(value.relationshipType as never)) {
    return failure("UNKNOWN_RELATIONSHIP_TYPE", `${path}.relationshipType`);
  }
  if (!FACTOR_REQUIREMENT_LEVELS.includes(value.requirementLevel as never)) {
    return failure("UNKNOWN_REQUIREMENT_LEVEL", `${path}.requirementLevel`);
  }
  if (value.optionalBehavior !== null
    && !COMPILED_OPTIONAL_FACTOR_BEHAVIORS.includes(value.optionalBehavior as never)) {
    return failure("INVALID_OPTIONAL_BEHAVIOR", `${path}.optionalBehavior`);
  }
  if (value.requirementLevel === "MANDATORY" && value.optionalBehavior !== null) {
    return failure("MANDATORY_BINDING_HAS_OPTIONAL_BEHAVIOR", `${path}.optionalBehavior`);
  }
  if (value.requirementLevel === "OPTIONAL" && value.optionalBehavior === null) {
    return failure("OPTIONAL_BINDING_MISSING_BEHAVIOR", `${path}.optionalBehavior`);
  }
  if (typeof value.weight !== "number" || !Number.isFinite(value.weight)
    || value.weight <= 0 || value.weight > MAX_COMPILED_RULEBOOK_WEIGHT) {
    return failure("INVALID_WEIGHT", `${path}.weight`);
  }

  if (!record(value.provider) || !identifier(value.provider.providerBindingId)) return failure("INVALID_PROVIDER_BINDING_ID", `${path}.provider.providerBindingId`);
  if (!positiveInteger(value.provider.providerBindingVersion)) return failure("INVALID_PROVIDER_BINDING_VERSION", `${path}.provider.providerBindingVersion`);
  if (!identifier(value.provider.resolutionPolicyId)) return failure("INVALID_RESOLUTION_POLICY_ID", `${path}.provider.resolutionPolicyId`);
  if (!positiveInteger(value.provider.resolutionPolicyVersion)) return failure("INVALID_RESOLUTION_POLICY_VERSION", `${path}.provider.resolutionPolicyVersion`);

  if (!record(value.executionPolicies) || !identifier(value.executionPolicies.aggregationPolicyId)) return failure("INVALID_AGGREGATION_POLICY_ID", `${path}.executionPolicies.aggregationPolicyId`);
  if (!positiveInteger(value.executionPolicies.aggregationPolicyVersion)) return failure("INVALID_AGGREGATION_POLICY_VERSION", `${path}.executionPolicies.aggregationPolicyVersion`);
  if (!identifier(value.executionPolicies.normalizationPolicyId)) return failure("INVALID_NORMALIZATION_POLICY_ID", `${path}.executionPolicies.normalizationPolicyId`);
  if (!positiveInteger(value.executionPolicies.normalizationPolicyVersion)) return failure("INVALID_NORMALIZATION_POLICY_VERSION", `${path}.executionPolicies.normalizationPolicyVersion`);
  if (!identifier(value.executionPolicies.decisionBandPolicyId)) return failure("INVALID_DECISION_BAND_POLICY_ID", `${path}.executionPolicies.decisionBandPolicyId`);
  if (!positiveInteger(value.executionPolicies.decisionBandPolicyVersion)) return failure("INVALID_DECISION_BAND_POLICY_VERSION", `${path}.executionPolicies.decisionBandPolicyVersion`);
  return null;
};

const validateSubjectBinding = (value: unknown, path: string): CompiledRulebookValidationResult | null => {
  if (!record(value) || typeof value.type !== "string") return failure("INVALID_SUBJECT_BINDING", path);
  if (!COMPILED_SUBJECT_BINDING_TYPES.includes(value.type as never)) return failure("UNKNOWN_SUBJECT_BINDING_TYPE", `${path}.type`);
  if (value.type !== "FIXED") return null;
  if (!record(value.subject)
    || !EVIDENCE_SUBJECT_TYPES.includes(value.subject.type as EvidenceSubjectType)
    || typeof value.subject.key !== "string"
    || value.subject.key.length === 0
    || value.subject.key.length > MAX_COMPILED_SUBJECT_KEY_LENGTH
    || value.subject.key.trim() !== value.subject.key
    || !SUBJECT_KEY_PATTERN.test(value.subject.key)) {
    return failure("INVALID_FIXED_SUBJECT", `${path}.subject`);
  }
  return null;
};

const validateOptionalPolicy = (
  value: unknown,
  path: string,
  code: "INVALID_CROSS_FACTOR_POLICY" | "INVALID_DECISION_POLICY",
): CompiledRulebookValidationResult | null => {
  if (value === null) return null;
  if (!record(value) || !identifier(value.policyId) || !positiveInteger(value.policyVersion)) {
    return failure(code, path);
  }
  return null;
};

const semanticBindingIdentity = (binding: CompiledFactorBinding): string => JSON.stringify([
  binding.factor.factorKey,
  binding.factor.factorVersion,
  binding.subjectBinding.type,
  binding.subjectBinding.type === "FIXED"
    ? [binding.subjectBinding.subject.type, binding.subjectBinding.subject.key]
    : null,
  binding.evaluator.evaluatorId,
  binding.evaluator.evaluatorVersion,
  binding.evaluator.configurationId,
  binding.evaluator.configurationVersion,
  binding.relationshipType,
  binding.requirementLevel,
  binding.optionalBehavior,
]);

const cloneRulebook = (rulebook: CompiledRulebookDefinition): CompiledRulebookDefinition => Object.freeze({
  identity: Object.freeze({ ...rulebook.identity }),
  source: Object.freeze({ ...rulebook.source }),
  compilation: Object.freeze({
    ...rulebook.compilation,
    compiledAt: new Date(rulebook.compilation.compiledAt.getTime()),
  }),
  factorBindings: Object.freeze(rulebook.factorBindings.map(cloneBinding)),
  crossFactorPolicy: clonePolicy(rulebook.crossFactorPolicy),
  decisionPolicy: clonePolicy(rulebook.decisionPolicy),
});

const cloneBinding = (binding: CompiledFactorBinding): CompiledFactorBinding => Object.freeze({
  ...binding,
  factor: Object.freeze({ ...binding.factor }),
  subjectBinding: cloneSubjectBinding(binding.subjectBinding),
  evaluator: Object.freeze({ ...binding.evaluator }),
  provider: Object.freeze({ ...binding.provider }),
  executionPolicies: Object.freeze({ ...binding.executionPolicies }),
});

const cloneSubjectBinding = (binding: CompiledSubjectBinding): CompiledSubjectBinding => binding.type === "FIXED"
  ? Object.freeze({ type: "FIXED", subject: Object.freeze({ ...binding.subject }) })
  : Object.freeze({ type: binding.type });

const clonePolicy = (policy: CompiledPolicyLineage | null): CompiledPolicyLineage | null => policy === null
  ? null
  : Object.freeze({ ...policy });

const failure = (
  code: CompiledRulebookValidationFailureCode,
  path: string,
): CompiledRulebookValidationResult => Object.freeze({ valid: false, code, path });

const record = (value: unknown): value is UnknownRecord => typeof value === "object" && value !== null && !Array.isArray(value);
const identifier = (value: unknown): value is string => typeof value === "string"
  && value.length > 0
  && value.length <= MAX_COMPILED_RULEBOOK_IDENTIFIER_LENGTH
  && value.trim() === value
  && IDENTIFIER_PATTERN.test(value);
const positiveInteger = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
const nonNegativeInteger = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const validDate = (value: unknown): value is Date => value instanceof Date && Number.isFinite(value.getTime());
