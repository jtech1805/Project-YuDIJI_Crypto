import { model, Schema, type InferSchemaType } from "mongoose";

import { INSTRUMENT_TYPES, MARKET_TYPES } from "../types/market-data.types.js";
import { PNL_BASES } from "../types/risk.types.js";
import {
  EMOTIONAL_STATES,
  ENTRY_QUALITIES,
  EXIT_QUALITIES,
  JOURNAL_MODES,
  JOURNAL_STATUSES,
  MISTAKE_TAGS,
  OUTCOME_QUALITIES,
  SETUP_TYPES,
  TRADE_DIRECTIONS,
  TRADE_EXIT_REASONS,
  TRADE_RESULT_TYPES,
  TRADE_RULE_VIOLATIONS,
} from "../types/trade.types.js";

const tradeJournalSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tradePlanId: { type: Schema.Types.ObjectId, ref: "TradePlan", required: true, index: true },
    tradeSetupId: { type: Schema.Types.ObjectId, ref: "TradeSetup", required: true },
    activeTradeId: { type: Schema.Types.ObjectId, ref: "ActiveTrade", required: true, index: true },
    tradeResultId: { type: Schema.Types.ObjectId, ref: "TradeResult", required: true },
    scoreCheckId: { type: Schema.Types.ObjectId, ref: "ScoreCheck" },
    tradeScoreSnapshotId: { type: Schema.Types.ObjectId, ref: "TradeScoreSnapshot" },
    symbolId: { type: Schema.Types.ObjectId, ref: "Symbol", required: true, index: true },
    symbolSnapshot: { type: Schema.Types.Mixed, required: true },
    mode: { type: String, enum: JOURNAL_MODES, required: true, default: "MANAGED_TRADE" },
    status: { type: String, enum: JOURNAL_STATUSES, required: true, default: "DRAFT", index: true },

    direction: { type: String, enum: TRADE_DIRECTIONS, required: true },
    marketType: { type: String, enum: MARKET_TYPES, required: true },
    tradeStyle: { type: String, required: true, trim: true },
    instrumentType: { type: String, enum: INSTRUMENT_TYPES, required: true },
    plannedEntry: { type: Number, required: true },
    plannedStopLoss: { type: Number, required: true },
    plannedTarget1: { type: Number, required: true },
    plannedTarget2: Number,
    plannedRewardRiskRatio: { type: Number, required: true },
    actualEntry: { type: Number, required: true },
    actualQuantity: { type: Number, required: true },
    initialStopLoss: { type: Number, required: true },
    finalStopLoss: Number,
    exitPrice: { type: Number, required: true },
    exitReason: { type: String, enum: TRADE_EXIT_REASONS, required: true },
    grossPnl: { type: Number, required: true },
    netPnl: Number,
    realizedPnlUsedForRisk: { type: Number, required: true },
    pnlBasis: { type: String, enum: PNL_BASES, required: true },
    realizedR: { type: Number, required: true },
    resultType: { type: String, enum: TRADE_RESULT_TYPES, required: true },
    ruleViolations: { type: [{ type: String, enum: TRADE_RULE_VIOLATIONS }], default: [] },
    tradeEventIds: { type: [{ type: Schema.Types.ObjectId, ref: "TradeEvent" }], default: [] },
    openedAt: { type: Date, required: true },
    closedAt: { type: Date, required: true, index: true },

    setupType: { type: String, enum: SETUP_TYPES },
    entryQuality: { type: String, enum: ENTRY_QUALITIES },
    exitQuality: { type: String, enum: EXIT_QUALITIES },
    outcomeQuality: { type: String, enum: OUTCOME_QUALITIES },
    emotionalStateBefore: { type: String, enum: EMOTIONAL_STATES },
    emotionalStateDuring: { type: String, enum: EMOTIONAL_STATES },
    emotionalStateAfter: { type: String, enum: EMOTIONAL_STATES },
    mistakeTags: { type: [{ type: String, enum: MISTAKE_TAGS }], default: [] },
    userNotes: { type: String, trim: true, maxlength: 5000 },
    lessonLearned: { type: String, trim: true, maxlength: 3000 },
    screenshotUrls: { type: [String], default: [] },
    selfRating: { type: Number, min: 1, max: 10 },
    followedPlan: Boolean,
    whatWentWell: { type: String, trim: true, maxlength: 3000 },
    whatWentWrong: { type: String, trim: true, maxlength: 3000 },
    nextTimeFocus: { type: String, trim: true, maxlength: 3000 },

    aiSummary: String,
    aiReviewId: { type: Schema.Types.ObjectId, ref: "AiExplanation" },
    aiGeneratedAt: Date,
    finalizedAt: Date,
    archivedAt: Date,
  },
  { timestamps: true, versionKey: false },
);

tradeJournalSchema.index({ userId: 1, createdAt: -1 });
tradeJournalSchema.index({ tradeResultId: 1 }, { unique: true });
tradeJournalSchema.index({ tradePlanId: 1, createdAt: -1 });
tradeJournalSchema.index({ symbolId: 1, closedAt: -1 });
tradeJournalSchema.index({ userId: 1, status: 1, createdAt: -1 });

export type TradeJournal = InferSchemaType<typeof tradeJournalSchema>;
export const TradeJournalModel = model<TradeJournal>("TradeJournal", tradeJournalSchema);
