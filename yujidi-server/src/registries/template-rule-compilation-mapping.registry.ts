import { EVIDENCE_SUBJECT_TYPES } from "../types/evidence.types.js";
import { FACTOR_KEYS, type FactorKey } from "../types/factor-registry.types.js";
import { classifyGenericFactorRelationship, GENERIC_FACTOR_RELATIONSHIP_TYPES } from "../types/generic-factor-relationship.types.js";
import { MISSING_DATA_POLICIES } from "../types/scoring.types.js";
import {
  TemplateRuleCompilationMappingRegistryError,
  type TemplateRuleCompilationMapping,
  type TemplateRuleCompilationMappingRegistry,
  type TemplateRuleCompilationMappingRegistryDependencies,
  type TemplateRuleMappingLookupResult,
} from "../types/template-rule-compilation-mapping.types.js";
import { ImmutableHistoricalAuthority, cloneAndFreeze } from "./historical-authority.internal.js";

const IDENTIFIER = /^[A-Z0-9_]{1,120}$/;
const EVALUATOR_KEY = /^[A-Z0-9_.:]{1,120}$/;
export const DEFAULT_TEMPLATE_RULE_COMPILATION_MAPPINGS: readonly TemplateRuleCompilationMapping[] = Object.freeze([]);

export class StaticTemplateRuleCompilationMappingRegistry
implements TemplateRuleCompilationMappingRegistry {
  private readonly authority: ImmutableHistoricalAuthority<TemplateRuleCompilationMapping>;
  private readonly eligibleByEvaluatorKey: ReadonlyMap<string, readonly TemplateRuleCompilationMapping[]>;

  public constructor(
    mappings: readonly TemplateRuleCompilationMapping[],
    dependencies: TemplateRuleCompilationMappingRegistryDependencies,
  ) {
    if (!Array.isArray(mappings) || !dense(mappings) || !validDependencies(dependencies)) fail("INVALID_MAPPING_COLLECTION");
    const entries = [];
    const identities = new Set<string>();
    const semantics = new Set<string>();
    const eligible = new Map<string, TemplateRuleCompilationMapping[]>();
    for (const raw of mappings as readonly unknown[]) {
      const mapping = validateStructure(raw);
      const identity = `${mapping.identity.mappingId}:${mapping.identity.mappingVersion}`;
      if (identities.has(identity)) fail("DUPLICATE_MAPPING_VERSION");
      identities.add(identity);
      validateReferences(mapping, dependencies);
      if (mapping.compileEligible) {
        const semantic = JSON.stringify({ ...mapping, identity: undefined, compileEligible: undefined });
        if (semantics.has(semantic)) fail("SEMANTIC_MAPPING_CONFLICT");
        semantics.add(semantic);
      }
      const snapshot = cloneAndFreeze(mapping);
      entries.push({ id: mapping.identity.mappingId, version: mapping.identity.mappingVersion, value: snapshot });
      if (mapping.compileEligible) {
        const found = eligible.get(mapping.source.evaluatorKey) ?? [];
        found.push(snapshot);
        eligible.set(mapping.source.evaluatorKey, found);
      }
    }
    for (const found of eligible.values()) Object.freeze(found);
    this.authority = new ImmutableHistoricalAuthority(entries);
    this.eligibleByEvaluatorKey = eligible;
  }

  public getExact(id: string, version: number) {
    return validId(id) && positive(version) ? this.authority.getExact(id, version) : null;
  }
  public getLatest(id: string) { return validId(id) ? this.authority.getLatest(id) : null; }
  public listVersions(id: string) { return validId(id) ? this.authority.listVersions(id) : Object.freeze([]); }
  public findBySourceEvaluatorKey(value: string): TemplateRuleMappingLookupResult {
    const key = normalizeEvaluatorKey(value);
    if (!key) return Object.freeze({ status: "NOT_FOUND" });
    const found = this.eligibleByEvaluatorKey.get(key) ?? [];
    if (found.length === 0) return Object.freeze({ status: "NOT_FOUND" });
    if (found.length === 1) return cloneAndFreeze({ status: "UNIQUE", mapping: found[0]! });
    return cloneAndFreeze({ status: "AMBIGUOUS", mappings: found });
  }
}

export const createDefaultTemplateRuleCompilationMappingRegistry =
  (dependencies: TemplateRuleCompilationMappingRegistryDependencies) =>
    new StaticTemplateRuleCompilationMappingRegistry(DEFAULT_TEMPLATE_RULE_COMPILATION_MAPPINGS, dependencies);

export const isTemplateRuleSourceCoordinate = (value: unknown): boolean => record(value)
  && nonNegative(value.sectionIndex) && normalizedKey(value.sectionKey)
  && nonNegative(value.evaluatorIndex) && normalizeEvaluatorKey(value.evaluatorKey) === value.evaluatorKey;

