import { factorRegistry } from "../../src/registries/factor.registry.js";
import { BTC_ETF_FLOW_AUTHORITY_IDS, BTC_ETF_FLOW_EVALUATOR_CONFIGURATION } from "../../src/registries/btc-etf-flow-characterization.authorities.js";
import { CompiledLegacyParityComparisonService } from "../../src/services/compiled-legacy-parity-comparison.service.js";
import { GenericFactorCompatibilityDispatcher, GenericFactorLegacyResultAdapter } from "../../src/services/generic-factor-legacy-compatibility.service.js";
import { GenericRelationshipFactorEvaluator } from "../../src/services/generic-relationship-factor-evaluator.js";
import { ScoringEngineService, type ScoringEngineInput, type ScoringEngineResult } from "../../src/services/scoring-engine.service.js";
import { ScoringTemplateRegistryService } from "../../src/services/scoring-template-registry.service.js";
import type { CompiledLegacyParityPolicy, CompiledLegacyParityResult } from "../../src/types/compiled-legacy-parity.types.js";
import type { CompiledShadowExecutionOutcome } from "../../src/types/compiled-shadow-execution.types.js";
import type { AssembledFactorInput } from "../../src/types/factor-input-assembly.types.js";
import type { ResolvedScoringTemplateDefinition } from "../../src/types/scoring.types.js";
import { createBtcEtfRuntimeHarness, createEtfEvidence, type EtfRuntimeOptions, ETF_RUNTIME_TIMES } from "./btc-etf-flow-compiled-runtime.fixture.js";

export const BTC_ETF_FLOW_PARITY_POLICY: CompiledLegacyParityPolicy = deepFreeze({
  policyId: "BTC_ETF_FLOW_LEGACY_COMPILED_PARITY",
  policyVersion: 1,
  numeric: { enabled: true, legacySource: "SCORE", compiledSource: "NORMALIZED_SCORE", canonicalization: { method: "DECIMAL_PLACES", decimalPlaces: 2 }, comparison: "EXACT", forcedLegacyValueHandling: "REQUIRE_EXPLICIT_ELIGIBILITY" },
  semanticDimensions: [
    { dimensionId: "PERMISSION_TO_DECISION_BAND", legacySource: "PERMISSION", compiledSource: "DECISION_BAND", mappings: [
      { legacyValue: "TAKE_TRADE", compiledValue: "POSITIVE", outcome: "MATCH" },
      { legacyValue: "WAIT", compiledValue: "NEUTRAL", outcome: "MATCH" },
      { legacyValue: "REJECT", compiledValue: "NEGATIVE", outcome: "MATCH" },
      { legacyValue: "REJECT", compiledValue: "POSITIVE", outcome: "MISMATCH" },
    ] },
    { dimensionId: "SCORE_STATUS_TO_EXECUTION_STATUS", legacySource: "SCORE_STATUS", compiledSource: "EXECUTION_STATUS", mappings: [
      { legacyValue: "READY", compiledValue: "COMPLETED", outcome: "MATCH" },
      { legacyValue: "UNAVAILABLE", compiledValue: "COMPLETED", outcome: "MISMATCH" },
    ] },
  ],
});

export type BtcEtfFlowReplayReport = Readonly<{
  replayIdentity: Readonly<{ replayId: string; replayVersion: number; sourceTemplateId: string; sourceTemplateVersion: number; compiledRulebookId: string; compiledRulebookVersion: number; executionBindingId: string; executionBindingVersion: number; asOf: Date }>;
  input: Readonly<{ factorKey: string; subjectType: string; subjectKey: string; value: number | null; unit: string; characterizationOnly: true }>;
  legacy: Readonly<{ score: number; permission: string; scoreStatus: string; dataConfidence: string }>;
  compiled: Readonly<{ status: string; normalizedScore: number | null; decisionBand: string | null }>;
  parity: Readonly<{ comparability: string; numericOutcome: string; semanticOutcomes: readonly Readonly<{ dimension: string; outcome: string }>[] }>;
  lineage: Readonly<{ evaluatorConfigurationId: string; providerBindingId: string; resolutionPolicyId: string; aggregationPolicyId: string; normalizationPolicyId: string; decisionPolicyId: string }>;
  diagnostics: readonly string[];
}>;

export type BtcEtfReplayOptions = Readonly<{
  value?: number;
  legacyValue?: number;
  omitLegacyInput?: boolean;
  rewardRiskRatio?: number;
  compiled?: EtfRuntimeOptions;
  policy?: CompiledLegacyParityPolicy;
}>;

