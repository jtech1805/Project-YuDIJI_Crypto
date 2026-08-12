import type { TemplateDraftGenerationResult } from "./template-draft-generation.types.js";

export const COPILOT_DRAFT_REVIEW_TTL_MS = 30 * 60 * 1000;

export type CopilotBindingReview = Readonly<{
  bindingReviewId: string;
  bindingCandidateId: string;
  label: string;
  relationship: "DIRECT" | "INVERSE";
}>;

export type CopilotDraftReviewRecord = Readonly<{
  reviewId: string;
  reviewVersion: 1;
  ownerId: string;
  generation: TemplateDraftGenerationResult;
  bindings: readonly CopilotBindingReview[];
  createdAt: Date;
  expiresAt: Date;
  consumedAt: Date | null;
  acceptedTemplateId: string | null;
}>;

export type CreateCopilotDraftReview = Omit<
  CopilotDraftReviewRecord,
  "consumedAt" | "acceptedTemplateId"
>;

export type CopilotDraftReviewReadResult =
  | Readonly<{ found: true; review: CopilotDraftReviewRecord }>
  | Readonly<{ found: false; code: "NOT_FOUND" | "INVARIANT_VIOLATION" | "PERSISTENCE_FAILED" }>;

export interface CopilotDraftReviewRepositoryPort {
  create(input: CreateCopilotDraftReview): Promise<CopilotDraftReviewReadResult>;
  findExact(reviewId: string, reviewVersion: number): Promise<CopilotDraftReviewReadResult>;
  markAccepted(
    reviewId: string,
    reviewVersion: number,
    acceptedTemplateId: string,
    consumedAt: Date,
  ): Promise<CopilotDraftReviewReadResult>;
}