const validateStructure = (raw: unknown): TemplateRuleCompilationMapping => {
  ensure(record(raw), "INVALID_MAPPING_ID");
  ensure(record(raw.identity), "INVALID_MAPPING_ID");
  if (!validId(raw.identity.mappingId)) fail("INVALID_MAPPING_ID");
  if (!positive(raw.identity.mappingVersion)) fail("INVALID_MAPPING_VERSION");
  if (!record(raw.source)) fail("INVALID_SOURCE_EVALUATOR_KEY");
  const evaluatorKey = normalizeEvaluatorKey(raw.source.evaluatorKey);
  if (!evaluatorKey) fail("INVALID_SOURCE_EVALUATOR_KEY");
  if (!record(raw.factor) || !FACTOR_KEYS.includes(raw.factor.factorKey as FactorKey) || !positive(raw.factor.factorVersion)) fail("INVALID_FACTOR_REFERENCE");
  if (!validSubject(raw.subjectBinding)) fail("INVALID_SUBJECT_BINDING");
  if (!record(raw.evaluator) || !validId(raw.evaluator.evaluatorId) || !positive(raw.evaluator.evaluatorVersion)) fail("INVALID_EVALUATOR_REFERENCE");
  if (!validId(raw.evaluator.configurationId) || !positive(raw.evaluator.configurationVersion)) fail("INVALID_CONFIGURATION_REFERENCE");
  if (!GENERIC_FACTOR_RELATIONSHIP_TYPES.includes(raw.relationshipType as any)) fail("INVALID_RELATIONSHIP");
  validateMissingData(raw.missingDataMappings);
  if (!record(raw.weightPolicy) || raw.weightPolicy.type !== "USE_EFFECTIVE_TEMPLATE_WEIGHT") fail("INVALID_WEIGHT_POLICY");
  if (!record(raw.provider) || !validId(raw.provider.providerBindingId) || !positive(raw.provider.providerBindingVersion)) fail("INVALID_PROVIDER_BINDING_REFERENCE");
  if (!validId(raw.provider.resolutionPolicyId) || !positive(raw.provider.resolutionPolicyVersion)) fail("INVALID_RESOLUTION_POLICY_REFERENCE");
  if (!record(raw.executionPolicies) || !validId(raw.executionPolicies.aggregationPolicyId) || !positive(raw.executionPolicies.aggregationPolicyVersion)) fail("INVALID_AGGREGATION_POLICY_REFERENCE");
  if (!validId(raw.executionPolicies.normalizationPolicyId) || !positive(raw.executionPolicies.normalizationPolicyVersion)) fail("INVALID_NORMALIZATION_POLICY_REFERENCE");
  if (!validId(raw.executionPolicies.decisionBandPolicyId) || !positive(raw.executionPolicies.decisionBandPolicyVersion)) fail("INVALID_DECISION_BAND_POLICY_REFERENCE");
  if (typeof raw.compileEligible !== "boolean") fail("INVALID_COMPILE_ELIGIBILITY");
  const normalized = { ...raw, source: { evaluatorKey } } as unknown as TemplateRuleCompilationMapping;
  if (normalized.compileEligible && classifyGenericFactorRelationship(normalized.relationshipType)?.supportState !== "SINGLE_FACTOR_EXECUTABLE") fail("DEFERRED_RELATIONSHIP_NOT_COMPILE_ELIGIBLE");
  return normalized;
};

const validateMissingData = (value: unknown) => {
  ensure(Array.isArray(value) && value.length > 0 && dense(value), "INVALID_MISSING_DATA_MAPPING");
  const seen = new Set<string>();
  for (const item of value as unknown[]) {
    ensure(record(item) && MISSING_DATA_POLICIES.includes(item.sourcePolicy as any), "INVALID_MISSING_DATA_MAPPING");
    if (item.sourcePolicy === "ZERO") fail("ZERO_MISSING_DATA_POLICY_UNSUPPORTED");
    if (seen.has(item.sourcePolicy)) fail("DUPLICATE_MISSING_DATA_POLICY");
    seen.add(item.sourcePolicy);
    const valid = item.sourcePolicy === "BLOCK"
      ? item.requirementLevel === "MANDATORY" && item.optionalBehavior === null
      : item.sourcePolicy === "PARTIAL"
        ? item.requirementLevel === "OPTIONAL" && item.optionalBehavior === "PARTIAL"
        : item.requirementLevel === "OPTIONAL" && item.optionalBehavior === "OMIT";
    if (!valid) fail("INVALID_MISSING_DATA_MAPPING");
  }
};

