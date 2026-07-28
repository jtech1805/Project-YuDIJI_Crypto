import { Types, isValidObjectId } from "mongoose";
import { z } from "zod";

import { AppError } from "../errors/AppError.js";
import { ActiveTradeModel } from "../models/active-trade.model.js";
import { ScoreCheckModel } from "../models/score-check.model.js";
import { ScoreCheckSnapshotModel } from "../models/score-check-snapshot.model.js";
import { SymbolModel } from "../models/Symbol.js";
import { TradeScoreSnapshotModel } from "../models/trade-score-snapshot.model.js";
import { TradeSetupModel } from "../models/trade-setup.model.js";
import {
  INSTRUMENT_TYPES,
  MARKET_PROVIDERS,
  MARKET_TYPES,
  EXCHANGES,
  type Exchange,
  type InstrumentType,
  type MarketProvider,
  type MarketType,
} from "../types/market-data.types.js";
import {
  DATA_CONFIDENCE_LEVELS,
  SCORING_SETUP_TYPES,
  type ScoringContextSymbolIds,
  type ScoringSetupType,
  type DataConfidence,
  type ScoringUserLevels,
  type ResolvedScoringTemplateDefinition,
  type ScoringTemplateResourceSnapshotContext,
} from "../types/scoring.types.js";
import { TRADE_DIRECTIONS, type TradeDirection } from "../types/trade.types.js";
import { auditLogService, type AuditLogService } from "./audit-log.service.js";
import { ScoringEngineService, type ScoringEngineResult } from "./scoring-engine.service.js";
import { ScoringContextBuilderService } from "./scoring-context-builder.service.js";
import { ScoringTemplateCrudService } from "./scoring-template-crud.service.js";

const positiveNumber = z.number().positive();
const userLevelsSchema = z.object({
  breakoutLevel: positiveNumber.optional(),
  supportLevel: positiveNumber.optional(),
  resistanceLevel: positiveNumber.optional(),
  pullbackZone: positiveNumber.optional(),
  rangeHigh: positiveNumber.optional(),
  rangeLow: positiveNumber.optional(),
}).strict();
const contextSymbolIdsSchema = z.object({
  indexSymbolId: z.string().refine(isValidObjectId, "Invalid indexSymbolId").optional(),
  sectorSymbolId: z.string().refine(isValidObjectId, "Invalid sectorSymbolId").optional(),
  vixSymbolId: z.string().refine(isValidObjectId, "Invalid vixSymbolId").optional(),
}).strict();

const baseScoreCheckSchema = z.object({
  symbolId: z.string().min(1),
  marketType: z.enum(MARKET_TYPES),
  tradeStyle: z.string().min(1).max(64).transform((value) => value.trim().toUpperCase()),
  instrumentType: z.enum(INSTRUMENT_TYPES),
  direction: z.enum(TRADE_DIRECTIONS),
  entry: positiveNumber,
  stopLoss: positiveNumber,
  target1: positiveNumber,
  target2: positiveNumber.optional(),
  setupType: z.enum(SCORING_SETUP_TYPES).optional(),
  userLevels: userLevelsSchema.optional(),
  contextSymbolIds: contextSymbolIdsSchema.optional(),
  scoringTemplateKey: z.string().min(1).max(140).transform((value) => value.trim().toUpperCase()).optional(),
  scoringTemplateId: z.string().refine(isValidObjectId, "Invalid scoringTemplateId").optional(),
  scoringTemplateVersion: z.string().min(1).max(64).optional(),
  dataConfidence: z.enum(DATA_CONFIDENCE_LEVELS).optional(),
});

const requireTemplateSelection = (value: {
  scoringTemplateKey?: string | undefined;
  scoringTemplateId?: string | undefined;
}, context: z.RefinementCtx): void => {
  if (!value.scoringTemplateKey && !value.scoringTemplateId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["scoringTemplateKey"],
      message: "scoringTemplateKey or scoringTemplateId is required",
    });
  }
};

export const createScoreCheckSchema = baseScoreCheckSchema.superRefine((value, context) => {
  requireTemplateSelection(value, context);

  if (value.direction === "LONG" && !(value.stopLoss < value.entry && value.entry < value.target1)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["direction"],
      message: "INVALID_LONG_GEOMETRY",
    });
  }

  if (value.direction === "SHORT" && !(value.target1 < value.entry && value.entry < value.stopLoss)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["direction"],
      message: "INVALID_SHORT_GEOMETRY",
    });
  }
});

export type CreateScoreCheckInput = z.infer<typeof createScoreCheckSchema>;

export const updateScoreCheckSchema = baseScoreCheckSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "No update fields provided",
);

export const deleteScoreCheckSchema = z.object({
  reason: z.string().max(500).optional(),
}).strict();

export type UpdateScoreCheckInput = z.infer<typeof updateScoreCheckSchema>;
export type DeleteScoreCheckInput = z.infer<typeof deleteScoreCheckSchema>;

type QueryExec<T> = {
  exec: () => Promise<T>;
};

type LeanQueryExec<T> = {
  lean: () => QueryExec<T>;
};

type SortableLeanQueryExec<T> = {
  sort: (sort: Record<string, 1 | -1>) => LeanQueryExec<T>;
};

type ScoreCheckRepository = {
  create: (input: Record<string, unknown>) => Promise<unknown>;
  find: (filter: Record<string, unknown>) => SortableLeanQueryExec<unknown[]>;
  findOne: (filter: Record<string, unknown>) => LeanQueryExec<unknown | null>;
  findOneAndUpdate: (
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options: Record<string, unknown>,
  ) => LeanQueryExec<unknown | null>;
};

