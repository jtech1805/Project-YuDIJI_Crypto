import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import type { MarketSnapshot } from "../types/market-snapshot.types.js";
import {
  calculateTradeGeometry,
  type CreateScoreCheckInput,
  ScoreCheckService,
} from "./score-check.service.js";
import { ScoringContextBuilderService } from "./scoring-context-builder.service.js";

const userId = "69e64c5f9042aac89c8c83f8";
const symbolId = "65abc0000000000000000001";
const fixedNow = new Date("2026-06-23T10:00:00.000Z");

const execResult = <T>(value: T) => ({
  exec: async () => value,
});

const leanResult = <T>(value: T) => ({
  lean: () => execResult(value),
});

const sortableLeanResult = <T>(value: T) => ({
  sort: () => leanResult(value),
});

const idString = (value: unknown): string => String(value);

const matchesFilter = (record: Record<string, any>, filter: Record<string, any>): boolean => {
  for (const [key, value] of Object.entries(filter)) {
    const recordValue = record[key];
    if (recordValue instanceof Types.ObjectId || value instanceof Types.ObjectId) {
      if (idString(recordValue) !== idString(value)) return false;
      continue;
    }
    if (recordValue !== value) return false;
  }
  return true;
};

const applyUpdate = (record: Record<string, any>, update: Record<string, any>): Record<string, any> => {
  if (update.$set && typeof update.$set === "object") {
    Object.assign(record, update.$set);
  }
  return record;
};

const activeSymbol = (overrides: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(symbolId),
  symbol: "MCX:GOLD:04DEC2026:FUTURE",
  displayName: "MCX GOLD 04DEC2026 FUTURE",
  provider: "ANGEL_ONE",
  marketType: "COMMODITY",
  exchange: "MCX",
  instrumentType: "FUTURE",
  providerSymbol: "GOLD04DEC26FUT",
  instrumentToken: "495213",
  lotSize: 100,
  tickSize: 1,
  expiry: new Date("2026-12-04T00:00:00.000Z"),
  requiresBrokerLogin: true,
  status: "ACTIVE",
  ...overrides,
});

const baseScoreInput = (overrides: Partial<CreateScoreCheckInput> = {}): CreateScoreCheckInput => ({
  symbolId,
  marketType: "COMMODITY",
  tradeStyle: "INTRADAY",
  instrumentType: "FUTURE",
  direction: "LONG",
  entry: 100,
  stopLoss: 95,
  target1: 110,
  scoringTemplateKey: "COMMODITY_MCX_INTRADAY_V1",
  scoringTemplateVersion: "1",
  ...overrides,
});

const commodityScoreInput = (
  overrides: Partial<CreateScoreCheckInput> = {},
): CreateScoreCheckInput => baseScoreInput({
  scoringTemplateKey: "COMMODITY_MCX_INTRADAY_V1",
  ...overrides,
});

