import { randomUUID } from "node:crypto";
import { Types, isValidObjectId } from "mongoose";
import { z } from "zod";

import { AppError } from "../errors/AppError.js";
import { AiExplanationModel } from "../models/ai-explanation.model.js";
import { TradeJournalModel } from "../models/trade-journal.model.js";
import {
  AI_CONFIDENCE_LEVELS,
  AI_PROCESS_QUALITIES,
  type AiProcessQuality,
} from "../types/ai.types.js";
import { auditLogService, type AuditLogService } from "./audit-log.service.js";
import {
  AiTradeReviewContextService,
  type TradeJournalAiContext,
} from "./ai-trade-review-context.service.js";
import { sharedLlmService } from "./llm.service.js";

export const POST_TRADE_REVIEW_PROMPT_VERSION = "post-trade-review-v1";
export const POST_TRADE_REVIEW_SCHEMA_VERSION = "1.0";

const boundedText = z.string().trim().min(1).max(3000);
const boundedTextArray = z.array(z.string().trim().min(1).max(1000)).max(20);

export const postTradeReviewOutputSchema = z.object({
  summary: boundedText,
  processQuality: z.enum(AI_PROCESS_QUALITIES),
  strengths: boundedTextArray,
  keyMistakes: boundedTextArray,
  riskNotes: boundedTextArray,
  improvementSuggestions: boundedTextArray,
  nextTradeFocus: boundedText,
  confidence: z.enum(AI_CONFIDENCE_LEVELS),
}).strict();

export type PostTradeReviewOutput = z.infer<typeof postTradeReviewOutputSchema>;

const forbiddenRules = [
  { code: "FORBIDDEN_TRADE_RECOMMENDATION", pattern: /\b(?:strong[\s_-]*buy|strong[\s_-]*sell|buy|sell)\b/i },
  {
    code: "FORBIDDEN_ORDER_INSTRUCTION",
    pattern: /\b(?:place|submit|execute|open|enter|send|modify|cancel)\b.{0,40}\border\b/i,
  },
  {
    code: "FORBIDDEN_RISK_MUTATION_CLAIM",
    pattern: /\b(?:i|ai|system|review)\b.{0,40}\b(?:changed|updated|modified|overrode|reset)\b.{0,40}\brisk\b/i,
  },
  {
    code: "FORBIDDEN_PNL_CALCULATION_CLAIM",
    pattern: /\b(?:i|ai|system|review)\b.{0,40}\b(?:calculated|recalculated|computed|revised)\b.{0,40}\b(?:p&l|pnl|profit|loss)\b/i,
  },
] as const;

const collectStrings = (value: unknown): string[] => {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value && typeof value === "object") return Object.values(value).flatMap(collectStrings);
  return [];
};

const semanticValidationErrors = (value: unknown): string[] => {
  const outputText = collectStrings(value).join("\n");
  return forbiddenRules
    .filter((rule) => rule.pattern.test(outputText))
    .map((rule) => rule.code);
};

export const validatePostTradeReviewOutput = (
  value: unknown,
): { success: true; data: PostTradeReviewOutput } | { success: false; errors: string[] } => {
  const parsed = postTradeReviewOutputSchema.safeParse(value);
  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.issues.map((issue) => `${issue.path.join(".") || "output"}: ${issue.message}`),
    };
  }

  const semanticErrors = semanticValidationErrors(parsed.data);
  return semanticErrors.length
    ? { success: false, errors: semanticErrors }
    : { success: true, data: parsed.data };
};

type QueryExec<T> = { exec: () => Promise<T> };
type LeanQueryExec<T> = { lean: () => QueryExec<T> };
type FindOneQuery<T> = LeanQueryExec<T> & {
  sort: (sort: Record<string, 1 | -1>) => LeanQueryExec<T>;
};

type JournalRepository = {
  findOne: (filter: Record<string, unknown>) => LeanQueryExec<unknown | null>;
  findOneAndUpdate: (
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options: Record<string, unknown>,
  ) => LeanQueryExec<unknown | null>;
};
type ExplanationRepository = {
  create: (input: Record<string, unknown>) => Promise<unknown>;
  findOne: (filter: Record<string, unknown>) => FindOneQuery<unknown | null>;
};
type ReviewLlmService = {
  generatePostTradeReview: (input: {
    context: Record<string, unknown>;
    promptVersion: string;
    schemaVersion: string;
  }) => Promise<unknown>;
  getProviderMetadata: () => { name: string; modelName?: string };
};
type Dependencies = {
  journalRepository: JournalRepository;
  explanationRepository: ExplanationRepository;
  auditLogService: Pick<AuditLogService, "record">;
  contextService: Pick<AiTradeReviewContextService, "build" | "hash">;
  llmService: ReviewLlmService;
  now: () => Date;
};
type RecordShape = Record<string, any>;

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

