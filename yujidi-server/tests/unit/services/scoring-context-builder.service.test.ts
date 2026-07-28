import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import type { SnapshotMarketTick } from "../../../src/types/market-snapshot.types.js";
import type { ResolvedScoringTemplateDefinition } from "../../../src/types/scoring.types.js";
import { MarketSnapshotService } from "../../../src/services/market-snapshot.service.js";
import { ScoringContextBuilderService } from "../../../src/services/scoring-context-builder.service.js";

const userId = "69e64c5f9042aac89c8c83f8";
const ids = {
  tata: new Types.ObjectId("65abc0000000000000001001"),
  nifty: new Types.ObjectId("65abc0000000000000001002"),
  bank: new Types.ObjectId("65abc0000000000000001003"),
  vix: new Types.ObjectId("65abc0000000000000001004"),
  metal: new Types.ObjectId("65abc0000000000000001005"),
  jsw: new Types.ObjectId("65abc0000000000000001006"),
  missing: new Types.ObjectId("65abc0000000000000001999"),
};

const symbol = (
  _id: Types.ObjectId,
  symbolName: string,
  instrumentToken: string,
  marketType = "EQUITY",
  instrumentType = "CASH",
) => ({
  _id,
  symbol: symbolName,
  displayName: symbolName.replace("NSE:", ""),
  provider: "ANGEL_ONE",
  marketType,
  exchange: "NSE",
  instrumentType,
  providerSymbol: symbolName.replace("NSE:", ""),
  instrumentToken,
  requiresBrokerLogin: true,
  status: "ACTIVE",
});

const symbols = [
  symbol(ids.tata, "NSE:TATASTEEL-EQ", "3499"),
  symbol(ids.nifty, "NSE:NIFTY", "26000", "INDEX", "INDEX"),
  symbol(ids.bank, "NSE:BANKNIFTY", "26009", "INDEX", "INDEX"),
  symbol(ids.vix, "NSE:INDIA VIX", "26017", "INDEX", "INDEX"),
  symbol(ids.metal, "NSE:NIFTY METAL", "26034", "INDEX", "INDEX"),
  symbol(ids.jsw, "NSE:JSWSTEEL-EQ", "11723"),
];

const template = (overrides: Partial<ResolvedScoringTemplateDefinition> = {}): ResolvedScoringTemplateDefinition => ({
  id: "65abc0000000000000002222",
  templateKey: "USER_METAL_INTRADAY",
  baseTemplateKey: "INDIA_EQUITY_INTRADAY_V1",
  templateName: "Metal Intraday Template",
  scope: "USER",
  version: 1,
  marketType: "EQUITY",
  tradeStyle: "INTRADAY",
  instrumentType: "CASH",
  maxScore: 100,
  sections: [],
  permissionThresholds: {
    rejectBelow: 40,
    waitBelow: 60,
    takeSmallRiskBelow: 75,
    takeTradeAtOrAbove: 75,
  },
  allowedTradableSymbols: [ids.tata.toString()],
  resourceConfig: {
    marketRegime: {
      marketIndexSymbolId: ids.nifty.toString(),
      bankIndexSymbolId: ids.bank.toString(),
      volatilitySymbolId: ids.vix.toString(),
    },
    sectorContext: {
      sectorName: "METAL",
      sectorIndexSymbolId: ids.metal.toString(),
    },
    relatedSymbols: [ids.jsw.toString()],
  },
  snapshotPolicy: {
    captureMarketRegime: true,
    captureSectorContext: true,
    captureRelatedSymbols: true,
    captureAllowedTradableSymbol: true,
    maxSnapshotAgeSeconds: 900,
  },
  ...overrides,
});

const tick = (
  item: ReturnType<typeof symbol>,
  price: number,
  now: Date,
  overrides: Partial<SnapshotMarketTick> = {},
): SnapshotMarketTick => ({
  provider: "ANGEL_ONE",
  exchange: "NSE",
  marketType: item.marketType as SnapshotMarketTick["marketType"],
  symbol: item.symbol,
  providerSymbol: item.providerSymbol,
  instrumentToken: item.instrumentToken,
  userId,
  price,
  open: price - 1,
  high: price + 2,
  low: price - 2,
  previousClose: price - 0.5,
  volume: 10,
  occurredAt: now,
  receivedAt: now,
  source: "ANGEL_WS",
  ...overrides,
} as SnapshotMarketTick);

const createBuilder = (recordedSymbols: typeof symbols = symbols) => {
  const now = new Date("2026-06-29T10:00:00.000Z");
  const marketSnapshotService = new MarketSnapshotService({ now: () => now });
  const symbolRepository = {
    findOne: (filter: Record<string, unknown>) => ({
      lean: () => ({
        exec: async () => recordedSymbols.find((item) => String(item._id) === String(filter._id)) ?? null,
      }),
    }),
  };
  const builder = new ScoringContextBuilderService({
    symbolRepository: symbolRepository as never,
    marketSnapshotService,
  });
  return { builder, marketSnapshotService, now };
};

test("buildTemplateResourceSnapshotContext resolves primary and configured template resources", async () => {
  const { builder, marketSnapshotService, now } = createBuilder();
  for (const item of symbols) {
    marketSnapshotService.recordTick(tick(item, 100 + symbols.indexOf(item), now));
  }

  const context = await builder.buildTemplateResourceSnapshotContext({
    userId,
    scoringTemplate: template(),
    selectedSymbol: symbols[0]!,
  });

  assert.deepEqual(context.resolvedResources.map((resource) => resource.role), [
    "PRIMARY_SYMBOL",
    "MARKET_INDEX",
    "BANK_INDEX",
    "VOLATILITY_INDEX",
    "SECTOR_INDEX",
    "RELATED_SYMBOL",
  ]);
  assert.equal(context.resourceSnapshots[0]?.symbol, "NSE:TATASTEEL-EQ");
  assert.equal(context.resourceSnapshots[0]?.price, 100);
  assert.equal(context.resourceReadinessSummary.total, 6);
  assert.equal(context.blockers.length, 0);
  assert.equal(JSON.stringify(context).includes("raw"), false);
});

test("buildTemplateResourceSnapshotContext treats missing related symbols as warnings only", async () => {
  const { builder, marketSnapshotService, now } = createBuilder(symbols.filter((item) => item._id !== ids.jsw));
  marketSnapshotService.recordTick(tick(symbols[0]!, 100, now));

  const context = await builder.buildTemplateResourceSnapshotContext({
    userId,
    scoringTemplate: template({
      resourceConfig: {
        ...template().resourceConfig,
        relatedSymbols: [ids.missing.toString()],
      },
    }),
    selectedSymbol: symbols[0]!,
  });

  assert.equal(context.warnings.some((warning) => warning.includes("RELATED_SYMBOL")), true);
  assert.equal(context.blockers.some((blocker) => blocker.includes("RELATED_SYMBOL")), false);
});

test("buildTemplateResourceSnapshotContext blocks missing configured required snapshots", async () => {
  const { builder, marketSnapshotService, now } = createBuilder();
  marketSnapshotService.recordTick(tick(symbols[0]!, 100, now));

  const context = await builder.buildTemplateResourceSnapshotContext({
    userId,
    scoringTemplate: template(),
    selectedSymbol: symbols[0]!,
  });

  assert.equal(context.resourceReadinessSummary.blockingMissing > 0, true);
  assert.equal(context.blockers.some((blocker) => blocker.includes("MARKET_INDEX")), true);
});