const createHarness = (
  symbol: Record<string, unknown> | null = activeSymbol(),
  dependencyOverrides: Record<string, unknown> = {},
) => {
  const scoreChecks: Record<string, any>[] = [];
  const snapshots: Record<string, any>[] = [];
  const auditEvents: Record<string, any>[] = [];
  let riskMutationCount = 0;

  const scoreCheckRepository = {
    create: async (input: Record<string, unknown>) => {
      const scoreCheck = {
        _id: new Types.ObjectId(),
        ...input,
        createdAt: fixedNow,
        updatedAt: fixedNow,
      };
      scoreChecks.push(scoreCheck);
      return scoreCheck;
    },
    find: (filter: Record<string, unknown>) => {
      return sortableLeanResult(scoreChecks.filter((scoreCheck) => matchesFilter(scoreCheck, filter)));
    },
    findOne: (filter: Record<string, unknown>) => {
      return leanResult(scoreChecks.find((scoreCheck) => matchesFilter(scoreCheck, filter)) ?? null);
    },
    findOneAndUpdate: (filter: Record<string, unknown>, update: Record<string, unknown>) => {
      const scoreCheck = scoreChecks.find((candidate) => matchesFilter(candidate, filter));
      if (!scoreCheck) return leanResult(null);
      applyUpdate(scoreCheck, update);
      scoreCheck.updatedAt = fixedNow;
      return leanResult(scoreCheck);
    },
  };

  const tradeScoreSnapshotRepository = {
    create: async (input: Record<string, unknown>) => {
      const snapshot = {
        _id: new Types.ObjectId(),
        ...input,
        createdAt: fixedNow,
        updatedAt: fixedNow,
      };
      snapshots.push(snapshot);
      return snapshot;
    },
  };

  const symbolRepository = {
    findOne: () => leanResult(symbol),
  };
  const scoringContextBuilder = dependencyOverrides.scoringContextBuilder
    ?? new ScoringContextBuilderService({
      symbolRepository: symbolRepository as never,
      runtimeProvider: {
        getAnalyzerRuntimeSnapshot: () => ({
          priceBuffer: { available: false, count: 0, returnedCount: 0 },
          cvd: { available: false, bufferCount: 0, returnedCount: 0 },
          cooldown: { active: false, activeCount: 0, remainingMs: 0 },
          orderBook: { available: false, bidLevels: 0, askLevels: 0 },
        }),
        getTradeMonitoringHealthSnapshot: () => [],
        getActiveTradeSubscriptionSnapshot: () => [],
      },
      ...(dependencyOverrides.marketSnapshotService
        ? { marketSnapshotService: dependencyOverrides.marketSnapshotService as never }
        : {}),
      ...(dependencyOverrides.templateOrchestrator
        ? { templateOrchestrator: dependencyOverrides.templateOrchestrator as never }
        : {}),
      ...(dependencyOverrides.templateResourceResolver
        ? { templateResourceResolver: dependencyOverrides.templateResourceResolver as never }
        : {}),
    });

  const service = new ScoreCheckService({
    scoreCheckRepository: scoreCheckRepository as never,
    tradeScoreSnapshotRepository: tradeScoreSnapshotRepository as never,
    symbolRepository: symbolRepository as never,
    auditLogService: {
      record: async (event) => {
        auditEvents.push(event);
      },
    },
    now: () => fixedNow,
    scoringContextBuilder: scoringContextBuilder as never,
    ...dependencyOverrides,
  });

  return {
    auditEvents,
    get riskMutationCount() {
      return riskMutationCount;
    },
    mutateRiskState: () => {
      riskMutationCount += 1;
    },
    scoreChecks,
    service,
    snapshots,
  };
};

test("ScoreCheckService accepts valid LONG geometry", async () => {
  const { service } = createHarness();

  const scoreCheck = await service.createScoreCheck(userId, baseScoreInput());

  assert.equal(scoreCheck.direction, "LONG");
  assert.equal(scoreCheck.reasonCodes.includes("VALID_GEOMETRY"), true);
});

test("ScoreCheckService rejects invalid LONG geometry", async () => {
  const { service } = createHarness();

  await assert.rejects(
    service.createScoreCheck(userId, baseScoreInput({ stopLoss: 101 })),
    /Invalid ScoreCheck payload/,
  );
});

test("ScoreCheckService accepts valid SHORT geometry", async () => {
  const { service } = createHarness();

  const scoreCheck = await service.createScoreCheck(
    userId,
    baseScoreInput({
      direction: "SHORT",
      entry: 100,
      stopLoss: 105,
      target1: 90,
    }),
  );

  assert.equal(scoreCheck.direction, "SHORT");
  assert.equal(scoreCheck.rewardRiskRatio, 2);
});

test("ScoreCheckService rejects invalid SHORT geometry", async () => {
  const { service } = createHarness();

  await assert.rejects(
    service.createScoreCheck(
      userId,
      baseScoreInput({
        direction: "SHORT",
        entry: 100,
        stopLoss: 95,
        target1: 90,
      }),
    ),
    /Invalid ScoreCheck payload/,
  );
});

test("calculateTradeGeometry calculates LONG risk reward and RR", () => {
  assert.deepEqual(
    calculateTradeGeometry({
      direction: "LONG",
      entry: 100,
      stopLoss: 95,
      target1: 110,
    }),
    {
      riskPerUnit: 5,
      rewardPerUnit: 10,
      rewardRiskRatio: 2,
    },
  );
});

