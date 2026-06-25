import type {
  DataConfidence,
  ScoringRuleEvaluationResult,
} from "../types/scoring.types.js";

export type ScoringEvaluatorInput = {
  rewardRiskRatio: number;
  dataConfidence?: DataConfidence;
  symbol?: {
    status?: string;
    marketType?: string;
    exchange?: string;
    instrumentType?: string;
    lotSize?: number;
    tickSize?: number;
    expiry?: Date;
    requiresBrokerLogin?: boolean;
  };
  runtime?: {
    priceBufferAvailable?: boolean;
    currentCvdAvailable?: boolean;
    orderBookAvailable?: boolean;
  };
  evaluatedAt?: Date;
};

export type ScoringRuleEvaluator = {
  evaluate: (input: ScoringEvaluatorInput) => ScoringRuleEvaluationResult;
};

const result = (
  evaluatorKey: string,
  input: Omit<ScoringRuleEvaluationResult, "evaluatorKey">,
): ScoringRuleEvaluationResult => ({ evaluatorKey, ...input });

const skipped = (
  evaluatorKey: string,
  reasonCode: string,
  warning: string,
): ScoringRuleEvaluationResult => result(evaluatorKey, {
  status: "SKIPPED",
  score: 0,
  maxScore: 100,
  reasonCodes: [reasonCode],
  warnings: [warning],
  dataConfidence: "LOW",
});

const unavailableEvaluators: Record<string, [string, string]> = {
  MARKET_REGIME_CONTEXT: ["INDEX_DATA_UNAVAILABLE", "Market-regime data is unavailable."],
  SECTOR_STRENGTH_CONTEXT: ["SECTOR_DATA_UNAVAILABLE", "Sector-strength data is unavailable."],
  VWAP_CONTEXT: ["VWAP_DATA_UNAVAILABLE", "VWAP data is unavailable."],
  VOLUME_CONTEXT: ["VOLUME_DATA_UNAVAILABLE", "Volume context is unavailable."],
  FUNDING_OPEN_INTEREST_CONTEXT: ["FUNDING_DATA_UNAVAILABLE", "Funding and open-interest data is unavailable."],
};

const rewardRiskEvaluator: ScoringRuleEvaluator = {
  evaluate: (input) => {
    const rr = input.rewardRiskRatio;
    const score = rr < 1 ? 30 : rr < 1.5 ? 50 : rr < 2 ? 70 : 80;
    return result("REWARD_RISK_RATIO", {
      status: "EXECUTED",
      score,
      maxScore: 100,
      reasonCodes: [rr < 1 ? "RR_BELOW_MINIMUM" : "RR_ACCEPTABLE"],
      warnings: [],
      dataConfidence: input.dataConfidence ?? "HIGH",
      metadata: { rewardRiskRatio: rr },
    });
  },
};

const symbolMetadataEvaluator: ScoringRuleEvaluator = {
  evaluate: (input) => {
    const active = input.symbol?.status === "ACTIVE" || input.symbol?.status === "TRADING";
    return result("SYMBOL_METADATA_SANITY", {
      status: active ? "EXECUTED" : "BLOCKED",
      score: active ? 100 : 0,
      maxScore: 100,
      reasonCodes: [active ? "SYMBOL_METADATA_VALID" : "SYMBOL_INACTIVE"],
      warnings: [],
      dataConfidence: active ? "HIGH" : "LOW",
    });
  },
};

