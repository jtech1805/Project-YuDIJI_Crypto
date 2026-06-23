import { AppError } from "../errors/AppError.js";
import {
  SCORING_TEMPLATE_KEYS,
  type DataConfidence,
  type ScoringTemplateKey,
  type ScoreStatus,
} from "../types/scoring.types.js";
import type { TradePermission } from "../types/trade.types.js";

export type ScoringEngineInput = {
  scoringTemplateKey: ScoringTemplateKey;
  scoringTemplateVersion: string;
  rewardRiskRatio: number;
  dataConfidence?: DataConfidence;
};

export type ScoringEngineResult = {
  score: number;
  permission: TradePermission;
  scoreStatus: ScoreStatus;
  dataConfidence: DataConfidence;
  reasonCodes: string[];
  warnings: string[];
  breakdown: Record<string, unknown>;
};

type ScoringEvaluator = {
  evaluate: (input: ScoringEngineInput) => ScoringEngineResult;
};

const supportedTemplates = new Set<string>(SCORING_TEMPLATE_KEYS);

const baselineEvaluator: ScoringEvaluator = {
  evaluate: (input: ScoringEngineInput): ScoringEngineResult => {
    const rr = input.rewardRiskRatio;
    const dataConfidence = input.dataConfidence ?? "MEDIUM";
    const warnings = [
      "Baseline RR-only score. Final production scoring will add market context in later phases.",
    ];

    if (dataConfidence === "LOW") {
      warnings.push("Data confidence is low.");
    }

    if (rr < 1) {
      return {
        score: 30,
        permission: "REJECT",
        scoreStatus: dataConfidence === "LOW" ? "PARTIAL_DATA" : "READY",
        dataConfidence,
        reasonCodes: ["RR_BELOW_MINIMUM"],
        warnings,
        breakdown: {
          rewardRiskRatio: rr,
          rrBand: "BELOW_1",
        },
      };
    }

    if (rr < 1.5) {
      return {
        score: 50,
        permission: "WAIT",
        scoreStatus: dataConfidence === "LOW" ? "PARTIAL_DATA" : "READY",
        dataConfidence,
        reasonCodes: ["RR_ACCEPTABLE"],
        warnings,
        breakdown: {
          rewardRiskRatio: rr,
          rrBand: "ONE_TO_ONE_POINT_FIVE",
        },
      };
    }

    if (rr < 2) {
      return {
        score: 70,
        permission: "TAKE_SMALL_RISK",
        scoreStatus: dataConfidence === "LOW" ? "PARTIAL_DATA" : "READY",
        dataConfidence,
        reasonCodes: ["RR_ACCEPTABLE"],
        warnings,
        breakdown: {
          rewardRiskRatio: rr,
          rrBand: "ONE_POINT_FIVE_TO_TWO",
        },
      };
    }

    return {
      score: 80,
      permission: "TAKE_TRADE",
      scoreStatus: dataConfidence === "LOW" ? "PARTIAL_DATA" : "READY",
      dataConfidence,
      reasonCodes: ["RR_ACCEPTABLE"],
      warnings,
      breakdown: {
        rewardRiskRatio: rr,
        rrBand: "TWO_OR_ABOVE",
      },
    };
  },
};

export class ScoringRuleRegistryService {
  private readonly evaluators = new Map<string, ScoringEvaluator>();

  public constructor() {
    for (const templateKey of SCORING_TEMPLATE_KEYS) {
      this.evaluators.set(templateKey, baselineEvaluator);
    }
  }

  public getEvaluator(templateKey: ScoringTemplateKey): ScoringEvaluator {
    const evaluator = this.evaluators.get(templateKey);
    if (!evaluator) {
      throw new AppError("UNSUPPORTED_TEMPLATE", 400);
    }
    return evaluator;
  }
}

export class ScoringEngineService {
  public constructor(private readonly registry = new ScoringRuleRegistryService()) {}

  public score(input: ScoringEngineInput): ScoringEngineResult {
    if (!supportedTemplates.has(input.scoringTemplateKey)) {
      throw new AppError("UNSUPPORTED_TEMPLATE", 400);
    }
    if (!Number.isFinite(input.rewardRiskRatio) || input.rewardRiskRatio <= 0) {
      throw new AppError("Invalid rewardRiskRatio", 400);
    }

    return this.registry.getEvaluator(input.scoringTemplateKey).evaluate(input);
  }
}