export type BtcEtfReplayResult = Readonly<{
  legacy: ScoringEngineResult;
  compiled: CompiledShadowExecutionOutcome;
  parity: Readonly<{ status: "COMPLETED"; result: CompiledLegacyParityResult }> | Readonly<{ status: "UNAVAILABLE"; reasonCode: string; overallComparability: "NOT_COMPARABLE" }>;
  report: BtcEtfFlowReplayReport;
  calls: Readonly<{ legacyExecution: number; compiledExecution: number; parity: number; scoreCheckWrites: 0; productionWrites: 0; providerExecution: 0 }>;
}>;

export const createLegacyFactorInput = (value: number): AssembledFactorInput => ({
  factorKey: "CRYPTO.ETF_NET_FLOW",
  factorDefinitionVersion: 1,
  subject: { type: "ASSET", key: "BTC" },
  evidenceId: "LEGACY_ETF_FLOW_EXPLICIT_INPUT",
  value: { type: "NUMBER", value, unit: "USD" },
  source: { sourceType: "TEST_REPLAY", provider: "TEST_OWNED_EXPLICIT_INPUT", sourceId: "A6_REPLAY_V1", priority: null },
  observedAt: new Date(ETF_RUNTIME_TIMES.observedAt),
  evaluatedAt: new Date(ETF_RUNTIME_TIMES.asOf),
  confidence: 0.9,
  freshness: { status: "FRESH", ageMs: 600_000, maxAgeMs: 86_400_000 },
});

export const runBtcEtfLegacyCompiledReplay = async (options: BtcEtfReplayOptions = {}): Promise<BtcEtfReplayResult> => {
  const value = options.value ?? 200;
  const legacyValue = options.legacyValue ?? value;
  const calls = { legacyExecution: 0, compiledExecution: 0, parity: 0, scoreCheckWrites: 0 as const, productionWrites: 0 as const, providerExecution: 0 as const };
  const registration = new ScoringTemplateRegistryService().getExact(BTC_ETF_FLOW_AUTHORITY_IDS.templateKey, 1);
  const legacyRequest: ScoringEngineInput = {
    scoringTemplateKey: registration.template.key as never,
    scoringTemplateVersion: String(registration.template.version),
    resolvedTemplate: resolvedTemplate(registration.template),
    marketType: registration.template.marketType,
    tradeStyle: registration.template.tradeStyle,
    instrumentType: registration.template.instrumentType,
    rewardRiskRatio: options.rewardRiskRatio ?? 2,
    evaluatedAt: new Date(ETF_RUNTIME_TIMES.asOf),
    ...(!options.omitLegacyInput ? { genericFactorInputs: { "CRYPTO.ETF_NET_FLOW": { relationshipType: "DIRECT", input: createLegacyFactorInput(legacyValue) } } } : {}),
  };
  const compatibility = new GenericFactorCompatibilityDispatcher({ enabled: true, factorRegistry, adapter: new GenericFactorLegacyResultAdapter() });
  const scorer = new ScoringEngineService(undefined, undefined, {
    featureFlags: { isEnabled: (key) => key === "GENERIC_EVALUATOR_ENABLED" },
    genericCompatibility: compatibility,
    genericExecution: { execute: ({ input }) => { calls.legacyExecution += 1; return new GenericRelationshipFactorEvaluator(BTC_ETF_FLOW_EVALUATOR_CONFIGURATION.configuration).evaluate(input); } },
  });
  const legacy = scorer.score(legacyRequest);
  const compiledOptions = options.compiled ?? { evidence: [createEtfEvidence({ value: { type: "NUMBER", numberValue: value, unit: "USD" } })] };
  const compiledHarness = createBtcEtfRuntimeHarness(compiledOptions);
  calls.compiledExecution += 1;
  const compiled = await compiledHarness.execute();
  let parity: BtcEtfReplayResult["parity"];
  if (compiled.status === "COMPLETED") {
    calls.parity += 1;
    const compared = new CompiledLegacyParityComparisonService().compare({
      policy: options.policy ?? BTC_ETF_FLOW_PARITY_POLICY,
      legacy,
      compiled: compiled.compiledExecution,
      legacyNumericEligibility: { eligible: legacy.scoreStatus !== "UNAVAILABLE" && (options.rewardRiskRatio ?? 2) >= 1, reasonCode: legacy.scoreStatus === "UNAVAILABLE" ? "LEGACY_SCORE_UNAVAILABLE" : (options.rewardRiskRatio ?? 2) < 1 ? "LEGACY_REWARD_RISK_FORCED_VALUE" : null },
    });
    if (!compared.compared) throw new Error(`Parity comparison failed: ${compared.code}`);
    parity = deepFreeze({ status: "COMPLETED", result: compared.result });
  } else {
    parity = deepFreeze({ status: "UNAVAILABLE", reasonCode: "COMPILED_EXECUTION_UNAVAILABLE", overallComparability: "NOT_COMPARABLE" });
  }
  return deepFreeze({ legacy, compiled, parity, report: report(value, legacy, compiled, parity), calls });
};

