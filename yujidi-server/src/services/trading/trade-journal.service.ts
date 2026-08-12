import { Types, isValidObjectId } from "mongoose";
import { z } from "zod";

import { AppError } from "../../errors/AppError.js";
import { ActiveTradeModel } from "../../models/active-trade.model.js";
import { TradeEventModel } from "../../models/trade-event.model.js";
import { TradeJournalModel } from "../../models/trade-journal.model.js";
import { TradeResultModel } from "../../models/trade-result.model.js";
import { TradeSetupModel } from "../../models/trade-setup.model.js";
import {
  EMOTIONAL_STATES,
  ENTRY_QUALITIES,
  EXIT_QUALITIES,
  MISTAKE_TAGS,
  OUTCOME_QUALITIES,
  SETUP_TYPES,
  type JournalStatus,
} from "../../types/trade.types.js";
import { auditLogService, type AuditLogService } from "../access/audit-log.service.js";

export const updateTradeJournalSchema = z.object({
  setupType: z.enum(SETUP_TYPES).optional(),
  entryQuality: z.enum(ENTRY_QUALITIES).optional(),
  exitQuality: z.enum(EXIT_QUALITIES).optional(),
  outcomeQuality: z.enum(OUTCOME_QUALITIES).optional(),
  emotionalStateBefore: z.enum(EMOTIONAL_STATES).optional(),
  emotionalStateDuring: z.enum(EMOTIONAL_STATES).optional(),
  emotionalStateAfter: z.enum(EMOTIONAL_STATES).optional(),
  mistakeTags: z.array(z.enum(MISTAKE_TAGS)).max(20).optional(),
  userNotes: z.string().max(5000).optional(),
  lessonLearned: z.string().max(3000).optional(),
  screenshotUrls: z.array(z.string().url()).max(20).optional(),
  selfRating: z.number().int().min(1).max(10).optional(),
  followedPlan: z.boolean().optional(),
  whatWentWell: z.string().max(3000).optional(),
  whatWentWrong: z.string().max(3000).optional(),
  nextTimeFocus: z.string().max(3000).optional(),
}).strict();

export type UpdateTradeJournalInput = z.infer<typeof updateTradeJournalSchema>;

type QueryExec<T> = { exec: () => Promise<T> };
type LeanQueryExec<T> = { lean: () => QueryExec<T> };
type SortableLeanQueryExec<T> = { sort: (sort: Record<string, 1 | -1>) => LeanQueryExec<T> };

type ReadRepository = {
  findOne: (filter: Record<string, unknown>) => LeanQueryExec<unknown | null>;
};
type EventRepository = {
  find: (filter: Record<string, unknown>, projection?: Record<string, 0 | 1>) => LeanQueryExec<unknown[]>;
};
type JournalRepository = {
  create: (input: Record<string, unknown>) => Promise<unknown>;
  find: (filter: Record<string, unknown>) => SortableLeanQueryExec<unknown[]>;
  findOne: (filter: Record<string, unknown>) => LeanQueryExec<unknown | null>;
  findOneAndUpdate: (
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options: Record<string, unknown>,
  ) => LeanQueryExec<unknown | null>;
};

type Dependencies = {
  tradeResultRepository: ReadRepository;
  activeTradeRepository: ReadRepository;
  tradeSetupRepository: ReadRepository;
  tradeEventRepository: EventRepository;
  journalRepository: JournalRepository;
  auditLogService: Pick<AuditLogService, "record">;
  now: () => Date;
};

type LifecycleRecord = Record<string, any>;
export type TradeJournalRecord = Record<string, any> & {
  _id: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  tradeResultId: Types.ObjectId | string;
  activeTradeId: Types.ObjectId | string;
  status: JournalStatus;
};

const toObjectId = (value: string, label: string): Types.ObjectId => {
  if (!isValidObjectId(value)) throw new AppError(`Invalid ${label}`, 400);
  return new Types.ObjectId(value);
};

const normalizeRecord = <T>(value: unknown): T => {
  if (value && typeof value === "object" && "toObject" in value && typeof value.toObject === "function") {
    return value.toObject() as T;
  }
  return value as T;
};

export class TradeJournalService {
  public constructor(private readonly dependencies: Partial<Dependencies> = {}) {}

