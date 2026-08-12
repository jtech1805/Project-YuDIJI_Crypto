import type { CandleSnapshot, MarketSnapshot } from "../../types/market-snapshot.types.js";
import type { ScoringRuleEvaluationResult } from "../../types/scoring.types.js";
import type {
  ScoringEvaluatorInput,
  ScoringRuleEvaluator,
} from "./scoring-rule-evaluator-registry.service.js";

const output = (
  evaluatorKey: string,
  input: Omit<ScoringRuleEvaluationResult, "evaluatorKey">,
): ScoringRuleEvaluationResult => ({ evaluatorKey, ...input });

const unavailable = (
  evaluatorKey: string,
  reasonCode: string,
  warning: string,
): ScoringRuleEvaluationResult => output(evaluatorKey, {
  status: "PARTIAL",
  score: 0,
  maxScore: 100,
  reasonCodes: [reasonCode],
  warnings: [warning],
  dataConfidence: "LOW",
});

const alignedWithDirection = (
  direction: ScoringEvaluatorInput["direction"],
  positive: boolean,
): boolean => direction === "LONG" ? positive : !positive;

const structureResult = (
  evaluatorKey: string,
  snapshot: MarketSnapshot | null | undefined,
  direction: ScoringEvaluatorInput["direction"],
  prefix: "INDEX" | "SECTOR" | "STOCK",
): ScoringRuleEvaluationResult => {
  if (!snapshot || !direction) {
    return unavailable(
      evaluatorKey,
      `${prefix}_CANDLE_DATA_INSUFFICIENT`,
      `${prefix.toLowerCase()} candle structure is unavailable.`,
    );
  }
  const evaluateTimeframe = (timeframe: "5m" | "15m"): boolean | null => {
    const candles = snapshot.candles[timeframe];
    const previous = candles.at(-2);
    const latest = candles.at(-1);
    if (!previous || !latest) return null;
    return alignedWithDirection(direction, latest.close > previous.close);
  };
  const fiveMinute = evaluateTimeframe("5m");
  const fifteenMinute = evaluateTimeframe("15m");
  if (fiveMinute === null || fifteenMinute === null) {
    return unavailable(
      evaluatorKey,
      `${prefix}_CANDLE_DATA_INSUFFICIENT`,
      `${prefix.toLowerCase()} 5m/15m candles are insufficient.`,
    );
  }
  const alignedCount = Number(fiveMinute) + Number(fifteenMinute);
  const positiveSuffix = direction === "LONG" ? "POSITIVE" : "NEGATIVE";
  return output(evaluatorKey, {
    status: "EXECUTED",
    score: alignedCount === 2 ? 100 : alignedCount === 1 ? 50 : 0,
    maxScore: 100,
    reasonCodes: [
      fiveMinute
        ? `${prefix}_5M_STRUCTURE_${positiveSuffix}`
        : `${prefix}_5M_STRUCTURE_OPPOSED`,
      fifteenMinute
        ? `${prefix}_15M_STRUCTURE_${positiveSuffix}`
        : `${prefix}_15M_STRUCTURE_OPPOSED`,
    ],
    warnings: alignedCount === 0 ? [`${prefix}_STRUCTURE_OPPOSES_DIRECTION`] : [],
    dataConfidence: snapshot.freshness.status === "FRESH" ? "HIGH" : "LOW",
  });
};

const comparisonResult = (
  evaluatorKey: string,
  primaryChange: number | undefined,
  benchmarkChange: number | undefined,
  direction: ScoringEvaluatorInput["direction"],
  reasonCodes: {
    favorable: string;
    inline: string;
    unfavorable: string;
    primaryMissing: string;
    benchmarkMissing: string;
  },
  threshold = 0.25,
): ScoringRuleEvaluationResult => {
  if (primaryChange === undefined) {
    return unavailable(evaluatorKey, reasonCodes.primaryMissing, "Primary comparison snapshot is unavailable.");
  }
  if (benchmarkChange === undefined) {
    return unavailable(evaluatorKey, reasonCodes.benchmarkMissing, "Benchmark snapshot is unavailable.");
  }
  const difference = primaryChange - benchmarkChange;
  const directionalDifference = direction === "SHORT" ? -difference : difference;
  const score = directionalDifference > threshold ? 100 : directionalDifference >= -threshold ? 60 : 0;
  return output(evaluatorKey, {
    status: "EXECUTED",
    score,
    maxScore: 100,
    reasonCodes: [
      score === 100 ? reasonCodes.favorable : score === 60 ? reasonCodes.inline : reasonCodes.unfavorable,
    ],
    warnings: score === 0 ? [`${evaluatorKey}_OPPOSES_DIRECTION`] : [],
    dataConfidence: "HIGH",
    metadata: { primaryChange, benchmarkChange, difference, threshold },
  });
};