export class AiTradeReviewService {
  public constructor(private readonly dependencies: Partial<Dependencies> = {}) {}

  public async generateReview(userId: string, journalId: string): Promise<RecordShape> {
    const journal = await this.getOwnedJournal(userId, journalId);
    if (journal.status !== "FINALIZED") {
      throw new AppError("AI review requires FINALIZED TradeJournal", 409);
    }

    const context = this.getContextService().build(journal);
    const contextHash = this.getContextService().hash(context);
    const correlationId = randomUUID();
    await this.audit("AI_EXPLANATION_REQUESTED", userId, journalId, correlationId, {
      taskType: "POST_TRADE_REVIEW",
      contextHash,
      promptVersion: POST_TRADE_REVIEW_PROMPT_VERSION,
      schemaVersion: POST_TRADE_REVIEW_SCHEMA_VERSION,
    });

    let output: PostTradeReviewOutput;
    let status: "COMPLETED" | "FALLBACK_USED";
    let aiOutput: PostTradeReviewOutput | undefined;
    let fallbackOutput: PostTradeReviewOutput | undefined;
    let validationErrors: string[] = [];
    let warnings: string[] = [];

    try {
      const candidate = await this.getLlmService().generatePostTradeReview({
        context: context as unknown as Record<string, unknown>,
        promptVersion: POST_TRADE_REVIEW_PROMPT_VERSION,
        schemaVersion: POST_TRADE_REVIEW_SCHEMA_VERSION,
      });
      const validation = validatePostTradeReviewOutput(candidate);
      if (!validation.success) {
        validationErrors = validation.errors;
        await this.audit("AI_OUTPUT_REJECTED", userId, journalId, correlationId, {
          validationErrors,
        });
        output = this.buildFallback(context);
        fallbackOutput = output;
        status = "FALLBACK_USED";
      } else {
        output = validation.data;
        aiOutput = output;
        status = "COMPLETED";
        await this.audit("AI_OUTPUT_VALIDATED", userId, journalId, correlationId);
      }
    } catch {
      warnings = ["LLM_REQUEST_FAILED"];
      await this.audit("AI_OUTPUT_REJECTED", userId, journalId, correlationId, { warnings });
      output = this.buildFallback(context);
      fallbackOutput = output;
      status = "FALLBACK_USED";
    }

    if (status === "FALLBACK_USED") {
      await this.audit("AI_FALLBACK_USED", userId, journalId, correlationId, {
        validationErrors,
        warnings,
      });
    }

    const generatedAt = this.getNow();
    const provider = this.getLlmService().getProviderMetadata();
    const explanation = normalizeRecord<RecordShape>(await this.getExplanationRepository().create({
      userId: toObjectId(userId, "user id"),
      taskType: "POST_TRADE_REVIEW",
      sourceType: "TRADE_JOURNAL",
      sourceId: toObjectId(journalId, "trade journal id"),
      tradePlanId: journal.tradePlanId,
      tradeSetupId: journal.tradeSetupId,
      activeTradeId: journal.activeTradeId,
      tradeResultId: journal.tradeResultId,
      tradeJournalId: journal._id,
      contextHash,
      promptVersion: POST_TRADE_REVIEW_PROMPT_VERSION,
      schemaVersion: POST_TRADE_REVIEW_SCHEMA_VERSION,
      modelProvider: provider.name,
      ...(provider.modelName ? { modelName: provider.modelName } : {}),
      status,
      ...(aiOutput ? { aiOutput } : {}),
      ...(fallbackOutput ? { fallbackOutput } : {}),
      summary: output.summary,
      keyMistakes: output.keyMistakes,
      strengths: output.strengths,
      improvementSuggestions: output.improvementSuggestions,
      processQuality: output.processQuality,
      riskNotes: output.riskNotes,
      validationErrors,
      warnings,
      generatedAt,
    }));

    const updatedJournal = await this.getJournalRepository().findOneAndUpdate(
      { _id: toObjectId(journalId, "trade journal id"), userId: toObjectId(userId, "user id") },
      { $set: { aiSummary: output.summary, aiReviewId: explanation._id, aiGeneratedAt: generatedAt } },
      { new: true },
    ).lean().exec();
    if (!updatedJournal) throw new AppError("TRADE_JOURNAL_NOT_FOUND", 404);

    await this.audit("AI_EXPLANATION_STORED", userId, String(explanation._id), correlationId, {
      tradeJournalId: journalId,
      status,
      contextHash,
    });
    return explanation;
  }

  public async getExplanation(userId: string, explanationId: string): Promise<RecordShape> {
    const explanation = await this.getExplanationRepository().findOne({
      _id: toObjectId(explanationId, "AI explanation id"),
      userId: toObjectId(userId, "user id"),
    }).lean().exec() as RecordShape | null;
    if (!explanation) throw new AppError("AI_EXPLANATION_NOT_FOUND", 404);
    return explanation;
  }

