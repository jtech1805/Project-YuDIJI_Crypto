import assert from "node:assert/strict";
import test from "node:test";

import { AppError } from "../../../src/errors/AppError.js";
import {
  ScoringEngineService,
  type ScoringEngineInput,
  type ScoringEngineResult,
} from "../../../src/services/scoring/scoring-engine.service.js";
import { ScoringRuleEvaluatorRegistryService } from "../../../src/services/scoring/scoring-rule-evaluator-registry.service.js";
import { ScoringTemplateRegistryService } from "../../../src/services/scoring/scoring-template-registry.service.js";
import type { ScoringRuleEvaluationResult, ResolvedScoringTemplateDefinition, ScoringTemplateKey } from "../../../src/types/scoring.types.js";
import type { TradePermission } from "../../../src/types/trade.types.js";

const SYSTEM_TEMPLATE_KEYS = [
  "INDIA_EQUITY_INTRADAY_V1",
  "INDIA_EQUITY_SWING_V1",
  "CRYPTO_SPOT_INTRADAY_V1",
  "CRYPTO_PERPETUAL_INTRADAY_V1",
  "COMMODITY_MCX_INTRADAY_V1",
  "INDIA_FNO_FUTURE_INTRADAY_V1",
  "INDIA_FNO_OPTION_INTRADAY_V1",
] as const satisfies readonly ScoringTemplateKey[];

const registry = new ScoringTemplateRegistryService();

type SectionExpectation = {
  key: string;
  score: number;
  status: string;
  evaluators: Array<{ key: string; status: string }>;
};

type TemplateExpectation = {
  score: number;
  permission: TradePermission;
  scoreStatus: string;
  dataConfidence: string;
  sections: SectionExpectation[];
  reasonCodes: string[];
  warnings: string[];
  partialSections: string[];
  skippedEvaluators: string[];
  blockedEvaluators: string[];
};

