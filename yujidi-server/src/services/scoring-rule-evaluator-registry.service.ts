import type {
  DataConfidence,
  ScoringRuleEvaluationResult,
} from "../types/scoring.types.js";
import type { MarketSnapshot } from "../types/market-snapshot.types.js";
import type { TradeDirection } from "../types/trade.types.js";

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
  direction?: TradeDirection;
  marketSnapshot?: MarketSnapshot | null;
  indexSnapshot?: MarketSnapshot | null;
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
  MARKET_BREADTH_CONTEXT: ["MARKET_BREADTH_UNAVAILABLE", "Market breadth data is unavailable."],
  VIX_STABILITY_CONTEXT: ["VIX_DATA_UNAVAILABLE", "VIX context is unavailable."],
  SECTOR_RELATIVE_STRENGTH: ["SECTOR_DATA_UNAVAILABLE", "Sector mapping is unavailable."],
  SECTOR_BREADTH_CONTEXT: ["SECTOR_DATA_UNAVAILABLE", "Sector breadth data is unavailable."],
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

const priceVsVwapEvaluator: ScoringRuleEvaluator = {
  evaluate: (input) => {
    const position = input.marketSnapshot?.vwap.positionVsVwap;
    if (!position || !input.direction) {
      return skipped("PRICE_VS_VWAP_CONTEXT", "VWAP_DATA_UNAVAILABLE", "VWAP position is unavailable.");
    }
    const aligned = (input.direction === "LONG" && position === "ABOVE")
      || (input.direction === "SHORT" && position === "BELOW");
    const score = position === "NEAR" ? 60 : aligned ? 100 : 0;
    return result("PRICE_VS_VWAP_CONTEXT", {
      status: "EXECUTED",
      score,
      maxScore: 100,
      reasonCodes: [
        position === "NEAR"
          ? "PRICE_NEAR_VWAP"
          : aligned ? "PRICE_VWAP_ALIGNED" : "PRICE_VWAP_OPPOSED",
      ],
      warnings: aligned || position === "NEAR" ? [] : ["PRICE_OPPOSES_VWAP_CONTEXT"],
      dataConfidence: input.marketSnapshot?.dataConfidence === "HIGH" ? "HIGH" : "MEDIUM",
      metadata: { direction: input.direction, positionVsVwap: position },
    });
  },
};

const vwapDistanceEvaluator: ScoringRuleEvaluator = {
  evaluate: (input) => {
    const distance = input.marketSnapshot?.vwap.distanceFromVwapPercent;
    if (distance === undefined) {
      return skipped("VWAP_DISTANCE_CONTEXT", "VWAP_DATA_UNAVAILABLE", "VWAP distance is unavailable.");
    }
    const absoluteDistance = Math.abs(distance);
    const score = absoluteDistance <= 0.3 ? 100 : absoluteDistance <= 1.5 ? 60 : 20;
    return result("VWAP_DISTANCE_CONTEXT", {
      status: "EXECUTED",
      score,
      maxScore: 100,
      reasonCodes: [
        absoluteDistance <= 0.3
          ? "VWAP_DISTANCE_NEAR"
          : absoluteDistance <= 1.5 ? "VWAP_DISTANCE_ACCEPTABLE" : "VWAP_DISTANCE_EXTENDED",
      ],
      warnings: absoluteDistance > 1.5 ? ["PRICE_EXTENDED_FROM_VWAP"] : [],
      dataConfidence: "HIGH",
      metadata: { distanceFromVwapPercent: distance, nearPercent: 0.3, extendedPercent: 1.5 },
    });
  },
};

const liquidityFreshnessEvaluator: ScoringRuleEvaluator = {
  evaluate: (input) => {
    const freshness = input.marketSnapshot?.freshness.status;
    if (!freshness || freshness === "MISSING") {
      return skipped("LIQUIDITY_FRESHNESS_CONTEXT", "SNAPSHOT_MISSING", "Market snapshot is missing.");
    }
    return result("LIQUIDITY_FRESHNESS_CONTEXT", {
      status: freshness === "FRESH" ? "EXECUTED" : "PARTIAL",
      score: freshness === "FRESH" ? 100 : 30,
      maxScore: 100,
      reasonCodes: [freshness === "FRESH" ? "SNAPSHOT_FRESH" : "SNAPSHOT_STALE"],
      warnings: freshness === "STALE" ? ["MARKET_SNAPSHOT_STALE"] : [],
      dataConfidence: freshness === "FRESH" ? "HIGH" : "LOW",
      metadata: { ageMs: input.marketSnapshot?.freshness.ageMs },
    });
  },
};

const rvolEvaluator: ScoringRuleEvaluator = {
  evaluate: (input) => {
    const rvol = input.marketSnapshot?.volume.relativeVolume;
    if (rvol === undefined) {
      return result("RVOL_CONTEXT", {
        status: "PARTIAL",
        score: 0,
        maxScore: 100,
        reasonCodes: ["RVOL_BASELINE_UNAVAILABLE"],
        warnings: ["RVOL baseline is unavailable."],
        dataConfidence: "LOW",
      });
    }
    return result("RVOL_CONTEXT", {
      status: "EXECUTED",
      score: rvol >= 1.5 ? 100 : rvol >= 1 ? 65 : 30,
      maxScore: 100,
      reasonCodes: [rvol >= 1.5 ? "RVOL_STRONG" : rvol >= 1 ? "RVOL_NORMAL" : "RVOL_WEAK"],
      warnings: rvol < 1 ? ["RELATIVE_VOLUME_WEAK"] : [],
      dataConfidence: "HIGH",
      metadata: { relativeVolume: rvol },
    });
  },
};

const indexVwapAlignmentEvaluator: ScoringRuleEvaluator = {
  evaluate: (input) => {
    const position = input.indexSnapshot?.vwap.positionVsVwap;
    if (!position || !input.direction) {
      return skipped(
        "INDEX_VWAP_TREND_ALIGNMENT",
        "INDEX_DATA_UNAVAILABLE",
        "Index VWAP context is unavailable.",
      );
    }
    const aligned = (input.direction === "LONG" && position === "ABOVE")
      || (input.direction === "SHORT" && position === "BELOW");
    return result("INDEX_VWAP_TREND_ALIGNMENT", {
      status: "EXECUTED",
      score: position === "NEAR" ? 60 : aligned ? 100 : 0,
      maxScore: 100,
      reasonCodes: [aligned ? "INDEX_VWAP_ALIGNED" : position === "NEAR" ? "INDEX_NEAR_VWAP" : "INDEX_VWAP_OPPOSED"],
      warnings: aligned || position === "NEAR" ? [] : ["INDEX_CONTEXT_OPPOSES_DIRECTION"],
      dataConfidence: input.indexSnapshot?.dataConfidence === "HIGH" ? "HIGH" : "MEDIUM",
    });
  },
};

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
    this.evaluators.set("PRICE_VS_VWAP_CONTEXT", priceVsVwapEvaluator);
    this.evaluators.set("VWAP_DISTANCE_CONTEXT", vwapDistanceEvaluator);
    this.evaluators.set("LIQUIDITY_FRESHNESS_CONTEXT", liquidityFreshnessEvaluator);
    this.evaluators.set("RVOL_CONTEXT", rvolEvaluator);
    this.evaluators.set("INDEX_VWAP_TREND_ALIGNMENT", indexVwapAlignmentEvaluator);
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