type ScoreCheckSnapshotRepository = {
  findOne: (filter: Record<string, unknown>) => LeanQueryExec<unknown | null>;
  findOneAndUpdate: (
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options: Record<string, unknown>,
  ) => LeanQueryExec<unknown | null>;
};

type SymbolRepository = {
  findOne: (filter: Record<string, unknown>, projection?: Record<string, 0 | 1>) => LeanQueryExec<unknown | null>;
};

type ScoreCheckServiceDependencies = {
  scoreCheckRepository: ScoreCheckRepository;
  scoreCheckSnapshotRepository: ScoreCheckSnapshotRepository;
  symbolRepository: SymbolRepository;
  scoringEngine: Pick<ScoringEngineService, "score">;
  scoringTemplateService: Pick<ScoringTemplateCrudService, "resolveForScoreCheck" | "markUsed">;
  auditLogService: Pick<AuditLogService, "record">;
  now: () => Date;
  scoringContextBuilder: Pick<ScoringContextBuilderService, "build" | "buildTemplateResourceSnapshotContext">;
};

type SymbolRecord = {
  _id: Types.ObjectId | string;
  symbol: string;
  displayName?: string;
  provider: MarketProvider;
  marketType: MarketType;
  exchange: Exchange;
  instrumentType: InstrumentType;
  providerSymbol?: string;
  instrumentToken?: string;
  lotSize?: number;
  tickSize?: number;
  expiry?: Date;
  requiresBrokerLogin?: boolean;
  status: string;
};

type ScoreCheckRecord = {
  _id: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  scoreMode: "STANDALONE_SCORE_CHECK";
  symbolId: Types.ObjectId | string;
  symbolSnapshot: Record<string, unknown>;
  marketType: MarketType;
  tradeStyle: string;
  instrumentType: InstrumentType;
  direction: TradeDirection;
  entry: number;
  stopLoss: number;
  target1: number;
  target2?: number;
  setupType?: ScoringSetupType;
  userLevels?: ScoringUserLevels;
  contextSymbolIds?: ScoringContextSymbolIds;
  riskPerUnit: number;
  rewardPerUnit: number;
  rewardRiskRatio: number;
  scoringTemplateKey: string;
  scoringTemplateId?: Types.ObjectId | string;
  scoringTemplateVersion: string;
  scoringTemplateScope?: "SYSTEM" | "USER";
  scoringTemplateName?: string;
  scoreStatus: string;
  score: number;
  permission: string;
  dataConfidence: DataConfidence;
  reasonCodes: string[];
  warnings: string[];
  breakdown?: Record<string, unknown>;
  resourceSnapshotSummary?: ScoringTemplateResourceSnapshotContext;
  scoreCheckSnapshotId?: Types.ObjectId | string;
  scoreCheckSnapshotExpiresAt?: Date;
  scoreCheckSnapshotCreatedAt?: Date;
  tradeScoreSnapshotId?: Types.ObjectId | string;
  scoreCalculatedAt?: Date;
  scoreValidUntil?: Date;
  convertedToTradeSetupId?: Types.ObjectId | string;
  isDeleted?: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId | string;
  deleteReason?: string;
};

const symbolProjection = {
  symbol: 1,
  displayName: 1,
  provider: 1,
  marketType: 1,
  exchange: 1,
  instrumentType: 1,
  providerSymbol: 1,
  instrumentToken: 1,
  lotSize: 1,
  tickSize: 1,
  expiry: 1,
  requiresBrokerLogin: 1,
  status: 1,
} as const;

const toObjectId = (value: string, label: string): Types.ObjectId => {
  if (!isValidObjectId(value)) {
    throw new AppError(`Invalid ${label}`, 400);
  }
  return new Types.ObjectId(value);
};

const normalizeRecord = <T>(value: unknown): T => {
  if (value && typeof value === "object" && "toObject" in value && typeof value.toObject === "function") {
    return value.toObject() as T;
  }
  return value as T;
};

export const calculateTradeGeometry = (input: {
  direction: TradeDirection;
  entry: number;
  stopLoss: number;
  target1: number;
}): {
  riskPerUnit: number;
  rewardPerUnit: number;
  rewardRiskRatio: number;
} => {
  const riskPerUnit = input.direction === "LONG"
    ? input.entry - input.stopLoss
    : input.stopLoss - input.entry;
  const rewardPerUnit = input.direction === "LONG"
    ? input.target1 - input.entry
    : input.entry - input.target1;

  return {
    riskPerUnit,
    rewardPerUnit,
    rewardRiskRatio: Number((rewardPerUnit / riskPerUnit).toFixed(4)),
  };
};

export class ScoreCheckService {
  public constructor(private readonly dependencies: Partial<ScoreCheckServiceDependencies> = {}) {}

