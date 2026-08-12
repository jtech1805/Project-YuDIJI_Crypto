import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import {
  buildTradeEventCreatedPayload,
  TradeEventDeliveryService,
} from "../../../src/services/trading/trade-event-delivery.service.js";
import { TradeEventService, type TradeEventRecord } from "../../../src/services/trading/trade-event.service.js";

const userId = "69e64c5f9042aac89c8c83f8";
const otherUserId = "69e64c5f9042aac89c8c83f9";
const tradeEventId = "65abc0000000000000000012";
const activeTradeId = "65abc0000000000000000003";
const tradePlanId = "65abc0000000000000000002";
const tradeSetupId = "65abc0000000000000000004";
const symbolId = "65abc0000000000000000001";
const occurredAt = new Date("2026-06-24T12:00:00.000Z");

const makeEvent = (overrides: Partial<TradeEventRecord> = {}): TradeEventRecord => ({
  _id: new Types.ObjectId(tradeEventId),
  userId,
  tradePlanId,
  activeTradeId,
  tradeSetupId,
  symbolId,
  symbolSnapshot: {
    symbolId,
    symbol: "BTCUSDT",
    displayName: "BTC / USDT",
    provider: "BINANCE",
    marketType: "CRYPTO",
    exchange: "BINANCE",
    instrumentType: "SPOT",
    providerSymbol: "BTCUSDT",
    apiKey: "must-not-leak",
    feedToken: "must-not-leak",
    raw: { secret: "must-not-leak" },
  },
  eventType: "TARGET_1_HIT",
  severity: "INFO",
  source: "SYSTEM",
  direction: "LONG",
  price: 68200,
  currentR: 1.4,
  reasonCodes: ["ACTUAL_TARGET_1_REACHED"],
  message: "Target 1 hit for your active trade.",
  occurredAt,
  ...overrides,
});

const execResult = <T>(value: T) => ({ exec: async () => value });
const leanResult = <T>(value: T) => ({ lean: () => execResult(value) });
const sortableLeanResult = <T>(value: T) => ({ sort: () => leanResult(value) });

test("TradeEvent payload builder includes required frontend fields", () => {
  const payload = buildTradeEventCreatedPayload(makeEvent());
  assert.deepEqual(payload, {
    type: "TRADE_EVENT_CREATED",
    payload: {
      tradeEventId,
      activeTradeId,
      tradePlanId,
      tradeSetupId,
      eventType: "TARGET_1_HIT",
      severity: "INFO",
      symbolId,
      symbol: "BTCUSDT",
      displayName: "BTC / USDT",
      marketType: "CRYPTO",
      exchange: "BINANCE",
      instrumentType: "SPOT",
      direction: "LONG",
      price: 68200,
      currentR: 1.4,
      message: "Target 1 hit for your active trade.",
      occurredAt: occurredAt.toISOString(),
    },
  });
});

test("TradeEvent payload excludes secrets, provider tokens, metadata, and raw payloads", () => {
  const serialized = JSON.stringify(buildTradeEventCreatedPayload(makeEvent({
    metadata: {
      accessToken: "must-not-leak",
      providerPayload: { secret: "must-not-leak" },
    },
  })));
  assert.equal(serialized.includes("must-not-leak"), false);
  assert.equal(serialized.includes("apiKey"), false);
  assert.equal(serialized.includes("feedToken"), false);
  assert.equal(serialized.includes("metadata"), false);
  assert.equal(serialized.includes("\"raw\""), false);
});

test("delivery emits TRADE_EVENT_CREATED only to the owning user", async () => {
  const emissions: Array<{ userId: string; payload: unknown }> = [];
  const service = new TradeEventDeliveryService({
    emitter: {
      emitToUser: (emittedUserId, payload) => {
        emissions.push({ userId: emittedUserId, payload });
        return 1;
      },
    },
    auditLogService: { record: async () => undefined },
  });

  await service.deliver(makeEvent());

  assert.equal(emissions.length, 1);
  assert.equal(emissions[0]?.userId, userId);
  assert.notEqual(emissions[0]?.userId, otherUserId);
  assert.equal((emissions[0]?.payload as { type: string }).type, "TRADE_EVENT_CREATED");
});

