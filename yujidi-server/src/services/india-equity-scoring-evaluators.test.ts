import assert from "node:assert/strict";
import test from "node:test";

import type { CandleSnapshot, MarketSnapshot } from "../types/market-snapshot.types.js";
import { ScoringEngineService } from "./scoring-engine.service.js";
import { ScoringRuleEvaluatorRegistryService } from "./scoring-rule-evaluator-registry.service.js";

const candle = (
  timeframe: "1m" | "5m" | "15m",
  open: number,
  close: number,
  volume = 100,
  minute = 0,
): CandleSnapshot => ({
  timeframe,
  startTime: new Date(`2026-06-25T09:${String(minute).padStart(2, "0")}:00.000Z`),
  endTime: new Date(`2026-06-25T09:${String(minute + 1).padStart(2, "0")}:00.000Z`),
  open,
  high: Math.max(open, close),
  low: Math.min(open, close),
  close,
  volume,
  tickCount: 2,
});

const snapshot = (overrides: Partial<MarketSnapshot> = {}): MarketSnapshot => ({
  resourceKey: "ANGEL_ONE:user-a:NSE:PRIMARY",
  provider: "ANGEL_ONE",
  exchange: "NSE",
  latestPrice: 104,
  previousPrice: 103,
  previousClose: 100,
  changePercent: 4,
  bid: 103.95,
  ask: 104.05,
  spreadPercent: 0.0962,
  tickCount: 20,
  candles: {
    "1m": [
      candle("1m", 99, 100, 100, 0),
      candle("1m", 100, 101, 100, 1),
      candle("1m", 101, 102, 100, 2),
      candle("1m", 102, 103, 100, 3),
      candle("1m", 103, 104, 180, 4),
    ],
    "3m": [],
    "5m": [
      candle("5m", 100, 101, 300, 0),
      candle("5m", 101, 103, 400, 5),
      candle("5m", 103, 104, 500, 10),
    ],
    "15m": [
      candle("15m", 98, 100, 600, 0),
      candle("15m", 100, 104, 800, 15),
    ],
  },
  vwap: {
    value: 102,
    cumulativePriceVolume: 10_200,
    cumulativeVolume: 100,
    positionVsVwap: "ABOVE",
    distanceFromVwapPercent: 0.2,
    status: "READY",
  },
  volume: {
    latestVolume: 180,
    cumulativeVolume: 580,
    relativeVolume: 1.8,
    volumeTrend: "EXPANDING",
    status: "READY",
  },
  freshness: { status: "FRESH", ageMs: 500 },
  dataConfidence: "HIGH",
  ...overrides,
});

const evaluate = (
  key: string,
  overrides: Record<string, unknown> = {},
) => new ScoringRuleEvaluatorRegistryService().evaluate(key, {
  rewardRiskRatio: 2,
  direction: "LONG",
  ...overrides,
});

test("index VWAP alignment scores full zero and unavailable honestly", () => {
  assert.equal(evaluate("INDEX_VWAP_TREND_ALIGNMENT", {
    indexSnapshot: snapshot(),
  }).score, 100);
  assert.equal(evaluate("INDEX_VWAP_TREND_ALIGNMENT", {
    indexSnapshot: snapshot({
      vwap: {
        value: 105,
        cumulativePriceVolume: 10_500,
        cumulativeVolume: 100,
        positionVsVwap: "BELOW",
        status: "READY",
      },
    }),
  }).score, 0);
  const missing = evaluate("INDEX_VWAP_TREND_ALIGNMENT", { indexSnapshot: null });
  assert.equal(missing.status, "PARTIAL");
  assert.equal(missing.reasonCodes.includes("INDEX_SNAPSHOT_UNAVAILABLE"), true);
});

test("index structure scores both aligned and one aligned", () => {
  assert.equal(evaluate("INDEX_MULTI_TIMEFRAME_STRUCTURE", {
    indexSnapshot: snapshot(),
  }).score, 100);
  const oneAligned = snapshot();
  oneAligned.candles["15m"] = [
    candle("15m", 100, 104, 600, 0),
    candle("15m", 104, 101, 800, 15),
  ];
  assert.equal(evaluate("INDEX_MULTI_TIMEFRAME_STRUCTURE", {
    indexSnapshot: oneAligned,
  }).score, 50);
});

test("market choppiness and VIX stability use real snapshots", () => {
  assert.equal(evaluate("MARKET_CHOPPINESS_CONTEXT", {
    indexSnapshot: snapshot(),
  }).score, 100);
  assert.equal(evaluate("VIX_STABILITY_CONTEXT", {
    vixSnapshot: snapshot({ changePercent: 2 }),
  }).score, 100);
  const missing = evaluate("VIX_STABILITY_CONTEXT", { vixSnapshot: null });
  assert.equal(missing.status, "PARTIAL");
  assert.equal(missing.reasonCodes.includes("VIX_DATA_UNAVAILABLE"), true);
});

