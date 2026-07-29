import assert from "node:assert/strict";
import test from "node:test";

import { EvidenceModel } from "../../../src/models/evidence.model.js";

const observation = (overrides: Record<string, unknown> = {}) => ({
  evidenceId: "evidence-001",
  recordType: "OBSERVATION",
  factorKey: "GLOBAL.DXY",
  deduplicationKey: "dedup-global-dxy-2026-07-29",
  subject: { type: "ECONOMY", key: "MACRO:DXY" },
  provenance: { sourceType: "MACRO_DATA", provider: "test-provider" },
  value: { type: "NUMBER", numberValue: 104.25, unit: "INDEX" },
  observedAt: new Date("2026-07-29T10:00:00.000Z"),
  schemaVersion: "1.0",
  ...overrides,
});

test("validates minimal and full number observations", async () => {
  await new EvidenceModel(observation()).validate();
  const full = new EvidenceModel(observation({
    subject: {
      type: "INSTRUMENT",
      key: "INSTRUMENT:MCX:GOLD",
      symbol: "GOLD",
      exchange: "MCX",
      marketType: "COMMODITY",
      timeframe: "1D",
    },
    provenance: {
      sourceType: "MARKET_DATA",
      provider: "normalized-provider",
      sourceName: "daily-close",
      externalReference: "opaque-reference-1",
      sourcePublishedAt: new Date("2026-07-29T09:59:00.000Z"),
    },
    validFrom: new Date("2026-07-29T10:00:00.000Z"),
    validUntil: new Date("2026-07-29T11:00:00.000Z"),
    confidence: 0.9,
    supersedesEvidenceId: "evidence-000",
  }));
  await full.validate();
  assert.equal(full.subject?.key, "INSTRUMENT:MCX:GOLD");
});

test("validates boolean false, category, and event observation values", async () => {
  await new EvidenceModel(observation({
    value: { type: "BOOLEAN", booleanValue: false },
  })).validate();
  const category = new EvidenceModel(observation({
    value: { type: "CATEGORY", categoryValue: "  ELEVATED  " },
  }));
  await category.validate();
  assert.equal(category.value?.categoryValue, "ELEVATED");
  await new EvidenceModel(observation({
    value: {
      type: "EVENT",
      eventCode: "CENTRAL_BANK_PURCHASE",
      summary: "A bounded normalized event summary.",
    },
  })).validate();
});

test("validates an append-only revocation record", async () => {
  const revocation = new EvidenceModel({
    evidenceId: "evidence-revoke-001",
    recordType: "REVOCATION",
    factorKey: "GLOBAL.DXY",
    deduplicationKey: "dedup-revoke-evidence-001",
    subject: { type: "ECONOMY", key: "MACRO:DXY" },
    provenance: { sourceType: "MANUAL", provider: "internal-operator" },
    observedAt: new Date("2026-07-29T11:00:00.000Z"),
    revokesEvidenceId: "evidence-001",
    reasonCode: "SOURCE_CORRECTION",
    schemaVersion: "1.0",
  });
  await revocation.validate();
  assert.equal(revocation.value, undefined);
});

test("rejects invalid observation and revocation record shapes", async () => {
  await assert.rejects(
    new EvidenceModel(observation({ value: undefined })).validate(),
    /value is required/,
  );
  await assert.rejects(
    new EvidenceModel(observation({
      revokesEvidenceId: "evidence-old",
      reasonCode: "INVALID",
    })).validate(),
    /forbidden for observations/,
  );
  await assert.rejects(
    new EvidenceModel({
      ...observation(),
      recordType: "REVOCATION",
      value: { type: "NUMBER", numberValue: 1 },
      revokesEvidenceId: undefined,
      reasonCode: undefined,
    }).validate(),
    /value is forbidden|revokesEvidenceId is required|reasonCode is required/,
  );
});

test("rejects value-union shape violations", async () => {
  const invalidValues = [
    { type: "NUMBER", numberValue: 1, booleanValue: true },
    { type: "BOOLEAN", booleanValue: true, categoryValue: "HIGH" },
    { type: "EVENT", eventCode: "EVENT", numberValue: 1 },
    { type: "CATEGORY" },
  ];
  for (const value of invalidValues) {
    await assert.rejects(
      new EvidenceModel(observation({ value })).validate(),
      /value fields do not match value type/,
    );
  }
});