test("calculateTradeGeometry calculates SHORT risk reward and RR", () => {
  assert.deepEqual(
    calculateTradeGeometry({
      direction: "SHORT",
      entry: 100,
      stopLoss: 105,
      target1: 90,
    }),
    {
      riskPerUnit: 5,
      rewardPerUnit: 10,
      rewardRiskRatio: 2,
    },
  );
});

test("ScoreCheckService returns REJECT when RR is below 1", async () => {
  const { service } = createHarness();

  const scoreCheck = await service.createScoreCheck(
    userId,
    baseScoreInput({
      entry: 100,
      stopLoss: 90,
      target1: 105,
    }),
  );

  assert.equal(scoreCheck.permission, "REJECT");
  assert.equal(scoreCheck.score, 30);
});

test("ScoreCheckService returns WAIT when RR is 1 to below 1.5", async () => {
  const { service } = createHarness();

  const scoreCheck = await service.createScoreCheck(
    userId,
    baseScoreInput({
      entry: 100,
      stopLoss: 90,
      target1: 112,
    }),
  );

  assert.equal(scoreCheck.permission, "WAIT");
  assert.equal(scoreCheck.score, 50);
});

test("ScoreCheckService returns TAKE_SMALL_RISK when RR is 1.5 to below 2", async () => {
  const { service } = createHarness();

  const scoreCheck = await service.createScoreCheck(
    userId,
    baseScoreInput({
      entry: 100,
      stopLoss: 90,
      target1: 116,
    }),
  );

  assert.equal(scoreCheck.permission, "TAKE_SMALL_RISK");
  assert.equal(scoreCheck.score, 70);
});

test("ScoreCheckService returns TAKE_TRADE when RR is 2 or above", async () => {
  const { service } = createHarness();

  const scoreCheck = await service.createScoreCheck(userId, baseScoreInput());

  assert.equal(scoreCheck.permission, "TAKE_TRADE");
  assert.equal(scoreCheck.score, 80);
});

test("ScoreCheckService does not mutate risk state", async () => {
  const harness = createHarness();

  await harness.service.createScoreCheck(userId, baseScoreInput());

  assert.equal(harness.riskMutationCount, 0);
});

test("ScoreCheckService creates TradeScoreSnapshot", async () => {
  const { service, snapshots } = createHarness();

  const scoreCheck = await service.createScoreCheck(userId, baseScoreInput());

  assert.equal(snapshots.length, 1);
  assert.equal(String(scoreCheck.tradeScoreSnapshotId), String(snapshots[0]!._id));
  const breakdown = snapshots[0]!.breakdown as Record<string, any>;
  assert.equal(breakdown.templateKey, "COMMODITY_MCX_INTRADAY_V1");
  assert.equal(Array.isArray(breakdown.sectionResults), true);
  assert.equal(Array.isArray(breakdown.evaluatorResults), true);
});