const latestCandle = (snapshot?: MarketSnapshot | null): CandleSnapshot | undefined =>
  snapshot?.candles["5m"].at(-1) ?? snapshot?.candles["1m"].at(-1);

const recentVolumes = (
  snapshot?: MarketSnapshot | null,
  lookback = 5,
): { latest: number; average: number } | null => {
  const candles = snapshot?.candles["1m"] ?? [];
  const latest = candles.at(-1)?.volume;
  const baseline = candles
    .slice(-(lookback + 1), -1)
    .map((candle) => candle.volume)
    .filter((volume): volume is number => volume !== undefined && volume > 0);
  if (latest === undefined || baseline.length === 0) return null;
  return {
    latest,
    average: baseline.reduce((total, volume) => total + volume, 0) / baseline.length,
  };
};

const indexVwapAlignment: ScoringRuleEvaluator = {
  evaluate: (input) => {
    const snapshot = input.indexSnapshot;
    const position = snapshot?.vwap.positionVsVwap;
    if (!snapshot) {
      return unavailable("INDEX_VWAP_TREND_ALIGNMENT", "INDEX_SNAPSHOT_UNAVAILABLE", "Index snapshot is unavailable.");
    }
    if (!position || !input.direction) {
      return unavailable("INDEX_VWAP_TREND_ALIGNMENT", "INDEX_VWAP_UNAVAILABLE", "Index VWAP is unavailable.");
    }
    const aligned = (input.direction === "LONG" && position === "ABOVE")
      || (input.direction === "SHORT" && position === "BELOW");
    const stale = snapshot.freshness.status !== "FRESH";
    return output("INDEX_VWAP_TREND_ALIGNMENT", {
      status: stale ? "PARTIAL" : "EXECUTED",
      score: stale ? 0 : position === "NEAR" ? 60 : aligned ? 100 : 0,
      maxScore: 100,
      reasonCodes: [
        position === "ABOVE"
          ? "INDEX_ABOVE_VWAP"
          : position === "BELOW" ? "INDEX_BELOW_VWAP" : "INDEX_NEAR_VWAP",
        ...(stale ? ["INDEX_SNAPSHOT_STALE"] : []),
      ],
      warnings: stale ? ["INDEX_SNAPSHOT_STALE"] : aligned || position === "NEAR"
        ? [] : ["INDEX_CONTEXT_OPPOSES_DIRECTION"],
      dataConfidence: stale ? "LOW" : snapshot.dataConfidence === "HIGH" ? "HIGH" : "MEDIUM",
    });
  },
};

const marketChoppiness: ScoringRuleEvaluator = {
  evaluate: (input) => {
    const snapshot = input.indexSnapshot;
    const vwap = snapshot?.vwap.value;
    const candles = snapshot?.candles["5m"] ?? [];
    if (!snapshot || vwap === undefined || candles.length < 3) {
      return unavailable("MARKET_CHOPPINESS_CONTEXT", "CHOPPINESS_DATA_UNAVAILABLE", "Index choppiness data is unavailable.");
    }
    const recent = candles.slice(-8);
    let transitions = 0;
    for (let index = 1; index < recent.length; index += 1) {
      const previous = recent[index - 1]!;
      const current = recent[index]!;
      const directionFlip = Math.sign(previous.close - previous.open) !== Math.sign(current.close - current.open);
      const vwapCross = (previous.close - vwap) * (current.close - vwap) < 0;
      if (directionFlip || vwapCross) transitions += 1;
    }
    const score = transitions <= 2 ? 100 : transitions <= 4 ? 50 : 0;
    return output("MARKET_CHOPPINESS_CONTEXT", {
      status: "EXECUTED",
      score,
      maxScore: 100,
      reasonCodes: [
        score === 100 ? "MARKET_NOT_CHOPPY" : score === 50 ? "MARKET_MODERATELY_CHOPPY" : "MARKET_CHOPPY",
      ],
      warnings: score === 0 ? ["MARKET_CHOPPY"] : [],
      dataConfidence: "MEDIUM",
      metadata: { transitions, candleCount: recent.length },
    });
  },
};