const expectations: Record<ScoringTemplateKey, TemplateExpectation> = {
  INDIA_EQUITY_INTRADAY_V1: {
    score: 16.67,
    permission: "REJECT",
    scoreStatus: "PARTIAL_DATA",
    dataConfidence: "LOW",
    sections: [
      section("MARKET_REGIME", 0, "PARTIAL", [
        ["INDEX_VWAP_TREND_ALIGNMENT", "PARTIAL"],
        ["INDEX_MULTI_TIMEFRAME_STRUCTURE", "PARTIAL"],
        ["MARKET_CHOPPINESS_CONTEXT", "PARTIAL"],
        ["VIX_STABILITY_CONTEXT", "PARTIAL"],
        ["MARKET_BREADTH_CONTEXT", "PARTIAL"],
      ]),
      section("SECTOR_STRENGTH", 0, "PARTIAL", [
        ["SECTOR_RELATIVE_STRENGTH", "PARTIAL"],
        ["SECTOR_VWAP_CONTEXT", "PARTIAL"],
        ["SECTOR_TREND_CONTEXT", "PARTIAL"],
        ["SECTOR_BREADTH_CONTEXT", "PARTIAL"],
      ]),
      section("STOCK_RELATIVE_STRENGTH", 0, "PARTIAL", [
        ["STOCK_VS_SECTOR_RS", "PARTIAL"],
        ["STOCK_VS_INDEX_RS", "PARTIAL"],
        ["STOCK_INTRADAY_STRUCTURE", "PARTIAL"],
        ["STOCK_KEY_LEVEL_CONTEXT", "PARTIAL"],
      ]),
      section("VOLUME_RVOL", 0, "PARTIAL", [
        ["RVOL_CONTEXT", "PARTIAL"],
        ["VOLUME_EXPANSION_CONTEXT", "PARTIAL"],
        ["CANDLE_VOLUME_CONTEXT", "PARTIAL"],
        ["VOLUME_DRY_UP_CONTEXT", "PARTIAL"],
      ]),
      section("VWAP_LIQUIDITY", 0, "PARTIAL", [
        ["PRICE_VS_VWAP_CONTEXT", "SKIPPED"],
        ["VWAP_DISTANCE_CONTEXT", "SKIPPED"],
        ["VWAP_RECLAIM_HOLD_CONTEXT", "PARTIAL"],
        ["LIQUIDITY_FRESHNESS_CONTEXT", "SKIPPED"],
        ["SPREAD_DEPTH_CONTEXT", "PARTIAL"],
      ]),
      section("PRICE_ACTION", 0, "PARTIAL", [
        ["SETUP_TYPE_CONTEXT", "PARTIAL"],
        ["ENTRY_LEVEL_CONTEXT", "PARTIAL"],
        ["STOPLOSS_STRUCTURE_CONTEXT", "PARTIAL"],
        ["CANDLE_CONFIRMATION_CONTEXT", "PARTIAL"],
        ["NEARBY_LEVEL_BLOCK_CONTEXT", "PARTIAL"],
      ]),
      section("RISK_REWARD", 16.6667, "EXECUTED", [
        ["DIRECTION_GEOMETRY", "EXECUTED"],
        ["REWARD_RISK_RATIO", "EXECUTED"],
        ["TRADE_MANAGEMENT_LEVELS", "EXECUTED"],
      ]),
    ],
    reasonCodes: ["INDEX_SNAPSHOT_UNAVAILABLE", "RR_ACCEPTABLE", "VALID_GEOMETRY"],
    warnings: ["Index snapshot is unavailable.", "SECONDARY_TARGET_UNAVAILABLE"],
    partialSections: [
      "MARKET_REGIME",
      "SECTOR_STRENGTH",
      "STOCK_RELATIVE_STRENGTH",
      "VOLUME_RVOL",
      "VWAP_LIQUIDITY",
      "PRICE_ACTION",
    ],
    skippedEvaluators: ["PRICE_VS_VWAP_CONTEXT", "VWAP_DISTANCE_CONTEXT", "LIQUIDITY_FRESHNESS_CONTEXT"],
    blockedEvaluators: [],
  },
  INDIA_EQUITY_SWING_V1: {
    score: 80,
    permission: "TAKE_TRADE",
    scoreStatus: "PARTIAL_DATA",
    dataConfidence: "LOW",
    sections: [
      section("MARKET_REGIME", 0, "PARTIAL", [["INDEX_VWAP_TREND_ALIGNMENT", "PARTIAL"]]),
      section("SECTOR_STRENGTH", 0, "PARTIAL", [["SECTOR_STRENGTH_CONTEXT", "SKIPPED"]]),
      section("VOLUME_CONTEXT", 0, "PARTIAL", [
        ["RVOL_CONTEXT", "PARTIAL"],
        ["LIQUIDITY_FRESHNESS_CONTEXT", "SKIPPED"],
      ]),
      section("RISK_REWARD", 32, "EXECUTED", [["REWARD_RISK_RATIO", "EXECUTED"]]),
    ],
    reasonCodes: ["INDEX_SNAPSHOT_UNAVAILABLE", "SECTOR_DATA_UNAVAILABLE", "RR_ACCEPTABLE"],
    warnings: ["Index snapshot is unavailable.", "Sector-strength data is unavailable."],
    partialSections: ["MARKET_REGIME", "SECTOR_STRENGTH", "VOLUME_CONTEXT"],
    skippedEvaluators: ["SECTOR_STRENGTH_CONTEXT", "LIQUIDITY_FRESHNESS_CONTEXT"],
    blockedEvaluators: [],
  },
  CRYPTO_SPOT_INTRADAY_V1: {
    score: 80,
    permission: "TAKE_TRADE",
    scoreStatus: "PARTIAL_DATA",
    dataConfidence: "LOW",
    sections: [
      section("SYMBOL_TREND_CONTEXT", 0, "PARTIAL", [
        ["PRICE_VS_VWAP_CONTEXT", "SKIPPED"],
        ["VWAP_DISTANCE_CONTEXT", "SKIPPED"],
      ]),
      section("VOLUME_ORDER_FLOW", 0, "PARTIAL", [
        ["RVOL_CONTEXT", "PARTIAL"],
        ["CVD_CONTEXT", "SKIPPED"],
      ]),
      section("LIQUIDITY_CONTEXT", 0, "PARTIAL", [
        ["LIQUIDITY_FRESHNESS_CONTEXT", "SKIPPED"],
        ["ORDER_BOOK_CONTEXT", "SKIPPED"],
      ]),
      section("RISK_REWARD", 32, "EXECUTED", [["REWARD_RISK_RATIO", "EXECUTED"]]),
    ],
    reasonCodes: ["VWAP_DATA_UNAVAILABLE", "CVD_DATA_UNAVAILABLE", "RR_ACCEPTABLE"],
    warnings: ["VWAP position is unavailable.", "CVD data is unavailable."],
    partialSections: ["SYMBOL_TREND_CONTEXT", "VOLUME_ORDER_FLOW", "LIQUIDITY_CONTEXT"],
    skippedEvaluators: [
      "PRICE_VS_VWAP_CONTEXT",
      "VWAP_DISTANCE_CONTEXT",
      "CVD_CONTEXT",
      "LIQUIDITY_FRESHNESS_CONTEXT",
      "ORDER_BOOK_CONTEXT",
    ],
    blockedEvaluators: [],
  },
  CRYPTO_PERPETUAL_INTRADAY_V1: {
    score: 80,
    permission: "TAKE_TRADE",
    scoreStatus: "PARTIAL_DATA",
    dataConfidence: "LOW",
    sections: [
      section("SYMBOL_TREND_CONTEXT", 0, "PARTIAL", [
        ["PRICE_VS_VWAP_CONTEXT", "SKIPPED"],
        ["VWAP_DISTANCE_CONTEXT", "SKIPPED"],
      ]),
      section("VOLUME_ORDER_FLOW", 0, "PARTIAL", [
        ["RVOL_CONTEXT", "PARTIAL"],
        ["CVD_CONTEXT", "SKIPPED"],
      ]),
      section("LIQUIDITY_CONTEXT", 0, "PARTIAL", [
        ["LIQUIDITY_FRESHNESS_CONTEXT", "SKIPPED"],
        ["ORDER_BOOK_CONTEXT", "SKIPPED"],
      ]),
      section("DERIVATIVES_CONTEXT", 0, "PARTIAL", [["FUNDING_OPEN_INTEREST_CONTEXT", "SKIPPED"]]),
      section("RISK_REWARD", 32, "EXECUTED", [["REWARD_RISK_RATIO", "EXECUTED"]]),
    ],
    reasonCodes: ["FUNDING_DATA_UNAVAILABLE", "CVD_DATA_UNAVAILABLE", "RR_ACCEPTABLE"],
    warnings: ["Funding and open-interest data is unavailable.", "CVD data is unavailable."],
    partialSections: ["SYMBOL_TREND_CONTEXT", "VOLUME_ORDER_FLOW", "LIQUIDITY_CONTEXT", "DERIVATIVES_CONTEXT"],
    skippedEvaluators: [
      "PRICE_VS_VWAP_CONTEXT",
      "VWAP_DISTANCE_CONTEXT",
      "CVD_CONTEXT",
      "LIQUIDITY_FRESHNESS_CONTEXT",
      "ORDER_BOOK_CONTEXT",
      "FUNDING_OPEN_INTEREST_CONTEXT",
    ],
    blockedEvaluators: [],
  },
  COMMODITY_MCX_INTRADAY_V1: {
    score: 80,
    permission: "TAKE_TRADE",
    scoreStatus: "PARTIAL_DATA",
    dataConfidence: "LOW",
    sections: [
      section("CONTRACT_SANITY", 0, "PARTIAL", [["COMMODITY_CONTRACT_SANITY", "PARTIAL"]]),
      section("MARKET_CONTEXT", 0, "PARTIAL", [
        ["PRICE_VS_VWAP_CONTEXT", "SKIPPED"],
        ["VWAP_DISTANCE_CONTEXT", "SKIPPED"],
      ]),
      section("VOLATILITY_LIQUIDITY_CONTEXT", 0, "PARTIAL", [
        ["RVOL_CONTEXT", "PARTIAL"],
        ["LIQUIDITY_FRESHNESS_CONTEXT", "SKIPPED"],
      ]),
      section("RISK_REWARD", 32, "EXECUTED", [["REWARD_RISK_RATIO", "EXECUTED"]]),
    ],
    reasonCodes: ["COMMODITY_TEMPLATE_USED", "MCX_CONTRACT_VALIDATED", "RR_ACCEPTABLE"],
    warnings: ["COMMODITY_BASELINE_ONLY", "BROKER_LOGIN_REQUIRED_FOR_LIVE_MONITORING"],
    partialSections: ["CONTRACT_SANITY", "MARKET_CONTEXT", "VOLATILITY_LIQUIDITY_CONTEXT"],
    skippedEvaluators: ["PRICE_VS_VWAP_CONTEXT", "VWAP_DISTANCE_CONTEXT", "LIQUIDITY_FRESHNESS_CONTEXT"],
    blockedEvaluators: [],
  },
  INDIA_FNO_FUTURE_INTRADAY_V1: {
    score: 86.67,
    permission: "TAKE_TRADE",
    scoreStatus: "PARTIAL_DATA",
    dataConfidence: "LOW",
    sections: [
      section("CONTRACT_SANITY", 20, "EXECUTED", [["SYMBOL_METADATA_SANITY", "EXECUTED"]]),
      section("MARKET_CONTEXT", 0, "PARTIAL", [
        ["PRICE_VS_VWAP_CONTEXT", "SKIPPED"],
        ["VWAP_DISTANCE_CONTEXT", "SKIPPED"],
      ]),
      section("LIQUIDITY_CONTEXT", 0, "PARTIAL", [
        ["RVOL_CONTEXT", "PARTIAL"],
        ["LIQUIDITY_FRESHNESS_CONTEXT", "SKIPPED"],
      ]),
      section("RISK_REWARD", 32, "EXECUTED", [["REWARD_RISK_RATIO", "EXECUTED"]]),
    ],
    reasonCodes: ["SYMBOL_METADATA_VALID", "VWAP_DATA_UNAVAILABLE", "RR_ACCEPTABLE"],
    warnings: ["VWAP position is unavailable.", "RVOL baseline is unavailable."],
    partialSections: ["MARKET_CONTEXT", "LIQUIDITY_CONTEXT"],
    skippedEvaluators: ["PRICE_VS_VWAP_CONTEXT", "VWAP_DISTANCE_CONTEXT", "LIQUIDITY_FRESHNESS_CONTEXT"],
    blockedEvaluators: [],
  },
  INDIA_FNO_OPTION_INTRADAY_V1: {
    score: 86.67,
    permission: "TAKE_TRADE",
    scoreStatus: "PARTIAL_DATA",
    dataConfidence: "LOW",
    sections: [
      section("CONTRACT_SANITY", 20, "EXECUTED", [["SYMBOL_METADATA_SANITY", "EXECUTED"]]),
      section("MARKET_CONTEXT", 0, "PARTIAL", [
        ["PRICE_VS_VWAP_CONTEXT", "SKIPPED"],
        ["VWAP_DISTANCE_CONTEXT", "SKIPPED"],
      ]),
      section("LIQUIDITY_CONTEXT", 0, "PARTIAL", [
        ["RVOL_CONTEXT", "PARTIAL"],
        ["LIQUIDITY_FRESHNESS_CONTEXT", "SKIPPED"],
      ]),
      section("RISK_REWARD", 32, "EXECUTED", [["REWARD_RISK_RATIO", "EXECUTED"]]),
    ],
    reasonCodes: ["SYMBOL_METADATA_VALID", "VWAP_DATA_UNAVAILABLE", "RR_ACCEPTABLE"],
    warnings: ["VWAP position is unavailable.", "RVOL baseline is unavailable."],
    partialSections: ["MARKET_CONTEXT", "LIQUIDITY_CONTEXT"],
    skippedEvaluators: ["PRICE_VS_VWAP_CONTEXT", "VWAP_DISTANCE_CONTEXT", "LIQUIDITY_FRESHNESS_CONTEXT"],
    blockedEvaluators: [],
  },
};