test("ScoreCheckService stores safe runtime snapshot from shared scoring context", async () => {
  const cryptoSymbol = activeSymbol({
    symbol: "BTCUSDT",
    displayName: "BTC / USDT",
    provider: "BINANCE",
    marketType: "CRYPTO",
    exchange: "BINANCE",
    instrumentType: "SPOT",
    providerSymbol: "BTCUSDT",
    instrumentToken: "BTCUSDT",
    requiresBrokerLogin: false,
  });
  const { service, snapshots } = createHarness(cryptoSymbol, {
    scoringContextBuilder: {
      build: async () => ({
        symbolRecord: cryptoSymbol,
        resourceKey: "BINANCE:BINANCE:BTCUSDT",
        runtime: {
          streamKey: "BTCUSDT",
          latestPrice: 100,
          priceBuffer: { available: true, count: 50, returnedCount: 0, changePercent: 1.2 },
          cvd: { available: true, currentCVD: 8, netDelta: 8, bufferCount: 20, returnedCount: 0 },
          cooldown: { active: false, activeCount: 0, remainingMs: 0 },
          orderBook: { available: true, bidLevels: 20, askLevels: 20, bestBid: 100, bestAsk: 100.01 },
        },
        marketSnapshot: null,
        marketSnapshotSummary: null,
        templateResources: null,
        snapshotRefs: { marketSnapshotId: "BINANCE:BINANCE:BTCUSDT" },
        runtimeSnapshotSummary: {
          activeTradeMonitoring: {
            subscriptionKey: "BINANCE:BINANCE:BTCUSDT",
            available: false,
          },
        },
        evaluatorInput: {
          scoringTemplateKey: "CRYPTO_SPOT_INTRADAY_V1",
          scoringTemplateVersion: "1",
          marketType: "CRYPTO",
          tradeStyle: "INTRADAY",
          instrumentType: "SPOT",
          rewardRiskRatio: 2,
          direction: "LONG",
          entry: 100,
          stopLoss: 95,
          target1: 110,
          runtime: {
            priceBufferAvailable: true,
            currentCvdAvailable: true,
            orderBookAvailable: true,
            cvd: { available: true, currentCVD: 8, netDelta: 8, bufferCount: 20 },
            orderBook: { available: true, bidLevels: 20, askLevels: 20, bestBid: 100, bestAsk: 100.01 },
          },
        },
        response: {},
      }),
    },
  });

  await service.createScoreCheck(userId, baseScoreInput({
    marketType: "CRYPTO",
    instrumentType: "SPOT",
    scoringTemplateKey: "CRYPTO_SPOT_INTRADAY_V1",
  }));

  assert.equal((snapshots[0]!.runtimeSnapshot as any).cvd.currentCVD, 8);
  assert.equal((snapshots[0]!.runtimeSnapshot as any).orderBook.bestAsk, 100.01);
  assert.equal(JSON.stringify(snapshots[0]!.runtimeSnapshot).includes("items"), false);
});

test("ScoreCheckService audits SCORE_CHECK_CREATED and SCORE_CALCULATED", async () => {
  const { auditEvents, service } = createHarness();

  await service.createScoreCheck(userId, baseScoreInput());

  assert.deepEqual(auditEvents.map((event) => event.action), [
    "SCORE_CHECK_CREATED",
    "SCORE_CALCULATED",
  ]);
});

test("ScoreCheckService rejects missing symbol safely", async () => {
  const { service } = createHarness(null);

  await assert.rejects(
    service.createScoreCheck(userId, baseScoreInput()),
    /SYMBOL_NOT_FOUND/,
  );
});

test("ScoreCheckService rejects inactive symbol safely", async () => {
  const { service } = createHarness(activeSymbol({ status: "EXPIRED" }));

  await assert.rejects(
    service.createScoreCheck(userId, baseScoreInput()),
    /SYMBOL_INACTIVE/,
  );
});

test("commodity MCX template accepts a valid FUTURE intraday symbol", async () => {
  const { service } = createHarness();

  const scoreCheck = await service.createScoreCheck(userId, commodityScoreInput());

  assert.equal(scoreCheck.scoringTemplateKey, "COMMODITY_MCX_INTRADAY_V1");
  assert.equal(scoreCheck.reasonCodes.includes("COMMODITY_TEMPLATE_USED"), true);
  assert.equal(scoreCheck.reasonCodes.includes("MCX_CONTRACT_VALIDATED"), true);
  assert.equal(scoreCheck.reasonCodes.includes("LOT_SIZE_AVAILABLE"), true);
  assert.equal(scoreCheck.reasonCodes.includes("TICK_SIZE_AVAILABLE"), true);
  assert.equal(scoreCheck.symbolSnapshot.lotSize, 100);
  assert.equal(scoreCheck.symbolSnapshot.tickSize, 1);
});

test("commodity MCX template supports valid LONG and SHORT geometry", async () => {
  const longHarness = createHarness();
  const shortHarness = createHarness();

  const longScore = await longHarness.service.createScoreCheck(userId, commodityScoreInput());
  const shortScore = await shortHarness.service.createScoreCheck(
    userId,
    commodityScoreInput({
      direction: "SHORT",
      entry: 100,
      stopLoss: 105,
      target1: 90,
    }),
  );

  assert.equal(longScore.permission, "TAKE_TRADE");
  assert.equal(shortScore.permission, "TAKE_TRADE");
  assert.equal(shortScore.rewardRiskRatio, 2);
});

