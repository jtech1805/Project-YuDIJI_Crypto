import assert from "node:assert/strict";
import test from "node:test";

import { ScoringEngineService } from "../../../src/services/scoring-engine.service.js";
import { ScoringRuleEvaluatorRegistryService } from "../../../src/services/scoring-rule-evaluator-registry.service.js";
import { ScoringTemplateRegistryService } from "../../../src/services/scoring-template-registry.service.js";

const registry = new ScoringTemplateRegistryService();

for (const key of [
  "INDIA_EQUITY_INTRADAY_V1",
  "CRYPTO_SPOT_INTRADAY_V1",
  "CRYPTO_PERPETUAL_INTRADAY_V1",
  "COMMODITY_MCX_INTRADAY_V1",
] as const) {
  test(`template registry returns ${key}`, () => {
    const template = registry.get(key, 1);
    assert.equal(template.key, key);
    assert.equal(template.sections.reduce((total, section) => total + section.weight, 0), 100);
  });
}

test("template registry rejects incompatible market scope", () => {
  assert.throws(
    () => registry.validateCompatibility({
      template: registry.get("CRYPTO_SPOT_INTRADAY_V1", 1),
      marketType: "COMMODITY",
      tradeStyle: "INTRADAY",
      instrumentType: "SPOT",
    }),
    /SCORING_TEMPLATE_SCOPE_MISMATCH/,
  );
});

test("reward-risk evaluator preserves deterministic bands", () => {
  const evaluators = new ScoringRuleEvaluatorRegistryService();
  assert.equal(evaluators.evaluate("REWARD_RISK_RATIO", { rewardRiskRatio: 0.8 }).score, 30);
  assert.equal(evaluators.evaluate("REWARD_RISK_RATIO", { rewardRiskRatio: 1.2 }).score, 50);
  assert.equal(evaluators.evaluate("REWARD_RISK_RATIO", { rewardRiskRatio: 1.7 }).score, 70);
  assert.equal(evaluators.evaluate("REWARD_RISK_RATIO", { rewardRiskRatio: 2 }).score, 80);
});

test("RR below one hard rejects", () => {
  const result = new ScoringEngineService().score({
    scoringTemplateKey: "CRYPTO_SPOT_INTRADAY_V1",
    scoringTemplateVersion: "1",
    marketType: "CRYPTO",
    tradeStyle: "INTRADAY",
    instrumentType: "SPOT",
    rewardRiskRatio: 0.8,
  });
  assert.equal(result.score, 30);
  assert.equal(result.permission, "REJECT");
});

test("weighted aggregation normalizes only executed sections", () => {
  const result = new ScoringEngineService().score({
    scoringTemplateKey: "CRYPTO_SPOT_INTRADAY_V1",
    scoringTemplateVersion: "1",
    marketType: "CRYPTO",
    tradeStyle: "INTRADAY",
    instrumentType: "SPOT",
    rewardRiskRatio: 2,
  });
  assert.equal(result.score, 80);
  assert.equal(result.permission, "TAKE_TRADE");
  assert.equal(result.breakdown.sectionResults.find((section) => section.sectionKey === "RISK_REWARD")?.status, "EXECUTED");
});

test("missing market context is partial or skipped without fake score", () => {
  const result = new ScoringEngineService().score({
    scoringTemplateKey: "INDIA_EQUITY_INTRADAY_V1",
    scoringTemplateVersion: "1",
    marketType: "EQUITY",
    tradeStyle: "INTRADAY",
    instrumentType: "CASH",
    rewardRiskRatio: 2,
  });
  const marketSection = result.breakdown.sectionResults.find((section) => section.sectionKey === "MARKET_REGIME");
  assert.equal(marketSection?.status, "PARTIAL");
  assert.equal(marketSection?.score, 0);
  assert.equal(result.scoreStatus, "PARTIAL_DATA");
  assert.equal(result.warnings.includes("Index snapshot is unavailable."), true);
});

