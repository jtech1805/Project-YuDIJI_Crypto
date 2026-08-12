import assert from "node:assert/strict";
import test from "node:test";

import { CopilotDraftAcceptanceService } from "../../../src/services/copilot/copilot-draft-acceptance.service.js";
import { CopilotDraftReviewService } from "../../../src/services/copilot/copilot-draft-review.service.js";
import { TemplateDraftAcceptanceValidatorService } from "../../../src/services/copilot/template-draft-acceptance-validator.service.js";
import { TemplateDraftCandidateValidatorService } from "../../../src/services/copilot/template-draft-candidate-validator.service.js";
import { TemplateDraftProjectionService } from "../../../src/services/copilot/template-draft-projection.service.js";
import { TemplateDraftRegistryProjectionService } from "../../../src/services/copilot/template-draft-registry-projection.service.js";
import { TemplateDraftingWorkflowService } from "../../../src/services/copilot/template-drafting-workflow.service.js";
import { copilotDraftReviewSchema } from "../../../src/models/copilot-draft-review.model.js";
import type { CopilotDraftReviewRecord } from "../../../src/types/copilot-draft-review.types.js";
import {
  authorities,
  generation,
  partialGeneration,
} from "../../fixtures/template-draft-workflow.fixture.js";

const now = new Date("2026-08-12T10:00:00Z");

test("review schema freezes exact identity and TTL indexes", () => {
  const indexes = copilotDraftReviewSchema.indexes();
  assert.equal(indexes.some(([fields, options]) =>
    fields.reviewId === 1 && fields.reviewVersion === 1 && options.unique === true), true);
  assert.equal(indexes.some(([fields, options]) =>
    fields.expiresAt === 1 && options.expireAfterSeconds === 0), true);
});

class ReviewMemory {
  public record: CopilotDraftReviewRecord | null = null;
  public async create(input: any) {
    this.record = structuredClone({ ...input, consumedAt: null, acceptedTemplateId: null });
    return { found: true as const, review: structuredClone(this.record) };
  }
  public async findExact(id: string, version: number) {
    return this.record?.reviewId === id && this.record.reviewVersion === version
      ? { found: true as const, review: structuredClone(this.record) }
      : { found: false as const, code: "NOT_FOUND" as const };
  }
  public async markAccepted(id: string, version: number, templateId: string, consumedAt: Date) {
    if (!this.record || this.record.reviewId !== id || this.record.reviewVersion !== version)
      return { found: false as const, code: "NOT_FOUND" as const };
    this.record = structuredClone({ ...this.record, consumedAt, acceptedTemplateId: templateId });
    return { found: true as const, review: structuredClone(this.record) };
  }
}

const createReview = async (
  repository: ReviewMemory,
  source = generation(),
  ownerId = "507f1f77bcf86cd799439011",
) => {
  const service = new CopilotDraftReviewService(
    repository as any,
    () => new Date(now),
    (prefix) => prefix === "rvw" ? "REVIEW_1" : "BINDING_REVIEW_1",
  );
  const created = await service.create(ownerId, source);
  assert.equal(created.created, true);
  if (!created.created) throw new Error("review not created");
  return created.review;
};

const request = (change: Record<string, unknown> = {}) => ({
  reviewVersion: 1,
  template: {
    baseTemplateKey: "CRYPTO_SPOT_INTRADAY_V1" as const,
    templateName: "BTC ETF Flow Draft",
    description: "User-reviewed draft",
    marketType: "CRYPTO" as const,
    tradeStyle: "DAILY",
    instrumentType: "SPOT" as const,
  },
  acceptedBindings: [{ bindingReviewId: "BINDING_REVIEW_1", weight: 100 }],
  ...change,
});

const harness = (repository: ReviewMemory) => {
  let templateCreates = 0;
  const templates = {
    createUserDraft: async (command: any) => {
      templateCreates += 1;
      return {
        ...command,
        id: "TEMPLATE_1",
        version: 1,
        scope: "USER",
        status: "DRAFT",
      };
    },
    findOwnedDraftByTemplateKey: async () => null,
  };
  const workflow = new TemplateDraftingWorkflowService({
    generation: { generate: async () => { throw new Error("not used"); } } as any,
    acceptance: new TemplateDraftAcceptanceValidatorService(),
    projection: new TemplateDraftProjectionService(),
    registryProjection: new TemplateDraftRegistryProjectionService(),
    validator: new TemplateDraftCandidateValidatorService(),
    templates,
  });
  const service = new CopilotDraftAcceptanceService(
    repository as any,
    workflow,
    templates,
    () => authorities,
    () => new Date(now),
  );
  return { service, templateCreates: () => templateCreates };
};