  public async createScoreCheck(userId: string, input: CreateScoreCheckInput): Promise<ScoreCheckRecord> {
    const userObjectId = toObjectId(userId, "user id");
    const parsedInput = this.parseCreateInput(input);
    const symbol = await this.getActiveSymbol(parsedInput.symbolId);
    this.assertSymbolMatchesInput(symbol, parsedInput);
    const resolvedTemplate = await this.getScoringTemplateService().resolveForScoreCheck({
      userId,
      ...(parsedInput.scoringTemplateKey ? { scoringTemplateKey: parsedInput.scoringTemplateKey } : {}),
      ...(parsedInput.scoringTemplateId ? { scoringTemplateId: parsedInput.scoringTemplateId } : {}),
    });
    this.assertResolvedTemplateMatchesSymbol(symbol, parsedInput, resolvedTemplate);
    this.assertTemplateAllowsSymbol(resolvedTemplate, parsedInput.symbolId);

    const symbolSnapshot = this.buildSymbolSnapshot(symbol);
    const userLevels = this.compactUserLevels(parsedInput.userLevels);
    const contextSymbolIds = this.compactContextSymbolIds(parsedInput.contextSymbolIds);
    const geometry = calculateTradeGeometry(parsedInput);
    const calculatedAt = this.getNow();
    const scoringContext = await this.getScoringContextBuilder().build({
      userId,
      symbolId: parsedInput.symbolId,
      templateKey: resolvedTemplate.baseTemplateKey,
      ...(contextSymbolIds ? { contextSymbolIds } : {}),
      includeBuffers: false,
      bufferLimit: 20,
      scoring: {
        scoringTemplateKey: resolvedTemplate.baseTemplateKey,
        scoringTemplateVersion: String(resolvedTemplate.version),
        marketType: parsedInput.marketType,
        tradeStyle: parsedInput.tradeStyle,
        instrumentType: parsedInput.instrumentType,
        rewardRiskRatio: geometry.rewardRiskRatio,
        ...(parsedInput.dataConfidence ? { dataConfidence: parsedInput.dataConfidence } : {}),
        evaluatedAt: calculatedAt,
        direction: parsedInput.direction,
        entry: parsedInput.entry,
        stopLoss: parsedInput.stopLoss,
        target1: parsedInput.target1,
        ...(parsedInput.target2 !== undefined ? { target2: parsedInput.target2 } : {}),
        ...(parsedInput.setupType ? { setupType: parsedInput.setupType } : {}),
        ...(userLevels ? { userLevels } : {}),
      },
    });
    const resourceSnapshotSummary = await this.buildTemplateResourceSnapshotSummary({
      userId,
      symbol,
      resolvedTemplate,
      ...(parsedInput.scoringTemplateId ? { scoringTemplateId: parsedInput.scoringTemplateId } : {}),
    });
    const scoringResult = this.getScoringEngine().score({
      ...scoringContext.evaluatorInput!,
      scoringTemplateKey: resolvedTemplate.templateKey,
      scoringTemplateVersion: String(resolvedTemplate.version),
      resolvedTemplate,
    });
    const validUntil = new Date(calculatedAt.getTime() + 15 * 60 * 1000);
    const reasonCodes = ["VALID_GEOMETRY", ...scoringResult.reasonCodes, "SCORE_CHECK_CREATED"];

    const scoreCheck = normalizeRecord<ScoreCheckRecord>(await this.getScoreCheckRepository().create({
      userId: userObjectId,
      scoreMode: "STANDALONE_SCORE_CHECK",
      symbolId: toObjectId(parsedInput.symbolId, "symbol id"),
      symbolSnapshot,
      marketType: parsedInput.marketType,
      tradeStyle: parsedInput.tradeStyle,
      instrumentType: parsedInput.instrumentType,
      direction: parsedInput.direction,
      entry: parsedInput.entry,
      stopLoss: parsedInput.stopLoss,
      target1: parsedInput.target1,
      ...(parsedInput.target2 ? { target2: parsedInput.target2 } : {}),
      ...(parsedInput.setupType ? { setupType: parsedInput.setupType } : {}),
      ...(userLevels ? { userLevels } : {}),
      ...(contextSymbolIds ? { contextSymbolIds } : {}),
      ...geometry,
      scoringTemplateKey: resolvedTemplate.templateKey,
      ...(resolvedTemplate.id ? { scoringTemplateId: toObjectId(resolvedTemplate.id, "scoring template id") } : {}),
      scoringTemplateVersion: String(resolvedTemplate.version),
      scoringTemplateScope: resolvedTemplate.scope,
      scoringTemplateName: resolvedTemplate.templateName,
      scoreStatus: scoringResult.scoreStatus,
      score: scoringResult.score,
      permission: scoringResult.permission,
      dataConfidence: scoringResult.dataConfidence,
      reasonCodes,
      warnings: scoringResult.warnings,
      breakdown: scoringResult.breakdown,
      scoreCalculatedAt: calculatedAt,
      scoreValidUntil: validUntil,
    }));

    await this.audit("SCORE_CHECK_CREATED", userId, scoreCheck._id, {
      after: this.toAuditScoreSnapshot(scoreCheck),
    });

    const updatedScoreCheck = await this.updateScoreCheckRecord(userId, String(scoreCheck._id), {
      $set: {
        reasonCodes: [...reasonCodes, "SCORE_CALCULATED"],
      },
    });

    await this.audit("SCORE_CALCULATED", userId, updatedScoreCheck._id, {
      metadata: {
        score: updatedScoreCheck.score,
        permission: updatedScoreCheck.permission,
        rewardRiskRatio: updatedScoreCheck.rewardRiskRatio,
      },
    });

    await this.getScoringTemplateService().markUsed(resolvedTemplate);

    const scoreCheckSnapshot = await this.upsertScoreCheckSnapshot({
      userId,
      scoreCheck: updatedScoreCheck,
      symbol,
      resolvedTemplate,
      scoringResult,
      ...(resourceSnapshotSummary ? { resourceSnapshotSummary } : {}),
      calculatedAt,
    });

    return {
      ...updatedScoreCheck,
      ...(resourceSnapshotSummary ? { resourceSnapshotSummary } : {}),
      scoreCheckSnapshotId: scoreCheckSnapshot._id as Types.ObjectId | string,
      scoreCheckSnapshotExpiresAt: scoreCheckSnapshot.expiresAt as Date,
      scoreCheckSnapshotCreatedAt: scoreCheckSnapshot.createdAt as Date,
    };
  }

