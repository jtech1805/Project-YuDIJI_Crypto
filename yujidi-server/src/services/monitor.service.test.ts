import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import { MonitorService } from "./monitor.service.js";

const userId = "69e64c5f9042aac89c8c83f8";
const symbolId = new Types.ObjectId("65abc0000000000000000001");

const execResult = <T>(value: T) => ({
  exec: async () => value,
});

const leanExecResult = <T>(value: T) => ({
  lean: () => execResult(value),
});

const makeSymbol = (overrides: Record<string, unknown> = {}) => ({
  _id: symbolId,
  symbol: "BTCUSDT",
  provider: "BINANCE",
  marketType: "CRYPTO",
  exchange: "BINANCE",
  displayName: "BTC / USDT",
  providerSymbol: "BTCUSDT",
  instrumentToken: "BTCUSDT",
  instrumentType: "SPOT",
  requiresBrokerLogin: false,
  supportedBroker: "NONE",
  status: "ACTIVE",
  ...overrides,
});

const makeMonitorService = ({
  symbolById = null,
  symbolByLookup = null,
  hasBrokerConnection = false,
}: {
  symbolById?: unknown;
  symbolByLookup?: unknown;
  hasBrokerConnection?: boolean;
} = {}) => {
  const createdPayloads: Record<string, unknown>[] = [];
  const service = new MonitorService({
    symbolModel: {
      find: (() => ({ sort: () => ({ lean: () => execResult([]) }) })) as never,
      findById: (() => leanExecResult(symbolById)) as never,
      findOne: (() => leanExecResult(symbolByLookup)) as never,
    } as never,
    tripwireConfigModel: {
      aggregate: (() => ({ exec: async () => [] })) as never,
      create: (async (payload: Record<string, unknown>) => {
        createdPayloads.push(payload);
        return {
          toObject: () => ({
            _id: new Types.ObjectId(),
            ...payload,
          }),
        };
      }) as never,
      find: (() => ({ lean: () => execResult([]) })) as never,
      findOneAndUpdate: (() => execResult(null)) as never,
      findOneAndDelete: (() => execResult(null)) as never,
    } as never,
    brokerConnectionService: {
      hasActiveBrokerConnection: async () => hasBrokerConnection,
    },
  });

  return { service, createdPayloads };
};

test("MonitorService creates Binance monitor using legacy symbol request", async () => {
  const { service, createdPayloads } = makeMonitorService({
    symbolByLookup: null,
  });

  const monitor = await service.createMonitor(userId, {
    symbol: "btcusdt",
    thresholdPercentage: 1,
    timeWindowMinutes: 5,
    trigger: "drop",
  });

  assert.equal(monitor.symbol, "BTCUSDT");
  const payload = createdPayloads[0];
  assert.ok(payload);
  assert.equal(payload.provider, "BINANCE");
  assert.equal(payload.exchange, "BINANCE");
  assert.equal(payload.instrumentToken, "BTCUSDT");
  assert.equal(payload.requiresBrokerLogin, false);
});

test("MonitorService creates Binance monitor using symbolId without broker login", async () => {
  const { service, createdPayloads } = makeMonitorService({
    symbolById: makeSymbol(),
  });

  const monitor = await service.createMonitor(userId, {
    symbolId: symbolId.toString(),
    thresholdPercentage: 1,
    timeWindowMinutes: 5,
    trigger: "spike",
  });

  assert.equal(monitor.symbol, "BTCUSDT");
  const payload = createdPayloads[0];
  assert.ok(payload);
  assert.equal(payload.symbolId?.toString(), symbolId.toString());
  assert.equal(payload.provider, "BINANCE");
  assert.equal(payload.providerSymbol, "BTCUSDT");
  assert.equal(payload.instrumentType, "SPOT");
  assert.equal(payload.supportedBroker, "NONE");
});

test("MonitorService creates Angel monitor using symbolId when broker connection is active", async () => {
  const angelSymbol = makeSymbol({
    symbol: "MCX:CRUDEOIL:26JUN2026:7200:CE",
    provider: "ANGEL_ONE",
    marketType: "COMMODITY",
    exchange: "MCX",
    displayName: "MCX CRUDEOIL 26JUN2026 7200 CE",
    providerSymbol: "CRUDEOIL26JUN7200CE",
    instrumentToken: "253456",
    instrumentType: "OPTION",
    requiresBrokerLogin: true,
    supportedBroker: "ANGEL_ONE",
  });
  const { service, createdPayloads } = makeMonitorService({
    symbolById: angelSymbol,
    hasBrokerConnection: true,
  });

  const monitor = await service.createMonitor(userId, {
    symbolId: symbolId.toString(),
    thresholdPercentage: 1,
    timeWindowMinutes: 5,
    trigger: "spike",
  });

  assert.equal(monitor.symbol, "MCX:CRUDEOIL:26JUN2026:7200:CE");
  const payload = createdPayloads[0];
  assert.ok(payload);
  assert.equal(payload.provider, "ANGEL_ONE");
  assert.equal(payload.exchange, "MCX");
  assert.equal(payload.instrumentToken, "253456");
  assert.equal(payload.displayName, "MCX CRUDEOIL 26JUN2026 7200 CE");
  assert.equal(payload.requiresBrokerLogin, true);
  assert.equal(payload.supportedBroker, "ANGEL_ONE");
});

test("MonitorService rejects Angel monitor when broker connection is missing", async () => {
  const { service } = makeMonitorService({
    symbolById: makeSymbol({
      symbol: "MCX:CRUDEOIL:26JUN2026:7200:CE",
      provider: "ANGEL_ONE",
      marketType: "COMMODITY",
      exchange: "MCX",
      instrumentToken: "253456",
      requiresBrokerLogin: true,
      supportedBroker: "ANGEL_ONE",
    }),
    hasBrokerConnection: false,
  });

  await assert.rejects(
    service.createMonitor(userId, {
      symbolId: symbolId.toString(),
      thresholdPercentage: 1,
      timeWindowMinutes: 5,
      trigger: "spike",
    }),
    /BROKER_LOGIN_REQUIRED/,
  );
});