test("sector relative strength supports LONG SHORT and missing sector", () => {
  assert.equal(evaluate("SECTOR_RELATIVE_STRENGTH", {
    sectorSnapshot: snapshot({ changePercent: 2 }),
    indexSnapshot: snapshot({ changePercent: 1 }),
  }).score, 100);
  assert.equal(evaluate("SECTOR_RELATIVE_STRENGTH", {
    direction: "SHORT",
    sectorSnapshot: snapshot({ changePercent: -2 }),
    indexSnapshot: snapshot({ changePercent: -1 }),
  }).score, 100);
  assert.equal(evaluate("SECTOR_RELATIVE_STRENGTH", {
    sectorSnapshot: null,
    indexSnapshot: snapshot(),
  }).status, "PARTIAL");
});

test("stock relative strength and structure score against sector and index", () => {
  assert.equal(evaluate("STOCK_VS_SECTOR_RS", {
    marketSnapshot: snapshot({ changePercent: 3 }),
    sectorSnapshot: snapshot({ changePercent: 2 }),
  }).score, 100);
  assert.equal(evaluate("STOCK_VS_INDEX_RS", {
    marketSnapshot: snapshot({ changePercent: 1.1 }),
    indexSnapshot: snapshot({ changePercent: 1 }),
  }).score, 60);
  assert.equal(evaluate("STOCK_INTRADAY_STRUCTURE", {
    marketSnapshot: snapshot(),
  }).score, 100);
  assert.equal(evaluate("STOCK_KEY_LEVEL_CONTEXT", {
    entry: 104,
    userLevels: undefined,
  }).status, "PARTIAL");
});

test("volume evaluators score RVOL expansion and dry-up", () => {
  assert.equal(evaluate("RVOL_CONTEXT", {
    marketSnapshot: snapshot(),
  }).score, 100);
  assert.equal(evaluate("VOLUME_EXPANSION_CONTEXT", {
    marketSnapshot: snapshot(),
  }).score, 100);
  const dry = snapshot();
  dry.candles["1m"][4] = candle("1m", 103, 104, 20, 4);
  const result = evaluate("VOLUME_DRY_UP_CONTEXT", { marketSnapshot: dry });
  assert.equal(result.score, 0);
  assert.equal(result.warnings.includes("VOLUME_DRY_UP_DETECTED"), true);
});

test("spread depth remains partial when bid ask data is unavailable", () => {
  assert.equal(evaluate("SPREAD_DEPTH_CONTEXT", {
    marketSnapshot: snapshot(),
  }).score, 100);
  const { bid: _bid, ask: _ask, spreadPercent: _spread, ...missing } = snapshot();
  assert.equal(evaluate("SPREAD_DEPTH_CONTEXT", {
    marketSnapshot: missing,
  }).status, "PARTIAL");
});

test("price action evaluates setup geometry candles and nearby level blocks", () => {
  assert.equal(evaluate("SETUP_TYPE_CONTEXT", {
    setupType: "BREAKOUT",
  }).status, "EXECUTED");
  assert.equal(evaluate("SETUP_TYPE_CONTEXT").status, "PARTIAL");
  assert.equal(evaluate("STOPLOSS_STRUCTURE_CONTEXT", {
    entry: 104,
    stopLoss: 100,
  }).status, "PARTIAL");
  assert.equal(evaluate("CANDLE_CONFIRMATION_CONTEXT", {
    marketSnapshot: snapshot(),
  }).score, 100);
  const blocked = evaluate("NEARBY_LEVEL_BLOCK_CONTEXT", {
    entry: 104,
    target1: 114,
    userLevels: { resistanceLevel: 106 },
  });
  assert.equal(blocked.score, 0);
  assert.equal(blocked.warnings.includes("NEARBY_LEVEL_BLOCKS_TRADE"), true);
});

test("India equity template executes available criteria and sums weighted sections", () => {
  const primary = snapshot({ changePercent: 3 });
  const index = snapshot({ changePercent: 1 });
  const sector = snapshot({ changePercent: 2 });
  const vix = snapshot({ changePercent: 2 });
  const result = new ScoringEngineService().score({
    scoringTemplateKey: "INDIA_EQUITY_INTRADAY_V1",
    scoringTemplateVersion: "1",
    marketType: "EQUITY",
    tradeStyle: "INTRADAY",
    instrumentType: "CASH",
    rewardRiskRatio: 2,
    direction: "LONG",
    entry: 104,
    stopLoss: 99,
    target1: 114,
    target2: 120,
    setupType: "BREAKOUT",
    userLevels: {
      breakoutLevel: 103.9,
      supportLevel: 100,
      resistanceLevel: 118,
    },
    marketSnapshot: primary,
    indexSnapshot: index,
    sectorSnapshot: sector,
    vixSnapshot: vix,
  });

  const sectionSum = result.breakdown.sectionResults
    .reduce((total, section) => total + section.score, 0);
  assert.equal(result.score, Number(sectionSum.toFixed(2)));
  assert.equal(
    result.breakdown.evaluatorResults.find(
      (item) => item.evaluatorKey === "STOCK_VS_INDEX_RS",
    )?.status,
    "EXECUTED",
  );
  assert.equal(
    result.breakdown.evaluatorResults.find(
      (item) => item.evaluatorKey === "SECTOR_BREADTH_CONTEXT",
    )?.status,
    "PARTIAL",
  );
});
