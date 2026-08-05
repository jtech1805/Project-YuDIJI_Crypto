import { AppError } from "../errors/AppError.js";
import type { InstrumentType, MarketType } from "../types/market-data.types.js";
import type {
  DataConfidence,
  RuleExecutionStatus,
  ScoringRuleEvaluationResult,
  ScoringSectionResult,
  ScoringTemplateKey,
  EditableScoringSectionDefinition,
  ResolvedScoringTemplateDefinition,
  ScoringPermissionThresholds,
  ScoreStatus,
} from "../types/scoring.types.js";
import type { TradePermission } from "../types/trade.types.js";
import type { TradeDirection } from "../types/trade.types.js";
import type { MarketSnapshot } from "../types/market-snapshot.types.js";
import {
  ScoringRuleEvaluatorRegistryService,
  type ScoringEvaluatorInput,
} from "./scoring-rule-evaluator-registry.service.js";
import { ScoringTemplateRegistryService } from "./scoring-template-registry.service.js";
import type { AssembledFactorInput } from "../types/factor-input-assembly.types.js";
import type { FactorEvaluatorExecutionResult } from "../types/factor-evaluator.types.js";
import type { FactorKey } from "../types/factor-registry.types.js";
import type { GenericFactorRelationshipType } from "../types/generic-factor-relationship.types.js";
import { GENERIC_FACTOR_EVALUATOR_PREFIX, type GenericFactorCompatibilityDispatchRequest, type GenericFactorLegacyTranslationResult } from "../types/generic-factor-legacy-compatibility.types.js";
import { factorRegistry } from "../registries/factor.registry.js";
import { sharedFeatureFlagService, type FeatureFlagService } from "../config/feature-flags.js";
import { GenericFactorCompatibilityDispatcher, GenericFactorLegacyResultAdapter, parseGenericFactorEvaluatorKey } from "./generic-factor-legacy-compatibility.service.js";

export type ScoringEngineInput = {
  scoringTemplateKey: string;
  scoringTemplateVersion: string;
  resolvedTemplate?: ResolvedScoringTemplateDefinition;
  marketType: MarketType;
  tradeStyle: string;
  instrumentType: InstrumentType;
  rewardRiskRatio: number;
  dataConfidence?: DataConfidence;
  symbol?: ScoringEvaluatorInput["symbol"];
  runtime?: ScoringEvaluatorInput["runtime"];
  evaluatedAt?: Date;
  direction?: TradeDirection;
  entry?: number;
  stopLoss?: number;
  target1?: number;
  target2?: number;
  setupType?: ScoringEvaluatorInput["setupType"];
  userLevels?: ScoringEvaluatorInput["userLevels"];
  marketSnapshot?: MarketSnapshot | null;
  indexSnapshot?: MarketSnapshot | null;
  sectorSnapshot?: MarketSnapshot | null;
  vixSnapshot?: MarketSnapshot | null;
  marketBreadthPositivePercent?: number;
  genericFactorInputs?: Readonly<Partial<Record<FactorKey, Readonly<{
    relationshipType: GenericFactorRelationshipType;
    input: AssembledFactorInput;
  }>>>>;
};

export type ScoringEngineGenericFactorDependencies = Readonly<{
  featureFlags: Pick<FeatureFlagService, "isEnabled">;
  genericCompatibility: Pick<GenericFactorCompatibilityDispatcher, "dispatch">;
  genericExecution: Readonly<{
    execute(request: Readonly<{ relationshipType: GenericFactorRelationshipType; input: AssembledFactorInput }>): FactorEvaluatorExecutionResult;
  }>;
}>;

export type ScoringEngineBreakdown = {
  templateKey: string;
  templateVersion: number;
  templateId?: string;
  templateScope?: "SYSTEM" | "USER";
  templateName?: string;
  totalScore: number;
  maxScore: number;
  sectionResults: ScoringSectionResult[];
  evaluatorResults: ScoringRuleEvaluationResult[];
  reasonCodes: string[];
  warnings: string[];
  dataConfidence: DataConfidence;
  missingDataSummary: {
    partialSections: string[];
    skippedEvaluators: string[];
    blockedEvaluators: string[];
  };
};

export type ScoringEngineResult = {
  score: number;
  permission: TradePermission;
  scoreStatus: ScoreStatus;
  dataConfidence: DataConfidence;
  reasonCodes: string[];
  warnings: string[];
  breakdown: ScoringEngineBreakdown;
};

