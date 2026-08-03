import { cloneAndFreeze } from "../registries/historical-authority.internal.js";
import { FACTOR_KEYS } from "../types/factor-registry.types.js";
import { INSTRUMENT_TYPES, MARKET_TYPES } from "../types/market-data.types.js";
import { MISSING_DATA_POLICIES, SCORING_TEMPLATE_STATUSES, SCORING_TEMPLATE_VISIBILITIES } from "../types/scoring.types.js";
import type { TemplateRuleCompilationMapping } from "../types/template-rule-compilation-mapping.types.js";
import type { CompilationCompatibilityDependencies, CompilationCompatibilityFailureCode, CompilationCompatibilityResult, ResolvedTemplateRuleBinding } from "../types/compiled-rulebook-compatibility.types.js";
import type { TemplateCompilationSnapshotInput } from "../types/canonical-template-snapshot.types.js";
import { CanonicalTemplateSnapshotService } from "./canonical-template-snapshot.service.js";

const ID = /^[A-Z0-9_.:-]{1,160}$/;
const EXECUTABLE = new Set(["DIRECT", "INVERSE"]);

export class CompiledRulebookCompatibilityValidationService {
  public constructor(
    private readonly dependencies: CompilationCompatibilityDependencies,
    private readonly snapshots = new CanonicalTemplateSnapshotService(),
  ) {}

  public validate(template: TemplateCompilationSnapshotInput): CompilationCompatibilityResult {
    const structural = validateTemplate(template);
    if (structural) return structural;
    const canonical = this.snapshots.create(template);
    if (!canonical.valid) return failure(canonical.code, canonical.path);
    const sections = canonical.snapshot.sections.filter((section) => section.enabled);
    if (sections.length === 0) return failure("NO_ENABLED_SECTIONS", "templateSnapshot.sections");
    if (!sections.some((section) => section.evaluators.some((evaluator) => evaluator.enabled))) return failure("NO_ENABLED_EVALUATORS", "templateSnapshot.sections");
    const bindings: ResolvedTemplateRuleBinding[] = [];
    const semantics = new Map<string, number>();
    for (const section of sections) {
      for (const evaluator of section.evaluators.filter((item) => item.enabled)) {
        const path = `templateSnapshot.sections[${section.sectionIndex}].evaluators[${evaluator.evaluatorIndex}]`;
        const lookup = this.dependencies.mappings.findBySourceEvaluatorKey(evaluator.evaluatorKey.trim().toUpperCase());
        if (lookup.status === "NOT_FOUND") return failure("TEMPLATE_RULE_MAPPING_NOT_FOUND", path);
        if (lookup.status === "AMBIGUOUS") return failure("TEMPLATE_RULE_MAPPING_AMBIGUOUS", path);
        if (!lookup.mapping.compileEligible) return failure("TEMPLATE_RULE_MAPPING_NOT_COMPILE_ELIGIBLE", path);
        const resolved = this.resolve(lookup.mapping, section, evaluator, path);
        if (!resolved.compatible) return resolved;
        const binding = resolved.specification.resolvedBindings[0]!;
        const key = semanticKey(binding);
        const priorWeight = semantics.get(key);
        if (priorWeight !== undefined) return failure(priorWeight === binding.source.effectiveWeight
          ? "SEMANTIC_BINDING_DUPLICATE" : "SEMANTIC_BINDING_WEIGHT_CONFLICT", path);
        semantics.set(key, binding.source.effectiveWeight);
        bindings.push(binding);
      }
    }
    return cloneAndFreeze({ compatible: true, specification: {
      sourceTemplate: {
        templateId: canonical.snapshot.templateId,
        templateVersion: canonical.snapshot.templateVersion,
        templateSnapshotHash: canonical.hash,
        templateKind: canonical.snapshot.templateKind,
        status: canonical.snapshot.status,
        visibility: canonical.snapshot.visibility,
        scope: canonical.snapshot.scope,
        aggregationMode: "WEIGHTED_SUM",
      },
      resolvedBindings: bindings,
      futureCrossFactorPolicy: null,
      futureDecisionPolicy: null,
    } });
  }

