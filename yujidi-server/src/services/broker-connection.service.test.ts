import assert from "node:assert/strict";
import test from "node:test";

import {
  BrokerConnectionService,
  toBrokerConnectionSafeResponse,
} from "./broker-connection.service.js";

const userId = "69e64c5f9042aac89c8c83f8";

const makeConnection = (overrides: Record<string, unknown> = {}) => ({
  broker: "ANGEL_ONE",
  status: "ACTIVE",
  clientCode: "AB1234",
  encryptedApiKey: "encrypted-api-key",
  encryptedPin: "encrypted-pin",
  encryptedTotpSecret: "encrypted-totp-secret",
  session: {
    encryptedJwtToken: "encrypted-jwt",
    encryptedRefreshToken: "encrypted-refresh",
    encryptedFeedToken: "encrypted-feed",
    expiresAt: new Date("2026-06-15T18:30:00.000Z"),
  },
  permissions: {
    marketData: true,
    orderPlacement: false,
    portfolioRead: false,
  },
  lastVerifiedAt: new Date("2026-06-15T06:00:00.000Z"),
  ...overrides,
});

const execResult = <T>(value: T) => ({
  exec: async () => value,
});

test("toBrokerConnectionSafeResponse masks clientCode and omits secrets", () => {
  const response = toBrokerConnectionSafeResponse(makeConnection() as never);
  const serialized = JSON.stringify(response);

  assert.equal(response.clientCode, "**1234");
  assert.equal(response.permissions.orderPlacement, false);
  assert.equal(serialized.includes("encrypted"), false);
  assert.equal(serialized.includes("jwt"), false);
  assert.equal(serialized.includes("pin"), false);
});

test("BrokerConnectionService successful Angel connect stores encrypted fields", async () => {
  const updates: Record<string, unknown>[] = [];
  const service = new BrokerConnectionService({
    encryptionService: {
      encryptSecret: (value) => `enc(${value})`,
      decryptSecret: (value) => value.replace(/^enc\((.*)\)$/, "$1"),
    },
    angelAuthService: {
      loginByPassword: async () => ({
        jwtToken: "jwt-token",
        refreshToken: "refresh-token",
        feedToken: "feed-token",
      }),
      getProfile: async () => ({ clientcode: "AB1234" }),
      generateTokens: async () => {
        throw new Error("not used");
      },
      logout: async () => undefined,
    },
    repository: {
      find: (() => execResult([])) as never,
      findOne: (() => ({ select: () => execResult(null) })) as never,
      findOneAndUpdate: ((_filter: unknown, update: unknown) => {
        updates.push(update as Record<string, unknown>);
        const set = (update as { $set: Record<string, unknown> }).$set;
        return execResult(makeConnection({
          ...set,
          session: set.session,
        }));
      }) as never,
    },
  });

  const response = await service.connectAngelConnection(userId, {
    clientCode: "AB1234",
    apiKey: "api-key",
    pin: "1234",
    totp: "654321",
    totpSecret: "totp-secret",
  });

  const stored = (updates[0] as { $set: Record<string, unknown> }).$set;
  assert.equal(stored.encryptedApiKey, "enc(api-key)");
  assert.equal(stored.encryptedPin, "enc(1234)");
  assert.equal(stored.encryptedTotpSecret, "enc(totp-secret)");
  assert.deepEqual(stored.permissions, {
    marketData: true,
    orderPlacement: false,
    portfolioRead: false,
  });
  assert.equal(response.status, "ACTIVE");
  assert.equal(response.permissions.orderPlacement, false);
  assert.equal(JSON.stringify(response).includes("enc("), false);
});

test("BrokerConnectionService Angel login failure returns safe error", async () => {
  const service = new BrokerConnectionService({
    encryptionService: {
      encryptSecret: (value) => `enc(${value})`,
      decryptSecret: (value) => value,
    },
    angelAuthService: {
      loginByPassword: async () => {
        throw new Error("Angel login failed");
      },
      getProfile: async () => ({ clientcode: "AB1234" }),
      generateTokens: async () => {
        throw new Error("not used");
      },
      logout: async () => undefined,
    },
    repository: {
      find: (() => execResult([])) as never,
      findOne: (() => ({ select: () => execResult(null) })) as never,
      findOneAndUpdate: (() => execResult(null)) as never,
    },
  });

  await assert.rejects(
    service.connectAngelConnection(userId, {
      clientCode: "AB1234",
      apiKey: "api-key",
      pin: "1234",
      totp: "654321",
    }),
    /Angel login failed/,
  );
});