const unique = (values: string[]): string[] => [...new Set(values)];

const sectionStatus = (
  statuses: RuleExecutionStatus[],
  missingDataPolicy: "BLOCK" | "PARTIAL" | "ZERO" | "IGNORE",
): RuleExecutionStatus => {
  if (statuses.includes("BLOCKED")) return missingDataPolicy === "BLOCK" ? "BLOCKED" : "PARTIAL";
  if (statuses.every((status) => status === "EXECUTED")) return "EXECUTED";
  if (statuses.every((status) => status === "SKIPPED")) return missingDataPolicy === "IGNORE" ? "SKIPPED" : "PARTIAL";
  return "PARTIAL";
};

const permissionForScore = (score: number): TradePermission => {
  if (score < 40) return "REJECT";
  if (score < 60) return "WAIT";
  if (score < 75) return "TAKE_SMALL_RISK";
  return "TAKE_TRADE";
};

const permissionForThresholds = (
  score: number,
  thresholds?: ScoringPermissionThresholds,
): TradePermission => {
  if (!thresholds) return permissionForScore(score);
  if (score < thresholds.rejectBelow) return "REJECT";
  if (score < thresholds.waitBelow) return "WAIT";
  if (score < thresholds.takeTradeAtOrAbove) return "TAKE_SMALL_RISK";
  return "TAKE_TRADE";
};

const normalizeSystemTemplate = (
  template: ReturnType<ScoringTemplateRegistryService["get"]>,
): ResolvedScoringTemplateDefinition => ({
  templateKey: template.key,
  baseTemplateKey: template.key,
  templateName: template.key,
  scope: "SYSTEM",
  version: template.version,
  marketType: template.marketType,
  tradeStyle: template.tradeStyle,
  instrumentType: template.instrumentType,
  maxScore: template.maxScore,
  ...(template.aggregationMode ? { aggregationMode: template.aggregationMode } : {}),
  permissionThresholds: {
    rejectBelow: 40,
    waitBelow: 60,
    takeSmallRiskBelow: 75,
    takeTradeAtOrAbove: 75,
  },
  sections: template.sections.map((section) => ({
    sectionKey: section.key,
    label: section.label,
    weight: section.weight,
    enabled: true,
    missingDataPolicy: section.missingDataPolicy,
    evaluators: section.evaluators.map((evaluatorKey) => ({
      evaluatorKey,
      label: evaluatorKey,
      weight: Number((100 / section.evaluators.length).toFixed(4)),
      enabled: true,
      missingDataPolicy: section.missingDataPolicy,
      config: {},
    })),
  })),
});

export class ScoringEngineService {
  private readonly generic: ScoringEngineGenericFactorDependencies;

  public constructor(
    private readonly templateRegistry = new ScoringTemplateRegistryService(),
    private readonly evaluatorRegistry = new ScoringRuleEvaluatorRegistryService(),
    generic: Partial<ScoringEngineGenericFactorDependencies> = {},
  ) {
    this.generic = {
      featureFlags: generic.featureFlags ?? sharedFeatureFlagService,
      genericCompatibility: generic.genericCompatibility ?? new GenericFactorCompatibilityDispatcher({ enabled: true, factorRegistry, adapter: new GenericFactorLegacyResultAdapter() }),
      genericExecution: generic.genericExecution ?? { execute: ({ input }) => Object.freeze({ evaluated: false, evaluatorId: null, factorKey: input.factorKey, code: "INVALID_CONFIGURATION" }) },
    };
  }