const vixStability: ScoringRuleEvaluator = {
  evaluate: (input) => {
    const snapshot = input.vixSnapshot;
    const change = snapshot?.changePercent
      ?? (
        snapshot?.latestPrice !== undefined
        && snapshot.previousClose !== undefined
        && snapshot.previousClose > 0
          ? ((snapshot.latestPrice - snapshot.previousClose) / snapshot.previousClose) * 100
          : undefined
      );
    if (change === undefined) {
      return unavailable("VIX_STABILITY_CONTEXT", "VIX_DATA_UNAVAILABLE", "India VIX snapshot is unavailable.");
    }
    const absoluteChange = Math.abs(change);
    return output("VIX_STABILITY_CONTEXT", {
      status: "EXECUTED",
      score: absoluteChange <= 3 ? 100 : absoluteChange <= 6 ? 50 : 0,
      maxScore: 100,
      reasonCodes: [
        absoluteChange <= 3
          ? "VIX_STABLE"
          : absoluteChange <= 6 ? "VIX_SLIGHTLY_EXPANDING" : "VIX_EXPANDING_RISK",
      ],
      warnings: absoluteChange > 6 ? ["VIX_EXPANDING_RISK"] : [],
      dataConfidence: input.vixSnapshot?.freshness.status === "FRESH" ? "HIGH" : "LOW",
      metadata: { changePercent: change },
    });
  },
};

const marketBreadth: ScoringRuleEvaluator = {
  evaluate: (input) => {
    const positivePercent = input.marketBreadthPositivePercent;
    if (positivePercent === undefined || !input.direction) {
      return unavailable("MARKET_BREADTH_CONTEXT", "MARKET_BREADTH_UNAVAILABLE", "Market breadth is unavailable.");
    }
    const supportive = input.direction === "LONG" ? positivePercent : 100 - positivePercent;
    return output("MARKET_BREADTH_CONTEXT", {
      status: "EXECUTED",
      score: supportive >= 55 ? 100 : supportive >= 45 ? 50 : 0,
      maxScore: 100,
      reasonCodes: [supportive >= 55 ? "MARKET_BREADTH_SUPPORTIVE" : supportive >= 45 ? "MARKET_BREADTH_NEUTRAL" : "MARKET_BREADTH_OPPOSED"],
      warnings: supportive < 45 ? ["MARKET_BREADTH_OPPOSED"] : [],
      dataConfidence: "MEDIUM",
      metadata: { positivePercent },
    });
  },
};

const snapshotVwapEvaluator = (
  evaluatorKey: string,
  snapshot: (input: ScoringEvaluatorInput) => MarketSnapshot | null | undefined,
  missingCode: string,
): ScoringRuleEvaluator => ({
  evaluate: (input) => {
    const selected = snapshot(input);
    const position = selected?.vwap.positionVsVwap;
    if (!selected || !position || !input.direction) {
      return unavailable(evaluatorKey, missingCode, `${evaluatorKey} data is unavailable.`);
    }
    const aligned = (input.direction === "LONG" && position === "ABOVE")
      || (input.direction === "SHORT" && position === "BELOW");
    return output(evaluatorKey, {
      status: selected.freshness.status === "FRESH" ? "EXECUTED" : "PARTIAL",
      score: selected.freshness.status === "FRESH"
        ? position === "NEAR" ? 60 : aligned ? 100 : 0
        : 0,
      maxScore: 100,
      reasonCodes: [position === "NEAR" ? `${evaluatorKey}_NEAR` : aligned ? `${evaluatorKey}_ALIGNED` : `${evaluatorKey}_OPPOSED`],
      warnings: selected.freshness.status === "STALE" ? [`${evaluatorKey}_STALE`] : aligned || position === "NEAR" ? [] : [`${evaluatorKey}_OPPOSED`],
      dataConfidence: selected.freshness.status === "FRESH" ? "HIGH" : "LOW",
    });
  },
});