function section(
  key: string,
  score: number,
  status: string,
  evaluators: Array<[string, string]>,
): SectionExpectation {
  return {
    key,
    score,
    status,
    evaluators: evaluators.map(([evaluatorKey, evaluatorStatus]) => ({
      key: evaluatorKey,
      status: evaluatorStatus,
    })),
  };
}

const systemInput = (key: ScoringTemplateKey, rewardRiskRatio = 2): ScoringEngineInput => {
  const template = registry.get(key, 1);
  return {
    scoringTemplateKey: key,
    scoringTemplateVersion: "1",
    marketType: template.marketType,
    tradeStyle: template.tradeStyle,
    instrumentType: template.instrumentType,
    rewardRiskRatio,
    evaluatedAt: new Date("2026-06-25T09:30:00.000Z"),
    direction: "LONG",
    entry: 100,
    stopLoss: 95,
    target1: 110,
    symbol: {
      status: "ACTIVE",
      marketType: template.marketType,
      exchange: template.marketType === "COMMODITY" ? "MCX" : template.marketType === "CRYPTO" ? "BINANCE" : "NSE",
      instrumentType: template.instrumentType,
      lotSize: 100,
      tickSize: 1,
      expiry: new Date("2026-07-30T00:00:00.000Z"),
      requiresBrokerLogin: template.marketType !== "CRYPTO",
    },
  };
};