  public async createFromTradeResult(userId: string, tradeResultId: string): Promise<TradeJournalRecord> {
    const result = await this.findOwned(this.getTradeResultRepository(), userId, tradeResultId, "TRADE_RESULT");
    if (result.status !== "FINALIZED") throw new AppError("TradeJournal requires FINALIZED TradeResult", 409);

    const existing = await this.getJournalRepository().findOne({
      tradeResultId: toObjectId(tradeResultId, "trade result id"),
      userId: toObjectId(userId, "user id"),
    }).lean().exec() as TradeJournalRecord | null;
    if (existing) return existing;

    const activeTrade = await this.findOwned(
      this.getActiveTradeRepository(),
      userId,
      String(result.activeTradeId),
      "ACTIVE_TRADE",
    );
    const tradeSetup = await this.findOwned(
      this.getTradeSetupRepository(),
      userId,
      String(result.tradeSetupId),
      "TRADE_SETUP",
    );
    const events = await this.getTradeEventRepository().find({
      userId: toObjectId(userId, "user id"),
      activeTradeId: toObjectId(String(result.activeTradeId), "active trade id"),
    }, { _id: 1 }).lean().exec() as Array<{ _id: Types.ObjectId | string }>;

    let journal: TradeJournalRecord;
    try {
      journal = normalizeRecord<TradeJournalRecord>(await this.getJournalRepository().create({
        userId: toObjectId(userId, "user id"),
        tradePlanId: result.tradePlanId,
        tradeSetupId: result.tradeSetupId,
        activeTradeId: result.activeTradeId,
        tradeResultId: result._id,
        ...(activeTrade.sourceScoreCheckId ? { scoreCheckId: activeTrade.sourceScoreCheckId } : {}),
        ...(tradeSetup.tradeScoreSnapshotId ? { tradeScoreSnapshotId: tradeSetup.tradeScoreSnapshotId } : {}),
        symbolId: result.symbolId,
        symbolSnapshot: result.symbolSnapshot,
        mode: "MANAGED_TRADE",
        status: "DRAFT",
        direction: result.direction,
        marketType: result.marketType,
        tradeStyle: result.tradeStyle,
        instrumentType: result.instrumentType,
        plannedEntry: tradeSetup.plannedEntry,
        plannedStopLoss: tradeSetup.plannedStopLoss,
        plannedTarget1: tradeSetup.plannedTarget1,
        ...(tradeSetup.plannedTarget2 !== undefined ? { plannedTarget2: tradeSetup.plannedTarget2 } : {}),
        plannedRewardRiskRatio: tradeSetup.plannedRewardRiskRatio,
        actualEntry: activeTrade.actualEntry,
        actualQuantity: result.quantity,
        initialStopLoss: activeTrade.initialStopLoss,
        ...(activeTrade.currentStopLoss !== undefined ? { finalStopLoss: activeTrade.currentStopLoss } : {}),
        exitPrice: result.exitPrice,
        exitReason: result.exitReason,
        grossPnl: result.grossPnl,
        ...(result.netPnl !== undefined ? { netPnl: result.netPnl } : {}),
        realizedPnlUsedForRisk: result.realizedPnlUsedForRisk,
        pnlBasis: result.pnlBasis,
        realizedR: result.realizedR,
        resultType: result.resultType,
        ruleViolations: activeTrade.ruleViolations ?? [],
        tradeEventIds: events.map((event) => event._id),
        openedAt: activeTrade.openedAt,
        closedAt: result.closedAt,
      }));
    } catch (error: unknown) {
      if (this.isDuplicateKeyError(error)) {
        const duplicate = await this.getJournalByTradeResult(userId, tradeResultId);
        return duplicate;
      }
      throw error;
    }

    await this.audit("TRADE_JOURNAL_CREATED", userId, journal._id, {
      tradeResultId,
      activeTradeId: String(result.activeTradeId),
      tradeEventCount: events.length,
    });
    return journal;
  }

  public async updateJournal(
    userId: string,
    journalId: string,
    input: UpdateTradeJournalInput,
  ): Promise<TradeJournalRecord> {
    const parsed = updateTradeJournalSchema.safeParse(input);
    if (!parsed.success) throw new AppError("Invalid TradeJournal update payload", 400);
    const current = await this.getJournal(userId, journalId);
    if (current.status === "FINALIZED" || current.status === "ARCHIVED") {
      throw new AppError(`${current.status} TradeJournal cannot be updated`, 409);
    }

    const updated = await this.getJournalRepository().findOneAndUpdate(
      { _id: toObjectId(journalId, "trade journal id"), userId: toObjectId(userId, "user id") },
      { $set: parsed.data },
      { new: true },
    ).lean().exec() as TradeJournalRecord | null;
    if (!updated) throw new AppError("TRADE_JOURNAL_NOT_FOUND", 404);
    await this.audit("TRADE_JOURNAL_UPDATED", userId, updated._id, {
      updatedFields: Object.keys(parsed.data),
    });
    return updated;
  }

  public async finalizeJournal(userId: string, journalId: string): Promise<TradeJournalRecord> {
    const journal = await this.getJournal(userId, journalId);
    if (journal.status === "FINALIZED") throw new AppError("TradeJournal already finalized", 409);
    if (journal.status === "ARCHIVED") throw new AppError("Archived TradeJournal cannot be finalized", 409);
    this.assertComplete(journal);

    const finalizedAt = this.getNow();
    const finalized = await this.getJournalRepository().findOneAndUpdate(
      { _id: toObjectId(journalId, "trade journal id"), userId: toObjectId(userId, "user id") },
      { $set: { status: "FINALIZED", finalizedAt } },
      { new: true },
    ).lean().exec() as TradeJournalRecord | null;
    if (!finalized) throw new AppError("TRADE_JOURNAL_NOT_FOUND", 404);
    await this.audit("TRADE_JOURNAL_FINALIZED", userId, finalized._id);
    return finalized;
  }