  public score(input: ScoringEngineInput): ScoringEngineResult {
    if (!Number.isFinite(input.rewardRiskRatio) || input.rewardRiskRatio <= 0) {
      throw new AppError("Invalid rewardRiskRatio", 400);
    }
    const version = Number.parseInt(input.scoringTemplateVersion, 10);
    const template = input.resolvedTemplate ?? normalizeSystemTemplate(
      this.templateRegistry.get(
        input.scoringTemplateKey as ScoringTemplateKey,
        Number.isFinite(version) && version > 0 ? version : 1,
      ),
    );
    this.templateRegistry.validateCompatibility({
      template: {
        key: template.baseTemplateKey,
        version: template.version,
        marketType: template.marketType,
        tradeStyle: template.tradeStyle,
        instrumentType: template.instrumentType,
        maxScore: template.maxScore,
        sections: [],
      },
      marketType: input.marketType,
      tradeStyle: input.tradeStyle,
      instrumentType: input.instrumentType,
    });

    const evaluatorInput: ScoringEvaluatorInput = {
      rewardRiskRatio: input.rewardRiskRatio,
      ...(input.dataConfidence ? { dataConfidence: input.dataConfidence } : {}),
      ...(input.symbol ? { symbol: input.symbol } : {}),
      ...(input.runtime ? { runtime: input.runtime } : {}),
      ...(input.evaluatedAt ? { evaluatedAt: input.evaluatedAt } : {}),
      ...(input.direction ? { direction: input.direction } : {}),
      ...(input.entry !== undefined ? { entry: input.entry } : {}),
      ...(input.stopLoss !== undefined ? { stopLoss: input.stopLoss } : {}),
      ...(input.target1 !== undefined ? { target1: input.target1 } : {}),
      ...(input.target2 !== undefined ? { target2: input.target2 } : {}),
      ...(input.setupType ? { setupType: input.setupType } : {}),
      ...(input.userLevels ? { userLevels: input.userLevels } : {}),
      ...(input.marketSnapshot !== undefined ? { marketSnapshot: input.marketSnapshot } : {}),
      ...(input.indexSnapshot !== undefined ? { indexSnapshot: input.indexSnapshot } : {}),
      ...(input.sectorSnapshot !== undefined ? { sectorSnapshot: input.sectorSnapshot } : {}),
      ...(input.vixSnapshot !== undefined ? { vixSnapshot: input.vixSnapshot } : {}),
      ...(input.marketBreadthPositivePercent !== undefined
        ? { marketBreadthPositivePercent: input.marketBreadthPositivePercent }
        : {}),
    };
    const sectionResults: ScoringSectionResult[] = [];

    for (const definition of template.sections.filter((section) => section.enabled)) {
      const enabledEvaluators = definition.evaluators.filter((evaluator) => evaluator.enabled);
      const evaluatorResults = enabledEvaluators.map((evaluator) =>
        this.evaluateRule(evaluator.evaluatorKey, evaluatorInput, input.genericFactorInputs));
      const executed = evaluatorResults.filter((item) => item.status === "EXECUTED");
      const scoredEvaluators = template.aggregationMode === "WEIGHTED_SUM"
        || definition.missingDataPolicy !== "IGNORE"
        ? evaluatorResults
        : executed;
      const average = scoredEvaluators.length > 0
        ? this.weightedEvaluatorAverage(scoredEvaluators, enabledEvaluators)
        : 0;
      const status = sectionStatus(
        evaluatorResults.map((item) => item.status),
        definition.missingDataPolicy,
      );
      sectionResults.push({
        sectionKey: definition.sectionKey,
        label: definition.label,
        score: Number(((average / 100) * definition.weight).toFixed(4)),
        maxScore: definition.weight,
        weight: definition.weight,
        status,
        evaluatorResults,
        reasonCodes: unique(evaluatorResults.flatMap((item) => item.reasonCodes)),
        warnings: unique(evaluatorResults.flatMap((item) => item.warnings)),
      });
    }

    const evaluatorResults = sectionResults.flatMap((sectionResult) => sectionResult.evaluatorResults);
    const blockedCritical = template.sections.some((definition, index) =>
      definition.missingDataPolicy === "BLOCK" && sectionResults[index]?.status === "BLOCKED");
    const executedSections = sectionResults.filter((item) => item.status === "EXECUTED");
    const executedWeight = executedSections.reduce((total, item) => total + item.weight, 0);
    const earnedScore = executedSections.reduce((total, item) => total + item.score, 0);
    const normalizedScore = template.aggregationMode === "WEIGHTED_SUM"
      ? Number(sectionResults.reduce((total, item) => total + item.score, 0).toFixed(2))
      : executedWeight > 0
      ? Number(((earnedScore / executedWeight) * template.maxScore).toFixed(2))
      : 0;
    const rrRejected = input.rewardRiskRatio < 1;
    const score = rrRejected ? 30 : blockedCritical ? 0 : normalizedScore;
    const permission = rrRejected || blockedCritical ? "REJECT" : permissionForThresholds(score, template.permissionThresholds);
    const partialSections = sectionResults
      .filter((item) => item.status === "PARTIAL")
      .map((item) => item.sectionKey);
    const skippedEvaluators = evaluatorResults
      .filter((item) => item.status === "SKIPPED")
      .map((item) => item.evaluatorKey);
    const blockedEvaluators = evaluatorResults
      .filter((item) => item.status === "BLOCKED")
      .map((item) => item.evaluatorKey);
    const missingCount = partialSections.length + skippedEvaluators.length;
    const dataConfidence: DataConfidence = blockedCritical
      ? "LOW"
      : missingCount === 0
        ? "HIGH"
        : missingCount <= 2
          ? "MEDIUM"
          : "LOW";
    const reasonCodes = unique(evaluatorResults.flatMap((item) => item.reasonCodes));
    const warnings = unique(evaluatorResults.flatMap((item) => item.warnings));
    const staleDataPresent = [...reasonCodes, ...warnings].some((value) => value.includes("STALE"));
    const scoreStatus: ScoreStatus = blockedCritical
      ? "UNAVAILABLE"
      : staleDataPresent
        ? "READY_WITH_STALE_DATA"
        : missingCount > 0
          ? "PARTIAL_DATA"
          : "READY";

    const breakdown: ScoringEngineBreakdown = {
      templateKey: template.templateKey,
      templateVersion: template.version,
      ...(template.id ? { templateId: template.id } : {}),
      templateScope: template.scope,
      templateName: template.templateName,
      totalScore: score,
      maxScore: template.maxScore,
      sectionResults,
      evaluatorResults,
      reasonCodes,
      warnings,
      dataConfidence,
      missingDataSummary: {
        partialSections,
        skippedEvaluators,
        blockedEvaluators,
      },
    };

    return {
      score,
      permission,
      scoreStatus,
      dataConfidence,
      reasonCodes,
      warnings,
      breakdown,
    };
  }