const toResolvedSystemEquivalent = (
  key: ScoringTemplateKey,
  overrides: Partial<ResolvedScoringTemplateDefinition> = {},
): ResolvedScoringTemplateDefinition => {
  const template = registry.get(key, 1);
  return {
    id: "user-template-1",
    templateKey: `USER_${key}`,
    baseTemplateKey: key,
    templateName: `${key} User Copy`,
    scope: "USER",
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
    sections: template.sections.map((definition) => ({
      sectionKey: definition.key,
      label: definition.label,
      weight: definition.weight,
      enabled: true,
      missingDataPolicy: definition.missingDataPolicy,
      evaluators: definition.evaluators.map((evaluatorKey) => ({
        evaluatorKey,
        label: evaluatorKey,
        weight: Number((100 / definition.evaluators.length).toFixed(4)),
        enabled: true,
        missingDataPolicy: definition.missingDataPolicy,
        config: {},
      })),
    })),
    ...overrides,
  };
};

const assertIncludesAll = (actual: string[], expected: string[]): void => {
  for (const value of expected) {
    assert.equal(actual.includes(value), true, `${value} missing from ${JSON.stringify(actual)}`);
  }
};

const assertCharacterizedResult = (
  result: ScoringEngineResult,
  key: ScoringTemplateKey,
  expected: TemplateExpectation,
): void => {
  assert.equal(result.breakdown.templateKey, key);
  assert.equal(result.breakdown.templateVersion, 1);
  assert.equal(result.score, expected.score);
  assert.equal(result.permission, expected.permission);
  assert.equal(result.scoreStatus, expected.scoreStatus);
  assert.equal(result.dataConfidence, expected.dataConfidence);
  assert.equal(result.breakdown.totalScore, expected.score);
  assert.equal(result.breakdown.maxScore, 100);
  assertIncludesAll(result.reasonCodes, expected.reasonCodes);
  assertIncludesAll(result.warnings, expected.warnings);
  assert.deepEqual(result.breakdown.missingDataSummary.partialSections, expected.partialSections);
  assert.deepEqual(result.breakdown.missingDataSummary.skippedEvaluators, expected.skippedEvaluators);
  assert.deepEqual(result.breakdown.missingDataSummary.blockedEvaluators, expected.blockedEvaluators);

  assert.deepEqual(
    result.breakdown.sectionResults.map((item) => ({
      key: item.sectionKey,
      score: item.score,
      status: item.status,
      evaluators: item.evaluatorResults.map((evaluator) => ({
        key: evaluator.evaluatorKey,
        status: evaluator.status,
      })),
    })),
    expected.sections,
  );
}

