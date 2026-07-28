import assert from "node:assert/strict";
import test from "node:test";

import { AuditSanitizerService } from "../../../src/services/audit-sanitizer.service.js";
import { AuditLogService } from "../../../src/services/audit-log.service.js";

test("AuditSanitizerService redacts sensitive root keys", () => {
  const sanitizer = new AuditSanitizerService();
  const sanitized = sanitizer.sanitize({
    password: "secret-password",
    accessToken: "access-token",
    apiKey: "api-key",
    safeValue: "visible",
  });

  assert.equal(sanitized.password, "[REDACTED]");
  assert.equal(sanitized.accessToken, "[REDACTED]");
  assert.equal(sanitized.apiKey, "[REDACTED]");
  assert.equal(sanitized.safeValue, "visible");
});

test("AuditSanitizerService redacts nested sensitive keys", () => {
  const sanitizer = new AuditSanitizerService();
  const sanitized = sanitizer.sanitize({
    session: {
      jwt: "jwt-token",
      nested: {
        refreshToken: "refresh-token",
      },
    },
    profile: {
      name: "Jigar",
    },
  });

  assert.equal(sanitized.session, "[REDACTED]");
  assert.deepEqual(sanitized.profile, { name: "Jigar" });
});

test("AuditSanitizerService handles arrays", () => {
  const sanitizer = new AuditSanitizerService();
  const sanitized = sanitizer.sanitize({
    events: [
      { action: "SAFE", feedToken: "feed-token" },
      { metadata: { pin: "1234", label: "visible" } },
    ],
  });

  assert.deepEqual(sanitized, {
    events: [
      { action: "SAFE", feedToken: "[REDACTED]" },
      { metadata: { pin: "[REDACTED]", label: "visible" } },
    ],
  });
});

test("AuditLogService sanitizes metadata before persistence", async () => {
  let persisted: Record<string, unknown> | undefined;
  const service = new AuditLogService({
    repository: {
      create: async (input) => {
        persisted = input;
        return input;
      },
    },
  });

  await service.record({
    actorType: "SYSTEM",
    action: "BROKER_SYNC_TEST",
    entityType: "BROKER_CONNECTION",
    entityId: "broker-1",
    metadata: {
      broker: "ANGEL_ONE",
      jwtToken: "jwt-token",
      nested: {
        apiSecret: "api-secret",
      },
    },
  });

  assert.deepEqual(persisted?.metadata, {
    broker: "ANGEL_ONE",
    jwtToken: "[REDACTED]",
    nested: {
      apiSecret: "[REDACTED]",
    },
  });
});