test("successful generation creates an opaque bounded review with binding projection", async () => {
  const repository = new ReviewMemory();
  const review = await createReview(repository);
  assert.equal(review.reviewId, "REVIEW_1");
  assert.equal(review.expiresAt.getTime() - review.createdAt.getTime(), 30 * 60 * 1000);
  assert.deepEqual(review.bindings, [{
    bindingReviewId: "BINDING_REVIEW_1",
    bindingCandidateId: "BINDING_1",
    label: "ETF flow",
    relationship: "DIRECT",
  }]);
  assert.equal(review.consumedAt, null);
});

test("valid user weight creates exactly one USER/DRAFT and consumes review", async () => {
  const repository = new ReviewMemory();
  await createReview(repository);
  const { service, templateCreates } = harness(repository);
  const first = await service.accept("REVIEW_1", request(), { userId: repository.record!.ownerId });
  assert.equal(first.status, "created");
  if (first.status === "created") {
    assert.equal(first.template.scope, "USER");
    assert.equal(first.template.status, "DRAFT");
  }
  assert.equal(templateCreates(), 1);
  assert.equal(repository.record?.acceptedTemplateId, "TEMPLATE_1");
  const second = await service.accept("REVIEW_1", request(), { userId: repository.record!.ownerId });
  assert.deepEqual(second.status, "rejected");
  if (second.status === "rejected") assert.equal(second.code, "REVIEW_ALREADY_ACCEPTED");
  assert.equal(templateCreates(), 1);
});

test("ownership, expiry, version and unknown review reject without persistence", async () => {
  const repository = new ReviewMemory();
  await createReview(repository);
  const { service, templateCreates } = harness(repository);
  const ownerMismatch = await service.accept("REVIEW_1", request(), { userId: "OTHER_USER" });
  assert.equal(ownerMismatch.status === "rejected" && ownerMismatch.code, "REVIEW_OWNER_MISMATCH");
  const invalidVersion = await service.accept("REVIEW_1", { ...request(), reviewVersion: 2 }, { userId: repository.record!.ownerId });
  assert.equal(invalidVersion.status === "rejected" && invalidVersion.code, "REVIEW_NOT_FOUND");
  repository.record = structuredClone({ ...repository.record!, expiresAt: new Date(now.getTime() - 1) });
  const expired = await service.accept("REVIEW_1", request(), { userId: repository.record.ownerId });
  assert.equal(expired.status === "rejected" && expired.code, "REVIEW_EXPIRED");
  const unknown = await service.accept("UNKNOWN", request(), { userId: repository.record.ownerId });
  assert.equal(unknown.status === "rejected" && unknown.code, "REVIEW_NOT_FOUND");
  assert.equal(templateCreates(), 0);
});

test("unresolved concepts, binding tampering and invalid weights are rejected", async () => {
  const unresolvedRepository = new ReviewMemory();
  await createReview(unresolvedRepository, partialGeneration());
  const unresolvedHarness = harness(unresolvedRepository);
  const unresolved = await unresolvedHarness.service.accept("REVIEW_1", request(), { userId: unresolvedRepository.record!.ownerId });
  assert.equal(unresolved.status === "rejected" && unresolved.code, "UNRESOLVED_CONCEPTS_PRESENT");

  const repository = new ReviewMemory();
  await createReview(repository);
  const { service, templateCreates } = harness(repository);
  const tampered = await service.accept("REVIEW_1", request({ acceptedBindings: [{ bindingReviewId: "BINDING_FAKE", weight: 100 }] }), { userId: repository.record!.ownerId });
  assert.equal(tampered.status === "rejected" && tampered.code, "INVALID_BINDING_SELECTION");
  for (const weight of [-1, 50, 101]) {
    const invalid = await service.accept("REVIEW_1", request({ acceptedBindings: [{ bindingReviewId: "BINDING_REVIEW_1", weight }] }), { userId: repository.record!.ownerId });
    assert.equal(invalid.status === "rejected" && invalid.code, "INVALID_WEIGHT");
  }
  assert.equal(templateCreates(), 0);
});

test("changed current authority is rejected through existing stale-generation workflow", async () => {
  const repository = new ReviewMemory();
  await createReview(repository);
  const templates = { createUserDraft: async () => { throw new Error("must not persist"); }, findOwnedDraftByTemplateKey: async () => null };
  const workflow = new TemplateDraftingWorkflowService({
    generation: { generate: async () => { throw new Error("not used"); } } as any,
    acceptance: new TemplateDraftAcceptanceValidatorService(),
    projection: new TemplateDraftProjectionService(),
    registryProjection: new TemplateDraftRegistryProjectionService(),
    validator: new TemplateDraftCandidateValidatorService(),
    templates,
  });
  const service = new CopilotDraftAcceptanceService(
    repository as any,
    workflow,
    templates,
    () => ({ ...authorities, projectionVersion: 2 }),
    () => new Date(now),
  );
  const result = await service.accept("REVIEW_1", request(), { userId: repository.record!.ownerId });
  assert.equal(result.status === "rejected" && result.code, "STALE_GENERATION");
});