const volumeExpansion: ScoringRuleEvaluator = {
  evaluate: (input) => {
    const volume = recentVolumes(input.marketSnapshot);
    if (!volume) {
      return unavailable("VOLUME_EXPANSION_CONTEXT", "VOLUME_BASELINE_UNAVAILABLE", "Volume expansion baseline is unavailable.");
    }
    const ratio = volume.latest / volume.average;
    return output("VOLUME_EXPANSION_CONTEXT", {
      status: "EXECUTED",
      score: ratio >= 1.2 ? 100 : ratio >= 0.8 ? 50 : 0,
      maxScore: 100,
      reasonCodes: [ratio >= 1.2 ? "VOLUME_EXPANDING" : ratio >= 0.8 ? "VOLUME_STABLE" : "VOLUME_DRYING"],
      warnings: ratio < 0.8 ? ["VOLUME_DRYING"] : [],
      dataConfidence: "HIGH",
      metadata: { ratio, lookback: 5 },
    });
  },
};

const candleVolume: ScoringRuleEvaluator = {
  evaluate: (input) => {
    const candle = latestCandle(input.marketSnapshot);
    const volume = recentVolumes(input.marketSnapshot);
    if (!candle || !volume || !input.direction) {
      return unavailable("CANDLE_VOLUME_CONTEXT", "CANDLE_VOLUME_DATA_UNAVAILABLE", "Candle volume context is unavailable.");
    }
    const directional = alignedWithDirection(input.direction, candle.close > candle.open);
    const expanding = volume.latest > volume.average;
    return output("CANDLE_VOLUME_CONTEXT", {
      status: "EXECUTED",
      score: directional && expanding ? 100 : directional || expanding ? 50 : 0,
      maxScore: 100,
      reasonCodes: [directional ? "CANDLE_DIRECTION_ALIGNED" : "CANDLE_DIRECTION_OPPOSED", expanding ? "CANDLE_VOLUME_EXPANDING" : "CANDLE_VOLUME_NOT_EXPANDING"],
      warnings: directional && expanding ? [] : ["CANDLE_VOLUME_CONFIRMATION_WEAK"],
      dataConfidence: "HIGH",
    });
  },
};

const volumeDryUp: ScoringRuleEvaluator = {
  evaluate: (input) => {
    const volume = recentVolumes(input.marketSnapshot);
    if (!volume) {
      return unavailable("VOLUME_DRY_UP_CONTEXT", "VOLUME_BASELINE_UNAVAILABLE", "Volume dry-up baseline is unavailable.");
    }
    const ratio = volume.latest / volume.average;
    return output("VOLUME_DRY_UP_CONTEXT", {
      status: "EXECUTED",
      score: ratio >= 0.8 ? 100 : ratio >= 0.5 ? 50 : 0,
      maxScore: 100,
      reasonCodes: [ratio >= 0.8 ? "VOLUME_NOT_DRYING" : ratio >= 0.5 ? "VOLUME_MODERATE_DRY_UP" : "VOLUME_SEVERE_DRY_UP"],
      warnings: ratio < 0.8 ? ["VOLUME_DRY_UP_DETECTED"] : [],
      dataConfidence: "HIGH",
      metadata: { ratio },
    });
  },
};

