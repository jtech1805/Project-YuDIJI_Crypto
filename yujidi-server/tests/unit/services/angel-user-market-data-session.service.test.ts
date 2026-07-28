import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import { AngelUserMarketDataSessionService } from "../../../src/services/angel-user-market-data-session.service.js";

const userId = "69e64c5f9042aac89c8c83f8";
const monitorId = "65abc0000000000000000001";

const execResult = <T>(value: T) => ({
  exec: async () => value,
});

const leanExecResult = <T>(value: T) => ({
  lean: () => execResult(value),
});

const makeAngelMonitor = (overrides: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(monitorId),
  user: new Types.ObjectId(userId),
  symbol: "MCX:CRUDEOIL:16JUL2026:10000:CE",
  provider: "ANGEL_ONE",
  marketType: "COMMODITY",
  exchange: "MCX",
  instrumentToken: "570027",
  providerSymbol: "CRUDEOIL16JUL2610000CE",
  instrumentType: "OPTION",
  displayName: "MCX CRUDEOIL 16JUL2026 10000 CE",
  requiresBrokerLogin: true,
  supportedBroker: "ANGEL_ONE",
  thresholdPercentage: 1,
  timeWindowMinutes: 5,
  isActive: true,
  trigger: "spike",
  ...overrides,
});

const makeService = ({
  monitor = makeAngelMonitor(),
  brokerThrows,
}: {
  monitor?: unknown;
  brokerThrows?: Error;
} = {}) => {
  const subscribed: unknown[] = [];
  const unsubscribed: unknown[] = [];
  let connected = false;
  let disconnected = false;

  const service = new AngelUserMarketDataSessionService({
    monitorRepository: {
      findOne: (() => leanExecResult(monitor)) as never,
    },
    brokerConnectionService: {
      getActiveAngelSessionForUser: async () => {
        if (brokerThrows) {
          throw brokerThrows;
        }

        return {
          clientCode: "AB1234",
          apiKey: "api-key",
          jwtToken: "jwt-token",
          feedToken: "feed-token",
        };
      },
    },
    providerFactory: () => ({
      connect: async () => {
        connected = true;
      },
      disconnect: async () => {
        disconnected = true;
        connected = false;
      },
      subscribe: async (subscription) => {
        subscribed.push(subscription);
      },
      unsubscribe: async (subscription) => {
        unsubscribed.push(subscription);
      },
      isConnected: () => connected,
    }),
  });

  return {
    service,
    subscribed,
    unsubscribed,
    get connected() {
      return connected;
    },
    get disconnected() {
      return disconnected;
    },
  };
};

test("AngelUserMarketDataSessionService subscribes active Angel monitor", async () => {
  const harness = makeService();
  const response = await harness.service.subscribeUserToAngelMonitor(userId, monitorId);

  assert.equal(harness.connected, true);
  assert.equal(harness.subscribed.length, 1);
  assert.equal(response.provider, "ANGEL_ONE");
  assert.equal(response.exchange, "MCX");
  assert.equal(response.instrumentToken, "570027");
  assert.equal(response.subscriptionKey, `ANGEL_ONE:${userId}:MCX:570027`);
  assert.equal(response.streamStatus, "SUBSCRIBED");

  const status = harness.service.getSessionStatus(userId);
  assert.equal(status.connected, true);
  assert.equal(status.subscriptionCount, 1);
  assert.equal(status.subscriptions[0]?.subscriptionKey, `ANGEL_ONE:${userId}:MCX:570027`);
});

test("AngelUserMarketDataSessionService subscribes NSE and NFO Angel monitors", async () => {
  const nseHarness = makeService({
    monitor: makeAngelMonitor({
      symbol: "NSE:RELIANCE-EQ",
      marketType: "EQUITY",
      exchange: "NSE",
      instrumentToken: "2885",
      providerSymbol: "RELIANCE-EQ",
      instrumentType: "CASH",
      displayName: "NSE RELIANCE",
    }),
  });
  const nfoHarness = makeService({
    monitor: makeAngelMonitor({
      symbol: "NFO:NIFTY:30JUL2026:25000:CE",
      marketType: "FNO",
      exchange: "NFO",
      instrumentToken: "53217",
      providerSymbol: "NIFTY30JUL2625000CE",
      instrumentType: "OPTION",
      displayName: "NFO NIFTY 30JUL2026 25000 CE",
    }),
  });

  const nseResponse = await nseHarness.service.subscribeUserToAngelMonitor(userId, monitorId);
  const nfoResponse = await nfoHarness.service.subscribeUserToAngelMonitor(userId, monitorId);

  assert.equal(nseResponse.exchange, "NSE");
  assert.equal(nseResponse.subscriptionKey, `ANGEL_ONE:${userId}:NSE:2885`);
  assert.equal((nseHarness.subscribed[0] as Record<string, unknown>).marketType, "EQUITY");
  assert.equal((nseHarness.subscribed[0] as Record<string, unknown>).exchange, "NSE");
  assert.equal(nfoResponse.exchange, "NFO");
  assert.equal(nfoResponse.subscriptionKey, `ANGEL_ONE:${userId}:NFO:53217`);
  assert.equal((nfoHarness.subscribed[0] as Record<string, unknown>).marketType, "FNO");
  assert.equal((nfoHarness.subscribed[0] as Record<string, unknown>).exchange, "NFO");
});

test("AngelUserMarketDataSessionService rejects missing BrokerConnection", async () => {
  const harness = makeService({
    brokerThrows: new Error("BROKER_LOGIN_REQUIRED"),
  });

  await assert.rejects(
    harness.service.subscribeUserToAngelMonitor(userId, monitorId),
    /BROKER_LOGIN_REQUIRED/,
  );
});

test("AngelUserMarketDataSessionService rejects Binance monitor", async () => {
  const harness = makeService({
    monitor: makeAngelMonitor({
      provider: "BINANCE",
      exchange: "BINANCE",
      instrumentToken: "BTCUSDT",
    }),
  });

  await assert.rejects(
    harness.service.subscribeUserToAngelMonitor(userId, monitorId),
    /MONITOR_PROVIDER_NOT_SUPPORTED/,
  );
});

test("AngelUserMarketDataSessionService unsubscribes and closes empty session", async () => {
  const harness = makeService();

  await harness.service.subscribeUserToAngelMonitor(userId, monitorId);
  const response = await harness.service.unsubscribeUserFromAngelMonitor(userId, monitorId);

  assert.equal(harness.unsubscribed.length, 1);
  assert.equal(harness.disconnected, true);
  assert.equal(response.streamStatus, "UNSUBSCRIBED");
  assert.equal(harness.service.getSessionStatus(userId).subscriptionCount, 0);
});