  public async getJournalReview(userId: string, journalId: string): Promise<RecordShape> {
    await this.getOwnedJournal(userId, journalId);
    const query = this.getExplanationRepository().findOne({
      userId: toObjectId(userId, "user id"),
      tradeJournalId: toObjectId(journalId, "trade journal id"),
      taskType: "POST_TRADE_REVIEW",
    });
    const explanation = await query.sort({ createdAt: -1 }).lean().exec();
    if (!explanation) throw new AppError("AI_EXPLANATION_NOT_FOUND", 404);
    return explanation;
  }

  private async getOwnedJournal(userId: string, journalId: string): Promise<RecordShape> {
    const journal = await this.getJournalRepository().findOne({
      _id: toObjectId(journalId, "trade journal id"),
      userId: toObjectId(userId, "user id"),
    }).lean().exec() as RecordShape | null;
    if (!journal) throw new AppError("TRADE_JOURNAL_NOT_FOUND", 404);
    return journal;
  }

  private buildFallback(context: TradeJournalAiContext): PostTradeReviewOutput {
    const processQuality = this.fallbackProcessQuality(context);
    const mistakes = [
      ...context.processEvidence.mistakeTags.filter((tag) => tag !== "NONE"),
      ...context.processEvidence.ruleViolations,
    ];
    const result = context.finalizedResult;
    const entry = context.processEvidence.entryQuality ?? "NOT_RECORDED";
    const exit = context.processEvidence.exitQuality ?? "NOT_RECORDED";
    const userFocus = context.processEvidence.nextTimeFocus;
    const focus =
      userFocus && semanticValidationErrors(userFocus).length === 0
        ? userFocus
        : mistakes[0]
          ? `Address ${mistakes[0]} while keeping the original setup risk unchanged.`
          : "Repeat the documented process and review execution quality.";

    return {
      summary: `This trade was finalized as a ${result.resultType} with ${result.realizedR.toFixed(2)}R using ${result.pnlBasis}. The journal records entry quality as ${entry} and exit quality as ${exit}.`,
      processQuality,
      strengths: context.processEvidence.followedPlan
        ? ["The journal records that the documented plan was followed."]
        : [],
      keyMistakes: mistakes,
      riskNotes: context.processEvidence.ruleViolations.length
        ? context.processEvidence.ruleViolations.map((violation) => `Recorded rule violation: ${violation}.`)
        : ["No rule violation was recorded in the finalized journal."],
      improvementSuggestions: mistakes.length
        ? mistakes.map((mistake) => `Create a specific prevention check for ${mistake}.`)
        : ["Keep the same pre-trade and execution review discipline."],
      nextTradeFocus: focus,
      confidence: "HIGH",
    };
  }

  private fallbackProcessQuality(context: TradeJournalAiContext): AiProcessQuality {
    const evidence = context.processEvidence;
    if (
      evidence.followedPlan === false
      || evidence.outcomeQuality?.includes("BAD_PROCESS")
      || evidence.ruleViolations.length > 1
    ) return "BAD_PROCESS";
    if (
      evidence.ruleViolations.length === 1
      || evidence.mistakeTags.some((tag) => tag !== "NONE")
      || evidence.followedPlan !== true
    ) return "MIXED_PROCESS";
    return "GOOD_PROCESS";
  }

  private async audit(
    action: string,
    userId: string,
    entityId: string,
    correlationId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.getAuditLogService().record({
      userId,
      actorType: action === "AI_EXPLANATION_REQUESTED" ? "USER" : "AI",
      actorId: action === "AI_EXPLANATION_REQUESTED" ? userId : "ai-trade-review",
      action,
      entityType: action === "AI_EXPLANATION_REQUESTED" ? "TRADE_JOURNAL" : "AI_EXPLANATION",
      entityId,
      correlationId,
      ...(metadata ? { metadata } : {}),
    });
  }

  private getJournalRepository(): JournalRepository {
    return this.dependencies.journalRepository ?? TradeJournalModel;
  }
  private getExplanationRepository(): ExplanationRepository {
    return this.dependencies.explanationRepository ?? AiExplanationModel;
  }
  private getAuditLogService(): Pick<AuditLogService, "record"> {
    return this.dependencies.auditLogService ?? auditLogService;
  }
  private getContextService(): Pick<AiTradeReviewContextService, "build" | "hash"> {
    return this.dependencies.contextService ?? new AiTradeReviewContextService();
  }
  private getLlmService(): ReviewLlmService {
    return this.dependencies.llmService ?? sharedLlmService;
  }
  private getNow(): Date {
    return this.dependencies.now?.() ?? new Date();
  }
}
