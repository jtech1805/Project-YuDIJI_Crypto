import { model, Schema, type InferSchemaType } from "mongoose";

import {
  AI_EXPLANATION_STATUSES,
  AI_PROCESS_QUALITIES,
  AI_SOURCE_TYPES,
  AI_TASK_TYPES,
} from "../types/ai.types.js";

const aiExplanationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    taskType: { type: String, enum: AI_TASK_TYPES, required: true, index: true },
    sourceType: { type: String, enum: AI_SOURCE_TYPES, required: true },
    sourceId: { type: Schema.Types.ObjectId, required: true },
    tradePlanId: { type: Schema.Types.ObjectId, ref: "TradePlan" },
    tradeSetupId: { type: Schema.Types.ObjectId, ref: "TradeSetup" },
    activeTradeId: { type: Schema.Types.ObjectId, ref: "ActiveTrade" },
    tradeResultId: { type: Schema.Types.ObjectId, ref: "TradeResult" },
    tradeJournalId: { type: Schema.Types.ObjectId, ref: "TradeJournal" },
    contextHash: { type: String, required: true, trim: true, index: true },
    promptVersion: { type: String, required: true, trim: true },
    schemaVersion: { type: String, required: true, trim: true },
    modelProvider: { type: String, trim: true },
    modelName: { type: String, trim: true },
    status: { type: String, enum: AI_EXPLANATION_STATUSES, required: true, index: true },
    aiOutput: Schema.Types.Mixed,
    fallbackOutput: Schema.Types.Mixed,
    summary: { type: String, required: true, trim: true, maxlength: 3000 },
    keyMistakes: { type: [String], default: [] },
    strengths: { type: [String], default: [] },
    improvementSuggestions: { type: [String], default: [] },
    processQuality: { type: String, enum: AI_PROCESS_QUALITIES },
    riskNotes: { type: [String], default: [] },
    validationErrors: { type: [String], default: [] },
    warnings: { type: [String], default: [] },
    generatedAt: Date,
  },
  { timestamps: true, versionKey: false },
);

aiExplanationSchema.index({ userId: 1, createdAt: -1 });
aiExplanationSchema.index({ sourceType: 1, sourceId: 1, createdAt: -1 });
aiExplanationSchema.index({ tradeJournalId: 1, createdAt: -1 });
aiExplanationSchema.index({ taskType: 1, status: 1, createdAt: -1 });

export type AiExplanation = InferSchemaType<typeof aiExplanationSchema>;
export const AiExplanationModel = model<AiExplanation>("AiExplanation", aiExplanationSchema);