  public async archiveJournal(userId: string, journalId: string): Promise<TradeJournalRecord> {
    await this.getJournal(userId, journalId);
    const archived = await this.getJournalRepository().findOneAndUpdate(
      { _id: toObjectId(journalId, "trade journal id"), userId: toObjectId(userId, "user id") },
      { $set: { status: "ARCHIVED", archivedAt: this.getNow() } },
      { new: true },
    ).lean().exec() as TradeJournalRecord | null;
    if (!archived) throw new AppError("TRADE_JOURNAL_NOT_FOUND", 404);
    await this.audit("TRADE_JOURNAL_ARCHIVED", userId, archived._id);
    return archived;
  }

  public async listJournals(userId: string): Promise<TradeJournalRecord[]> {
    return this.getJournalRepository().find({ userId: toObjectId(userId, "user id") })
      .sort({ createdAt: -1 }).lean().exec() as Promise<TradeJournalRecord[]>;
  }

  public async listJournalsForPlan(userId: string, tradePlanId: string): Promise<TradeJournalRecord[]> {
    return this.getJournalRepository().find({
      userId: toObjectId(userId, "user id"),
      tradePlanId: toObjectId(tradePlanId, "trade plan id"),
    }).sort({ createdAt: -1 }).lean().exec() as Promise<TradeJournalRecord[]>;
  }

  public async getJournal(userId: string, journalId: string): Promise<TradeJournalRecord> {
    const journal = await this.getJournalRepository().findOne({
      _id: toObjectId(journalId, "trade journal id"),
      userId: toObjectId(userId, "user id"),
    }).lean().exec() as TradeJournalRecord | null;
    if (!journal) throw new AppError("TRADE_JOURNAL_NOT_FOUND", 404);
    return journal;
  }

  public async getJournalByTradeResult(userId: string, tradeResultId: string): Promise<TradeJournalRecord> {
    const journal = await this.getJournalRepository().findOne({
      tradeResultId: toObjectId(tradeResultId, "trade result id"),
      userId: toObjectId(userId, "user id"),
    }).lean().exec() as TradeJournalRecord | null;
    if (!journal) throw new AppError("TRADE_JOURNAL_NOT_FOUND", 404);
    return journal;
  }

  public async getJournalByActiveTrade(userId: string, activeTradeId: string): Promise<TradeJournalRecord> {
    const journal = await this.getJournalRepository().findOne({
      activeTradeId: toObjectId(activeTradeId, "active trade id"),
      userId: toObjectId(userId, "user id"),
    }).lean().exec() as TradeJournalRecord | null;
    if (!journal) throw new AppError("TRADE_JOURNAL_NOT_FOUND", 404);
    return journal;
  }

  private assertComplete(journal: TradeJournalRecord): void {
    if (!journal.entryQuality) throw new AppError("entryQuality is required", 409);
    if (!journal.exitQuality) throw new AppError("exitQuality is required", 409);
    if (!journal.outcomeQuality) throw new AppError("outcomeQuality is required", 409);
    if (typeof journal.followedPlan !== "boolean") throw new AppError("followedPlan is required", 409);
    if (!Array.isArray(journal.mistakeTags) || journal.mistakeTags.length === 0) {
      throw new AppError("mistakeTags is required", 409);
    }
  }

  private async findOwned(
    repository: ReadRepository,
    userId: string,
    id: string,
    label: string,
  ): Promise<LifecycleRecord> {
    const record = await repository.findOne({
      _id: toObjectId(id, `${label.toLowerCase()} id`),
      userId: toObjectId(userId, "user id"),
    }).lean().exec() as LifecycleRecord | null;
    if (!record) throw new AppError(`${label}_NOT_FOUND`, 404);
    return record;
  }

  private async audit(
    action: string,
    userId: string,
    entityId: Types.ObjectId | string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.getAuditLogService().record({
      userId,
      actorType: "USER",
      actorId: userId,
      action,
      entityType: "TRADE_JOURNAL",
      entityId: String(entityId),
      ...(metadata ? { metadata } : {}),
    });
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return Boolean(error && typeof error === "object" && "code" in error && error.code === 11000);
  }
  private getTradeResultRepository(): ReadRepository {
    return this.dependencies.tradeResultRepository ?? TradeResultModel;
  }
  private getActiveTradeRepository(): ReadRepository {
    return this.dependencies.activeTradeRepository ?? ActiveTradeModel;
  }
  private getTradeSetupRepository(): ReadRepository {
    return this.dependencies.tradeSetupRepository ?? TradeSetupModel;
  }
  private getTradeEventRepository(): EventRepository {
    return this.dependencies.tradeEventRepository ?? TradeEventModel;
  }
  private getJournalRepository(): JournalRepository {
    return this.dependencies.journalRepository ?? TradeJournalModel;
  }
  private getAuditLogService(): Pick<AuditLogService, "record"> {
    return this.dependencies.auditLogService ?? auditLogService;
  }
  private getNow(): Date {
    return this.dependencies.now?.() ?? new Date();
  }
}