test("commodity MCX template preserves deterministic RR permission bands", async () => {
  const cases = [
    { stopLoss: 90, target1: 105, permission: "REJECT", score: 30 },
    { stopLoss: 90, target1: 112, permission: "WAIT", score: 50 },
    { stopLoss: 90, target1: 116, permission: "TAKE_SMALL_RISK", score: 70 },
    { stopLoss: 90, target1: 120, permission: "TAKE_TRADE", score: 80 },
  ] as const;

  for (const scenario of cases) {
    const { service } = createHarness();
    const scoreCheck = await service.createScoreCheck(
      userId,
      commodityScoreInput({
        stopLoss: scenario.stopLoss,
        target1: scenario.target1,
      }),
    );
    assert.equal(scoreCheck.permission, scenario.permission);
    assert.equal(scoreCheck.score, scenario.score);
  }
});

test("commodity MCX template warns when live monitoring requires broker login", async () => {
  const { service } = createHarness();

  const scoreCheck = await service.createScoreCheck(userId, commodityScoreInput());

  assert.equal(
    scoreCheck.warnings.includes("BROKER_LOGIN_REQUIRED_FOR_LIVE_MONITORING"),
    true,
  );
  assert.equal(scoreCheck.warnings.includes("COMMODITY_BASELINE_ONLY"), true);
});

test("commodity MCX template warns when lot size and tick size are missing", async () => {
  const { service } = createHarness(activeSymbol({ lotSize: undefined, tickSize: undefined }));

  const scoreCheck = await service.createScoreCheck(userId, commodityScoreInput());

  assert.equal(scoreCheck.reasonCodes.includes("LOT_SIZE_MISSING"), true);
  assert.equal(scoreCheck.reasonCodes.includes("TICK_SIZE_MISSING"), true);
  assert.equal(scoreCheck.warnings.includes("LOT_SIZE_MISSING"), true);
  assert.equal(scoreCheck.warnings.includes("TICK_SIZE_MISSING"), true);
});

test("commodity MCX template adds a near-expiry warning within three days", async () => {
  const { service } = createHarness(activeSymbol({
    expiry: new Date("2026-06-25T10:00:00.000Z"),
  }));

  const scoreCheck = await service.createScoreCheck(userId, commodityScoreInput());

  assert.equal(scoreCheck.warnings.includes("EXPIRY_NEAR_WARNING"), true);
});

test("commodity MCX template rejects wrong market type", async () => {
  const { service } = createHarness(activeSymbol({ marketType: "EQUITY" }));

  await assert.rejects(
    service.createScoreCheck(userId, commodityScoreInput({ marketType: "EQUITY" })),
    /Commodity scoring template requires COMMODITY market type/,
  );
});

test("commodity MCX template rejects wrong exchange", async () => {
  const { service } = createHarness(activeSymbol({ exchange: "NSE" }));

  await assert.rejects(
    service.createScoreCheck(userId, commodityScoreInput()),
    /Commodity scoring template requires MCX exchange/,
  );
});

test("commodity MCX template rejects wrong instrument type", async () => {
  const { service } = createHarness(activeSymbol({ instrumentType: "OPTION" }));

  await assert.rejects(
    service.createScoreCheck(
      userId,
      commodityScoreInput({ instrumentType: "OPTION" }),
    ),
    /Commodity scoring template requires FUTURE instrument/,
  );
});

test("commodity MCX template rejects expired contracts", async () => {
  const { service } = createHarness(activeSymbol({
    expiry: new Date("2026-06-22T10:00:00.000Z"),
  }));

  await assert.rejects(
    service.createScoreCheck(userId, commodityScoreInput()),
    /MCX contract is expired/,
  );
});

