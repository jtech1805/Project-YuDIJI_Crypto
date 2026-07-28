import { model, Schema, type InferSchemaType } from "mongoose";

import { LLM_TRACE_STATUSES, LLM_TRACE_TASK_TYPES } from "../types/llm-trace.types.js";

const nonNegativeInteger = {
  type: Number,
  min: 0,
  validate: {
    validator: Number.isInteger,
    message: "{PATH} must be an integer",
  },
};

const llmTraceSchema = new Schema(
  {
    traceId: { type: String, required: true, trim: true, unique: true },
    correlationId: { type: String, trim: true },
    taskType: { type: String, enum: LLM_TRACE_TASK_TYPES, required: true },
    status: { type: String, enum: LLM_TRACE_STATUSES, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    source: {
      _id: false,
      entityType: { type: String, trim: true },
      entityId: { type: String, trim: true },
    },
    provider: { type: String, required: true, trim: true },
    model: { type: String, trim: true },
    promptVersion: { type: String, required: true, trim: true },
    schemaVersion: { type: String, trim: true },
    startedAt: { type: Date, required: true },
    completedAt: Date,
    latencyMs: { type: Number, min: 0 },
    tokenUsage: {
      _id: false,
      promptTokens: nonNegativeInteger,
      completionTokens: nonNegativeInteger,
      totalTokens: nonNegativeInteger,
    },
    inputReference: {
      _id: false,
      hash: { type: String, trim: true },
      redactedSummary: Schema.Types.Mixed,
    },
    outputReference: {
      _id: false,
      hash: { type: String, trim: true },
      fieldSummary: Schema.Types.Mixed,
    },
    validation: {
      _id: false,
      parseSucceeded: Boolean,
      schemaSucceeded: Boolean,
      semanticSucceeded: Boolean,
      errors: {
        type: [{ type: String, trim: true, maxlength: 500 }],
        validate: {
          validator: (errors: string[]): boolean => errors.length <= 20,
          message: "validation.errors cannot contain more than 20 entries",
        },
      },
    },
    fallbackUsed: { type: Boolean, required: true },
    failureCode: { type: String, trim: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

llmTraceSchema.index({ taskType: 1, createdAt: -1 });
llmTraceSchema.index({ status: 1, createdAt: -1 });
llmTraceSchema.index({ correlationId: 1, createdAt: -1 });
llmTraceSchema.index({ userId: 1, createdAt: -1 });
llmTraceSchema.index({ "source.entityType": 1, "source.entityId": 1, createdAt: -1 });

export type LlmTrace = InferSchemaType<typeof llmTraceSchema>;
export const LlmTraceModel = model<LlmTrace>("LlmTrace", llmTraceSchema);
