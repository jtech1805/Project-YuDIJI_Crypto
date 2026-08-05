import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";

import { ScoringTemplateCrudService } from "../../../src/services/scoring-template-crud.service.js";
import { ScoringTemplateModel } from "../../../src/models/scoring-template.model.js";

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

test("system duplication now creates an owned USER DRAFT without changing the source", async () => {
  const original = (ScoringTemplateModel as any).create; let payload: any;
  (ScoringTemplateModel as any).create = async (value: any) => { payload = value; return { toObject: () => ({ ...value, _id: new Types.ObjectId(), usedCount: 0 }) }; };
  try { const service = new ScoringTemplateCrudService(undefined, noopValidator as never); await service.duplicateSystemTemplate(userId, "CRYPTO_SPOT_INTRADAY_V1", {}); assert.equal(payload.scope, "USER"); assert.equal(payload.status, "DRAFT"); assert.equal(String(payload.userId), userId); assert.equal(payload.visibility, "PRIVATE"); assert.equal(payload.isReadonly, false); }
  finally { (ScoringTemplateModel as any).create = original; }
});

test("ScoreCheck resolution rejects owned DRAFT and preserves owned ACTIVE eligibility", async () => {
  const original = (ScoringTemplateModel as any).findOne; const id = new Types.ObjectId();
  const base: any = { _id: id, userId: new Types.ObjectId(userId), scope: "USER", templateKey: "USER_TEMPLATE", baseTemplateKey: "CRYPTO_SPOT_INTRADAY_V1", templateName: "User", marketType: "CRYPTO", tradeStyle: "INTRADAY", instrumentType: "SPOT", version: 1, maxScore: 100, sections: [], permissionThresholds: {}, resourceConfig: {}, allowedTradableSymbols: [], sectionOverrides: [], snapshotPolicy: {}, usedCount: 0 };
  let status = "DRAFT"; (ScoringTemplateModel as any).findOne = () => ({ lean: () => ({ exec: async () => ({ ...base, status }) }) });
  try { const service = new ScoringTemplateCrudService(undefined, noopValidator as never); await assert.rejects(() => service.resolveForScoreCheck({ userId, scoringTemplateId: String(id) }), /SCORING_TEMPLATE_NOT_ACTIVE/); status = "ACTIVE"; const active = await service.resolveForScoreCheck({ userId, scoringTemplateId: String(id) }); assert.equal(active.templateKey, "USER_TEMPLATE"); }
  finally { (ScoringTemplateModel as any).findOne = original; }
});