test("India equity ScoreCheck stores snapshot-backed evaluator outputs", async () => {
  const equitySymbol = activeSymbol({
    symbol: "TATASTEEL",
    displayName: "Tata Steel",
    provider: "ANGEL_ONE",
    marketType: "EQUITY",
    exchange: "NSE",
    instrumentType: "CASH",
    providerSymbol: "TATASTEEL-EQ",
    instrumentToken: "3499",
    lotSize: undefined,
    tickSize: 0.05,
    expiry: undefined,
  });
  const makeSnapshot = (
    resourceKey: string,
    changePercent: number,
  ): MarketSnapshot => ({
    resourceKey,
    provider: "ANGEL_ONE",
    exchange: "NSE",
    latestPrice: 104,
    previousClose: 100,
    changePercent,
    bid: 103.95,
    ask: 104.05,
    spreadPercent: 0.0962,
    tickCount: 20,
    candles: {
      "1m": [
        { timeframe: "1m", startTime: fixedNow, endTime: fixedNow, open: 100, high: 101, low: 100, close: 101, volume: 100, tickCount: 2 },
        { timeframe: "1m", startTime: fixedNow, endTime: fixedNow, open: 101, high: 104, low: 101, close: 104, volume: 180, tickCount: 2 },
      ],
      "3m": [],
      "5m": [
        { timeframe: "5m", startTime: fixedNow, endTime: fixedNow, open: 100, high: 102, low: 100, close: 102, volume: 300, tickCount: 2 },
        { timeframe: "5m", startTime: fixedNow, endTime: fixedNow, open: 102, high: 104, low: 102, close: 104, volume: 400, tickCount: 2 },
      ],
      "15m": [
        { timeframe: "15m", startTime: fixedNow, endTime: fixedNow, open: 99, high: 101, low: 99, close: 101, volume: 500, tickCount: 2 },
        { timeframe: "15m", startTime: fixedNow, endTime: fixedNow, open: 101, high: 104, low: 101, close: 104, volume: 700, tickCount: 2 },
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
      relativeVolume: 1.8,
      volumeTrend: "EXPANDING",
      status: "READY",
    },
    freshness: { status: "FRESH", ageMs: 100 },
    dataConfidence: "HIGH",
  });
  const primary = makeSnapshot(`ANGEL_ONE:${userId}:NSE:3499`, 3);
  const index = makeSnapshot(`ANGEL_ONE:${userId}:NSE:99926000`, 1);
  const sector = makeSnapshot(`ANGEL_ONE:${userId}:NSE:99926001`, 2);
  const vix = makeSnapshot(`ANGEL_ONE:${userId}:NSE:99926017`, 2);
  const { service, snapshots } = createHarness(equitySymbol, {
    marketSnapshotService: {
      getSnapshot: () => primary,
      getDebugSnapshot: () => ({
        resourceKey: primary.resourceKey,
        freshness: primary.freshness,
      }),
    },
    templateResourceResolver: {
      resolveIndiaEquityResources: async () => ({
        index: { role: "INDEX", resourceKey: index.resourceKey, snapshot: index },
        sector: { role: "SECTOR", resourceKey: sector.resourceKey, snapshot: sector },
        vix: { role: "VIX", resourceKey: vix.resourceKey, snapshot: vix },
      }),
    },
  });

  const scoreCheck = await service.createScoreCheck(userId, {
    symbolId,
    marketType: "EQUITY",
    tradeStyle: "INTRADAY",
    instrumentType: "CASH",
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
    scoringTemplateKey: "INDIA_EQUITY_INTRADAY_V1",
    scoringTemplateVersion: "1",
  });

  assert.equal(scoreCheck.setupType, "BREAKOUT");
  const breakdown = snapshots[0]!.breakdown as Record<string, any>;
  assert.equal(
    breakdown.evaluatorResults.find(
      (item: any) => item.evaluatorKey === "INDEX_MULTI_TIMEFRAME_STRUCTURE",
    ).status,
    "EXECUTED",
  );
  assert.equal(
    breakdown.evaluatorResults.find(
      (item: any) => item.evaluatorKey === "MARKET_BREADTH_CONTEXT",
    ).status,
    "PARTIAL",
  );
  assert.equal(snapshots[0]!.snapshotRefs.indexSnapshotId, index.resourceKey);
  assert.equal(snapshots[0]!.snapshotRefs.sectorSnapshotId, sector.resourceKey);
  assert.equal(snapshots[0]!.snapshotRefs.vixSnapshotId, vix.resourceKey);
});