const resolvedTemplate = (template: ReturnType<ScoringTemplateRegistryService["getExact"]>["template"]): ResolvedScoringTemplateDefinition => ({
  templateKey: template.key,
  baseTemplateKey: template.key as never,
  templateName: template.key,
  scope: "SYSTEM",
  version: template.version,
  marketType: template.marketType,
  tradeStyle: template.tradeStyle,
  instrumentType: template.instrumentType,
  maxScore: template.maxScore,
  aggregationMode: template.aggregationMode ?? "NORMALIZE_EXECUTED",
  permissionThresholds: { rejectBelow: 40, waitBelow: 60, takeSmallRiskBelow: 75, takeTradeAtOrAbove: 75 },
  sections: template.sections.map((section) => ({ sectionKey: section.key, label: section.label, weight: section.weight, enabled: true, missingDataPolicy: section.missingDataPolicy, evaluators: section.evaluators.map((evaluatorKey) => ({ evaluatorKey, label: evaluatorKey, weight: 100 / section.evaluators.length, enabled: true, missingDataPolicy: section.missingDataPolicy, config: {} })) })),
});

const report = (value: number, legacy: ScoringEngineResult, compiled: CompiledShadowExecutionOutcome, parity: BtcEtfReplayResult["parity"]): BtcEtfFlowReplayReport => {
  const completed = compiled.status === "COMPLETED" ? compiled : null;
  const parityResult = parity.status === "COMPLETED" ? parity.result : null;
  return deepFreeze({
    replayIdentity: { replayId: "BTC_ETF_FLOW_LEGACY_COMPILED_REPLAY", replayVersion: 1, sourceTemplateId: BTC_ETF_FLOW_AUTHORITY_IDS.templateKey, sourceTemplateVersion: 1, compiledRulebookId: "CRYPTO_BTC_ETF_FLOW_DAILY_RULEBOOK", compiledRulebookVersion: 1, executionBindingId: "BTC_ETF_FLOW_TEST_EXECUTION_BINDING", executionBindingVersion: 1, asOf: new Date(ETF_RUNTIME_TIMES.asOf) },
    input: { factorKey: "CRYPTO.ETF_NET_FLOW", subjectType: "ASSET", subjectKey: "BTC", value, unit: "USD", characterizationOnly: true },
    legacy: { score: legacy.score, permission: legacy.permission, scoreStatus: legacy.scoreStatus, dataConfidence: legacy.dataConfidence },
    compiled: { status: compiled.status, normalizedScore: completed?.compiledExecution.normalizedScore ?? null, decisionBand: completed?.compiledExecution.decisionBand?.label ?? null },
    parity: { comparability: parityResult?.overallComparability ?? "NOT_COMPARABLE", numericOutcome: parityResult?.numeric.status ?? "UNAVAILABLE", semanticOutcomes: parityResult?.semanticDimensions.map((item) => ({ dimension: item.dimensionId, outcome: item.status })) ?? [] },
    lineage: { evaluatorConfigurationId: BTC_ETF_FLOW_AUTHORITY_IDS.configurationId, providerBindingId: BTC_ETF_FLOW_AUTHORITY_IDS.providerBindingId, resolutionPolicyId: BTC_ETF_FLOW_AUTHORITY_IDS.resolutionPolicyId, aggregationPolicyId: BTC_ETF_FLOW_AUTHORITY_IDS.aggregationPolicyId, normalizationPolicyId: BTC_ETF_FLOW_AUTHORITY_IDS.normalizationPolicyId, decisionPolicyId: BTC_ETF_FLOW_AUTHORITY_IDS.decisionBandPolicyId },
    diagnostics: ["VALID_TRADE_GEOMETRY_ISOLATES_ETF_FLOW_SCORING", "CHARACTERIZATION_ONLY_LITERAL_USD_NOT_PRODUCTION_CALIBRATED", ...(compiled.status === "COMPLETED" ? [] : ["ASYMMETRIC_INPUT_AVAILABILITY"])],
  });
};

function deepFreeze<T>(value: T): T {
  const cloned = structuredClone(value);
  const freeze = (item: any): any => { if (typeof item !== "object" || item === null || Object.isFrozen(item)) return item; for (const child of Object.values(item)) freeze(child); return Object.freeze(item); };
  return freeze(cloned);
}