const vwapReclaimHold: ScoringRuleEvaluator = {
  evaluate: (input) => {
    const snapshot = input.marketSnapshot;
    const vwap = snapshot?.vwap.value;
    const candles = snapshot?.candles["5m"] ?? [];
    if (vwap === undefined || candles.length < 2 || !input.direction) {
      return unavailable("VWAP_RECLAIM_HOLD_CONTEXT", "VWAP_RECLAIM_DATA_UNAVAILABLE", "VWAP reclaim/hold data is unavailable.");
    }
    const previous = candles.at(-2)!;
    const latest = candles.at(-1)!;
    const supportive = input.direction === "LONG"
      ? previous.close <= vwap && latest.close > vwap
      : previous.close >= vwap && latest.close < vwap;
    const holding = input.direction === "LONG" ? latest.close > vwap : latest.close < vwap;
    return output("VWAP_RECLAIM_HOLD_CONTEXT", {
      status: "EXECUTED",
      score: supportive ? 100 : holding ? 60 : 0,
      maxScore: 100,
      reasonCodes: [supportive ? "VWAP_RECLAIM_CONFIRMED" : holding ? "VWAP_HOLD_CONFIRMED" : "VWAP_RECLAIM_NOT_CONFIRMED"],
      warnings: supportive || holding ? [] : ["VWAP_RECLAIM_NOT_CONFIRMED"],
      dataConfidence: "MEDIUM",
    });
  },
};

const spreadDepth: ScoringRuleEvaluator = {
  evaluate: (input) => {
    const spread = input.marketSnapshot?.spreadPercent;
    if (spread === undefined) {
      return unavailable("SPREAD_DEPTH_CONTEXT", "DEPTH_DATA_UNAVAILABLE", "Bid/ask spread and depth are unavailable.");
    }
    return output("SPREAD_DEPTH_CONTEXT", {
      status: "EXECUTED",
      score: spread <= 0.1 ? 100 : spread <= 0.3 ? 50 : 0,
      maxScore: 100,
      reasonCodes: [spread <= 0.1 ? "SPREAD_TIGHT" : spread <= 0.3 ? "SPREAD_MODERATE" : "SPREAD_WIDE"],
      warnings: spread > 0.3 ? ["SPREAD_WIDE"] : [],
      dataConfidence: "MEDIUM",
      metadata: { spreadPercent: spread },
    });
  },
};

const setupTypeContext: ScoringRuleEvaluator = {
  evaluate: (input) => input.setupType
    ? output("SETUP_TYPE_CONTEXT", {
      status: "EXECUTED",
      score: 100,
      maxScore: 100,
      reasonCodes: ["SETUP_TYPE_SUPPORTED"],
      warnings: [],
      dataConfidence: "HIGH",
      metadata: { setupType: input.setupType },
    })
    : unavailable("SETUP_TYPE_CONTEXT", "SETUP_TYPE_MISSING", "Setup type is missing."),
};

const intendedEntryLevel = (input: ScoringEvaluatorInput): number | undefined => {
  const levels = input.userLevels;
  switch (input.setupType) {
    case "BREAKOUT": return levels?.breakoutLevel ?? levels?.rangeHigh;
    case "RANGE_BREAKDOWN": return levels?.rangeLow;
    case "PULLBACK": return levels?.pullbackZone;
    case "SUPPORT_BOUNCE": return levels?.supportLevel;
    case "RESISTANCE_REJECTION": return levels?.resistanceLevel;
    case "VWAP_RECLAIM":
    case "VWAP_REJECTION":
      return input.marketSnapshot?.vwap.value;
    default: return undefined;
  }
};

const entryLevelContext: ScoringRuleEvaluator = {
  evaluate: (input) => {
    const intended = intendedEntryLevel(input);
    if (intended === undefined || input.entry === undefined) {
      return unavailable("ENTRY_LEVEL_CONTEXT", "ENTRY_LEVEL_DATA_UNAVAILABLE", "Entry setup level is unavailable.");
    }
    const distance = Math.abs(input.entry - intended) / intended * 100;
    return output("ENTRY_LEVEL_CONTEXT", {
      status: "EXECUTED",
      score: distance <= 0.25 ? 100 : distance <= 0.75 ? 50 : 0,
      maxScore: 100,
      reasonCodes: [distance <= 0.25 ? "ENTRY_LEVEL_ALIGNED" : distance <= 0.75 ? "ENTRY_LEVEL_ACCEPTABLE" : "ENTRY_LEVEL_EXTENDED"],
      warnings: distance > 0.75 ? ["ENTRY_LEVEL_EXTENDED"] : [],
      dataConfidence: "HIGH",
      metadata: { intendedLevel: intended, distancePercent: distance },
    });
  },
};

