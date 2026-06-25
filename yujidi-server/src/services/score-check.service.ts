import { createHash } from "node:crypto";
import { Types, isValidObjectId } from "mongoose";
import { z } from "zod";

import { AppError } from "../errors/AppError.js";
import { ScoreCheckModel } from "../models/score-check.model.js";
import { SymbolModel } from "../models/Symbol.js";
import { TradeScoreSnapshotModel } from "../models/trade-score-snapshot.model.js";
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
  SCORING_TEMPLATE_KEYS,
  type DataConfidence,
  type ScoringTemplateKey,
} from "../types/scoring.types.js";
import { TRADE_DIRECTIONS, type TradeDirection } from "../types/trade.types.js";
import { auditLogService, type AuditLogService } from "./audit-log.service.js";
import { ScoringEngineService, type ScoringEngineResult } from "./scoring-engine.service.js";
import {
  buildMarketResourceKey,
  sharedMarketSnapshotService,
  type MarketSnapshotService,
} from "./market-snapshot.service.js";
import {
  sharedTemplateMonitoringOrchestrator,
  type TemplateMonitoringOrchestratorService,
} from "./template-monitoring-orchestrator.service.js";

const positiveNumber = z.number().positive();

export const createScoreCheckSchema = z.object({
  symbolId: z.string().min(1),
  marketType: z.enum(MARKET_TYPES),
  tradeStyle: z.string().min(1).max(64).transform((value) => value.trim().toUpperCase()),
  instrumentType: z.enum(INSTRUMENT_TYPES),
  direction: z.enum(TRADE_DIRECTIONS),
  entry: positiveNumber,
  stopLoss: positiveNumber,
  target1: positiveNumber,
  target2: positiveNumber.optional(),
  scoringTemplateKey: z.enum(SCORING_TEMPLATE_KEYS),
  scoringTemplateVersion: z.string().min(1).max(64),
  dataConfidence: z.enum(DATA_CONFIDENCE_LEVELS).optional(),
}).superRefine((value, context) => {
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

type TradeScoreSnapshotRepository = {
  create: (input: Record<string, unknown>) => Promise<unknown>;
};

type SymbolRepository = {
  findOne: (filter: Record<string, unknown>, projection?: Record<string, 0 | 1>) => LeanQueryExec<unknown | null>;
};

type ScoreCheckServiceDependencies = {
  scoreCheckRepository: ScoreCheckRepository;
  tradeScoreSnapshotRepository: TradeScoreSnapshotRepository;
  symbolRepository: SymbolRepository;
  scoringEngine: Pick<ScoringEngineService, "score">;
  auditLogService: Pick<AuditLogService, "record">;
  now: () => Date;
  marketSnapshotService: Pick<MarketSnapshotService, "getSnapshot">;
  templateOrchestrator: Pick<TemplateMonitoringOrchestratorService, "ensure">;
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
  riskPerUnit: number;
  rewardPerUnit: number;
  rewardRiskRatio: number;
  scoringTemplateKey: ScoringTemplateKey;
  scoringTemplateVersion: string;
  scoreStatus: string;
  score: number;
  permission: string;
  dataConfidence: DataConfidence;
  reasonCodes: string[];
  warnings: string[];
  breakdown?: Record<string, unknown>;
  tradeScoreSnapshotId?: Types.ObjectId | string;
  scoreCalculatedAt?: Date;
  scoreValidUntil?: Date;
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
    this.assertTemplateMatchesSymbol(symbol, parsedInput);

    const symbolSnapshot = this.buildSymbolSnapshot(symbol);
    const resourceKey = buildMarketResourceKey({
      provider: symbol.provider,
      exchange: symbol.exchange,
      ...(symbol.instrumentToken ? { instrumentToken: symbol.instrumentToken } : {}),
      ...(symbol.providerSymbol ? { providerSymbol: symbol.providerSymbol } : {}),
      symbol: symbol.symbol,
      ...(symbol.provider === "ANGEL_ONE" ? { userId } : {}),
    });
    const marketSnapshot = this.getMarketSnapshotService().getSnapshot(resourceKey);
    this.getTemplateOrchestrator().ensure(resourceKey, marketSnapshot);
    const geometry = calculateTradeGeometry(parsedInput);
    const calculatedAt = this.getNow();
    const scoringResult = this.getScoringEngine().score({
      scoringTemplateKey: parsedInput.scoringTemplateKey,
      scoringTemplateVersion: parsedInput.scoringTemplateVersion,
      marketType: parsedInput.marketType,
      tradeStyle: parsedInput.tradeStyle,
      instrumentType: parsedInput.instrumentType,
      rewardRiskRatio: geometry.rewardRiskRatio,
      ...(parsedInput.dataConfidence ? { dataConfidence: parsedInput.dataConfidence } : {}),
      symbol: {
        status: symbol.status,
        marketType: symbol.marketType,
        exchange: symbol.exchange,
        instrumentType: symbol.instrumentType,
        ...(symbol.lotSize !== undefined ? { lotSize: symbol.lotSize } : {}),
        ...(symbol.tickSize !== undefined ? { tickSize: symbol.tickSize } : {}),
        ...(symbol.expiry ? { expiry: symbol.expiry } : {}),
        ...(typeof symbol.requiresBrokerLogin === "boolean"
          ? { requiresBrokerLogin: symbol.requiresBrokerLogin }
          : {}),
      },
      evaluatedAt: calculatedAt,
      direction: parsedInput.direction,
      marketSnapshot,
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
      ...geometry,
      scoringTemplateKey: parsedInput.scoringTemplateKey,
      scoringTemplateVersion: parsedInput.scoringTemplateVersion,
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

    const snapshot = normalizeRecord<Record<string, unknown>>(await this.getTradeScoreSnapshotRepository().create({
      userId: userObjectId,
      scoreCheckId: toObjectId(String(scoreCheck._id), "score check id"),
      symbolId: toObjectId(parsedInput.symbolId, "symbol id"),
      scoringTemplateKey: parsedInput.scoringTemplateKey,
      scoringTemplateVersion: parsedInput.scoringTemplateVersion,
      score: scoringResult.score,
      permission: scoringResult.permission,
      scoreStatus: scoringResult.scoreStatus,
      dataConfidence: scoringResult.dataConfidence,
      breakdown: this.buildBreakdown(scoringResult, geometry),
      reasonCodes: [...reasonCodes, "SCORE_CALCULATED"],
      warnings: scoringResult.warnings,
      snapshotRefs: {},
      inputHash: this.hashScoreInput(parsedInput, geometry),
      calculatedAt,
      validUntil,
    }));

    const updatedScoreCheck = await this.updateScoreCheck(userId, String(scoreCheck._id), {
      $set: {
        tradeScoreSnapshotId: snapshot._id,
        reasonCodes: [...reasonCodes, "SCORE_CALCULATED"],
      },
    });

    await this.audit("SCORE_CALCULATED", userId, updatedScoreCheck._id, {
      metadata: {
        score: updatedScoreCheck.score,
        permission: updatedScoreCheck.permission,
        tradeScoreSnapshotId: String(snapshot._id),
        rewardRiskRatio: updatedScoreCheck.rewardRiskRatio,
      },
    });

    return updatedScoreCheck;
  }

  public async listScoreChecks(userId: string): Promise<ScoreCheckRecord[]> {
    const userObjectId = toObjectId(userId, "user id");
    return this.getScoreCheckRepository()
      .find({ userId: userObjectId })
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
    }).lean().exec() as ScoreCheckRecord | null;

    if (!scoreCheck) {
      throw new AppError("SCORE_CHECK_NOT_FOUND", 404);
    }

    return scoreCheck;
  }

  private parseCreateInput(input: CreateScoreCheckInput): CreateScoreCheckInput {
    const parsed = createScoreCheckSchema.safeParse(input);
    if (!parsed.success) {
      throw new AppError("Invalid ScoreCheck payload", 400);
    }
    return parsed.data;
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

  private assertTemplateMatchesSymbol(symbol: SymbolRecord, input: CreateScoreCheckInput): void {
    if (input.scoringTemplateKey !== "COMMODITY_MCX_INTRADAY_V1") return;
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

  private buildBreakdown(
    scoringResult: ScoringEngineResult,
    geometry: ReturnType<typeof calculateTradeGeometry>,
  ): Record<string, unknown> {
    return {
      engine: "TEMPLATE_DRIVEN_SCORING_V1",
      score: scoringResult.score,
      permission: scoringResult.permission,
      riskPerUnit: geometry.riskPerUnit,
      rewardPerUnit: geometry.rewardPerUnit,
      rewardRiskRatio: geometry.rewardRiskRatio,
      ...scoringResult.breakdown,
    };
  }

  private hashScoreInput(
    input: CreateScoreCheckInput,
    geometry: ReturnType<typeof calculateTradeGeometry>,
  ): string {
    return createHash("sha256")
      .update(JSON.stringify({
        symbolId: input.symbolId,
        direction: input.direction,
        entry: input.entry,
        stopLoss: input.stopLoss,
        target1: input.target1,
        target2: input.target2,
        scoringTemplateKey: input.scoringTemplateKey,
        scoringTemplateVersion: input.scoringTemplateVersion,
        geometry,
      }))
      .digest("hex");
  }

  private async updateScoreCheck(
    userId: string,
    scoreCheckId: string,
    update: Record<string, unknown>,
  ): Promise<ScoreCheckRecord> {
    const updated = await this.getScoreCheckRepository().findOneAndUpdate(
      {
        _id: toObjectId(scoreCheckId, "score check id"),
        userId: toObjectId(userId, "user id"),
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

  private getTradeScoreSnapshotRepository(): TradeScoreSnapshotRepository {
    return this.dependencies.tradeScoreSnapshotRepository ?? TradeScoreSnapshotModel;
  }

  private getSymbolRepository(): SymbolRepository {
    return this.dependencies.symbolRepository ?? SymbolModel;
  }

  private getScoringEngine(): Pick<ScoringEngineService, "score"> {
    return this.dependencies.scoringEngine ?? new ScoringEngineService();
  }

  private getAuditLogService(): Pick<AuditLogService, "record"> {
    return this.dependencies.auditLogService ?? auditLogService;
  }
  private getMarketSnapshotService(): Pick<MarketSnapshotService, "getSnapshot"> {
    return this.dependencies.marketSnapshotService ?? sharedMarketSnapshotService;
  }
  private getTemplateOrchestrator(): Pick<TemplateMonitoringOrchestratorService, "ensure"> {
    return this.dependencies.templateOrchestrator ?? sharedTemplateMonitoringOrchestrator;
  }
}