  public async listScoreChecks(userId: string): Promise<ScoreCheckRecord[]> {
    const userObjectId = toObjectId(userId, "user id");
    return this.getScoreCheckRepository()
      .find({ userId: userObjectId, isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .lean()
      .exec() as Promise<ScoreCheckRecord[]>;
  }

  public async getScoreCheck(userId: string, scoreCheckId: string): Promise<ScoreCheckRecord> {
    const userObjectId = toObjectId(userId, "user id");
    const scoreCheckObjectId = toObjectId(scoreCheckId, "score check id");
    const scoreCheck = await this.getScoreCheckRepository().findOne({
      _id: scoreCheckObjectId,
      userId: userObjectId,
      isDeleted: { $ne: true },
    }).lean().exec() as ScoreCheckRecord | null;

    if (!scoreCheck) {
      throw new AppError("SCORE_CHECK_NOT_FOUND", 404);
    }

    return scoreCheck;
  }

  public async updateScoreCheck(
    userId: string,
    scoreCheckId: string,
    input: UpdateScoreCheckInput,
  ): Promise<ScoreCheckRecord> {
    const parsedInput = this.parseUpdateInput(input);
    const existing = await this.getScoreCheck(userId, scoreCheckId);
    await this.assertScoreCheckIsEditable(userId, existing);

    const mergedInput: CreateScoreCheckInput = {
      symbolId: String(parsedInput.symbolId ?? existing.symbolId),
      marketType: parsedInput.marketType ?? existing.marketType,
      tradeStyle: parsedInput.tradeStyle ?? existing.tradeStyle,
      instrumentType: parsedInput.instrumentType ?? existing.instrumentType,
      direction: parsedInput.direction ?? existing.direction,
      entry: parsedInput.entry ?? existing.entry,
      stopLoss: parsedInput.stopLoss ?? existing.stopLoss,
      target1: parsedInput.target1 ?? existing.target1,
      ...(parsedInput.target2 !== undefined
        ? { target2: parsedInput.target2 }
        : existing.target2 !== undefined
          ? { target2: existing.target2 }
          : {}),
      ...(parsedInput.setupType !== undefined
        ? { setupType: parsedInput.setupType }
        : existing.setupType !== undefined
          ? { setupType: existing.setupType }
          : {}),
      ...(parsedInput.userLevels !== undefined
        ? { userLevels: parsedInput.userLevels }
        : existing.userLevels
          ? { userLevels: existing.userLevels }
          : {}),
      ...(parsedInput.contextSymbolIds !== undefined
        ? { contextSymbolIds: parsedInput.contextSymbolIds }
        : existing.contextSymbolIds
          ? { contextSymbolIds: existing.contextSymbolIds }
          : {}),
      scoringTemplateKey: parsedInput.scoringTemplateKey ?? existing.scoringTemplateKey,
      ...(parsedInput.scoringTemplateId !== undefined
        ? { scoringTemplateId: parsedInput.scoringTemplateId }
        : existing.scoringTemplateId
          ? { scoringTemplateId: String(existing.scoringTemplateId) }
          : {}),
      ...(parsedInput.scoringTemplateVersion ?? existing.scoringTemplateVersion
        ? { scoringTemplateVersion: parsedInput.scoringTemplateVersion ?? existing.scoringTemplateVersion }
        : {}),
      dataConfidence: parsedInput.dataConfidence ?? existing.dataConfidence,
    };

    const validation = createScoreCheckSchema.safeParse(mergedInput);
    if (!validation.success) {
      throw new AppError("Invalid ScoreCheck update payload", 400);
    }

    const symbol = await this.getActiveSymbol(validation.data.symbolId);
    this.assertSymbolMatchesInput(symbol, validation.data);
    const resolvedTemplate = await this.getScoringTemplateService().resolveForScoreCheck({
      userId,
      ...(validation.data.scoringTemplateKey ? { scoringTemplateKey: validation.data.scoringTemplateKey } : {}),
      ...(validation.data.scoringTemplateId ? { scoringTemplateId: validation.data.scoringTemplateId } : {}),
    });
    this.assertResolvedTemplateMatchesSymbol(symbol, validation.data, resolvedTemplate);
    this.assertTemplateAllowsSymbol(resolvedTemplate, validation.data.symbolId);
    const calculatedAt = this.getNow();
    const symbolSnapshot = this.buildSymbolSnapshot(symbol);
    const userLevels = this.compactUserLevels(validation.data.userLevels);
    const contextSymbolIds = this.compactContextSymbolIds(validation.data.contextSymbolIds);
    const geometry = calculateTradeGeometry(validation.data);
    const scoringContext = await this.getScoringContextBuilder().build({
      userId,
      symbolId: validation.data.symbolId,
      templateKey: resolvedTemplate.baseTemplateKey,
      ...(contextSymbolIds ? { contextSymbolIds } : {}),
      includeBuffers: false,
      bufferLimit: 20,
      scoring: {
        scoringTemplateKey: resolvedTemplate.baseTemplateKey,
        scoringTemplateVersion: String(resolvedTemplate.version),
        marketType: validation.data.marketType,
        tradeStyle: validation.data.tradeStyle,
        instrumentType: validation.data.instrumentType,
        rewardRiskRatio: geometry.rewardRiskRatio,
        ...(validation.data.dataConfidence ? { dataConfidence: validation.data.dataConfidence } : {}),
        evaluatedAt: calculatedAt,
        direction: validation.data.direction,
        entry: validation.data.entry,
        stopLoss: validation.data.stopLoss,
        target1: validation.data.target1,
        ...(validation.data.target2 !== undefined ? { target2: validation.data.target2 } : {}),
        ...(validation.data.setupType ? { setupType: validation.data.setupType } : {}),
        ...(userLevels ? { userLevels } : {}),
      },
    });
    const resourceSnapshotSummary = await this.buildTemplateResourceSnapshotSummary({
      userId,
      symbol,
      resolvedTemplate,
      ...(validation.data.scoringTemplateId ? { scoringTemplateId: validation.data.scoringTemplateId } : {}),
    });
    const scoringResult = this.getScoringEngine().score({
      ...scoringContext.evaluatorInput!,
      scoringTemplateKey: resolvedTemplate.templateKey,
      scoringTemplateVersion: String(resolvedTemplate.version),
      resolvedTemplate,
    });
    const validUntil = new Date(calculatedAt.getTime() + 15 * 60 * 1000);
    const reasonCodes = ["VALID_GEOMETRY", ...scoringResult.reasonCodes, "SCORE_CHECK_UPDATED"];

    const updated = await this.updateScoreCheckRecord(userId, scoreCheckId, {
      $set: {
        symbolId: toObjectId(validation.data.symbolId, "symbol id"),
        symbolSnapshot,
        marketType: validation.data.marketType,
        tradeStyle: validation.data.tradeStyle,
        instrumentType: validation.data.instrumentType,
        direction: validation.data.direction,
        entry: validation.data.entry,
        stopLoss: validation.data.stopLoss,
        target1: validation.data.target1,
        ...(validation.data.target2 !== undefined ? { target2: validation.data.target2 } : {}),
        ...(validation.data.setupType !== undefined ? { setupType: validation.data.setupType } : {}),
        ...(userLevels ? { userLevels } : {}),
        ...(contextSymbolIds ? { contextSymbolIds } : {}),
        ...geometry,
        scoringTemplateKey: resolvedTemplate.templateKey,
        ...(resolvedTemplate.id ? { scoringTemplateId: toObjectId(resolvedTemplate.id, "scoring template id") } : {}),
        scoringTemplateVersion: String(resolvedTemplate.version),
        scoringTemplateScope: resolvedTemplate.scope,
        scoringTemplateName: resolvedTemplate.templateName,
        scoreStatus: scoringResult.scoreStatus,
        score: scoringResult.score,
        permission: scoringResult.permission,
        dataConfidence: scoringResult.dataConfidence,
        reasonCodes: [...reasonCodes, "SCORE_CALCULATED"],
        warnings: scoringResult.warnings,
        breakdown: scoringResult.breakdown,
        scoreCalculatedAt: calculatedAt,
        scoreValidUntil: validUntil,
      },
      $unset: {
        ...(validation.data.target2 === undefined ? { target2: "" } : {}),
        ...(validation.data.setupType === undefined ? { setupType: "" } : {}),
        ...(userLevels ? {} : { userLevels: "" }),
        ...(contextSymbolIds ? {} : { contextSymbolIds: "" }),
      },
    });

    await this.audit("SCORE_CHECK_UPDATED", userId, updated._id, {
      before: this.toAuditScoreSnapshot(existing),
      after: this.toAuditScoreSnapshot(updated),
    });

    await this.getScoringTemplateService().markUsed(resolvedTemplate);

    const scoreCheckSnapshot = await this.upsertScoreCheckSnapshot({
      userId,
      scoreCheck: updated,
      symbol,
      resolvedTemplate,
      scoringResult,
      ...(resourceSnapshotSummary ? { resourceSnapshotSummary } : {}),
      calculatedAt,
    });

    return {
      ...updated,
      ...(resourceSnapshotSummary ? { resourceSnapshotSummary } : {}),
      scoreCheckSnapshotId: scoreCheckSnapshot._id as Types.ObjectId | string,
      scoreCheckSnapshotExpiresAt: scoreCheckSnapshot.expiresAt as Date,
      scoreCheckSnapshotCreatedAt: scoreCheckSnapshot.createdAt as Date,
    };
  }

  public async getScoreCheckSnapshot(userId: string, scoreCheckId: string): Promise<Record<string, unknown>> {
    const snapshot = await this.getScoreCheckSnapshotRepository().findOne({
      userId: toObjectId(userId, "user id"),
      scoreCheckId: toObjectId(scoreCheckId, "score check id"),
      expiresAt: { $gt: this.getNow() },
    }).lean().exec() as Record<string, unknown> | null;

    if (!snapshot) {
      throw new AppError("SCORE_CHECK_SNAPSHOT_EXPIRED_OR_NOT_FOUND", 404);
    }

    return snapshot;
  }

  public async deleteScoreCheck(
    userId: string,
    scoreCheckId: string,
    input: DeleteScoreCheckInput = {},
  ): Promise<ScoreCheckRecord> {
    const parsedInput = this.parseDeleteInput(input);
    const existing = await this.getScoreCheck(userId, scoreCheckId);
    const linkedSetup = await TradeSetupModel.findOne({
      userId: toObjectId(userId, "user id"),
      sourceScoreCheckId: toObjectId(scoreCheckId, "score check id"),
      isDeleted: { $ne: true },
    }).lean().exec();

    if (linkedSetup) {
      const activeTrade = await ActiveTradeModel.findOne({
        userId: toObjectId(userId, "user id"),
        tradeSetupId: linkedSetup._id,
      }).lean().exec();
      if (linkedSetup.status === "EXECUTED" || activeTrade) {
        await this.audit("SCORE_CHECK_DELETE_BLOCKED", userId, existing._id, {
          metadata: {
            reason: "Linked to executed trade lifecycle",
            tradeSetupId: String(linkedSetup._id),
            activeTradeId: activeTrade ? String(activeTrade._id) : undefined,
          },
        });
        throw new AppError("ScoreCheck is linked to executed trade lifecycle. Archive related history instead.", 409);
      }

      const now = this.getNow();
      await TradeSetupModel.findOneAndUpdate(
        { _id: linkedSetup._id, userId: toObjectId(userId, "user id") },
        {
          $set: {
            status: "CANCELLED",
            cancelledAt: now,
            isDeleted: true,
            deletedAt: now,
            deletedBy: toObjectId(userId, "user id"),
            deleteReason: parsedInput.reason ?? "Deleted with linked ScoreCheck",
          },
        },
      ).exec();
    }

    const now = this.getNow();
    await TradeScoreSnapshotModel.updateMany(
      {
        userId: toObjectId(userId, "user id"),
        scoreCheckId: toObjectId(scoreCheckId, "score check id"),
        isDeleted: { $ne: true },
      },
      {
        $set: {
          isDeleted: true,
          deletedAt: now,
          deletedBy: toObjectId(userId, "user id"),
          deleteReason: parsedInput.reason ?? "ScoreCheck deleted",
        },
      },
    ).exec();

    const deleted = await this.updateScoreCheckRecord(userId, scoreCheckId, {
      $set: {
        isDeleted: true,
        deletedAt: now,
        deletedBy: toObjectId(userId, "user id"),
        deleteReason: parsedInput.reason ?? "User deleted from dashboard",
      },
    });

    await this.audit("SCORE_CHECK_DELETED", userId, deleted._id, {
      before: this.toAuditScoreSnapshot(existing),
      after: this.toAuditScoreSnapshot(deleted),
      metadata: {
        reason: parsedInput.reason,
        cascadeTradeSetupId: linkedSetup ? String(linkedSetup._id) : undefined,
      },
    });

    return deleted;
  }

  private parseCreateInput(input: CreateScoreCheckInput): CreateScoreCheckInput {
    const parsed = createScoreCheckSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError("Invalid ScoreCheck payload", 400);
    }
    return parsed.data;
  }

  private parseUpdateInput(input: UpdateScoreCheckInput): UpdateScoreCheckInput {
    const parsed = updateScoreCheckSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError("Invalid ScoreCheck update payload", 400);
    }
    return parsed.data;
  }