const stoplossStructure: ScoringRuleEvaluator = {
  evaluate: (input) => {
    if (!input.direction || input.entry === undefined || input.stopLoss === undefined) {
      return unavailable("STOPLOSS_STRUCTURE_CONTEXT", "STOPLOSS_GEOMETRY_UNAVAILABLE", "Stoploss geometry is unavailable.");
    }
    const geometryValid = input.direction === "LONG"
      ? input.stopLoss < input.entry
      : input.stopLoss > input.entry;
    if (!geometryValid) {
      return output("STOPLOSS_STRUCTURE_CONTEXT", {
        status: "BLOCKED",
        score: 0,
        maxScore: 100,
        reasonCodes: ["STOPLOSS_GEOMETRY_INVALID"],
        warnings: ["STOPLOSS_GEOMETRY_INVALID"],
        dataConfidence: "HIGH",
      });
    }
    const structural = input.direction === "LONG"
      ? input.userLevels?.supportLevel
      : input.userLevels?.resistanceLevel;
    if (structural === undefined) {
      return output("STOPLOSS_STRUCTURE_CONTEXT", {
        status: "PARTIAL",
        score: 0,
        maxScore: 100,
        reasonCodes: ["STOPLOSS_GEOMETRY_VALID", "USER_LEVELS_UNAVAILABLE"],
        warnings: ["Stoploss geometry is valid but structural level is unavailable."],
        dataConfidence: "MEDIUM",
      });
    }
    const correctlyPlaced = input.direction === "LONG"
      ? input.stopLoss <= structural
      : input.stopLoss >= structural;
    return output("STOPLOSS_STRUCTURE_CONTEXT", {
      status: "EXECUTED",
      score: correctlyPlaced ? 100 : 0,
      maxScore: 100,
      reasonCodes: [correctlyPlaced ? "STOPLOSS_STRUCTURE_ALIGNED" : "STOPLOSS_STRUCTURE_WEAK"],
      warnings: correctlyPlaced ? [] : ["STOPLOSS_STRUCTURE_WEAK"],
      dataConfidence: "HIGH",
    });
  },
};

const candleConfirmation: ScoringRuleEvaluator = {
  evaluate: (input) => {
    const candle = latestCandle(input.marketSnapshot);
    if (!candle || !input.direction) {
      return unavailable("CANDLE_CONFIRMATION_CONTEXT", "CANDLE_CONFIRMATION_UNAVAILABLE", "Candle confirmation is unavailable.");
    }
    const aligned = alignedWithDirection(input.direction, candle.close > candle.open);
    return output("CANDLE_CONFIRMATION_CONTEXT", {
      status: "EXECUTED",
      score: aligned ? 100 : 0,
      maxScore: 100,
      reasonCodes: [aligned ? "CANDLE_CONFIRMATION_ALIGNED" : "CANDLE_CONFIRMATION_OPPOSED"],
      warnings: aligned ? [] : ["CANDLE_CONFIRMATION_OPPOSED"],
      dataConfidence: "MEDIUM",
    });
  },
};

const nearbyLevelBlock: ScoringRuleEvaluator = {
  evaluate: (input) => {
    if (!input.direction || input.entry === undefined || input.target1 === undefined) {
      return unavailable("NEARBY_LEVEL_BLOCK_CONTEXT", "TRADE_LEVELS_UNAVAILABLE", "Trade levels are unavailable.");
    }
    const blockingLevel = input.direction === "LONG"
      ? input.userLevels?.resistanceLevel
      : input.userLevels?.supportLevel;
    if (blockingLevel === undefined) {
      return unavailable("NEARBY_LEVEL_BLOCK_CONTEXT", "USER_LEVELS_UNAVAILABLE", "Nearby support/resistance is unavailable.");
    }
    const rewardDistance = Math.abs(input.target1 - input.entry);
    const levelDistance = input.direction === "LONG"
      ? blockingLevel - input.entry
      : input.entry - blockingLevel;
    const blocked = levelDistance > 0 && levelDistance < rewardDistance * 0.5;
    return output("NEARBY_LEVEL_BLOCK_CONTEXT", {
      status: "EXECUTED",
      score: blocked ? 0 : 100,
      maxScore: 100,
      reasonCodes: [blocked ? "NEARBY_LEVEL_BLOCKS_TRADE" : "NO_NEARBY_LEVEL_BLOCK"],
      warnings: blocked ? ["NEARBY_LEVEL_BLOCKS_TRADE"] : [],
      dataConfidence: "HIGH",
      metadata: { blockingLevel, levelDistance, rewardDistance },
    });
  },
};