test("delivery audits attempted and successful delivery", async () => {
  const audits: Record<string, any>[] = [];
  const service = new TradeEventDeliveryService({
    emitter: { emitToUser: () => 2 },
    auditLogService: { record: async (event) => { audits.push(event); } },
  });

  await service.deliver(makeEvent());

  assert.deepEqual(audits.map((event) => event.action), [
    "TRADE_EVENT_DELIVERY_ATTEMPTED",
    "TRADE_EVENT_DELIVERED",
  ]);
  assert.equal(audits[1]?.metadata.deliveredSocketCount, 2);
});

test("delivery failure is swallowed and audited safely", async () => {
  const audits: Record<string, any>[] = [];
  const service = new TradeEventDeliveryService({
    emitter: {
      emitToUser: () => {
        throw new Error("socket unavailable");
      },
    },
    auditLogService: { record: async (event) => { audits.push(event); } },
  });

  await assert.doesNotReject(service.deliver(makeEvent()));
  assert.deepEqual(audits.map((event) => event.action), [
    "TRADE_EVENT_DELIVERY_ATTEMPTED",
    "TRADE_EVENT_DELIVERY_FAILED",
  ]);
});

test("TradeEventService delivers only newly created events", async () => {
  const records: Record<string, any>[] = [];
  const delivered: TradeEventRecord[] = [];
  const repository = {
    create: async (input: Record<string, unknown>) => {
      const record = { ...makeEvent(), ...input };
      records.push(record);
      return record;
    },
    find: () => sortableLeanResult(records),
    findOne: (filter: Record<string, unknown>) => {
      const record = records.find((item) => item.idempotencyKey === filter.idempotencyKey) ?? null;
      return leanResult(record);
    },
  };
  const service = new TradeEventService({
    tradeEventRepository: repository,
    auditLogService: { record: async () => undefined },
    deliveryService: { deliver: async (event) => { delivered.push(event); } },
  });
  const input = {
    ...makeEvent(),
    userId,
    tradePlanId,
    activeTradeId,
    tradeSetupId,
    symbolId,
    idempotencyKey: `${activeTradeId}:TARGET_1_HIT`,
  };
  delete (input as Partial<TradeEventRecord>)._id;

  const first = await service.createIdempotently(input);
  const second = await service.createIdempotently(input);

  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(delivered.length, 1);
});

test("unexpected delivery error does not roll back TradeEvent creation", async () => {
  let persisted = false;
  const service = new TradeEventService({
    tradeEventRepository: {
      create: async (input) => {
        persisted = true;
        return { ...makeEvent(), ...input };
      },
      find: () => sortableLeanResult([]),
      findOne: () => leanResult(null),
    },
    auditLogService: { record: async () => undefined },
    deliveryService: {
      deliver: async () => {
        throw new Error("unexpected delivery failure");
      },
    },
  });
  const event = makeEvent();

  const result = await service.createIdempotently({
    userId,
    tradePlanId,
    activeTradeId,
    tradeSetupId,
    symbolId,
    symbolSnapshot: event.symbolSnapshot,
    eventType: event.eventType,
    severity: event.severity,
    source: event.source,
    direction: event.direction,
    price: event.price,
    ...(event.currentR !== undefined ? { currentR: event.currentR } : {}),
    reasonCodes: event.reasonCodes,
    message: event.message,
    occurredAt,
  });

  assert.equal(persisted, true);
  assert.equal(result.created, true);
});

test("existing market alert websocket event name remains NEW_ALERT", async () => {
  const source = await import("node:fs/promises");
  const analyzerSource = await source.readFile(
    new URL("../../../src/services/trading/analyzer.service.ts", import.meta.url),
    "utf8",
  );
  assert.match(analyzerSource, /type:\s*"NEW_ALERT"/);
});
