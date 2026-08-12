import { CompiledGenericRelationshipEvaluator } from "../services/compiled-rulebook/compiled-generic-relationship-evaluator.js";
import { FactorAggregateNormalizationPolicyService } from "../services/scoring/factor-aggregate-normalization-policy.service.js";
import { FactorContributionAggregationPolicyService } from "../services/scoring/factor-contribution-aggregation-policy.service.js";
import { FactorDecisionBandPolicyService } from "../services/scoring/factor-decision-band-policy.service.js";
import { ProviderCatalogService } from "../services/providers/provider-catalog.service.js";
import { ProviderResolutionPolicyService } from "../services/providers/provider-resolution-policy.service.js";
import type { TemplateCompilationSnapshotInput } from "../types/canonical-template-snapshot.types.js";
import type { TemplateRuleCompilationMapping } from "../types/template-rule-compilation-mapping.types.js";
import { BTC_ETF_FLOW_CHARACTERIZATION_PROVIDER, createDefaultProviderAuthorityRegistry } from "./provider-authority.registry.js";
import { StaticCompiledEvaluatorImplementationRegistry } from "./compiled-evaluator-implementation.registry.js";
import { StaticEvaluatorConfigurationRegistry } from "./evaluator-configuration.registry.js";
import { StaticFactorRegistry } from "./factor.registry.js";
import { DEFAULT_FACTOR_DEFINITIONS } from "./default-factor-definitions.js";
import { StaticTemplateRuleCompilationMappingRegistry } from "./template-rule-compilation-mapping.registry.js";
import { StaticVersionedAggregationPolicyRegistry } from "./versioned-aggregation-policy.registry.js";
import { StaticVersionedCompiledRulebookAggregationPolicyRegistry } from "./versioned-compiled-rulebook-aggregation-policy.registry.js";
import { StaticVersionedDecisionBandPolicyRegistry } from "./versioned-decision-band-policy.registry.js";
import { StaticVersionedEvaluatorDeclarationRegistry, DEFAULT_VERSIONED_EVALUATOR_DECLARATIONS } from "./versioned-evaluator-declaration.registry.js";
import { StaticVersionedFactorDefinitionRegistry, DEFAULT_VERSIONED_FACTOR_DEFINITIONS } from "./versioned-factor-definition.registry.js";
import { StaticVersionedNormalizationPolicyRegistry } from "./versioned-normalization-policy.registry.js";
import { StaticVersionedProviderBindingRegistry } from "./versioned-provider-binding.registry.js";
import { StaticVersionedProviderResolutionPolicyRegistry } from "./versioned-provider-resolution-policy.registry.js";

export const BTC_ETF_FLOW_AUTHORITY_IDS = Object.freeze({
  templateKey: "CRYPTO_BTC_ETF_FLOW_DAILY_V1",
  providerBindingId: "BTC_ETF_FLOW_CHARACTERIZATION_BINDING",
  resolutionPolicyId: "BTC_ETF_FLOW_CHARACTERIZATION_RESOLUTION",
  configurationId: "BTC_ETF_FLOW_DIRECT_CHARACTERIZATION",
  mappingId: "BTC_ETF_FLOW_CHARACTERIZATION_MAPPING",
  aggregationPolicyId: "BTC_ETF_FLOW_CHARACTERIZATION_AGGREGATION",
  normalizationPolicyId: "BTC_ETF_FLOW_CHARACTERIZATION_NORMALIZATION",
  decisionBandPolicyId: "BTC_ETF_FLOW_CHARACTERIZATION_DECISION_BANDS",
} as const);