const stockKeyLevel: ScoringRuleEvaluator = {
  evaluate: (input) => {
    if (!input.direction || input.entry === undefined) {
      return unavailable("STOCK_KEY_LEVEL_CONTEXT", "USER_LEVELS_UNAVAILABLE", "Stock key levels are unavailable.");
    }
    const support = input.userLevels?.supportLevel;
    const resistance = input.userLevels?.resistanceLevel;
    if (support === undefined && resistance === undefined) {
      return unavailable("STOCK_KEY_LEVEL_CONTEXT", "USER_LEVELS_UNAVAILABLE", "Stock key levels are unavailable.");
    }
    const valid = input.direction === "LONG"
      ? (support === undefined || input.entry > support)
      : (resistance === undefined || input.entry < resistance);
    return output("STOCK_KEY_LEVEL_CONTEXT", {
      status: "EXECUTED",
      score: valid ? 100 : 0,
      maxScore: 100,
      reasonCodes: [valid ? "STOCK_KEY_LEVELS_SUPPORTIVE" : "STOCK_KEY_LEVELS_OPPOSED"],
      warnings: valid ? [] : ["STOCK_KEY_LEVELS_OPPOSED"],
      dataConfidence: "HIGH",
    });
  },
};

const directionGeometry: ScoringRuleEvaluator = {
  evaluate: (input) => {
    if (!input.direction || input.entry === undefined || input.stopLoss === undefined || input.target1 === undefined) {
      return unavailable("DIRECTION_GEOMETRY", "TRADE_GEOMETRY_UNAVAILABLE", "Trade geometry is unavailable.");
    }
    const valid = input.direction === "LONG"
      ? input.stopLoss < input.entry && input.entry < input.target1
      : input.target1 < input.entry && input.entry < input.stopLoss;
    return output("DIRECTION_GEOMETRY", {
      status: valid ? "EXECUTED" : "BLOCKED",
      score: valid ? 100 : 0,
      maxScore: 100,
      reasonCodes: [valid ? "VALID_GEOMETRY" : input.direction === "LONG" ? "INVALID_LONG_GEOMETRY" : "INVALID_SHORT_GEOMETRY"],
      warnings: valid ? [] : ["TRADE_GEOMETRY_INVALID"],
      dataConfidence: "HIGH",
    });
  },
};

const tradeManagementLevels: ScoringRuleEvaluator = {
  evaluate: (input) => {
    if (input.target1 === undefined || input.stopLoss === undefined) {
      return unavailable("TRADE_MANAGEMENT_LEVELS", "TRADE_MANAGEMENT_LEVELS_UNAVAILABLE", "Trade management levels are unavailable.");
    }
    return output("TRADE_MANAGEMENT_LEVELS", {
      status: "EXECUTED",
      score: input.target2 !== undefined ? 100 : 70,
      maxScore: 100,
      reasonCodes: [input.target2 !== undefined ? "MULTI_TARGET_PLAN_AVAILABLE" : "PRIMARY_TARGET_PLAN_AVAILABLE"],
      warnings: input.target2 === undefined ? ["SECONDARY_TARGET_UNAVAILABLE"] : [],
      dataConfidence: "HIGH",
    });
  },
};

