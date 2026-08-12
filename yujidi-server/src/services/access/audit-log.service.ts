import pino from "pino";
import { Types, isValidObjectId } from "mongoose";

import { AuditLogModel } from "../../models/audit-log.model.js";
import type { CreateAuditLogInput } from "../../types/audit.types.js";
import { AuditSanitizerService } from "./audit-sanitizer.service.js";

const logger = pino({ name: "audit-log-service" });

type AuditLogRepository = {
  create: (input: Record<string, unknown>) => Promise<unknown>;
};

type AuditLogServiceDependencies = {
  repository: AuditLogRepository;
  sanitizer: Pick<AuditSanitizerService, "sanitize">;
};

export class AuditLogService {
  public constructor(private readonly dependencies: Partial<AuditLogServiceDependencies> = {}) {}

  public async record(input: CreateAuditLogInput): Promise<void> {
    try {
      await this.getRepository().create(this.toSanitizedRecord(input));
    } catch (error: unknown) {
      logger.error(
        {
          error: this.sanitizeError(error),
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          correlationId: input.correlationId,
          idempotencyKey: input.idempotencyKey,
        },
        "Failed to persist audit log",
      );
    }
  }

  private toSanitizedRecord(input: CreateAuditLogInput): Record<string, unknown> {
    const record: Record<string, unknown> = {
      actorType: input.actorType,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
    };

    const userId = this.normalizeUserId(input.userId);
    if (userId) record.userId = userId;
    if (input.actorId) record.actorId = input.actorId;
    if (input.reasonCode) record.reasonCode = input.reasonCode;
    if (input.correlationId) record.correlationId = input.correlationId;
    if (input.causationId) record.causationId = input.causationId;
    if (input.idempotencyKey) record.idempotencyKey = input.idempotencyKey;
    if (input.before) record.before = this.getSanitizer().sanitize(input.before);
    if (input.after) record.after = this.getSanitizer().sanitize(input.after);
    if (input.metadata) record.metadata = this.getSanitizer().sanitize(input.metadata);
    if (input.ipAddress) record.ipAddress = input.ipAddress;
    if (input.userAgent) record.userAgent = input.userAgent;

    return record;
  }

  private normalizeUserId(userId: CreateAuditLogInput["userId"]): Types.ObjectId | undefined {
    if (!userId) {
      return undefined;
    }
    if (userId instanceof Types.ObjectId) {
      return userId;
    }
    return isValidObjectId(userId) ? new Types.ObjectId(userId) : undefined;
  }

  private sanitizeError(error: unknown): Record<string, string> {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
      };
    }
    return {
      name: "UnknownError",
      message: "Audit log persistence failed",
    };
  }

  private getRepository(): AuditLogRepository {
    return this.dependencies.repository ?? AuditLogModel;
  }

  private getSanitizer(): Pick<AuditSanitizerService, "sanitize"> {
    return this.dependencies.sanitizer ?? new AuditSanitizerService();
  }
}

export const auditLogService = new AuditLogService();
