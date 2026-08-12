import type { ScoringTemplateCrudService } from "../scoring/scoring-template-crud.service.js";
import type { TemplateDraftingWorkflowService } from "./template-drafting-workflow.service.js";
import type {
  CopilotDraftAcceptanceRequest,
  CopilotDraftAcceptanceResult,
} from "../../types/copilot-template-draft.types.js";
import type { CopilotDraftReviewRepositoryPort } from "../../types/copilot-draft-review.types.js";
import type { TemplateDraftRegistryProjectionRequest } from "../../types/template-draft-registry-projection.types.js";
import { freezeClone } from "../knowledge/knowledge-document-admission.service.js";

export class CopilotDraftAcceptanceService {
  public constructor(
    private readonly reviews: CopilotDraftReviewRepositoryPort,
    private readonly workflow: Pick<TemplateDraftingWorkflowService, "accept">,
    private readonly templates: Pick<ScoringTemplateCrudService, "findOwnedDraftByTemplateKey">,
    private readonly currentAuthorities: () => TemplateDraftRegistryProjectionRequest,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async accept(
    reviewId: string,
    input: CopilotDraftAcceptanceRequest,
    principal: Readonly<{ userId: string }>,
  ): Promise<CopilotDraftAcceptanceResult> {
    const found = await this.reviews.findExact(reviewId, input.reviewVersion);
    if (!found.found)
      return reject(found.code === "PERSISTENCE_FAILED" ? "PERSISTENCE_FAILED" : "REVIEW_NOT_FOUND");
    const review = found.review;
    if (review.ownerId !== principal.userId) return reject("REVIEW_OWNER_MISMATCH");
    const acceptedAt = this.now();
    if (!Number.isFinite(acceptedAt.getTime()) || review.expiresAt <= acceptedAt)
      return reject("REVIEW_EXPIRED");
    if (review.consumedAt || review.acceptedTemplateId)
      return reject("REVIEW_ALREADY_ACCEPTED", review.acceptedTemplateId
        ? { id: review.acceptedTemplateId, templateKey: templateKey(reviewId), version: 1 }
        : undefined);
    if (
      review.generation.status !== "COMPLETED" &&
      review.generation.status !== "PARTIAL"
    ) return reject("ACCEPTANCE_REJECTED");
    if (review.generation.validatedCandidate.unresolvedConcepts.length > 0)
      return reject("UNRESOLVED_CONCEPTS_PRESENT");

    const selected = new Map(input.acceptedBindings.map((binding) => [binding.bindingReviewId, binding]));
    if (
      selected.size !== input.acceptedBindings.length ||
      input.acceptedBindings.length !== review.bindings.length ||
      review.bindings.some(({ bindingReviewId }) => !selected.has(bindingReviewId))
    ) return reject("INVALID_BINDING_SELECTION");
    const mapped = review.bindings.map((binding) => ({
      bindingCandidateId: binding.bindingCandidateId,
      weight: selected.get(binding.bindingReviewId)!.weight,
    }));

    const lineage = review.generation.validatedCandidate.validationLineage;
    const result = await this.workflow.accept({
      acceptance: {
        acceptanceId: reviewId.toUpperCase(),
        acceptanceVersion: review.reviewVersion,
        authenticatedUserId: principal.userId,
        generatedForUserId: review.ownerId,
        requestId: review.generation.candidate.requestId,
        candidateId: review.generation.candidate.candidateId,
        expectedCandidateSchemaVersion: review.generation.candidate.candidateSchemaVersion,
        expectedRegistryProjection: {
          projectionId: lineage.registryProjectionId,
          projectionVersion: lineage.registryProjectionVersion,
          projectionDigest: lineage.registryProjectionDigest,
        },
        expectedValidation: {
          validationPolicyId: lineage.validationPolicyId,
          validationPolicyVersion: lineage.validationPolicyVersion,
        },
        acceptedBindingIds: mapped.map(({ bindingCandidateId }) => bindingCandidateId),
        userProvidedWeights: mapped,
        template: input.template,
        acceptedAt,
      },
      generation: review.generation,
      currentAuthorities: this.currentAuthorities(),
    });
    if (result.status === "CREATED") {
      const marked = await this.reviews.markAccepted(
        reviewId,
        review.reviewVersion,
        result.template.id,
        acceptedAt,
      );
      if (!marked.found) return reject("PERSISTENCE_FAILED");
      return freezeClone({ status: "created" as const, template: {
        id: result.template.id,
        templateKey: result.template.templateKey,
        version: result.template.version,
        scope: "USER" as const,
        status: "DRAFT" as const,
      } });
    }

    const existing = await this.templates.findOwnedDraftByTemplateKey(
      principal.userId,
      templateKey(reviewId),
    );
    if (existing?.id) {
      await this.reviews.markAccepted(reviewId, review.reviewVersion, existing.id, acceptedAt);
      return reject("REVIEW_ALREADY_ACCEPTED", {
        id: existing.id,
        templateKey: existing.templateKey,
        version: existing.version,
      });
    }
    const issue = result.issues[0]?.code ?? "";
    if (issue === "INVALID_WEIGHT_TOTAL" || issue === "WEIGHT_REQUIRED") return reject("INVALID_WEIGHT");
    if (result.status === "STALE_CANDIDATE") return reject("STALE_GENERATION");
    if (result.status === "PERSISTENCE_FAILED") return reject("PERSISTENCE_FAILED");
    return reject("ACCEPTANCE_REJECTED");
  }
}

const templateKey = (reviewId: string): string => `USER_AI_DRAFT_${reviewId}`.toUpperCase();
const reject = (
  code: Extract<CopilotDraftAcceptanceResult, { status: "rejected" }>["code"],
  template?: Readonly<{ id: string; templateKey: string; version: number }>,
): CopilotDraftAcceptanceResult => freezeClone({
  status: "rejected" as const,
  code,
  ...(template ? { template } : {}),
});