test("snapshot-backed VWAP evaluators score direction and distance deterministically", () => {
  const evaluators = new ScoringRuleEvaluatorRegistryService();
  const baseSnapshot = {
    resourceKey: "BINANCE:BINANCE:BTCUSDT",
    provider: "BINANCE",
    exchange: "BINANCE",
    latestPrice: 101,
    tickCount: 2,
    candles: { "1m": [], "3m": [], "5m": [], "15m": [] },
    vwap: {
      value: 100,
      cumulativePriceVolume: 3_000,
      cumulativeVolume: 30,
      positionVsVwap: "ABOVE" as const,
      distanceFromVwapPercent: 0.2,
      status: "READY" as const,
    },
    volume: { status: "PARTIAL" as const },
    freshness: { status: "FRESH" as const, ageMs: 100 },
    dataConfidence: "HIGH" as const,
  };

  assert.equal(evaluators.evaluate("PRICE_VS_VWAP_CONTEXT", {
    rewardRiskRatio: 2,
    direction: "LONG",
    marketSnapshot: baseSnapshot,
  }).score, 100);
  assert.equal(evaluators.evaluate("PRICE_VS_VWAP_CONTEXT", {
    rewardRiskRatio: 2,
    direction: "SHORT",
    marketSnapshot: baseSnapshot,
  }).score, 0);
  assert.equal(evaluators.evaluate("PRICE_VS_VWAP_CONTEXT", {
    rewardRiskRatio: 2,
    direction: "LONG",
    marketSnapshot: {
      ...baseSnapshot,
      vwap: { ...baseSnapshot.vwap, positionVsVwap: "NEAR" },
    },
  }).score, 60);

  assert.equal(evaluators.evaluate("VWAP_DISTANCE_CONTEXT", {
    rewardRiskRatio: 2,
    marketSnapshot: baseSnapshot,
  }).score, 100);
  assert.equal(evaluators.evaluate("VWAP_DISTANCE_CONTEXT", {
    rewardRiskRatio: 2,
    marketSnapshot: {
      ...baseSnapshot,
      vwap: { ...baseSnapshot.vwap, distanceFromVwapPercent: 1 },
    },
  }).score, 60);
  const extended = evaluators.evaluate("VWAP_DISTANCE_CONTEXT", {
    rewardRiskRatio: 2,
    marketSnapshot: {
      ...baseSnapshot,
      vwap: { ...baseSnapshot.vwap, distanceFromVwapPercent: 2 },
    },
  });
  assert.equal(extended.score, 20);
  assert.equal(extended.warnings.includes("PRICE_EXTENDED_FROM_VWAP"), true);
});

test("freshness RVOL and index evaluators remain honest about missing data", () => {
  const evaluators = new ScoringRuleEvaluatorRegistryService();
  const snapshot = {
    resourceKey: "BINANCE:BINANCE:BTCUSDT",
    provider: "BINANCE",
    exchange: "BINANCE",
    tickCount: 2,
    candles: { "1m": [], "3m": [], "5m": [], "15m": [] },
    vwap: {
      value: 100,
      cumulativePriceVolume: 3_000,
      cumulativeVolume: 30,
      positionVsVwap: "ABOVE" as const,
      status: "READY" as const,
    },
    volume: { relativeVolume: 1.6, status: "READY" as const },
    freshness: { status: "FRESH" as const, ageMs: 100 },
    dataConfidence: "HIGH" as const,
  };

  assert.equal(evaluators.evaluate("LIQUIDITY_FRESHNESS_CONTEXT", {
    rewardRiskRatio: 2,
    marketSnapshot: snapshot,
  }).score, 100);
  assert.equal(evaluators.evaluate("LIQUIDITY_FRESHNESS_CONTEXT", {
    rewardRiskRatio: 2,
    marketSnapshot: {
      ...snapshot,
      freshness: { status: "STALE", ageMs: 20_000 },
    },
  }).status, "PARTIAL");
  assert.equal(evaluators.evaluate("LIQUIDITY_FRESHNESS_CONTEXT", {
    rewardRiskRatio: 2,
    marketSnapshot: null,
  }).status, "SKIPPED");

  assert.equal(evaluators.evaluate("RVOL_CONTEXT", {
    rewardRiskRatio: 2,
    marketSnapshot: snapshot,
  }).score, 100);
  const missingRvol = evaluators.evaluate("RVOL_CONTEXT", {
    rewardRiskRatio: 2,
    marketSnapshot: {
      ...snapshot,
      volume: { status: "PARTIAL" },
    },
  });
  assert.equal(missingRvol.status, "PARTIAL");
  assert.equal(missingRvol.reasonCodes.includes("RVOL_BASELINE_UNAVAILABLE"), true);

  assert.equal(evaluators.evaluate("INDEX_VWAP_TREND_ALIGNMENT", {
    rewardRiskRatio: 2,
    direction: "LONG",
    indexSnapshot: snapshot,
  }).score, 100);
  assert.equal(evaluators.evaluate("INDEX_VWAP_TREND_ALIGNMENT", {
    rewardRiskRatio: 2,
    direction: "LONG",
    indexSnapshot: null,
  }).status, "PARTIAL");
});

test("CVD evaluator scores alignment using analyzer runtime", () => {
  const evaluators = new ScoringRuleEvaluatorRegistryService();
  const aligned = evaluators.evaluate("CVD_CONTEXT", {
    rewardRiskRatio: 2,
    direction: "LONG",
    runtime: {
      currentCvdAvailable: true,
      cvd: {
        available: true,
        currentCVD: 8,
        netDelta: 8,
        bufferCount: 12,
      },
    },
  });
  assert.equal(aligned.status, "EXECUTED");
  assert.equal(aligned.score, 100);
  assert.equal(aligned.reasonCodes.includes("CVD_ALIGNED_WITH_DIRECTION"), true);

  const opposed = evaluators.evaluate("CVD_CONTEXT", {
    rewardRiskRatio: 2,
    direction: "LONG",
    runtime: {
      currentCvdAvailable: true,
      cvd: {
        available: true,
        currentCVD: -3,
        netDelta: -3,
        bufferCount: 8,
      },
    },
  });
  assert.equal(opposed.status, "EXECUTED");
  assert.equal(opposed.score, 0);
  assert.equal(opposed.warnings.includes("CVD_OPPOSES_TRADE_DIRECTION"), true);
});