const validateReferences = (m: TemplateRuleCompilationMapping, d: TemplateRuleCompilationMappingRegistryDependencies) => {
  const factor = d.factorDefinitions.getExact(m.factor.factorKey, m.factor.factorVersion);
  ensure(factor !== null, "FACTOR_NOT_FOUND");
  const evaluator = d.evaluatorDeclarations.getExact(m.evaluator.evaluatorId, m.evaluator.evaluatorVersion);
  ensure(evaluator !== null, "EVALUATOR_DECLARATION_NOT_FOUND");
  if (!evaluator.supportedFactorKeys.includes(m.factor.factorKey)) fail("EVALUATOR_FACTOR_INCOMPATIBLE");
  if (!evaluator.supportedRelationshipTypes.includes(m.relationshipType)) fail("EVALUATOR_RELATIONSHIP_INCOMPATIBLE");
  const configuration = d.evaluatorConfigurations.getExact(m.evaluator.configurationId, m.evaluator.configurationVersion);
  ensure(configuration !== null, "CONFIGURATION_NOT_FOUND");
  if (configuration.evaluatorId !== m.evaluator.evaluatorId || configuration.evaluatorVersion !== m.evaluator.evaluatorVersion) fail("CONFIGURATION_EVALUATOR_INCOMPATIBLE");
  if (!configuration.supportedFactorKeys.includes(m.factor.factorKey)) fail("CONFIGURATION_FACTOR_INCOMPATIBLE");
  if (!configuration.supportedRelationshipTypes.includes(m.relationshipType)) fail("CONFIGURATION_RELATIONSHIP_INCOMPATIBLE");
  const binding = d.providerBindings.getExact(m.provider.providerBindingId, m.provider.providerBindingVersion);
  ensure(binding !== null, "PROVIDER_BINDING_NOT_FOUND");
  if (binding.factorKey !== m.factor.factorKey || binding.factorVersion !== m.factor.factorVersion) fail("PROVIDER_BINDING_FACTOR_INCOMPATIBLE");
  const resolution = d.resolutionPolicies.getExact(m.provider.resolutionPolicyId, m.provider.resolutionPolicyVersion);
  ensure(resolution !== null, "RESOLUTION_POLICY_NOT_FOUND");
  const aggregation = d.aggregationPolicies.getExact(m.executionPolicies.aggregationPolicyId, m.executionPolicies.aggregationPolicyVersion);
  ensure(aggregation !== null, "AGGREGATION_POLICY_NOT_FOUND");
  const normalization = d.normalizationPolicies.getExact(m.executionPolicies.normalizationPolicyId, m.executionPolicies.normalizationPolicyVersion);
  ensure(normalization !== null, "NORMALIZATION_POLICY_NOT_FOUND");
  const bands = d.decisionBandPolicies.getExact(m.executionPolicies.decisionBandPolicyId, m.executionPolicies.decisionBandPolicyVersion);
  ensure(bands !== null, "DECISION_BAND_POLICY_NOT_FOUND");
  if (m.compileEligible && (!factor.compileEligible || !evaluator.compileEligible || !configuration.compileEligible
    || !binding.compileEligible || !resolution.compileEligible || !aggregation.compileEligible
    || !normalization.compileEligible || !bands.compileEligible)) fail("REFERENCE_NOT_COMPILE_ELIGIBLE");
};

const validDependencies = (d: unknown): d is TemplateRuleCompilationMappingRegistryDependencies => record(d)
  && [d.factorDefinitions, d.evaluatorDeclarations, d.evaluatorConfigurations, d.providerBindings,
    d.resolutionPolicies, d.aggregationPolicies, d.normalizationPolicies, d.decisionBandPolicies]
    .every((authority) => record(authority) && typeof authority.getExact === "function");
const validSubject = (v: unknown) => record(v) && (((v.type === "TRADED_INSTRUMENT" || v.type === "UNDERLYING_ASSET") && !Object.hasOwn(v, "subject"))
  || (v.type === "FIXED" && record(v.subject) && EVIDENCE_SUBJECT_TYPES.includes(v.subject.type as any)
    && typeof v.subject.key === "string" && v.subject.key.length > 0 && v.subject.key.length <= 160 && v.subject.key.trim() === v.subject.key));
const normalizeEvaluatorKey = (v: unknown) => {
  if (typeof v !== "string") return null;
  const normalized = v.trim().toUpperCase();
  return EVALUATOR_KEY.test(normalized) ? normalized : null;
};
const normalizedKey = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 120 && v.trim() === v;
const validId = (v: unknown): v is string => typeof v === "string" && IDENTIFIER.test(v) && v.trim() === v;
const positive = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) > 0;
const nonNegative = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
const record = (v: unknown): v is Record<string, any> => typeof v === "object" && v !== null && !Array.isArray(v);
const dense = (v: readonly unknown[]) => v.every((_, i) => i in v);
const fail = (code: ConstructorParameters<typeof TemplateRuleCompilationMappingRegistryError>[0]): never => { throw new TemplateRuleCompilationMappingRegistryError(code); };
function ensure(condition: unknown, code: ConstructorParameters<typeof TemplateRuleCompilationMappingRegistryError>[0]): asserts condition {
  if (!condition) fail(code);
}