  private evaluateRule(
    evaluatorKey: string,
    evaluatorInput: ScoringEvaluatorInput,
    genericInputs: ScoringEngineInput["genericFactorInputs"],
  ): ScoringRuleEvaluationResult {
    if (!evaluatorKey.startsWith(GENERIC_FACTOR_EVALUATOR_PREFIX)) {
      return this.evaluatorRegistry.evaluate(evaluatorKey, evaluatorInput);
    }
    const factorKey = parseGenericFactorEvaluatorKey(evaluatorKey);
    if (!factorKey || !this.generic.featureFlags.isEnabled("GENERIC_EVALUATOR_ENABLED")) {
      return this.evaluatorRegistry.evaluate(evaluatorKey, evaluatorInput);
    }
    const supplied = genericInputs?.[factorKey as FactorKey];
    let execution: FactorEvaluatorExecutionResult;
    if (!supplied) {
      execution = Object.freeze({ evaluated: false, evaluatorId: null, factorKey, code: "INVALID_INPUT" });
    } else {
      try {
        execution = this.generic.genericExecution.execute({ relationshipType: supplied.relationshipType, input: supplied.input });
      } catch {
        execution = Object.freeze({ evaluated: false, evaluatorId: null, factorKey, code: "EVALUATION_FAILED" });
      }
    }
    let translated: GenericFactorLegacyTranslationResult;
    try {
      const compatibilityRequest: GenericFactorCompatibilityDispatchRequest = { evaluatorKey, relationshipType: supplied?.relationshipType ?? "DIRECT", execution };
      translated = this.generic.genericCompatibility.dispatch(compatibilityRequest);
    } catch {
      translated = Object.freeze({ translated: false, evaluatorKey, code: "INVALID_EXECUTION_RESULT" });
    }
    return translated.translated ? translated.result : genericFailureResult(evaluatorKey, translated.code);
  }

  private weightedEvaluatorAverage(
    results: ScoringRuleEvaluationResult[],
    definitions: EditableScoringSectionDefinition["evaluators"],
  ): number {
    const weights = new Map(definitions.map((definition) => [definition.evaluatorKey, definition.weight]));
    const totalWeight = results.reduce((total, result) => total + (weights.get(result.evaluatorKey) ?? 0), 0);
    if (totalWeight <= 0) return 0;
    return results.reduce((total, result) => {
      const weight = weights.get(result.evaluatorKey) ?? 0;
      return total + ((result.score / result.maxScore) * 100 * weight) / totalWeight;
    }, 0);
  }
}

const genericFailureResult = (
  evaluatorKey: string,
  code: Extract<GenericFactorLegacyTranslationResult, { translated: false }>["code"],
): ScoringRuleEvaluationResult => ({
  evaluatorKey,
  status: "BLOCKED",
  score: 0,
  maxScore: 100,
  reasonCodes: [code],
  warnings: ["Generic factor evaluation is unavailable."],
  dataConfidence: "LOW",
  metadata: { genericFactorFailureCode: code },
});