test("order book evaluator scores tight and wide spreads from runtime", () => {
  const evaluators = new ScoringRuleEvaluatorRegistryService();
  const tight = evaluators.evaluate("ORDER_BOOK_CONTEXT", {
    rewardRiskRatio: 2,
    runtime: {
      orderBookAvailable: true,
      orderBook: {
        available: true,
        bidLevels: 20,
        askLevels: 20,
        bestBid: 100,
        bestAsk: 100.01,
      },
    },
  });
  assert.equal(tight.status, "EXECUTED");
  assert.equal(tight.score, 100);
  assert.equal(tight.reasonCodes.includes("ORDER_BOOK_SPREAD_TIGHT"), true);

  const wide = evaluators.evaluate("ORDER_BOOK_CONTEXT", {
    rewardRiskRatio: 2,
    runtime: {
      orderBookAvailable: true,
      orderBook: {
        available: true,
        bidLevels: 20,
        askLevels: 20,
        bestBid: 100,
        bestAsk: 100.1,
      },
    },
  });
  assert.equal(wide.status, "EXECUTED");
  assert.equal(wide.score, 0);
  assert.equal(wide.warnings.includes("ORDER_BOOK_SPREAD_WIDE"), true);
});

test("partial liquidity section does not receive full credit for missing order book", () => {
  const result = new ScoringEngineService().score({
    scoringTemplateKey: "CRYPTO_SPOT_INTRADAY_V1",
    scoringTemplateVersion: "1",
    marketType: "CRYPTO",
    tradeStyle: "INTRADAY",
    instrumentType: "SPOT",
    rewardRiskRatio: 2,
    marketSnapshot: {
      resourceKey: "BINANCE:BINANCE:BTCUSDT",
      provider: "BINANCE",
      exchange: "BINANCE",
      tickCount: 2,
      candles: { "1m": [], "3m": [], "5m": [], "15m": [] },
      vwap: { cumulativePriceVolume: 0, cumulativeVolume: 0, status: "UNAVAILABLE" },
      volume: { status: "UNAVAILABLE" },
      freshness: { status: "FRESH", ageMs: 100 },
      dataConfidence: "MEDIUM",
    },
  });
  const liquidity = result.breakdown.sectionResults.find((section) => section.sectionKey === "LIQUIDITY_CONTEXT");
  assert.equal(liquidity?.status, "PARTIAL");
  assert.equal(liquidity?.score, 10);
});

test("commodity sanity reports contract metadata and preserves baseline warnings", () => {
  const result = new ScoringEngineService().score({
    scoringTemplateKey: "COMMODITY_MCX_INTRADAY_V1",
    scoringTemplateVersion: "1",
    marketType: "COMMODITY",
    tradeStyle: "INTRADAY",
    instrumentType: "FUTURE",
    rewardRiskRatio: 2,
    evaluatedAt: new Date("2026-06-25T00:00:00.000Z"),
    symbol: {
      status: "ACTIVE",
      marketType: "COMMODITY",
      exchange: "MCX",
      instrumentType: "FUTURE",
      lotSize: 100,
      tickSize: 1,
      expiry: new Date("2026-06-27T00:00:00.000Z"),
      requiresBrokerLogin: true,
    },
  });
  assert.equal(result.reasonCodes.includes("MCX_CONTRACT_VALIDATED"), true);
  assert.equal(result.warnings.includes("COMMODITY_BASELINE_ONLY"), true);
  assert.equal(result.warnings.includes("EXPIRY_NEAR_WARNING"), true);
  assert.equal(result.warnings.includes("BROKER_LOGIN_REQUIRED_FOR_LIVE_MONITORING"), true);
});

test("engine breakdown exposes template sections evaluators and missing summary", () => {
  const result = new ScoringEngineService().score({
    scoringTemplateKey: "CRYPTO_PERPETUAL_INTRADAY_V1",
    scoringTemplateVersion: "1",
    marketType: "CRYPTO",
    tradeStyle: "INTRADAY",
    instrumentType: "FUTURE",
    rewardRiskRatio: 1.6,
  });
  assert.equal(result.breakdown.templateKey, "CRYPTO_PERPETUAL_INTRADAY_V1");
  assert.equal(result.breakdown.evaluatorResults.length > 0, true);
  assert.equal(result.breakdown.missingDataSummary.skippedEvaluators.includes("FUNDING_OPEN_INTEREST_CONTEXT"), true);
});