const executionPlan = Object.freeze({ planId: "BTC_ETF_FLOW_CHARACTERIZATION_PLAN", planVersion: 1, factorKey: "CRYPTO.ETF_NET_FLOW" as const, failurePolicy: "CONTINUE_ALWAYS" as const, steps: Object.freeze([{ order: 1, evaluatorId: "GENERIC_RELATIONSHIP_FACTOR_EVALUATOR", evaluatorVersion: 1, configurationVersion: 1, supportedFactorKeys: Object.freeze(["CRYPTO.ETF_NET_FLOW"] as const) }]) });
export const BTC_ETF_FLOW_EVALUATOR_CONFIGURATION = Object.freeze({ configurationType: "GENERIC_RELATIONSHIP" as const, configurationId: BTC_ETF_FLOW_AUTHORITY_IDS.configurationId, configurationVersion: 1, evaluatorId: "GENERIC_RELATIONSHIP_FACTOR_EVALUATOR" as const, evaluatorVersion: 1 as const, supportedFactorKeys: Object.freeze(["CRYPTO.ETF_NET_FLOW"] as const), supportedRelationshipTypes: Object.freeze(["DIRECT"] as const), compileEligible: true, configuration: Object.freeze({ relationshipType: "DIRECT" as const, expectedUnit: "USD", thresholds: Object.freeze({ strongNegativeMax: -300, negativeMax: -100, positiveMin: 100, strongPositiveMin: 300 }), contributions: Object.freeze({ strongNegative: -2, negative: -1, neutral: 0, positive: 1, strongPositive: 2 }), minimumPoints: -2, maximumPoints: 2 }) });
const factorAggregation = Object.freeze({ policyId: BTC_ETF_FLOW_AUTHORITY_IDS.aggregationPolicyId, policyVersion: 1, planId: executionPlan.planId, planVersion: 1, factorKey: "CRYPTO.ETF_NET_FLOW" as const, method: "WEIGHTED_SUM" as const, bounds: Object.freeze({ minimumPoints: -2, maximumPoints: 2 }), entries: Object.freeze([{ order: 1, evaluatorId: "GENERIC_RELATIONSHIP_FACTOR_EVALUATOR", evaluatorVersion: 1, configurationVersion: 1, weight: 1 }]) });
const normalizedAggregation = Object.freeze({ ...factorAggregation, outcomeEligibility: Object.freeze({ PASS: "ELIGIBLE" as const, FAIL: "ELIGIBLE" as const, NEUTRAL: "ELIGIBLE" as const, UNAVAILABLE: "INELIGIBLE" as const }) });
export const BTC_ETF_FLOW_NORMALIZATION_POLICY = Object.freeze({ normalizationPolicyId: BTC_ETF_FLOW_AUTHORITY_IDS.normalizationPolicyId, normalizationPolicyVersion: 1, aggregationPolicyId: BTC_ETF_FLOW_AUTHORITY_IDS.aggregationPolicyId, aggregationPolicyVersion: 1, factorKey: "CRYPTO.ETF_NET_FLOW" as const, method: "PIECEWISE_LINEAR_ZERO_ANCHORED" as const, sourceRange: Object.freeze({ minimumPoints: -2, neutralPoints: 0 as const, maximumPoints: 2 }), targetRange: Object.freeze({ minimumScore: 0, neutralScore: 50, maximumScore: 100 }), outOfRangePolicy: "FAIL" as const, precisionPolicy: "PRESERVE_NATIVE" as const });
export const BTC_ETF_FLOW_DECISION_BAND_POLICY = Object.freeze({ decisionBandPolicyId: BTC_ETF_FLOW_AUTHORITY_IDS.decisionBandPolicyId, decisionBandPolicyVersion: 1, normalizationPolicyId: BTC_ETF_FLOW_AUTHORITY_IDS.normalizationPolicyId, normalizationPolicyVersion: 1, factorKey: "CRYPTO.ETF_NET_FLOW" as const, normalizedRange: Object.freeze({ minimumScore: 0, maximumScore: 100 }), bands: Object.freeze(["STRONG_NEGATIVE", "NEGATIVE", "NEUTRAL", "POSITIVE", "STRONG_POSITIVE"].map((label, index) => Object.freeze({ order: index + 1, label, minimumScore: index * 20, maximumScore: (index + 1) * 20, minimumInclusive: true, maximumInclusive: index === 4 }))) });
export const BTC_ETF_FLOW_COMPILED_AGGREGATION_POLICY = Object.freeze({ policyId: BTC_ETF_FLOW_AUTHORITY_IDS.aggregationPolicyId, policyVersion: 1, strategy: "COMPILED_WEIGHTED_MEAN" as const, partialWeightBehavior: "RETAIN_IN_DENOMINATOR" as const, omittedWeightBehavior: "REMOVE_FROM_DENOMINATOR" as const, compileEligible: true });
export const BTC_ETF_FLOW_PROVIDER_BINDING = Object.freeze({ providerBindingId: BTC_ETF_FLOW_AUTHORITY_IDS.providerBindingId, providerBindingVersion: 1, factorKey: "CRYPTO.ETF_NET_FLOW" as const, factorVersion: 1, orderedProviderKeys: Object.freeze([BTC_ETF_FLOW_CHARACTERIZATION_PROVIDER.providerDefinition.providerKey]), compileEligible: true, liveExecutionEligible: false, replayFixtureEligible: true });
export const BTC_ETF_FLOW_RESOLUTION_POLICY = Object.freeze({ policyId: BTC_ETF_FLOW_AUTHORITY_IDS.resolutionPolicyId, policyVersion: 1, factorKey: "CRYPTO.ETF_NET_FLOW" as const, preferredProviderRule: Object.freeze({ allowedStates: Object.freeze(["HEALTHY"] as const) }), fallbackProviderRule: Object.freeze({ allowedStates: Object.freeze(["HEALTHY"] as const) }), allowDegradedPreferredProvider: false, noUsableProviderOutcome: "UNRESOLVED" as const, confidenceAdjustments: Object.freeze({ resolved: 0, degradedPrimaryUsed: -0.1, fallbackUsed: -0.2, proxyUsed: -0.3, manualRequired: -0.4, unresolved: -0.5 }) });
export const BTC_ETF_FLOW_TEMPLATE_RULE_MAPPING: TemplateRuleCompilationMapping = Object.freeze({ identity: Object.freeze({ mappingId: BTC_ETF_FLOW_AUTHORITY_IDS.mappingId, mappingVersion: 1 }), source: Object.freeze({ evaluatorKey: "GENERIC_FACTOR:CRYPTO.ETF_NET_FLOW" }), factor: Object.freeze({ factorKey: "CRYPTO.ETF_NET_FLOW", factorVersion: 1 }), subjectBinding: Object.freeze({ type: "FIXED", subject: Object.freeze({ type: "ASSET", key: "BTC" }) }), evaluator: Object.freeze({ evaluatorId: "GENERIC_RELATIONSHIP_FACTOR_EVALUATOR", evaluatorVersion: 1, configurationId: BTC_ETF_FLOW_AUTHORITY_IDS.configurationId, configurationVersion: 1 }), relationshipType: "DIRECT", missingDataMappings: Object.freeze([{ sourcePolicy: "BLOCK", requirementLevel: "MANDATORY", optionalBehavior: null }, { sourcePolicy: "PARTIAL", requirementLevel: "OPTIONAL", optionalBehavior: "PARTIAL" }, { sourcePolicy: "IGNORE", requirementLevel: "OPTIONAL", optionalBehavior: "OMIT" }] as const), weightPolicy: Object.freeze({ type: "USE_EFFECTIVE_TEMPLATE_WEIGHT" }), provider: Object.freeze({ providerBindingId: BTC_ETF_FLOW_AUTHORITY_IDS.providerBindingId, providerBindingVersion: 1, resolutionPolicyId: BTC_ETF_FLOW_AUTHORITY_IDS.resolutionPolicyId, resolutionPolicyVersion: 1 }), executionPolicies: Object.freeze({ aggregationPolicyId: BTC_ETF_FLOW_AUTHORITY_IDS.aggregationPolicyId, aggregationPolicyVersion: 1, normalizationPolicyId: BTC_ETF_FLOW_AUTHORITY_IDS.normalizationPolicyId, normalizationPolicyVersion: 1, decisionBandPolicyId: BTC_ETF_FLOW_AUTHORITY_IDS.decisionBandPolicyId, decisionBandPolicyVersion: 1 }), compileEligible: true });

