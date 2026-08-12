import crypto from "node:crypto";

import { freezeClone } from "../knowledge/knowledge-document-admission.service.js";
import type { CopilotDraftReviewRepositoryPort } from "../../types/copilot-draft-review.types.js";
import { COPILOT_DRAFT_REVIEW_TTL_MS } from "../../types/copilot-draft-review.types.js";
import type { TemplateDraftGenerationResult } from "../../types/template-draft-generation.types.js";

export class CopilotDraftReviewService {
  public constructor(
    private readonly repository: CopilotDraftReviewRepositoryPort,
    private readonly now: () => Date = () => new Date(),
    private readonly id: (prefix: "rvw" | "bnd") => string = (prefix) =>
      `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`,
  ) {}

  public async create(
    ownerId: string,
    generation: TemplateDraftGenerationResult,
  ) {
    if (generation.status !== "COMPLETED" && generation.status !== "PARTIAL")
      return Object.freeze({ created: false as const, code: "GENERATION_NOT_ACCEPTABLE" });
    if (generation.validatedCandidate.supportedBindings.length === 0)
      return Object.freeze({ created: false as const, code: "NO_SUPPORTED_BINDINGS" });
    if (generation.validatedCandidate.supportedBindings.some(
      ({ relationship }) => relationship !== "DIRECT" && relationship !== "INVERSE",
    )) return Object.freeze({ created: false as const, code: "UNSUPPORTED_RELATIONSHIP" });
    const createdAt = this.now();
    if (!Number.isFinite(createdAt.getTime()))
      return Object.freeze({ created: false as const, code: "INVALID_TIME" });
    const labels = new Map(
      generation.reviewReport.requestedConcepts.map(({ conceptId, text }) => [conceptId, text]),
    );
    const bindings = generation.validatedCandidate.supportedBindings.map((binding) => ({
      bindingReviewId: this.id("bnd"),
      bindingCandidateId: binding.bindingCandidateId,
      label:
        binding.requestedConceptIds.map((conceptId) => labels.get(conceptId)).filter(Boolean).join(", ") ||
        "Supported factor",
      relationship: binding.relationship as "DIRECT" | "INVERSE",
    }));
    const reviewId = this.id("rvw");
    const expiresAt = new Date(createdAt.getTime() + COPILOT_DRAFT_REVIEW_TTL_MS);
    const stored = await this.repository.create({
      reviewId,
      reviewVersion: 1,
      ownerId,
      generation,
      bindings,
      createdAt,
      expiresAt,
    });
    return stored.found
      ? freezeClone({ created: true as const, review: stored.review })
      : Object.freeze({ created: false as const, code: stored.code });
  }
}
