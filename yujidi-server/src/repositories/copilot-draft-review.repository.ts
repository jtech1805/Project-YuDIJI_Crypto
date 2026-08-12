import { CopilotDraftReviewModel } from "../models/copilot-draft-review.model.js";
import { freezeClone } from "../services/knowledge-document-admission.service.js";
import type {
  CopilotDraftReviewReadResult,
  CopilotDraftReviewRecord,
  CreateCopilotDraftReview,
} from "../types/copilot-draft-review.types.js";

type ReviewModel = {
  create(value: unknown): Promise<unknown>;
  find(filter: Record<string, unknown>): {
    limit(value: number): { lean(): { exec(): Promise<Record<string, unknown>[]> } };
  };
  findOneAndUpdate(
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options: Record<string, unknown>,
  ): { lean(): { exec(): Promise<Record<string, unknown> | null> } };
};

export class CopilotDraftReviewRepository {
  public constructor(
    private readonly model: ReviewModel = CopilotDraftReviewModel as unknown as ReviewModel,
  ) {}

  public async create(input: CreateCopilotDraftReview): Promise<CopilotDraftReviewReadResult> {
    try {
      await this.model.create({ ...input, consumedAt: null, acceptedTemplateId: null });
      return this.findExact(input.reviewId, input.reviewVersion);
    } catch (error: unknown) {
      if (duplicate(error)) return this.findExact(input.reviewId, input.reviewVersion);
      return Object.freeze({ found: false, code: "PERSISTENCE_FAILED" });
    }
  }

  public async findExact(
    reviewId: string,
    reviewVersion: number,
  ): Promise<CopilotDraftReviewReadResult> {
    try {
      const rows = await this.model
        .find({ reviewId, reviewVersion })
        .limit(2)
        .lean()
        .exec();
      if (rows.length === 0) return Object.freeze({ found: false, code: "NOT_FOUND" });
      if (rows.length !== 1) return Object.freeze({ found: false, code: "INVARIANT_VIOLATION" });
      const review = parse(rows[0]);
      return review
        ? freezeClone({ found: true as const, review })
        : Object.freeze({ found: false, code: "INVARIANT_VIOLATION" });
    } catch {
      return Object.freeze({ found: false, code: "PERSISTENCE_FAILED" });
    }
  }

  public async markAccepted(
    reviewId: string,
    reviewVersion: number,
    acceptedTemplateId: string,
    consumedAt: Date,
  ): Promise<CopilotDraftReviewReadResult> {
    try {
      const row = await this.model
        .findOneAndUpdate(
          {
            reviewId,
            reviewVersion,
            $or: [
              { consumedAt: null },
              { acceptedTemplateId },
            ],
          },
          { $set: { consumedAt, acceptedTemplateId } },
          { new: true },
        )
        .lean()
        .exec();
      if (!row) return this.findExact(reviewId, reviewVersion);
      const review = parse(row);
      return review
        ? freezeClone({ found: true as const, review })
        : Object.freeze({ found: false, code: "INVARIANT_VIOLATION" });
    } catch {
      return Object.freeze({ found: false, code: "PERSISTENCE_FAILED" });
    }
  }
}

const duplicate = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === 11000;

const parse = (value: Record<string, unknown> | undefined): CopilotDraftReviewRecord | null => {
  if (
    !value ||
    typeof value.reviewId !== "string" ||
    value.reviewVersion !== 1 ||
    typeof value.ownerId !== "string" ||
    !value.generation ||
    !Array.isArray(value.bindings) ||
    !(value.createdAt instanceof Date) ||
    !(value.expiresAt instanceof Date)
  ) return null;
  return {
    reviewId: value.reviewId,
    reviewVersion: 1,
    ownerId: value.ownerId,
    generation: value.generation as CopilotDraftReviewRecord["generation"],
    bindings: value.bindings as CopilotDraftReviewRecord["bindings"],
    createdAt: new Date(value.createdAt),
    expiresAt: new Date(value.expiresAt),
    consumedAt: value.consumedAt instanceof Date ? new Date(value.consumedAt) : null,
    acceptedTemplateId:
      typeof value.acceptedTemplateId === "string" ? value.acceptedTemplateId : null,
  };
};