test("rejects non-finite numbers and confidence outside zero through one", async () => {
  for (const numberValue of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    await assert.rejects(
      new EvidenceModel(observation({
        evidenceId: `invalid-number-${String(numberValue)}`,
        value: { type: "NUMBER", numberValue },
      })).validate(),
      /numberValue/,
    );
  }
  for (const confidence of [-0.1, 1.1, Number.POSITIVE_INFINITY]) {
    await assert.rejects(
      new EvidenceModel(observation({ confidence })).validate(),
      /confidence/,
    );
  }
});

test("enforces validity interval ordering and accepts equal timestamps", async () => {
  const instant = new Date("2026-07-29T10:00:00.000Z");
  await new EvidenceModel(observation({ validFrom: instant, validUntil: instant })).validate();
  await assert.rejects(
    new EvidenceModel(observation({
      validFrom: new Date("2026-07-29T11:00:00.000Z"),
      validUntil: new Date("2026-07-29T10:00:00.000Z"),
    })).validate(),
    /validUntil must be greater/,
  );
});

test("rejects unknown record, value, source, and subject enums", async () => {
  const invalidDocuments = [
    observation({ recordType: "UNKNOWN" }),
    observation({ value: { type: "UNKNOWN" } }),
    observation({ provenance: { sourceType: "UNKNOWN", provider: "test" } }),
    observation({ subject: { type: "UNKNOWN", key: "UNKNOWN" } }),
  ];
  for (const input of invalidDocuments) {
    await assert.rejects(
      new EvidenceModel(input).validate(),
      /not a valid enum value/,
    );
  }
});

test("schema is append-oriented with only approved indexes and no forbidden fields", () => {
  assert.equal(EvidenceModel.schema.path("createdAt") !== undefined, true);
  assert.equal(EvidenceModel.schema.path("updatedAt"), undefined);
  assert.equal(EvidenceModel.schema.options.versionKey, false);

  const indexes = EvidenceModel.schema.indexes() as Array<
    [Record<string, number>, Record<string, unknown>]
  >;
  assert.deepEqual(indexes.map(([fields, options]) => ({
    fields,
    unique: options.unique === true,
    sparse: options.sparse === true,
  })), [
    { fields: { evidenceId: 1 }, unique: true, sparse: false },
    { fields: { deduplicationKey: 1 }, unique: true, sparse: false },
    { fields: { factorKey: 1, observedAt: -1 }, unique: false, sparse: false },
    {
      fields: { "subject.type": 1, "subject.key": 1, observedAt: -1 },
      unique: false,
      sparse: false,
    },
    {
      fields: {
        "provenance.sourceType": 1,
        "provenance.provider": 1,
        observedAt: -1,
      },
      unique: false,
      sparse: false,
    },
    { fields: { recordType: 1, observedAt: -1 }, unique: false, sparse: false },
    { fields: { revokesEvidenceId: 1, createdAt: -1 }, unique: false, sparse: true },
    { fields: { supersedesEvidenceId: 1, createdAt: -1 }, unique: false, sparse: true },
    {
      fields: {
        factorKey: 1,
        "subject.type": 1,
        "subject.key": 1,
        observedAt: 1,
        evidenceId: 1,
      },
      unique: false,
      sparse: false,
    },
    {
      fields: { revokesEvidenceId: 1, observedAt: 1, evidenceId: 1 },
      unique: false,
      sparse: true,
    },
    {
      fields: { supersedesEvidenceId: 1, observedAt: 1, evidenceId: 1 },
      unique: false,
      sparse: true,
    },
  ]);

  for (const field of [
    "rawPayload",
    "providerPayload",
    "requestBody",
    "responseBody",
    "prompt",
    "llmOutput",
    "authorization",
    "accessToken",
    "apiKey",
    "credentials",
    "tradeDecision",
    "permission",
    "positionSize",
    "finalScore",
  ]) {
    assert.equal(EvidenceModel.schema.path(field), undefined);
  }
});
