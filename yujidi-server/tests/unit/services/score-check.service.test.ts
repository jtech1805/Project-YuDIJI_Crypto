import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import type { MarketSnapshot } from "../../../src/types/market-snapshot.types.js";
import {
  calculateTradeGeometry,
  type CreateScoreCheckInput,
  ScoreCheckService,
} from "../../../src/services/scoring/score-check.service.js";
import { ScoreCheckSnapshotModel } from "../../../src/models/score-check-snapshot.model.js";
import { ScoringContextBuilderService } from "../../../src/services/scoring/scoring-context-builder.service.js";
import { ScoringTemplateCrudService } from "../../../src/services/scoring/scoring-template-crud.service.js";

const userId = "69e64c5f9042aac89c8c83f8";
const symbolId = "65abc0000000000000000001";
const fixedNow = new Date("2026-06-23T10:00:00.000Z");
const userTemplateId = "65abc0000000000000000101";

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
    if (value && typeof value === "object" && "$ne" in value) {
      if (idString(recordValue) === idString(value.$ne)) return false;
      continue;
    }
    if (value && typeof value === "object" && "$gt" in value) {
      if (!(recordValue instanceof Date) || !(value.$gt instanceof Date) || recordValue.getTime() <= value.$gt.getTime()) {
        return false;
      }
      continue;
    }
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
  if (update.$unset && typeof update.$unset === "object") {
    for (const key of Object.keys(update.$unset)) {
      delete record[key];
    }
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

const buildUserCommodityTemplate = (overrides: Record<string, unknown> = {}) => {
  const systemTemplate = new ScoringTemplateCrudService().getSystemTemplate("COMMODITY_MCX_INTRADAY_V1");
  return {
    ...systemTemplate,
    id: userTemplateId,
    templateKey: "USER_COMMODITY_MCX_INTRADAY_V1",
    templateName: "User Commodity Template",
    scope: "USER" as const,
    allowedTradableSymbols: [symbolId],
    ...overrides,
  };
};

const createHarness = (
  symbol: Record<string, unknown> | null = activeSymbol(),
  dependencyOverrides: Record<string, unknown> = {},
) => {
  const scoreChecks: Record<string, any>[] = [];
  const scoreCheckSnapshots: Record<string, any>[] = [];
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

  const scoreCheckSnapshotRepository = {
    findOne: (filter: Record<string, unknown>) => {
      return leanResult(scoreCheckSnapshots.find((snapshot) => matchesFilter(snapshot, filter)) ?? null);
    },
    findOneAndUpdate: (
      filter: Record<string, unknown>,
      update: Record<string, unknown>,
      options: Record<string, unknown>,
    ) => {
      let snapshot = scoreCheckSnapshots.find((candidate) => matchesFilter(candidate, filter));
      if (!snapshot && options.upsert) {
        snapshot = {
          _id: new Types.ObjectId(),
          createdAt: fixedNow,
          updatedAt: fixedNow,
        };
        scoreCheckSnapshots.push(snapshot);
      }
      if (!snapshot) return leanResult(null);
      applyUpdate(snapshot, update);
      snapshot.updatedAt = fixedNow;
      return leanResult(snapshot);
    },
  };

  const symbolRepository = dependencyOverrides.symbolRepository ?? {
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
    scoreCheckSnapshotRepository: scoreCheckSnapshotRepository as never,
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
    scoreCheckSnapshots,
    service,
  };
};

test("ScoreCheckService accepts valid LONG geometry", async () => {
  const { service } = createHarness();

  const scoreCheck = await service.createScoreCheck(userId, baseScoreInput());

  assert.equal(scoreCheck.direction, "LONG");
  assert.equal(scoreCheck.reasonCodes.includes("VALID_GEOMETRY"), true);
});

test("ScoreCheckService allows user template when selected symbol is configured", async () => {
  const { service } = createHarness(activeSymbol(), {
    scoringTemplateService: {
      resolveForScoreCheck: async () => buildUserCommodityTemplate(),
      markUsed: async () => undefined,
    },
  });

  const scoreCheck = await service.createScoreCheck(userId, commodityScoreInput({
    scoringTemplateId: userTemplateId,
  }));

  assert.equal(scoreCheck.scoringTemplateScope, "USER");
  assert.equal(String(scoreCheck.symbolId), symbolId);
  assert.equal(scoreCheck.resourceSnapshotSummary?.resolvedResources[0]?.role, "PRIMARY_SYMBOL");
  assert.equal(scoreCheck.resourceSnapshotSummary?.resourceReadinessSummary.total, 1);
});

test("ScoreCheckService rejects user template when selected symbol is not allowed", async () => {
  const { service } = createHarness(activeSymbol(), {
    scoringTemplateService: {
      resolveForScoreCheck: async () => buildUserCommodityTemplate({
        allowedTradableSymbols: [new Types.ObjectId().toString()],
      }),
      markUsed: async () => undefined,
    },
  });

  await assert.rejects(
    service.createScoreCheck(userId, commodityScoreInput({
      scoringTemplateId: userTemplateId,
    })),
    /Selected symbol is not allowed for this scoring template/,
  );
});

test("ScoreCheckService rejects user template with disabled allowed symbol shape", async () => {
  const { service } = createHarness(activeSymbol(), {
    scoringTemplateService: {
      resolveForScoreCheck: async () => buildUserCommodityTemplate({
        allowedTradableSymbols: [{ symbolId, enabled: false }],
      }),
      markUsed: async () => undefined,
    },
  });

  await assert.rejects(
    service.createScoreCheck(userId, commodityScoreInput({
      scoringTemplateId: userTemplateId,
    })),
    /Selected symbol is not allowed for this scoring template/,
  );
});

test("ScoreCheckService rejects user template with no allowed symbols", async () => {
  const { service } = createHarness(activeSymbol(), {
    scoringTemplateService: {
      resolveForScoreCheck: async () => buildUserCommodityTemplate({
        allowedTradableSymbols: [],
      }),
      markUsed: async () => undefined,
    },
  });

  await assert.rejects(
    service.createScoreCheck(userId, commodityScoreInput({
      scoringTemplateId: userTemplateId,
    })),
    /TEMPLATE_HAS_NO_ALLOWED_SYMBOLS/,
  );
});

test("ScoreCheckService rejects another user's private template through resolver", async () => {
  const { service } = createHarness(activeSymbol(), {
    scoringTemplateService: {
      resolveForScoreCheck: async () => {
        throw new Error("SCORING_TEMPLATE_NOT_FOUND");
      },
      markUsed: async () => undefined,
    },
  });

  await assert.rejects(
    service.createScoreCheck(userId, commodityScoreInput({
      scoringTemplateId: userTemplateId,
    })),
    /SCORING_TEMPLATE_NOT_FOUND/,
  );
});

test("ScoreCheckService preserves broad system template behavior", async () => {
  const { service } = createHarness();

  const scoreCheck = await service.createScoreCheck(userId, commodityScoreInput());

  assert.equal(scoreCheck.scoringTemplateScope, "SYSTEM");
  assert.equal(String(scoreCheck.symbolId), symbolId);
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

test("ScoreCheckService does not create permanent TradeScoreSnapshot before conversion", async () => {
  const { service } = createHarness();

  const scoreCheck = await service.createScoreCheck(userId, baseScoreInput());

  assert.equal(scoreCheck.tradeScoreSnapshotId, undefined);
});

test("ScoreCheckService creates expirable ScoreCheckSnapshot", async () => {
  const { service, scoreCheckSnapshots } = createHarness();

  const scoreCheck = await service.createScoreCheck(userId, baseScoreInput());

  assert.equal(scoreCheckSnapshots.length, 1);
  assert.equal(String(scoreCheck.scoreCheckSnapshotId), String(scoreCheckSnapshots[0]!._id));
  assert.equal(scoreCheckSnapshots[0]!.finalScore, scoreCheck.score);
  assert.equal(scoreCheckSnapshots[0]!.expiresAt instanceof Date, true);
  assert.equal(JSON.stringify(scoreCheckSnapshots[0]).includes("providerPayload"), false);
});

test("ScoreCheckSnapshot INTRADAY default expires after 24 hours", async () => {
  const { service, scoreCheckSnapshots } = createHarness();

  await service.createScoreCheck(userId, baseScoreInput());

  assert.equal(
    scoreCheckSnapshots[0]!.expiresAt.toISOString(),
    new Date(fixedNow.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  );
});

test("ScoreCheckSnapshot SWING default expires after 7 days", async () => {
  const equitySymbol = activeSymbol({
    marketType: "EQUITY",
    exchange: "NSE",
    instrumentType: "CASH",
    requiresBrokerLogin: true,
    expiry: undefined,
  });
  const { service, scoreCheckSnapshots } = createHarness(equitySymbol);

  await service.createScoreCheck(userId, {
    symbolId,
    marketType: "EQUITY",
    tradeStyle: "SWING",
    instrumentType: "CASH",
    direction: "LONG",
    entry: 100,
    stopLoss: 95,
    target1: 110,
    scoringTemplateKey: "INDIA_EQUITY_SWING_V1",
  });

  assert.equal(
    scoreCheckSnapshots[0]!.expiresAt.toISOString(),
    new Date(fixedNow.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  );
});

test("ScoreCheckSnapshot policy override is bounded", async () => {
  const { service, scoreCheckSnapshots } = createHarness(activeSymbol(), {
    scoringTemplateService: {
      resolveForScoreCheck: async () => buildUserCommodityTemplate({
        snapshotPolicy: {
          ttlHours: 2,
          captureMarketRegime: true,
          captureSectorContext: true,
          captureRelatedSymbols: true,
          captureAllowedTradableSymbol: true,
          maxSnapshotAgeSeconds: 900,
        },
      }),
      markUsed: async () => undefined,
    },
  });

  await service.createScoreCheck(userId, commodityScoreInput({ scoringTemplateId: userTemplateId }));

  assert.equal(
    scoreCheckSnapshots[0]!.expiresAt.toISOString(),
    new Date(fixedNow.getTime() + 2 * 60 * 60 * 1000).toISOString(),
  );
});

test("ScoreCheckSnapshot TTL index exists on expiresAt", () => {
  const indexes = ScoreCheckSnapshotModel.schema.indexes() as Array<[Record<string, number>, Record<string, unknown>]>;
  const ttlIndex = indexes.find(([fields, options]) =>
    fields.expiresAt === 1 && options?.expireAfterSeconds === 0);

  assert.ok(ttlIndex);
});

test("ScoreCheckService returns own ScoreCheckSnapshot", async () => {
  const { service } = createHarness();
  const scoreCheck = await service.createScoreCheck(userId, baseScoreInput());

  const snapshot = await service.getScoreCheckSnapshot(userId, String(scoreCheck._id));

  assert.equal(String(snapshot.scoreCheckId), String(scoreCheck._id));
});

test("ScoreCheckService does not return another user's ScoreCheckSnapshot", async () => {
  const { service } = createHarness();
  const scoreCheck = await service.createScoreCheck(userId, baseScoreInput());

  await assert.rejects(
    service.getScoreCheckSnapshot("69e64c5f9042aac89c8c83f9", String(scoreCheck._id)),
    /SCORE_CHECK_SNAPSHOT_EXPIRED_OR_NOT_FOUND/,
  );
});

test("ScoreCheckService returns clear 404 when ScoreCheckSnapshot is expired or missing", async () => {
  const { service } = createHarness();

  await assert.rejects(
    service.getScoreCheckSnapshot(userId, new Types.ObjectId().toString()),
    /SCORE_CHECK_SNAPSHOT_EXPIRED_OR_NOT_FOUND/,
  );
});

test("ScoreCheckService keeps temporary snapshot compact without raw runtime payloads", async () => {
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
  const { service, scoreCheckSnapshots } = createHarness(cryptoSymbol, {
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

  assert.equal(scoreCheckSnapshots.length, 1);
  assert.equal(JSON.stringify(scoreCheckSnapshots[0]).includes("providerPayload"), false);
  assert.equal(JSON.stringify(scoreCheckSnapshots[0]).includes("candles"), false);
  assert.equal(JSON.stringify(scoreCheckSnapshots[0]).includes("orderBook"), false);
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
  const indexSymbolId = new Types.ObjectId().toString();
  const sectorSymbolId = new Types.ObjectId().toString();
  const vixSymbolId = new Types.ObjectId().toString();
  const symbolRecords = [
    equitySymbol,
    activeSymbol({
      _id: new Types.ObjectId(indexSymbolId),
      symbol: "NSE:NIFTY",
      displayName: "NSE NIFTY",
      provider: "ANGEL_ONE",
      marketType: "INDEX",
      exchange: "NSE",
      instrumentType: "INDEX",
      providerSymbol: "NIFTY",
      instrumentToken: "99926000",
      requiresBrokerLogin: true,
      expiry: undefined,
    }),
    activeSymbol({
      _id: new Types.ObjectId(sectorSymbolId),
      symbol: "NSE:METAL",
      displayName: "NSE Metal Index",
      provider: "ANGEL_ONE",
      marketType: "INDEX",
      exchange: "NSE",
      instrumentType: "INDEX",
      providerSymbol: "METAL",
      instrumentToken: "99926001",
      requiresBrokerLogin: true,
      expiry: undefined,
    }),
    activeSymbol({
      _id: new Types.ObjectId(vixSymbolId),
      symbol: "NSE:INDIAVIX",
      displayName: "India VIX",
      provider: "ANGEL_ONE",
      marketType: "INDEX",
      exchange: "NSE",
      instrumentType: "INDEX",
      providerSymbol: "INDIAVIX",
      instrumentToken: "99926017",
      requiresBrokerLogin: true,
      expiry: undefined,
    }),
  ];
  const { service, scoreCheckSnapshots } = createHarness(equitySymbol, {
    symbolRepository: {
      findOne: (filter: Record<string, unknown>) => {
        return leanResult(symbolRecords.find((record) => matchesFilter(record, filter)) ?? null);
      },
    },
    scoringTemplateService: {
      resolveForScoreCheck: async () => {
        const template = new ScoringTemplateCrudService().getSystemTemplate("INDIA_EQUITY_INTRADAY_V1");
        return {
          ...template,
          id: userTemplateId,
          templateKey: "USER_INDIA_EQUITY_INTRADAY_V1",
          templateName: "User India Equity Intraday",
          scope: "USER" as const,
          allowedTradableSymbols: [symbolId],
          resourceConfig: {
            marketRegime: {
              marketIndexSymbolId: indexSymbolId,
              volatilitySymbolId: vixSymbolId,
            },
            sectorContext: {
              sectorName: "METAL",
              sectorIndexSymbolId: sectorSymbolId,
            },
            relatedSymbols: [],
          },
        };
      },
      markUsed: async () => undefined,
    },
    marketSnapshotService: {
      getSnapshot: (resourceKey: string) => {
        if (resourceKey === index.resourceKey) return index;
        if (resourceKey === sector.resourceKey) return sector;
        if (resourceKey === vix.resourceKey) return vix;
        return primary;
      },
      getDebugSnapshot: (resourceKey: string) => ({
        resourceKey,
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
    scoringTemplateId: userTemplateId,
    scoringTemplateVersion: "1",
  });

  assert.equal(scoreCheck.setupType, "BREAKOUT");
  const breakdown = scoreCheck.breakdown as Record<string, any>;
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
  assert.equal(scoreCheckSnapshots[0]!.resourceSnapshots.some((item: any) =>
    item.role === "MARKET_INDEX" && item.symbol === "NSE:NIFTY" && item.price === index.latestPrice), true);
  assert.equal(scoreCheckSnapshots[0]!.resourceSnapshots.some((item: any) =>
    item.role === "SECTOR_INDEX" && item.symbol === "NSE:METAL" && item.price === sector.latestPrice), true);
  assert.equal(scoreCheckSnapshots[0]!.resourceSnapshots.some((item: any) =>
    item.role === "VOLATILITY_INDEX" && item.symbol === "NSE:INDIAVIX" && item.price === vix.latestPrice), true);
});