for (const key of SYSTEM_TEMPLATE_KEYS) {
  test(`characterizes current scoring output for ${key}`, () => {
    const result = new ScoringEngineService().score(systemInput(key));
    assertCharacterizedResult(result, key, expectations[key]);
  });
}

test("reward-risk ratio below one hard rejects with current baseline score", () => {
  const result = new ScoringEngineService().score(systemInput("CRYPTO_SPOT_INTRADAY_V1", 0.8));
  assert.equal(result.score, 30);
  assert.equal(result.permission, "REJECT");
  assert.equal(result.reasonCodes.includes("RR_BELOW_MINIMUM"), true);
});

test("missing data under BLOCK makes final result unavailable and rejected", () => {
  const result = new ScoringEngineService().score({
    ...systemInput("CRYPTO_SPOT_INTRADAY_V1"),
    resolvedTemplate: {
      ...toResolvedSystemEquivalent("CRYPTO_SPOT_INTRADAY_V1"),
      sections: [
        {
          sectionKey: "BLOCKING_SECTION",
          label: "Blocking section",
          weight: 100,
          enabled: true,
          missingDataPolicy: "BLOCK",
          evaluators: [{
            evaluatorKey: "UNKNOWN_EVALUATOR_FOR_BLOCK",
            label: "Unknown evaluator for block",
            weight: 100,
            enabled: true,
            missingDataPolicy: "BLOCK",
            config: {},
          }],
        },
      ],
    },
  });
  assert.equal(result.score, 0);
  assert.equal(result.permission, "REJECT");
  assert.equal(result.scoreStatus, "UNAVAILABLE");
  assert.deepEqual(result.breakdown.missingDataSummary.blockedEvaluators, ["UNKNOWN_EVALUATOR_FOR_BLOCK"]);
  assert.equal(result.breakdown.sectionResults[0]?.status, "BLOCKED");
});