const commodityContractEvaluator: ScoringRuleEvaluator = {
  evaluate: (input) => {
    const symbol = input.symbol ?? {};
    const validScope = symbol.marketType === "COMMODITY"
      && symbol.exchange === "MCX"
      && symbol.instrumentType === "FUTURE";
    if (!validScope) {
      return result("COMMODITY_CONTRACT_SANITY", {
        status: "BLOCKED",
        score: 0,
        maxScore: 100,
        reasonCodes: ["MCX_CONTRACT_INVALID"],
        warnings: [],
        dataConfidence: "LOW",
      });
    }

    const reasonCodes = [
      "COMMODITY_TEMPLATE_USED",
      "MCX_CONTRACT_VALIDATED",
      symbol.lotSize && symbol.lotSize > 0 ? "LOT_SIZE_AVAILABLE" : "LOT_SIZE_MISSING",
      symbol.tickSize && symbol.tickSize > 0 ? "TICK_SIZE_AVAILABLE" : "TICK_SIZE_MISSING",
    ];
    const warnings = ["COMMODITY_BASELINE_ONLY"];
    if (!symbol.lotSize || symbol.lotSize <= 0) warnings.push("LOT_SIZE_MISSING");
    if (!symbol.tickSize || symbol.tickSize <= 0) warnings.push("TICK_SIZE_MISSING");
    if (symbol.requiresBrokerLogin) warnings.push("BROKER_LOGIN_REQUIRED_FOR_LIVE_MONITORING");
    if (symbol.expiry) {
      const remainingMs = symbol.expiry.getTime() - (input.evaluatedAt ?? new Date()).getTime();
      if (remainingMs >= 0 && remainingMs <= 3 * 24 * 60 * 60 * 1000) {
        warnings.push("EXPIRY_NEAR_WARNING");
      }
    }

    return result("COMMODITY_CONTRACT_SANITY", {
      // Contract metadata validates the instrument but does not yet contribute a directional score.
      status: "PARTIAL",
      score: 0,
      maxScore: 100,
      reasonCodes,
      warnings,
      dataConfidence: symbol.lotSize && symbol.tickSize ? "MEDIUM" : "LOW",
      metadata: {
        lotSizeAvailable: Boolean(symbol.lotSize && symbol.lotSize > 0),
        tickSizeAvailable: Boolean(symbol.tickSize && symbol.tickSize > 0),
        expiry: symbol.expiry?.toISOString(),
        requiresBrokerLogin: symbol.requiresBrokerLogin === true,
      },
    });
  },
};

const runtimeContextEvaluator = (
  evaluatorKey: "PRICE_BUFFER_CONTEXT" | "CVD_CONTEXT" | "ORDER_BOOK_CONTEXT",
  available: (input: ScoringEvaluatorInput) => boolean,
): ScoringRuleEvaluator => ({
  evaluate: (input) => available(input)
    ? result(evaluatorKey, {
      status: "PARTIAL",
      score: 0,
      maxScore: 100,
      reasonCodes: [`${evaluatorKey}_AVAILABLE`],
      warnings: [`${evaluatorKey}_NOT_YET_SCORED`],
      dataConfidence: "MEDIUM",
    })
    : skipped(evaluatorKey, "ORDER_FLOW_DATA_UNAVAILABLE", `${evaluatorKey} data is unavailable.`),
});

export class ScoringRuleEvaluatorRegistryService {
  private readonly evaluators = new Map<string, ScoringRuleEvaluator>();

  public constructor() {
    this.evaluators.set("REWARD_RISK_RATIO", rewardRiskEvaluator);
    this.evaluators.set("SYMBOL_METADATA_SANITY", symbolMetadataEvaluator);
    this.evaluators.set("COMMODITY_CONTRACT_SANITY", commodityContractEvaluator);
    this.evaluators.set(
      "PRICE_BUFFER_CONTEXT",
      runtimeContextEvaluator("PRICE_BUFFER_CONTEXT", (input) => input.runtime?.priceBufferAvailable === true),
    );
    this.evaluators.set(
      "CVD_CONTEXT",
      runtimeContextEvaluator("CVD_CONTEXT", (input) => input.runtime?.currentCvdAvailable === true),
    );
    this.evaluators.set(
      "ORDER_BOOK_CONTEXT",
      runtimeContextEvaluator("ORDER_BOOK_CONTEXT", (input) => input.runtime?.orderBookAvailable === true),
    );
    for (const [key, [reasonCode, warning]] of Object.entries(unavailableEvaluators)) {
      this.evaluators.set(key, { evaluate: () => skipped(key, reasonCode, warning) });
    }
  }

  public evaluate(evaluatorKey: string, input: ScoringEvaluatorInput): ScoringRuleEvaluationResult {
    const evaluator = this.evaluators.get(evaluatorKey);
    if (!evaluator) {
      return result(evaluatorKey, {
        status: "BLOCKED",
        score: 0,
        maxScore: 100,
        reasonCodes: ["UNKNOWN_SCORING_EVALUATOR"],
        warnings: [`Evaluator ${evaluatorKey} is not registered.`],
        dataConfidence: "LOW",
      });
    }
    return evaluator.evaluate(input);
  }
}