export const BTC_ETF_FLOW_TEMPLATE_SNAPSHOT: TemplateCompilationSnapshotInput = Object.freeze({ templateId: BTC_ETF_FLOW_AUTHORITY_IDS.templateKey, templateVersion: 1, templateKind: "SYSTEM", status: "ACTIVE", visibility: null, scope: Object.freeze({ marketType: "CRYPTO", tradeStyle: "DAILY", instrumentType: "SPOT", allowedTradableSymbols: Object.freeze([]) }), aggregationMode: "WEIGHTED_SUM", sections: Object.freeze([{ sectionKey: "ETF_FLOW_CONTEXT", weight: 100, enabled: true, missingDataPolicy: "BLOCK" as const, evaluators: Object.freeze([{ evaluatorKey: "GENERIC_FACTOR:CRYPTO.ETF_NET_FLOW", label: "BTC ETF-flow context", weight: 100, enabled: true, missingDataPolicy: "BLOCK" as const, config: Object.freeze({ characterizationOnly: true, productionCalibrated: false }) }]) }]) });

export const createBtcEtfFlowCompilationAuthorities = () => {
  const catalogResult = new ProviderCatalogService().validate({ providers: [BTC_ETF_FLOW_CHARACTERIZATION_PROVIDER.providerDefinition], bindings: [] });
  if (!catalogResult.valid) throw new Error(`Invalid characterization provider: ${catalogResult.code}`);
  const factorRegistry = new StaticFactorRegistry(DEFAULT_FACTOR_DEFINITIONS);
  const factorDefinitions = new StaticVersionedFactorDefinitionRegistry(DEFAULT_VERSIONED_FACTOR_DEFINITIONS);
  const evaluatorDeclarations = new StaticVersionedEvaluatorDeclarationRegistry(DEFAULT_VERSIONED_EVALUATOR_DECLARATIONS);
  const evaluatorConfigurations = new StaticEvaluatorConfigurationRegistry([BTC_ETF_FLOW_EVALUATOR_CONFIGURATION]);
  const providerBindings = new StaticVersionedProviderBindingRegistry([BTC_ETF_FLOW_PROVIDER_BINDING], { catalog: catalogResult.catalog, factorRegistry });
  const resolutionPolicies = new StaticVersionedProviderResolutionPolicyRegistry([{ definition: BTC_ETF_FLOW_RESOLUTION_POLICY, compileEligible: true, liveExecutionEligible: false, replayFixtureEligible: true }], new ProviderResolutionPolicyService());
  const aggregationPolicies = new StaticVersionedAggregationPolicyRegistry([{ definition: factorAggregation, plan: executionPlan, compileEligible: true }], new FactorContributionAggregationPolicyService());
  const normalizationPolicies = new StaticVersionedNormalizationPolicyRegistry([{ definition: BTC_ETF_FLOW_NORMALIZATION_POLICY, aggregationPolicy: normalizedAggregation, compileEligible: true }], new FactorAggregateNormalizationPolicyService());
  const decisionBandPolicies = new StaticVersionedDecisionBandPolicyRegistry([{ definition: BTC_ETF_FLOW_DECISION_BAND_POLICY as never, normalizationPolicy: BTC_ETF_FLOW_NORMALIZATION_POLICY, compileEligible: true }], new FactorDecisionBandPolicyService());
  const providerAuthorities = createDefaultProviderAuthorityRegistry();
  const dependencies = { factorDefinitions, evaluatorDeclarations, evaluatorConfigurations, providerBindings, resolutionPolicies, aggregationPolicies, normalizationPolicies, decisionBandPolicies, providerAuthorities };
  return Object.freeze({ ...dependencies, mappings: new StaticTemplateRuleCompilationMappingRegistry([BTC_ETF_FLOW_TEMPLATE_RULE_MAPPING], dependencies), compiledAggregationPolicies: new StaticVersionedCompiledRulebookAggregationPolicyRegistry([BTC_ETF_FLOW_COMPILED_AGGREGATION_POLICY]), evaluatorImplementations: new StaticCompiledEvaluatorImplementationRegistry([new CompiledGenericRelationshipEvaluator()]) });
};