test("missing data under PARTIAL preserves partial status and zero scored section", () => {
  const result = new ScoringEngineService().score({
    ...systemInput("CRYPTO_SPOT_INTRADAY_V1"),
    resolvedTemplate: {
      ...toResolvedSystemEquivalent("CRYPTO_SPOT_INTRADAY_V1"),
      sections: [
        {
          sectionKey: "PARTIAL_SECTION",
          label: "Partial section",
          weight: 100,
          enabled: true,
          missingDataPolicy: "PARTIAL",
          evaluators: [{
            evaluatorKey: "LIQUIDITY_FRESHNESS_CONTEXT",
            label: "Liquidity freshness",
            weight: 100,
            enabled: true,
            missingDataPolicy: "PARTIAL",
            config: {},
          }],
        },
      ],
    },
  });
  assert.equal(result.score, 0);
  assert.equal(result.permission, "REJECT");
  assert.equal(result.scoreStatus, "PARTIAL_DATA");
  assert.deepEqual(result.breakdown.missingDataSummary.partialSections, ["PARTIAL_SECTION"]);
  assert.deepEqual(result.breakdown.missingDataSummary.skippedEvaluators, ["LIQUIDITY_FRESHNESS_CONTEXT"]);
});

test("missing data under IGNORE skips missing evaluator but partial section stays out of normalized total", () => {
  const result = new ScoringEngineService().score({
    ...systemInput("CRYPTO_SPOT_INTRADAY_V1"),
    resolvedTemplate: {
      ...toResolvedSystemEquivalent("CRYPTO_SPOT_INTRADAY_V1"),
      aggregationMode: "NORMALIZE_EXECUTED",
      sections: [
        {
          sectionKey: "IGNORE_SECTION",
          label: "Ignore section",
          weight: 100,
          enabled: true,
          missingDataPolicy: "IGNORE",
          evaluators: [
            {
              evaluatorKey: "LIQUIDITY_FRESHNESS_CONTEXT",
              label: "Liquidity freshness",
              weight: 50,
              enabled: true,
              missingDataPolicy: "IGNORE",
              config: {},
            },
            {
              evaluatorKey: "REWARD_RISK_RATIO",
              label: "Reward risk ratio",
              weight: 50,
              enabled: true,
              missingDataPolicy: "IGNORE",
              config: {},
            },
          ],
        },
      ],
    },
  });
  assert.equal(result.score, 0);
  assert.equal(result.permission, "REJECT");
  assert.equal(result.scoreStatus, "PARTIAL_DATA");
  assert.equal(result.breakdown.sectionResults[0]?.status, "PARTIAL");
  assert.equal(result.breakdown.sectionResults[0]?.score, 80);
  assert.deepEqual(result.breakdown.missingDataSummary.partialSections, ["IGNORE_SECTION"]);
  assert.deepEqual(result.breakdown.missingDataSummary.skippedEvaluators, ["LIQUIDITY_FRESHNESS_CONTEXT"]);
});

