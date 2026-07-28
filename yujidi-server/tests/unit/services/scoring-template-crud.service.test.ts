import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import { ScoringTemplateCrudService } from "../../../src/services/scoring-template-crud.service.js";

const userId = new Types.ObjectId().toString();
const symbolA = new Types.ObjectId().toString();
const symbolB = new Types.ObjectId().toString();
const noopValidator = {
  validateTemplate: () => undefined,
};

test("duplicateSystemTemplate rejects duplicate allowed tradable symbols", async () => {
  const service = new ScoringTemplateCrudService(undefined, noopValidator as never);

  await assert.rejects(
    () => service.duplicateSystemTemplate(userId, "INDIA_EQUITY_INTRADAY_V1", {
      allowedTradableSymbols: [symbolA, symbolA],
    }),
    /allowedTradableSymbols must be unique/,
  );
});

test("duplicateSystemTemplate validates resource and allowed symbol references exist", async () => {
  const service = new ScoringTemplateCrudService(undefined, noopValidator as never, {
    countSymbolsByIds: async () => 1,
  });

  await assert.rejects(
    () => service.duplicateSystemTemplate(userId, "INDIA_EQUITY_INTRADAY_V1", {
      resourceConfig: {
        marketRegime: {
          marketIndexSymbolId: symbolA,
        },
      },
      allowedTradableSymbols: [symbolB],
    }),
    /symbol references do not exist/,
  );
});

test("duplicateSystemTemplate validates enabled section override weights total 100", async () => {
  const service = new ScoringTemplateCrudService(undefined, noopValidator as never, {
    countSymbolsByIds: async (symbolIds) => symbolIds.length,
  });

  await assert.rejects(
    () => service.duplicateSystemTemplate(userId, "INDIA_EQUITY_INTRADAY_V1", {
      sectionOverrides: [
        { sectionKey: "A", weight: 60, enabled: true },
        { sectionKey: "B", weight: 30, enabled: true },
      ],
    }),
    /section override weights must total 100/,
  );
});