  private resolve(mapping: TemplateRuleCompilationMapping, section: any, evaluator: any, path: string): CompilationCompatibilityResult {
    const d = this.dependencies;
    const factor = d.factorDefinitions.getExact(mapping.factor.factorKey, mapping.factor.factorVersion);
    if (!factor) return failure("FACTOR_DEFINITION_NOT_FOUND", `${path}.factor`);
    if (!factor.compileEligible) return failure("FACTOR_REFERENCE_NOT_COMPILE_ELIGIBLE", `${path}.factor`);
    const declaration = d.evaluatorDeclarations.getExact(mapping.evaluator.evaluatorId, mapping.evaluator.evaluatorVersion);
    if (!declaration) return failure("EVALUATOR_DECLARATION_NOT_FOUND", `${path}.evaluator`);
    if (!declaration.compileEligible) return failure("EVALUATOR_REFERENCE_NOT_COMPILE_ELIGIBLE", `${path}.evaluator`);
    if (!declaration.supportedFactorKeys.includes(mapping.factor.factorKey)) return failure("EVALUATOR_FACTOR_INCOMPATIBLE", `${path}.evaluator`);
    if (!declaration.supportedRelationshipTypes.includes(mapping.relationshipType)) return failure("EVALUATOR_RELATIONSHIP_INCOMPATIBLE", `${path}.relationshipType`);
    const config = d.evaluatorConfigurations.getExact(mapping.evaluator.configurationId, mapping.evaluator.configurationVersion);
    if (!config) return failure("EVALUATOR_CONFIGURATION_NOT_FOUND", `${path}.configuration`);
    if (!config.compileEligible) return failure("CONFIGURATION_REFERENCE_NOT_COMPILE_ELIGIBLE", `${path}.configuration`);
    if (config.evaluatorId !== mapping.evaluator.evaluatorId || config.evaluatorVersion !== mapping.evaluator.evaluatorVersion) return failure("CONFIGURATION_EVALUATOR_INCOMPATIBLE", `${path}.configuration`);
    if (!config.supportedFactorKeys.includes(mapping.factor.factorKey)) return failure("CONFIGURATION_FACTOR_INCOMPATIBLE", `${path}.configuration`);
    if (!config.supportedRelationshipTypes.includes(mapping.relationshipType)) return failure("CONFIGURATION_RELATIONSHIP_INCOMPATIBLE", `${path}.configuration`);
    const binding = d.providerBindings.getExact(mapping.provider.providerBindingId, mapping.provider.providerBindingVersion);
    if (!binding) return failure("PROVIDER_BINDING_NOT_FOUND", `${path}.provider`);
    if (!binding.compileEligible) return failure("PROVIDER_BINDING_NOT_COMPILE_ELIGIBLE", `${path}.provider`);
    if (binding.factorKey !== mapping.factor.factorKey || binding.factorVersion !== mapping.factor.factorVersion) return failure("PROVIDER_BINDING_FACTOR_INCOMPATIBLE", `${path}.provider`);
    const resolution = d.resolutionPolicies.getExact(mapping.provider.resolutionPolicyId, mapping.provider.resolutionPolicyVersion);
    if (!resolution) return failure("RESOLUTION_POLICY_NOT_FOUND", `${path}.resolutionPolicy`);
    if (!resolution.compileEligible) return failure("RESOLUTION_POLICY_NOT_COMPILE_ELIGIBLE", `${path}.resolutionPolicy`);
    const aggregation = d.aggregationPolicies.getExact(mapping.executionPolicies.aggregationPolicyId, mapping.executionPolicies.aggregationPolicyVersion);
    if (!aggregation) return failure("AGGREGATION_POLICY_NOT_FOUND", `${path}.aggregationPolicy`);
    if (!aggregation.compileEligible) return failure("AGGREGATION_POLICY_NOT_COMPILE_ELIGIBLE", `${path}.aggregationPolicy`);
    const normalization = d.normalizationPolicies.getExact(mapping.executionPolicies.normalizationPolicyId, mapping.executionPolicies.normalizationPolicyVersion);
    if (!normalization) return failure("NORMALIZATION_POLICY_NOT_FOUND", `${path}.normalizationPolicy`);
    if (!normalization.compileEligible) return failure("NORMALIZATION_POLICY_NOT_COMPILE_ELIGIBLE", `${path}.normalizationPolicy`);
    const bands = d.decisionBandPolicies.getExact(mapping.executionPolicies.decisionBandPolicyId, mapping.executionPolicies.decisionBandPolicyVersion);
    if (!bands) return failure("DECISION_BAND_POLICY_NOT_FOUND", `${path}.decisionBandPolicy`);
    if (!bands.compileEligible) return failure("DECISION_BAND_POLICY_NOT_COMPILE_ELIGIBLE", `${path}.decisionBandPolicy`);
    if (!EXECUTABLE.has(mapping.relationshipType)) return failure("DEFERRED_RELATIONSHIP_NOT_EXECUTABLE", `${path}.relationshipType`);
    if (section.missingDataPolicy === "ZERO") return failure("UNSUPPORTED_LEGACY_ZERO_MISSING_DATA", `${path}.missingDataPolicy`);
    const translation = mapping.missingDataMappings.find((item) => item.sourcePolicy === section.missingDataPolicy);
    if (!translation) return failure("MISSING_DATA_MAPPING_NOT_FOUND", `${path}.missingDataPolicy`);
    const effectiveWeight = section.weight * evaluator.weight / 100;
    if (!Number.isFinite(effectiveWeight) || effectiveWeight <= 0 || effectiveWeight > 100 || Object.is(effectiveWeight, -0)) return failure("INVALID_EFFECTIVE_WEIGHT", `${path}.weight`);
    const resolved: ResolvedTemplateRuleBinding = {
      sourceRule: { sectionIndex: section.sectionIndex, sectionKey: section.sectionKey, evaluatorIndex: evaluator.evaluatorIndex, evaluatorKey: evaluator.evaluatorKey },
      source: { sectionWeight: section.weight, evaluatorWeight: evaluator.weight, effectiveWeight,
        sectionMissingDataPolicy: section.missingDataPolicy, evaluatorMissingDataPolicy: evaluator.evaluatorMissingDataPolicy,
        legacyEffectiveMissingDataPolicy: section.missingDataPolicy, sourceConfiguration: evaluator.config },
      mapping: { mappingId: mapping.identity.mappingId, mappingVersion: mapping.identity.mappingVersion },
      factor: mapping.factor, subjectBinding: mapping.subjectBinding, evaluator: mapping.evaluator,
      relationshipType: mapping.relationshipType,
      requirement: { requirementLevel: translation.requirementLevel, optionalBehavior: translation.optionalBehavior },
      provider: mapping.provider, executionPolicies: mapping.executionPolicies,
    };
    return cloneAndFreeze({ compatible: true, specification: { sourceTemplate: null as never, resolvedBindings: [resolved], futureCrossFactorPolicy: null, futureDecisionPolicy: null } });
  }
}