test("permission boundaries remain characterized at default thresholds", () => {
  const cases: Array<{ score: number; permission: TradePermission }> = [
    { score: 39.99, permission: "REJECT" },
    { score: 40, permission: "WAIT" },
    { score: 59.99, permission: "WAIT" },
    { score: 60, permission: "TAKE_SMALL_RISK" },
    { score: 74.99, permission: "TAKE_SMALL_RISK" },
    { score: 75, permission: "TAKE_TRADE" },
  ];
  for (const item of cases) {
    const result = new ScoringEngineService(
      registry,
      fixedScoreEvaluator("BOUNDARY_EVALUATOR", item.score),
    ).score({
      ...systemInput("CRYPTO_SPOT_INTRADAY_V1"),
      resolvedTemplate: singleEvaluatorTemplate("CRYPTO_SPOT_INTRADAY_V1", "BOUNDARY_EVALUATOR"),
    });
    assert.equal(result.score, item.score);
    assert.equal(result.permission, item.permission);
  }
});

test("resolved user template equivalent preserves system scoring semantics", () => {
  const engine = new ScoringEngineService();
  const baseInput = systemInput("CRYPTO_SPOT_INTRADAY_V1");
  const systemResult = engine.score(baseInput);
  const userTemplate = toResolvedSystemEquivalent("CRYPTO_SPOT_INTRADAY_V1", {
    id: "custom-template-id",
    templateKey: "USER_CRYPTO_SPOT_INTRADAY_V1_CUSTOM",
    templateName: "Crypto Spot Intraday Custom",
  });
  const userResult = engine.score({
    ...baseInput,
    scoringTemplateKey: userTemplate.templateKey,
    resolvedTemplate: userTemplate,
  });

  assert.equal(userResult.score, systemResult.score);
  assert.equal(userResult.permission, systemResult.permission);
  assert.equal(userResult.scoreStatus, systemResult.scoreStatus);
  assert.deepEqual(
    userResult.breakdown.sectionResults.map((item) => [item.sectionKey, item.score, item.status]),
    systemResult.breakdown.sectionResults.map((item) => [item.sectionKey, item.score, item.status]),
  );
  assert.deepEqual(
    userResult.breakdown.evaluatorResults.map((item) => [item.evaluatorKey, item.status]),
    systemResult.breakdown.evaluatorResults.map((item) => [item.evaluatorKey, item.status]),
  );
  assert.equal(userResult.breakdown.templateId, "custom-template-id");
  assert.equal(userResult.breakdown.templateScope, "USER");
  assert.equal(userResult.breakdown.templateName, "Crypto Spot Intraday Custom");
});