export const indiaEquityScoringEvaluators: Record<string, ScoringRuleEvaluator> = {
  INDEX_VWAP_TREND_ALIGNMENT: indexVwapAlignment,
  INDEX_MULTI_TIMEFRAME_STRUCTURE: {
    evaluate: (input) => structureResult("INDEX_MULTI_TIMEFRAME_STRUCTURE", input.indexSnapshot, input.direction, "INDEX"),
  },
  MARKET_CHOPPINESS_CONTEXT: marketChoppiness,
  VIX_STABILITY_CONTEXT: vixStability,
  MARKET_BREADTH_CONTEXT: marketBreadth,
  SECTOR_RELATIVE_STRENGTH: {
    evaluate: (input) => comparisonResult(
      "SECTOR_RELATIVE_STRENGTH",
      input.sectorSnapshot?.changePercent,
      input.indexSnapshot?.changePercent,
      input.direction,
      {
        favorable: "SECTOR_OUTPERFORMING_INDEX",
        inline: "SECTOR_IN_LINE_WITH_INDEX",
        unfavorable: "SECTOR_UNDERPERFORMING_INDEX",
        primaryMissing: "SECTOR_SNAPSHOT_UNAVAILABLE",
        benchmarkMissing: "INDEX_SNAPSHOT_UNAVAILABLE",
      },
    ),
  },
  SECTOR_VWAP_CONTEXT: snapshotVwapEvaluator("SECTOR_VWAP_CONTEXT", (input) => input.sectorSnapshot, "SECTOR_SNAPSHOT_UNAVAILABLE"),
  SECTOR_TREND_CONTEXT: {
    evaluate: (input) => structureResult("SECTOR_TREND_CONTEXT", input.sectorSnapshot, input.direction, "SECTOR"),
  },
  SECTOR_BREADTH_CONTEXT: {
    evaluate: () => unavailable("SECTOR_BREADTH_CONTEXT", "SECTOR_BREADTH_UNAVAILABLE", "Sector breadth is unavailable."),
  },
  STOCK_VS_SECTOR_RS: {
    evaluate: (input) => comparisonResult(
      "STOCK_VS_SECTOR_RS",
      input.marketSnapshot?.changePercent,
      input.sectorSnapshot?.changePercent,
      input.direction,
      {
        favorable: "STOCK_OUTPERFORMING_SECTOR",
        inline: "STOCK_IN_LINE_WITH_SECTOR",
        unfavorable: "STOCK_UNDERPERFORMING_SECTOR",
        primaryMissing: "STOCK_SNAPSHOT_UNAVAILABLE",
        benchmarkMissing: "SECTOR_SNAPSHOT_UNAVAILABLE",
      },
    ),
  },
  STOCK_VS_INDEX_RS: {
    evaluate: (input) => comparisonResult(
      "STOCK_VS_INDEX_RS",
      input.marketSnapshot?.changePercent,
      input.indexSnapshot?.changePercent,
      input.direction,
      {
        favorable: "STOCK_OUTPERFORMING_INDEX",
        inline: "STOCK_IN_LINE_WITH_INDEX",
        unfavorable: "STOCK_UNDERPERFORMING_INDEX",
        primaryMissing: "STOCK_SNAPSHOT_UNAVAILABLE",
        benchmarkMissing: "INDEX_SNAPSHOT_UNAVAILABLE",
      },
    ),
  },
  STOCK_INTRADAY_STRUCTURE: {
    evaluate: (input) => structureResult("STOCK_INTRADAY_STRUCTURE", input.marketSnapshot, input.direction, "STOCK"),
  },
  STOCK_KEY_LEVEL_CONTEXT: stockKeyLevel,
  VOLUME_EXPANSION_CONTEXT: volumeExpansion,
  CANDLE_VOLUME_CONTEXT: candleVolume,
  VOLUME_DRY_UP_CONTEXT: volumeDryUp,
  VWAP_RECLAIM_HOLD_CONTEXT: vwapReclaimHold,
  SPREAD_DEPTH_CONTEXT: spreadDepth,
  SETUP_TYPE_CONTEXT: setupTypeContext,
  ENTRY_LEVEL_CONTEXT: entryLevelContext,
  STOPLOSS_STRUCTURE_CONTEXT: stoplossStructure,
  CANDLE_CONFIRMATION_CONTEXT: candleConfirmation,
  NEARBY_LEVEL_BLOCK_CONTEXT: nearbyLevelBlock,
  DIRECTION_GEOMETRY: directionGeometry,
  TRADE_MANAGEMENT_LEVELS: tradeManagementLevels,
};