  private parseDeleteInput(input: DeleteScoreCheckInput): DeleteScoreCheckInput {
    const parsed = deleteScoreCheckSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError("Invalid ScoreCheck delete payload", 400);
    }
    return parsed.data;
  }

  private async assertScoreCheckIsEditable(userId: string, scoreCheck: ScoreCheckRecord): Promise<void> {
    if (!scoreCheck.convertedToTradeSetupId) return;
    const setup = await TradeSetupModel.findOne({
      _id: toObjectId(String(scoreCheck.convertedToTradeSetupId), "trade setup id"),
      userId: toObjectId(userId, "user id"),
      isDeleted: { $ne: true },
    }).lean().exec();
    if (!setup) return;
    const activeTrade = await ActiveTradeModel.findOne({
      userId: toObjectId(userId, "user id"),
      tradeSetupId: setup._id,
    }).lean().exec();
    if (setup.status === "EXECUTED" || activeTrade) {
      throw new AppError("ScoreCheck cannot be updated after execution lifecycle starts", 409);
    }
  }

  private async getActiveSymbol(symbolId: string): Promise<SymbolRecord> {
    const symbolObjectId = toObjectId(symbolId, "symbol id");
    const symbol = await this.getSymbolRepository().findOne({
      _id: symbolObjectId,
    }, symbolProjection).lean().exec() as SymbolRecord | null;

    if (!symbol) {
      throw new AppError("SYMBOL_NOT_FOUND", 404);
    }

    if (!["ACTIVE", "TRADING"].includes(symbol.status)) {
      throw new AppError("SYMBOL_INACTIVE", 409);
    }

    return symbol;
  }

  private assertSymbolMatchesInput(symbol: SymbolRecord, input: CreateScoreCheckInput): void {
    if (symbol.marketType !== input.marketType || symbol.instrumentType !== input.instrumentType) {
      throw new AppError("ScoreCheck symbol scope mismatch", 400);
    }
  }

  private assertResolvedTemplateMatchesSymbol(
    symbol: SymbolRecord,
    input: CreateScoreCheckInput,
    template: ResolvedScoringTemplateDefinition,
  ): void {
    if (template.baseTemplateKey === "COMMODITY_MCX_INTRADAY_V1") {
      if (input.marketType !== "COMMODITY" || symbol.marketType !== "COMMODITY") {
        throw new AppError("Commodity scoring template requires COMMODITY market type", 400);
      }
      if (symbol.exchange !== "MCX") {
        throw new AppError("Commodity scoring template requires MCX exchange", 400);
      }
      if (input.instrumentType !== "FUTURE" || symbol.instrumentType !== "FUTURE") {
        throw new AppError("Commodity scoring template requires FUTURE instrument", 400);
      }
      if (input.tradeStyle !== "INTRADAY") {
        throw new AppError("Commodity scoring template requires INTRADAY trade style", 400);
      }
      if (symbol.expiry && symbol.expiry.getTime() < this.getNow().getTime()) {
        throw new AppError("MCX contract is expired", 409);
      }
    }

    if (
      template.marketType !== input.marketType
      || template.tradeStyle !== input.tradeStyle
      || template.instrumentType !== input.instrumentType
    ) {
      throw new AppError("SCORING_TEMPLATE_SCOPE_MISMATCH", 400);
    }
    if (template.marketType !== symbol.marketType || template.instrumentType !== symbol.instrumentType) {
      throw new AppError("ScoreCheck symbol scope mismatch", 400);
    }
  }

  private assertTemplateAllowsSymbol(
    template: ResolvedScoringTemplateDefinition,
    symbolId: string,
  ): void {
    if (template.scope !== "USER") return;

    const allowedSymbols = template.allowedTradableSymbols ?? [];
    if (allowedSymbols.length === 0) {
      throw new AppError("TEMPLATE_HAS_NO_ALLOWED_SYMBOLS", 409);
    }

    const normalizedSymbolId = String(symbolId);
    const isAllowed = allowedSymbols.some((allowedSymbol) => {
      if (typeof allowedSymbol === "string") {
        return allowedSymbol === normalizedSymbolId;
      }

      if (allowedSymbol && typeof allowedSymbol === "object") {
        const candidate = allowedSymbol as { symbolId?: unknown; enabled?: unknown };
        if (candidate.enabled === false) return false;
        return String(candidate.symbolId) === normalizedSymbolId;
      }

      return false;
    });

    if (!isAllowed) {
      throw new AppError("Selected symbol is not allowed for this scoring template.", 403);
    }
  }

  private async buildTemplateResourceSnapshotSummary(input: {
    userId: string;
    symbol: SymbolRecord;
    resolvedTemplate: ResolvedScoringTemplateDefinition;
    scoringTemplateId?: string;
  }): Promise<ScoringTemplateResourceSnapshotContext | undefined> {
    if (input.resolvedTemplate.scope !== "USER" || !input.scoringTemplateId) {
      return undefined;
    }
    return this.getScoringContextBuilder().buildTemplateResourceSnapshotContext({
      userId: input.userId,
      scoringTemplate: input.resolvedTemplate,
      selectedSymbol: input.symbol,
    });
  }

  private async upsertScoreCheckSnapshot(input: {
    userId: string;
    scoreCheck: ScoreCheckRecord;
    symbol: SymbolRecord;
    resolvedTemplate: ResolvedScoringTemplateDefinition;
    scoringResult: ScoringEngineResult;
    resourceSnapshotSummary?: ScoringTemplateResourceSnapshotContext;
    calculatedAt: Date;
  }): Promise<Record<string, unknown>> {
    const expiresAt = this.calculateScoreCheckSnapshotExpiry(
      input.resolvedTemplate,
      input.calculatedAt,
    );
    const resourceSnapshotSummary = input.resourceSnapshotSummary ?? {
      resolvedResources: [],
      resourceSnapshots: [],
      resourceReadinessSummary: {
        total: 0,
        ready: 0,
        stale: 0,
        missing: 0,
        partial: 0,
        blockingMissing: 0,
      },
      warnings: [],
      blockers: [],
    };

    const updatePayload = {
      userId: toObjectId(input.userId, "user id"),
      scoreCheckId: toObjectId(String(input.scoreCheck._id), "score check id"),
      ...(input.resolvedTemplate.id
        ? { scoringTemplateId: toObjectId(input.resolvedTemplate.id, "scoring template id") }
        : {}),
      scoringTemplateKey: input.resolvedTemplate.templateKey,
      scoringTemplateName: input.resolvedTemplate.templateName,
      scoringTemplateVersion: String(input.resolvedTemplate.version),
      scoringTemplateScope: input.resolvedTemplate.scope,
      selectedSymbol: {
        symbolId: toObjectId(String(input.symbol._id), "symbol id"),
        symbol: input.symbol.symbol,
        exchange: input.symbol.exchange,
        provider: input.symbol.provider,
        marketType: input.symbol.marketType,
        instrumentType: input.symbol.instrumentType,
      },
      resolvedResources: resourceSnapshotSummary.resolvedResources,
      resourceSnapshots: resourceSnapshotSummary.resourceSnapshots,
      resourceReadinessSummary: resourceSnapshotSummary.resourceReadinessSummary,
      sectionBreakdown: input.scoringResult.breakdown.sectionResults.map((section) => ({
        sectionKey: section.sectionKey,
        label: section.label,
        score: section.score,
        maxScore: section.maxScore,
        weight: section.weight,
        status: section.status,
        reasonCodes: section.reasonCodes,
        warnings: section.warnings,
      })),
      finalScore: input.scoringResult.score,
      permission: input.scoringResult.permission,
      scoreStatus: input.scoringResult.scoreStatus,
      dataConfidence: input.scoringResult.dataConfidence,
      warnings: [...input.scoringResult.warnings, ...resourceSnapshotSummary.warnings],
      blockers: resourceSnapshotSummary.blockers,
      expiresAt,
    };

    const snapshot = await this.getScoreCheckSnapshotRepository().findOneAndUpdate(
      {
        scoreCheckId: toObjectId(String(input.scoreCheck._id), "score check id"),
        userId: toObjectId(input.userId, "user id"),
      },
      { $set: updatePayload },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean().exec() as Record<string, unknown> | null;

    if (!snapshot) {
      throw new AppError("SCORE_CHECK_SNAPSHOT_CREATE_FAILED", 500);
    }

    return snapshot;
  }

  private calculateScoreCheckSnapshotExpiry(
    template: ResolvedScoringTemplateDefinition,
    calculatedAt: Date,
  ): Date {
    const policy = template.snapshotPolicy as (ResolvedScoringTemplateDefinition["snapshotPolicy"] & {
      ttlHours?: unknown;
    }) | undefined;
    const ttlHours = Number(policy?.ttlHours);
    const maxSnapshotAgeSeconds = Number(policy?.maxSnapshotAgeSeconds);
    const requestedMs = Number.isFinite(ttlHours) && ttlHours > 0
      ? ttlHours * 60 * 60 * 1000
      : Number.isFinite(maxSnapshotAgeSeconds) && maxSnapshotAgeSeconds >= 3600
        ? maxSnapshotAgeSeconds * 1000
        : template.tradeStyle === "SWING"
          ? 7 * 24 * 60 * 60 * 1000
          : 24 * 60 * 60 * 1000;
    const boundedMs = Math.min(
      Math.max(requestedMs, 60 * 60 * 1000),
      7 * 24 * 60 * 60 * 1000,
    );
    return new Date(calculatedAt.getTime() + boundedMs);
  }

  private buildSymbolSnapshot(symbol: SymbolRecord): Record<string, unknown> {
    return {
      symbolId: symbol._id,
      symbol: symbol.symbol,
      displayName: symbol.displayName ?? symbol.symbol,
      provider: MARKET_PROVIDERS.includes(symbol.provider) ? symbol.provider : "BINANCE",
      marketType: MARKET_TYPES.includes(symbol.marketType) ? symbol.marketType : "CRYPTO",
      exchange: EXCHANGES.includes(symbol.exchange) ? symbol.exchange : "BINANCE",
      instrumentType: INSTRUMENT_TYPES.includes(symbol.instrumentType) ? symbol.instrumentType : "UNKNOWN",
      ...(symbol.providerSymbol ? { providerSymbol: symbol.providerSymbol } : {}),
      ...(symbol.lotSize !== undefined ? { lotSize: symbol.lotSize } : {}),
      ...(symbol.tickSize !== undefined ? { tickSize: symbol.tickSize } : {}),
      ...(symbol.expiry ? { expiry: symbol.expiry } : {}),
      ...(typeof symbol.requiresBrokerLogin === "boolean" ? { requiresBrokerLogin: symbol.requiresBrokerLogin } : {}),
    };
  }

  private async updateScoreCheckRecord(
    userId: string,
    scoreCheckId: string,
    update: Record<string, unknown>,
  ): Promise<ScoreCheckRecord> {
    const updated = await this.getScoreCheckRepository().findOneAndUpdate(
      {
        _id: toObjectId(scoreCheckId, "score check id"),
        userId: toObjectId(userId, "user id"),
        isDeleted: { $ne: true },
      },
      update,
      { new: true },
    ).lean().exec() as ScoreCheckRecord | null;

    if (!updated) {
      throw new AppError("SCORE_CHECK_NOT_FOUND", 404);
    }

    return updated;
  }

  private toAuditScoreSnapshot(scoreCheck: ScoreCheckRecord): Record<string, unknown> {
    return {
      id: String(scoreCheck._id),
      symbolId: String(scoreCheck.symbolId),
      scoreMode: scoreCheck.scoreMode,
      marketType: scoreCheck.marketType,
      tradeStyle: scoreCheck.tradeStyle,
      instrumentType: scoreCheck.instrumentType,
      direction: scoreCheck.direction,
      entry: scoreCheck.entry,
      stopLoss: scoreCheck.stopLoss,
      target1: scoreCheck.target1,
      rewardRiskRatio: scoreCheck.rewardRiskRatio,
      score: scoreCheck.score,
      permission: scoreCheck.permission,
      scoreStatus: scoreCheck.scoreStatus,
    };
  }

  private async audit(
    action: string,
    userId: string,
    entityId: Types.ObjectId | string,
    payload: {
      before?: Record<string, unknown>;
      after?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    } = {},
  ): Promise<void> {
    await this.getAuditLogService().record({
      userId,
      actorType: "USER",
      actorId: userId,
      action,
      entityType: "SCORE_CHECK",
      entityId: String(entityId),
      ...payload,
    });
  }

  private getNow(): Date {
    return this.dependencies.now?.() ?? new Date();
  }

  private getScoreCheckRepository(): ScoreCheckRepository {
    return this.dependencies.scoreCheckRepository ?? ScoreCheckModel;
  }

  private getScoreCheckSnapshotRepository(): ScoreCheckSnapshotRepository {
    return this.dependencies.scoreCheckSnapshotRepository ?? ScoreCheckSnapshotModel;
  }

  private getSymbolRepository(): SymbolRepository {
    return this.dependencies.symbolRepository ?? SymbolModel;
  }

  private getScoringEngine(): Pick<ScoringEngineService, "score"> {
    return this.dependencies.scoringEngine ?? new ScoringEngineService();
  }

  private getScoringTemplateService(): Pick<ScoringTemplateCrudService, "resolveForScoreCheck" | "markUsed"> {
    return this.dependencies.scoringTemplateService ?? new ScoringTemplateCrudService();
  }

  private getAuditLogService(): Pick<AuditLogService, "record"> {
    return this.dependencies.auditLogService ?? auditLogService;
  }
  private getScoringContextBuilder(): Pick<ScoringContextBuilderService, "build" | "buildTemplateResourceSnapshotContext"> {
    return this.dependencies.scoringContextBuilder ?? new ScoringContextBuilderService({
      symbolRepository: this.getSymbolRepository() as never,
    });
  }
  private compactUserLevels(
    levels: CreateScoreCheckInput["userLevels"],
  ): ScoringUserLevels | undefined {
    if (!levels) return undefined;
    const compact: ScoringUserLevels = {
      ...(levels.breakoutLevel !== undefined ? { breakoutLevel: levels.breakoutLevel } : {}),
      ...(levels.supportLevel !== undefined ? { supportLevel: levels.supportLevel } : {}),
      ...(levels.resistanceLevel !== undefined ? { resistanceLevel: levels.resistanceLevel } : {}),
      ...(levels.pullbackZone !== undefined ? { pullbackZone: levels.pullbackZone } : {}),
      ...(levels.rangeHigh !== undefined ? { rangeHigh: levels.rangeHigh } : {}),
      ...(levels.rangeLow !== undefined ? { rangeLow: levels.rangeLow } : {}),
    };
    return Object.keys(compact).length > 0 ? compact : undefined;
  }
  private compactContextSymbolIds(
    ids: CreateScoreCheckInput["contextSymbolIds"],
  ): ScoringContextSymbolIds | undefined {
    if (!ids) return undefined;
    const compact: ScoringContextSymbolIds = {
      ...(ids.indexSymbolId ? { indexSymbolId: ids.indexSymbolId } : {}),
      ...(ids.sectorSymbolId ? { sectorSymbolId: ids.sectorSymbolId } : {}),
      ...(ids.vixSymbolId ? { vixSymbolId: ids.vixSymbolId } : {}),
    };
    return Object.keys(compact).length > 0 ? compact : undefined;
  }
}