const validateTemplate = (t: unknown): CompilationCompatibilityResult | null => {
  if (!record(t)) return failure("INVALID_COMPATIBILITY_REQUEST", "templateSnapshot");
  if (typeof t.templateId !== "string" || !ID.test(t.templateId) || t.templateId.trim() !== t.templateId) return failure("INVALID_TEMPLATE_ID", "templateSnapshot.templateId");
  if (!positive(t.templateVersion)) return failure("INVALID_TEMPLATE_VERSION", "templateSnapshot.templateVersion");
  if (t.templateKind !== "SYSTEM" && t.templateKind !== "USER") return failure("INVALID_TEMPLATE_KIND", "templateSnapshot.templateKind");
  if (!SCORING_TEMPLATE_STATUSES.includes(t.status as any) || t.status === "ARCHIVED") return failure("TEMPLATE_STATUS_NOT_COMPILE_ELIGIBLE", "templateSnapshot.status");
  if (t.templateKind === "SYSTEM" ? t.visibility !== null : !SCORING_TEMPLATE_VISIBILITIES.includes(t.visibility as any)) return failure("INVALID_TEMPLATE_VISIBILITY", "templateSnapshot.visibility");
  if (!record(t.scope) || !MARKET_TYPES.includes(t.scope.marketType as any) || !INSTRUMENT_TYPES.includes(t.scope.instrumentType as any)
    || typeof t.scope.tradeStyle !== "string" || t.scope.tradeStyle.length === 0 || t.scope.tradeStyle.trim() !== t.scope.tradeStyle
    || !Array.isArray(t.scope.allowedTradableSymbols) || !t.scope.allowedTradableSymbols.every((v: unknown) => typeof v === "string" && v.length > 0 && v.trim() === v)) return failure("INVALID_TEMPLATE_SCOPE", "templateSnapshot.scope");
  if (t.aggregationMode !== "WEIGHTED_SUM") return failure("UNSUPPORTED_AGGREGATION_MODE", "templateSnapshot.aggregationMode");
  if (!Array.isArray(t.sections) || t.sections.length === 0 || !dense(t.sections)) return failure("INVALID_SECTION", "templateSnapshot.sections");
  for (let si = 0; si < t.sections.length; si++) {
    const s = t.sections[si];
    if (!record(s) || typeof s.sectionKey !== "string" || s.sectionKey.length === 0 || s.sectionKey.trim() !== s.sectionKey
      || !weight(s.weight) || typeof s.enabled !== "boolean" || !MISSING_DATA_POLICIES.includes(s.missingDataPolicy as any)
      || !Array.isArray(s.evaluators) || s.evaluators.length === 0 || !dense(s.evaluators)) return failure("INVALID_SECTION", `templateSnapshot.sections[${si}]`);
    for (let ei = 0; ei < s.evaluators.length; ei++) {
      const e = s.evaluators[ei];
      if (!record(e) || typeof e.evaluatorKey !== "string" || e.evaluatorKey.trim().length === 0 || typeof e.label !== "string"
        || e.label.trim().length === 0 || !weight(e.weight) || typeof e.enabled !== "boolean"
        || (e.missingDataPolicy !== undefined && !MISSING_DATA_POLICIES.includes(e.missingDataPolicy as any))
        || (e.config !== undefined && !record(e.config))) return failure("INVALID_EVALUATOR_ENTRY", `templateSnapshot.sections[${si}].evaluators[${ei}]`);
    }
    if (s.enabled) {
      const enabled = s.evaluators.filter((e: any) => e.enabled);
      if (enabled.length > 0 && !near100(enabled.reduce((n: number, e: any) => n + e.weight, 0))) return failure("INVALID_EVALUATOR_ENTRY", `templateSnapshot.sections[${si}].evaluators`);
    }
  }
  const enabledSections = t.sections.filter((s: any) => s.enabled);
  if (enabledSections.length > 0 && !near100(enabledSections.reduce((n: number, s: any) => n + s.weight, 0))) return failure("INVALID_SECTION", "templateSnapshot.sections");
  return null;
};
const semanticKey = (b: ResolvedTemplateRuleBinding) => JSON.stringify([b.factor, b.subjectBinding, b.evaluator, b.relationshipType, b.requirement, b.provider, b.executionPolicies]);
const failure = (code: CompilationCompatibilityFailureCode, path: string): CompilationCompatibilityResult => Object.freeze({ compatible: false, code, path });
const record = (v: unknown): v is Record<string, any> => typeof v === "object" && v !== null && !Array.isArray(v);
const positive = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) > 0;
const weight = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0 && v <= 100;
const dense = (v: readonly unknown[]) => v.every((_, i) => i in v);
const near100 = (v: number) => Math.abs(Number(v.toFixed(4)) - 100) <= 0.0001;
