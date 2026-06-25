import { AppError } from "../errors/AppError.js";
import type { InstrumentType, MarketType } from "../types/market-data.types.js";
import type {
  DataConfidence,
  RuleExecutionStatus,
  ScoringRuleEvaluationResult,
  ScoringSectionResult,
  ScoringTemplateKey,
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

export type ScoringEngineInput = {
  scoringTemplateKey: ScoringTemplateKey;
  scoringTemplateVersion: string;
  marketType: MarketType;
  tradeStyle: string;
  instrumentType: InstrumentType;
  rewardRiskRatio: number;
  dataConfidence?: DataConfidence;
  symbol?: ScoringEvaluatorInput["symbol"];
  runtime?: ScoringEvaluatorInput["runtime"];
  evaluatedAt?: Date;
  direction?: TradeDirection;
  marketSnapshot?: MarketSnapshot | null;
  indexSnapshot?: MarketSnapshot | null;
};

export type ScoringEngineBreakdown = {
  templateKey: ScoringTemplateKey;
  templateVersion: number;
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

export class ScoringEngineService {
  public constructor(
    private readonly templateRegistry = new ScoringTemplateRegistryService(),
    private readonly evaluatorRegistry = new ScoringRuleEvaluatorRegistryService(),
  ) {}

  public score(input: ScoringEngineInput): ScoringEngineResult {
    if (!Number.isFinite(input.rewardRiskRatio) || input.rewardRiskRatio <= 0) {
      throw new AppError("Invalid rewardRiskRatio", 400);
    }
    const version = Number.parseInt(input.scoringTemplateVersion, 10);
    const template = this.templateRegistry.get(
      input.scoringTemplateKey,
      Number.isFinite(version) && version > 0 ? version : 1,
    );
    this.templateRegistry.validateCompatibility({
      template,
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
      ...(input.marketSnapshot !== undefined ? { marketSnapshot: input.marketSnapshot } : {}),
      ...(input.indexSnapshot !== undefined ? { indexSnapshot: input.indexSnapshot } : {}),
    };
    const sectionResults: ScoringSectionResult[] = [];

    for (const definition of template.sections) {
      const evaluatorResults = definition.evaluators.map((key) =>
        this.evaluatorRegistry.evaluate(key, evaluatorInput));
      const executed = evaluatorResults.filter((item) => item.status === "EXECUTED");
      const average = executed.length > 0
        ? executed.reduce((total, item) => total + (item.score / item.maxScore) * 100, 0) / executed.length
        : 0;
      const status = sectionStatus(
        evaluatorResults.map((item) => item.status),
        definition.missingDataPolicy,
      );
      sectionResults.push({
        sectionKey: definition.key,
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
    const normalizedScore = executedWeight > 0
      ? Number(((earnedScore / executedWeight) * template.maxScore).toFixed(2))
      : 0;
    const rrRejected = input.rewardRiskRatio < 1;
    const score = rrRejected ? 30 : blockedCritical ? 0 : normalizedScore;
    const permission = rrRejected || blockedCritical ? "REJECT" : permissionForScore(score);
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
    const scoreStatus: ScoreStatus = blockedCritical
      ? "UNAVAILABLE"
      : missingCount > 0
        ? "READY_WITH_STALE_DATA"
        : "READY";
    const reasonCodes = unique(evaluatorResults.flatMap((item) => item.reasonCodes));
    const warnings = unique(evaluatorResults.flatMap((item) => item.warnings));

    const breakdown: ScoringEngineBreakdown = {
      templateKey: template.key,
      templateVersion: template.version,
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
}
