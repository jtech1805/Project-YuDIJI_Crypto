import assert from "node:assert/strict";
import test from "node:test";

import type { SnapshotMarketTick } from "../../../src/types/market-snapshot.types.js";
import {
  buildMarketResourceKey,
  MarketSnapshotService,
} from "../../../src/services/market-data/market-snapshot.service.js";
import { TemplateMonitoringOrchestratorService } from "../../../src/services/templates/template-monitoring-orchestrator.service.js";

const binanceTick = (
  price: number,
  occurredAt: Date,
  overrides: Partial<SnapshotMarketTick> = {},
): SnapshotMarketTick => ({
  provider: "BINANCE",
  exchange: "BINANCE",
  marketType: "CRYPTO",
  symbol: "BTCUSDT",
  providerSymbol: "BTCUSDT",
  instrumentToken: "BTCUSDT",
  price,
  occurredAt,
  receivedAt: occurredAt,
  source: "BINANCE_WS",
  ...overrides,
});

test("recordTick creates and updates a bounded market snapshot", () => {
  let now = new Date("2026-06-25T09:00:01.000Z");
  const service = new MarketSnapshotService({ now: () => now });

  service.recordTick(binanceTick(100, new Date("2026-06-25T09:00:00.000Z"), {
    open: 98,
    previousClose: 95,
    volume: 10,
  }));
  now = new Date("2026-06-25T09:00:31.000Z");
  const snapshot = service.recordTick(binanceTick(102, new Date("2026-06-25T09:00:30.000Z"), {
    volume: 20,
  }));

  assert.equal(snapshot.resourceKey, "BINANCE:BINANCE:BTCUSDT");
  assert.equal(snapshot.latestPrice, 102);
  assert.equal(snapshot.previousPrice, 100);
  assert.equal(snapshot.dayOpen, 98);
  assert.equal(snapshot.high, 102);
  assert.equal(snapshot.low, 100);
  assert.equal(snapshot.changePercent, 7.3684);
  assert.equal(snapshot.tickCount, 2);
  assert.equal(snapshot.candles["1m"].length, 1);
  assert.equal(snapshot.candles["1m"][0]?.open, 100);
  assert.equal(snapshot.candles["1m"][0]?.close, 102);
  assert.equal(snapshot.candles["5m"].length, 1);
});

test("candle history is bounded per timeframe", () => {
  let now = new Date("2026-06-25T09:00:00.000Z");
  const service = new MarketSnapshotService({
    maxCandlesPerTimeframe: 2,
    now: () => now,
  });

  for (let minute = 0; minute < 3; minute += 1) {
    now = new Date(`2026-06-25T09:0${minute}:01.000Z`);
    service.recordTick(binanceTick(100 + minute, now));
  }

  const snapshot = service.getSnapshot("BINANCE:BINANCE:BTCUSDT");
  assert.equal(snapshot?.candles["1m"].length, 2);
  assert.equal(snapshot?.candles["1m"][0]?.open, 101);
  assert.equal(snapshot?.candles["1m"][1]?.open, 102);
});

test("VWAP is calculated from volume and reports above below and near positions", () => {
  let now = new Date("2026-06-25T09:00:00.000Z");
  const service = new MarketSnapshotService({ now: () => now });

  service.recordTick(binanceTick(100, now, { volume: 10 }));
  now = new Date("2026-06-25T09:00:01.000Z");
  const above = service.recordTick(binanceTick(110, now, { volume: 10 }));
  assert.equal(above.vwap.value, 105);
  assert.equal(above.vwap.positionVsVwap, "ABOVE");

  now = new Date("2026-06-25T09:00:02.000Z");
  const below = service.recordTick(binanceTick(90, now, { volume: 10 }));
  assert.equal(below.vwap.positionVsVwap, "BELOW");

  const nearService = new MarketSnapshotService({ now: () => now });
  nearService.recordTick(binanceTick(100, now, { volume: 10 }));
  const near = nearService.recordTick(binanceTick(100.1, now, { volume: 10 }));
  assert.equal(near.vwap.positionVsVwap, "NEAR");
});

test("VWAP and volume remain honest when tick volume is unavailable", () => {
  const now = new Date("2026-06-25T09:00:00.000Z");
  const snapshot = new MarketSnapshotService({ now: () => now })
    .recordTick(binanceTick(100, now));

  assert.equal(snapshot.vwap.status, "UNAVAILABLE");
  assert.equal(snapshot.vwap.value, undefined);
  assert.equal(snapshot.volume.status, "UNAVAILABLE");
});

