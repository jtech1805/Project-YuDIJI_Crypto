import pino from "pino";
import { isValidObjectId, Types } from "mongoose";

import { LlmTraceModel } from "../../models/llm-trace.model.js";
import type { CreateLlmTraceInput } from "../../types/llm-trace.types.js";

const defaultLogger = pino({ name: "llm-trace-service" });
const REDACTED_VALUE = "[REDACTED]";
const MAX_VALIDATION_ERRORS = 20;
const MAX_VALIDATION_ERROR_LENGTH = 500;
const SENSITIVE_KEY_PARTS = [
  "password",
  "secret",
  "token",
  "accesstoken",
  "refreshtoken",
  "feedtoken",
  "apikey",
  "authorization",
  "cookie",
  "jwt",
  "credential",
  "privatekey",
];

type LlmTraceRepository = {
  create: (input: Record<string, unknown>) => Promise<unknown>;
};

type LlmTraceLogger = {
  error: (metadata: Record<string, unknown>, message: string) => void;
};

type LlmTraceServiceDependencies = {
  repository: LlmTraceRepository;
  logger: LlmTraceLogger;
  sanitizer: (value: Record<string, unknown>) => Record<string, unknown>;
};

export class LlmTraceService {
  public constructor(
    private readonly dependencies: Partial<LlmTraceServiceDependencies> = {},
  ) {}

  public async record(input: CreateLlmTraceInput): Promise<void> {
    try {
      await this.getRepository().create(this.toPersistenceRecord(input));
    } catch (error: unknown) {
      const metadata: Record<string, unknown> = {
        error: this.sanitizeError(error),
        traceId: input.traceId,
        taskType: input.taskType,
        status: input.status,
        provider: input.provider,
      };
      if (input.correlationId) metadata.correlationId = input.correlationId;
      if (input.failureCode) metadata.failureCode = input.failureCode;

      try {
        this.getLogger().error(metadata, "Failed to persist LLM trace");
      } catch {
        // Observability must never become a failure path for the calling workflow.
      }
    }
  }

  private toPersistenceRecord(input: CreateLlmTraceInput): Record<string, unknown> {
    const record: Record<string, unknown> = {
      traceId: input.traceId,
      taskType: input.taskType,
      status: input.status,
      provider: input.provider,
      promptVersion: input.promptVersion,
      startedAt: input.startedAt,
      fallbackUsed: input.fallbackUsed,
    };

    this.copyOptionalFields(record, input);
    const userId = this.normalizeUserId(input.userId);
    if (userId) record.userId = userId;
    if (input.inputReference) {
      record.inputReference = this.buildInputReference(input.inputReference);
    }
    if (input.outputReference) {
      record.outputReference = this.buildOutputReference(input.outputReference);
    }
    if (input.validation) record.validation = this.buildValidation(input.validation);

    return record;
  }

  private copyOptionalFields(
    record: Record<string, unknown>,
    input: CreateLlmTraceInput,
  ): void {
    if (input.correlationId) record.correlationId = input.correlationId;
    if (input.source) record.source = { ...input.source };
    if (input.model) record.model = input.model;
    if (input.schemaVersion) record.schemaVersion = input.schemaVersion;
    if (input.completedAt) record.completedAt = input.completedAt;
    if (input.latencyMs !== undefined) record.latencyMs = input.latencyMs;
    if (input.tokenUsage) record.tokenUsage = { ...input.tokenUsage };
    if (input.failureCode) record.failureCode = input.failureCode;
  }

  private buildInputReference(
    reference: NonNullable<CreateLlmTraceInput["inputReference"]>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    if (reference.hash) result.hash = reference.hash;
    if (reference.redactedSummary) {
      result.redactedSummary = this.sanitize(reference.redactedSummary);
    }
    return result;
  }

  private buildOutputReference(
    reference: NonNullable<CreateLlmTraceInput["outputReference"]>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    if (reference.hash) result.hash = reference.hash;
    if (reference.fieldSummary) {
      result.fieldSummary = this.sanitize(reference.fieldSummary);
    }
    return result;
  }

  private buildValidation(
    validation: NonNullable<CreateLlmTraceInput["validation"]>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    if (validation.parseSucceeded !== undefined) {
      result.parseSucceeded = validation.parseSucceeded;
    }
    if (validation.schemaSucceeded !== undefined) {
      result.schemaSucceeded = validation.schemaSucceeded;
    }
    if (validation.semanticSucceeded !== undefined) {
      result.semanticSucceeded = validation.semanticSucceeded;
    }
    if (validation.errors) {
      result.errors = validation.errors
        .filter((error): error is string => typeof error === "string")
        .slice(0, MAX_VALIDATION_ERRORS)
        .map((error) => this.sanitizeErrorText(error).slice(0, MAX_VALIDATION_ERROR_LENGTH))
        .map((error) => error.trim());
    }
    return result;
  }

  private sanitize(value: Record<string, unknown>): Record<string, unknown> {
    if (this.dependencies.sanitizer) return this.dependencies.sanitizer(value);
    return this.sanitizeObject(value);
  }

  private sanitizeObject(value: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (SENSITIVE_KEY_PARTS.some((part) => normalizedKey.includes(part))) {
        sanitized[key] = REDACTED_VALUE;
      } else if (Array.isArray(nestedValue)) {
        sanitized[key] = nestedValue.map((item) =>
          this.isPlainObject(item) ? this.sanitizeObject(item) : item,
        );
      } else if (this.isPlainObject(nestedValue)) {
        sanitized[key] = this.sanitizeObject(nestedValue);
      } else {
        sanitized[key] = nestedValue;
      }
    }
    return sanitized;
  }

  private sanitizeErrorText(value: string): string {
    return value.replace(
      /(password|secret|token|accessToken|refreshToken|feedToken|apiKey|authorization|cookie|jwt|credential|privateKey)(\s*[:=]\s*)([^\s,;]+)/gi,
      `$1$2${REDACTED_VALUE}`,
    );
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    if (value === null || typeof value !== "object") return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  private normalizeUserId(userId: string | undefined): Types.ObjectId | undefined {
    return userId && isValidObjectId(userId) ? new Types.ObjectId(userId) : undefined;
  }

  private sanitizeError(error: unknown): Record<string, string> {
    if (error instanceof Error) {
      return { name: error.name, message: this.sanitizeErrorText(error.message) };
    }
    return { name: "UnknownError", message: "LLM trace persistence failed" };
  }

  private getRepository(): LlmTraceRepository {
    return this.dependencies.repository ?? LlmTraceModel;
  }

  private getLogger(): LlmTraceLogger {
    return this.dependencies.logger ?? defaultLogger;
  }
}

export const llmTraceService = new LlmTraceService();