test("custom user-template permission thresholds change permission without changing score", () => {
  const resolvedTemplate = singleEvaluatorTemplate("CRYPTO_SPOT_INTRADAY_V1", "FIXED_70", {
    permissionThresholds: {
      rejectBelow: 20,
      waitBelow: 50,
      takeSmallRiskBelow: 90,
      takeTradeAtOrAbove: 90,
    },
  });
  const result = new ScoringEngineService(
    registry,
    fixedScoreEvaluator("FIXED_70", 70),
  ).score({
    ...systemInput("CRYPTO_SPOT_INTRADAY_V1"),
    resolvedTemplate,
  });
  assert.equal(result.score, 70);
  assert.equal(result.permission, "TAKE_SMALL_RISK");
});

test("current scoring errors remain unchanged", () => {
  assert.throws(
    () => new ScoringEngineService().score(systemInput("CRYPTO_SPOT_INTRADAY_V1", 0)),
    (error: unknown) => error instanceof AppError && error.message === "Invalid rewardRiskRatio",
  );
  assert.throws(
    () => new ScoringEngineService().score({
      ...systemInput("CRYPTO_SPOT_INTRADAY_V1"),
      scoringTemplateKey: "UNKNOWN_TEMPLATE",
    }),
    (error: unknown) => error instanceof AppError && error.message === "UNSUPPORTED_TEMPLATE",
  );
  assert.throws(
    () => new ScoringEngineService().score({
      ...systemInput("CRYPTO_SPOT_INTRADAY_V1"),
      marketType: "COMMODITY",
    }),
    (error: unknown) => error instanceof AppError && error.message === "SCORING_TEMPLATE_SCOPE_MISMATCH",
  );
});

function singleEvaluatorTemplate(
  baseTemplateKey: ScoringTemplateKey,
  evaluatorKey: string,
  overrides: Partial<ResolvedScoringTemplateDefinition> = {},
): ResolvedScoringTemplateDefinition {
  const template = registry.get(baseTemplateKey, 1);
  return {
    id: "single-evaluator-template",
    templateKey: `USER_${baseTemplateKey}_${evaluatorKey}`,
    baseTemplateKey,
    templateName: "Single Evaluator Template",
    scope: "USER",
    version: template.version,
    marketType: template.marketType,
    tradeStyle: template.tradeStyle,
    instrumentType: template.instrumentType,
    maxScore: 100,
    permissionThresholds: {
      rejectBelow: 40,
      waitBelow: 60,
      takeSmallRiskBelow: 75,
      takeTradeAtOrAbove: 75,
    },
    sections: [{
      sectionKey: "CONTROLLED_SECTION",
      label: "Controlled section",
      weight: 100,
      enabled: true,
      missingDataPolicy: "BLOCK",
      evaluators: [{
        evaluatorKey,
        label: evaluatorKey,
        weight: 100,
        enabled: true,
        missingDataPolicy: "BLOCK",
        config: {},
      }],
    }],
    ...overrides,
  };
}

function fixedScoreEvaluator(evaluatorKey: string, score: number): ScoringRuleEvaluatorRegistryService {
  return {
    evaluate: (key: string): ScoringRuleEvaluationResult => {
      assert.equal(key, evaluatorKey);
      return {
        evaluatorKey,
        status: "EXECUTED",
        score,
        maxScore: 100,
        reasonCodes: [`${evaluatorKey}_EXECUTED`],
        warnings: [],
        dataConfidence: "HIGH",
      };
    },
    has: (key: string): boolean => key === evaluatorKey,
    keys: (): string[] => [evaluatorKey],
  } as unknown as ScoringRuleEvaluatorRegistryService;
}