test("first cumulative-volume tick establishes a baseline instead of fabricating VWAP", () => {
  let now = new Date("2026-06-25T09:00:00.000Z");
  const service = new MarketSnapshotService({ now: () => now });
  const first = service.recordTick(binanceTick(100, now, { cumulativeVolume: 1_000 }));
  assert.equal(first.vwap.status, "UNAVAILABLE");
  assert.equal(first.vwap.value, undefined);

  now = new Date("2026-06-25T09:00:01.000Z");
  const second = service.recordTick(binanceTick(101, now, { cumulativeVolume: 1_010 }));
  assert.equal(second.vwap.value, 101);
  assert.equal(second.vwap.cumulativeVolume, 10);
});

test("freshness transitions from fresh to stale", () => {
  let now = new Date("2026-06-25T09:00:05.000Z");
  const service = new MarketSnapshotService({
    freshThresholdMs: 10_000,
    now: () => now,
  });
  service.recordTick(binanceTick(100, new Date("2026-06-25T09:00:00.000Z")));
  assert.equal(service.getSnapshot("BINANCE:BINANCE:BTCUSDT")?.freshness.status, "FRESH");

  now = new Date("2026-06-25T09:00:11.000Z");
  assert.equal(service.getSnapshot("BINANCE:BINANCE:BTCUSDT")?.freshness.status, "STALE");
});

test("resource cap evicts the least recently touched snapshot", () => {
  let now = new Date("2026-06-25T09:00:00.000Z");
  const service = new MarketSnapshotService({ maxResources: 2, now: () => now });
  service.recordTick(binanceTick(100, now, { symbol: "BTCUSDT", instrumentToken: "BTCUSDT" }));
  now = new Date("2026-06-25T09:00:01.000Z");
  service.recordTick(binanceTick(200, now, { symbol: "ETHUSDT", instrumentToken: "ETHUSDT" }));
  now = new Date("2026-06-25T09:00:02.000Z");
  service.recordTick(binanceTick(300, now, { symbol: "SOLUSDT", instrumentToken: "SOLUSDT" }));

  assert.equal(service.getResourceCount(), 2);
  assert.equal(service.getSnapshot("BINANCE:BINANCE:BTCUSDT"), null);
  assert.notEqual(service.getSnapshot("BINANCE:BINANCE:ETHUSDT"), null);
  assert.notEqual(service.getSnapshot("BINANCE:BINANCE:SOLUSDT"), null);
});

test("resource keys isolate Angel users while Binance remains public", () => {
  assert.equal(buildMarketResourceKey(binanceTick(100, new Date())), "BINANCE:BINANCE:BTCUSDT");
  assert.equal(buildMarketResourceKey({
    provider: "ANGEL_ONE",
    exchange: "MCX",
    instrumentToken: "570027",
    userId: "user-a",
  }), "ANGEL_ONE:user-a:MCX:570027");
  assert.throws(() => buildMarketResourceKey({
    provider: "ANGEL_ONE",
    exchange: "MCX",
    instrumentToken: "570027",
  }), /requires userId/);
});

test("returned snapshots are safe copies", () => {
  const now = new Date("2026-06-25T09:00:00.000Z");
  const service = new MarketSnapshotService({ now: () => now });
  const first = service.recordTick(binanceTick(100, now, { volume: 10 }));
  first.candles["1m"][0]!.close = 999;
  first.vwap.value = 999;

  const second = service.getSnapshot("BINANCE:BINANCE:BTCUSDT");
  assert.equal(second?.candles["1m"][0]?.close, 100);
  assert.equal(second?.vwap.value, 100);
});

test("bid ask input calculates spread percentage", () => {
  const now = new Date("2026-06-25T09:00:00.000Z");
  const snapshot = new MarketSnapshotService({ now: () => now })
    .recordTick(binanceTick(100, now, { bid: 99.9, ask: 100.1 }));

  assert.equal(snapshot.bid, 99.9);
  assert.equal(snapshot.ask, 100.1);
  assert.equal(snapshot.spreadPercent, 0.2);
});

test("template resource registry tracks readiness and reference count", () => {
  const now = new Date("2026-06-25T09:00:00.000Z");
  const snapshot = new MarketSnapshotService({ now: () => now })
    .recordTick(binanceTick(100, now, { volume: 10 }));
  const orchestrator = new TemplateMonitoringOrchestratorService();

  const first = orchestrator.register(snapshot.resourceKey, snapshot);
  const second = orchestrator.register(snapshot.resourceKey, snapshot);
  assert.equal(first.lastSnapshotStatus, "FRESH");
  assert.equal(second.refCount, 2);

  orchestrator.unregister(snapshot.resourceKey);
  assert.equal(orchestrator.get(snapshot.resourceKey)?.refCount, 1);
  orchestrator.unregister(snapshot.resourceKey);
  assert.equal(orchestrator.get(snapshot.resourceKey), null);
});
