import assert from "node:assert/strict";
import test from "node:test";

import { ScoringEngineService } from "./scoring-engine.service.js";
import { ScoringRuleEvaluatorRegistryService } from "./scoring-rule-evaluator-registry.service.js";
import { ScoringTemplateRegistryService } from "./scoring-template-registry.service.js";

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
  assert.equal(result.scoreStatus, "READY_WITH_STALE_DATA");
  assert.equal(result.warnings.includes("Market-regime data is unavailable."), true);
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
