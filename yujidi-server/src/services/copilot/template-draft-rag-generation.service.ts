import type { FeatureFlagService } from "../../config/feature-flags.js";
import type { TemplateDraftGenerationPort } from "../../ports/template-draft-generation.port.js";
import type { TemplateDraftCandidateValidatorService } from "./template-draft-candidate-validator.service.js";
import type { TemplateDraftGenerationService } from "./template-draft-generation.service.js";
import { templateDraftCandidateSchema } from "./template-draft-generation.service.js";
import type { TemplateDraftReviewReportService } from "./template-draft-review-report.service.js";
import type { KnowledgeRetrievalService } from "../knowledge/knowledge-retrieval.service.js";
import type {
  RagTemplateDraftGenerationRequest,
  RagTemplateDraftGenerationResult,
} from "../../types/template-draft-rag.types.js";
import type { TemplateDraftCandidate } from "../../types/template-draft-candidate.types.js";
import { freezeClone } from "../knowledge/knowledge-document-admission.service.js";
import { TemplateDraftRetrievalQueryService } from "./template-draft-retrieval-query.service.js";
import { TemplateDraftRagPromptContextService } from "./template-draft-rag-prompt-context.service.js";
import { TemplateDraftCitationValidationService } from "./template-draft-citation-validation.service.js";
import { TemplateDraftRagContradictionService } from "./template-draft-rag-contradiction.service.js";
import { TemplateDraftRagReviewReportService } from "./template-draft-rag-review-report.service.js";
import type { KnowledgeRetrievalExecutionAuthorization } from "../../types/knowledge-retrieval-execution-authorization.types.js";
import type { AiRuntimeDeadlineContext } from "../../types/ai-runtime-deadline.types.js";
import type { AiProviderExecutionObserver } from "../../types/ai-provider-execution.types.js";
import type { ApplicationRagRetrievalAuthorization } from "../../types/application-rag-retrieval-authorization.types.js";
export class TemplateDraftRagGenerationService {
  public constructor(
    private readonly d: Readonly<{
      flags: Pick<FeatureFlagService, "isEnabled">;
      registryGeneration: Pick<TemplateDraftGenerationService, "generate">;
      retrieval: Pick<KnowledgeRetrievalService, "retrieve">;
      port: TemplateDraftGenerationPort;
      validator: TemplateDraftCandidateValidatorService;
      baseReviews: TemplateDraftReviewReportService;
      queries?: TemplateDraftRetrievalQueryService;
      prompts?: TemplateDraftRagPromptContextService;
      citations?: TemplateDraftCitationValidationService;
      contradictions?: TemplateDraftRagContradictionService;
      reviews?: TemplateDraftRagReviewReportService;
    }>,
  ) {}
  public async generate(
    input: RagTemplateDraftGenerationRequest,
    authorization?:
      | KnowledgeRetrievalExecutionAuthorization
      | ApplicationRagRetrievalAuthorization,
    deadline?: AiRuntimeDeadlineContext,
    providerObserver?: AiProviderExecutionObserver,
  ): Promise<RagTemplateDraftGenerationResult> {
    const queries = this.d.queries ?? new TemplateDraftRetrievalQueryService(),
      prompts = this.d.prompts ?? new TemplateDraftRagPromptContextService(),
      citationService =
        this.d.citations ?? new TemplateDraftCitationValidationService(),
      contradictionsService =
        this.d.contradictions ?? new TemplateDraftRagContradictionService(),
      reviewService =
        this.d.reviews ?? new TemplateDraftRagReviewReportService();
    if (!valid(input))
      return result(
        "INVARIANT_VIOLATION",
        input?.knowledgeMode ?? "REGISTRY_ONLY",
      );
    if (input.knowledgeMode === "REGISTRY_ONLY") {
      const base = await this.d.registryGeneration.generate(input.drafting);
      return fromRegistry(base);
    }
    if (
      !this.d.flags.isEnabled("RAG_TEMPLATE_DRAFTING_ENABLED") &&
      !authorization?.ragGenerationAllowed
    )
      return result("FEATURE_DISABLED", input.knowledgeMode);
    const projected = queries.project(input);
    if (!projected || !input.retrieval)
      return result("INVARIANT_VIOLATION", input.knowledgeMode);
    const retrieval = await this.d.retrieval.retrieve(projected.request, {
      enabled: true,
      contextId: input.retrieval.contextId,
      contextVersion: input.retrieval.contextVersion,
      ...(authorization ? { authorization } : {}),
      ...(deadline ? { deadline } : {}),
      ...(providerObserver ? { providerObserver } : {}),
    });
    if (retrieval.status !== "COMPLETED" && retrieval.status !== "PARTIAL") {
      const safe = [
        "NO_CONTEXT",
        "QUERY_EMBEDDING_FAILED",
        "VECTOR_SEARCH_FAILED",
        "LEXICAL_SEARCH_FAILED",
      ].includes(retrieval.status);
      if (input.retrieval.fallbackPolicy === "REGISTRY_ONLY" && safe) {
        const base = await this.d.registryGeneration.generate(input.drafting);
        const converted = fromRegistry(base, true, retrieval.status, retrieval);
        return converted;
      }
      return result(
        retrieval.status === "NO_CONTEXT" ? "NO_CONTEXT" : "RETRIEVAL_FAILED",
        input.knowledgeMode,
        retrieval,
      );
    }
    const context = retrieval.context;
    if (!context || context.passages.length === 0)
      return result("NO_CONTEXT", input.knowledgeMode, retrieval);
    const prompt = prompts.build(input.drafting, context),
      messages = prompts.messages(prompt);
    let model;
    try {
      deadline?.enter("GENERATION");
      model = await this.d.port.generate(
        {
          correlationId: input.drafting.generationAttemptId,
          schemaId: "TEMPLATE_DRAFT_CANDIDATE",
          schemaVersion: input.drafting.candidateSchemaVersion,
          messages,
          context: prompt as any,
        },
        deadline ? { signal: deadline.signal } : undefined,
      );
      if (model.providerOutcome) {
        providerObserver?.record("RAG_GENERATION", model.providerOutcome);
      }
      deadline?.complete("GENERATION");
      deadline?.throwIfExpired("VALIDATION");
    } catch (error) {
      deadline?.complete("GENERATION");
      if (deadline?.signal.aborted) throw error;
      return result(
        "GENERATION_PROVIDER_FAILED",
        input.knowledgeMode,
        retrieval,
      );
    }
    if (!model.completed)
      return result(
        "GENERATION_PROVIDER_FAILED",
        input.knowledgeMode,
        retrieval,
      );
    let raw: unknown = model.output;
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch {
        return result(
          "GENERATION_SCHEMA_FAILED",
          input.knowledgeMode,
          retrieval,
        );
      }
    }
    const parsed = templateDraftCandidateSchema.safeParse(raw);
    if (!parsed.success)
      return result("GENERATION_SCHEMA_FAILED", input.knowledgeMode, retrieval);
    const candidate = parsed.data as unknown as TemplateDraftCandidate;
    deadline?.enter("VALIDATION");
    const checked = this.d.validator.validate({
      draftingRequest: input.drafting.draftingRequest,
      candidate,
      projection: input.drafting.registryProjection,
      currentAuthorities: input.drafting.currentAuthorities,
      validationPolicy: input.drafting.currentAuthorities.validationPolicy,
    });
    const citations = citationService.validate(
      candidate.citationReferences,
      context,
    );
    const contradictions = contradictionsService.analyze({
      candidate,
      projection: input.drafting.registryProjection,
      validation: checked.report,
      citations,
    });
    const baseReview = this.d.baseReviews.project({
      reportId: `${input.drafting.generationAttemptId}_REVIEW`,
      request: input.drafting.draftingRequest,
      candidate,
      validatedCandidate: checked.validatedCandidate,
      validation: checked.report,
      projection: input.drafting.registryProjection,
      promptId: input.drafting.promptIdentity.promptId,
      promptVersion: input.drafting.promptIdentity.promptVersion,
    });
    const review = reviewService.project({
      reportId: `${input.drafting.generationAttemptId}_RAG_REVIEW`,
      mode: input.knowledgeMode,
      baseReview,
      retrieval,
      citations,
      contradictions,
      fallbackUsed: false,
    });
    deadline?.complete("VALIDATION");
    const invalid = citations.filter((c) => !c.claimValid).length;
    let status: RagTemplateDraftGenerationResult["status"] =
      checked.report.outcome === "VALIDATION_FAILED"
        ? "CANDIDATE_VALIDATION_FAILED"
        : checked.report.outcome === "UNSUPPORTED_REQUEST"
          ? "UNSUPPORTED_REQUEST"
          : invalid ||
              contradictions.length ||
              checked.report.outcome === "PARTIAL"
            ? "PARTIAL"
            : "COMPLETED";
    if (
      invalid &&
      citations.length === invalid &&
      checked.validatedCandidate.supportedBindings.length === 0
    )
      status = "CITATION_VALIDATION_FAILED";
    const lineage = {
      requestId: input.drafting.requestId,
      generationAttemptId: input.drafting.generationAttemptId,
      provider: model.provider,
      model: model.model,
      promptId: input.drafting.promptIdentity.promptId,
      promptVersion: input.drafting.promptIdentity.promptVersion,
      candidateSchemaVersion: input.drafting.candidateSchemaVersion,
      registryProjectionId: input.drafting.registryProjection.projectionId,
      registryProjectionVersion:
        input.drafting.registryProjection.projectionVersion,
      registryProjectionDigest:
        input.drafting.registryProjection.canonicalDigest,
      requestedAt: new Date(input.drafting.requestedAt.getTime()),
      completedAt: new Date(model.completedAt.getTime()),
    };
    return freezeClone({
      status,
      knowledgeMode: input.knowledgeMode,
      fallbackUsed: false,
      retrieval,
      retrievalContext: context,
      candidate,
      validation: checked.report,
      validatedCandidate: checked.validatedCandidate,
      citations,
      contradictions,
      reviewReport: review,
      generationLineage: lineage,
      summary: summary(
        context.passages.length,
        citations,
        checked.validatedCandidate.supportedBindings.length,
        checked.validatedCandidate.unresolvedConcepts.length,
        contradictions.length,
      ),
    });
  }
}
const valid = (i: RagTemplateDraftGenerationRequest) =>
  !!i &&
  i.requestId === i.drafting?.requestId &&
  Number.isSafeInteger(i.requestVersion) &&
  i.requestVersion > 0 &&
  ((i.knowledgeMode === "REGISTRY_ONLY" && !i.retrieval) ||
    (i.knowledgeMode === "REGISTRY_PLUS_PLATFORM_KNOWLEDGE" &&
      !!i.retrieval &&
      i.retrieval.eligibleDocuments.length > 0 &&
      i.retrieval.asOf instanceof Date &&
      Number.isFinite(i.retrieval.asOf.getTime())));
const summary = (
  passages = 0,
  citations: readonly { claimValid: boolean }[] = [],
  supported = 0,
  unresolved = 0,
  contradictions = 0,
) => ({
  selectedPassages: passages,
  citationCount: citations.length,
  validCitations: citations.filter((c) => c.claimValid).length,
  invalidCitations: citations.filter((c) => !c.claimValid).length,
  supportedConcepts: supported,
  unresolvedConcepts: unresolved,
  contradictions,
});
const result = (
  status: RagTemplateDraftGenerationResult["status"],
  knowledgeMode: RagTemplateDraftGenerationResult["knowledgeMode"],
  retrieval: any = null,
): RagTemplateDraftGenerationResult =>
  freezeClone({
    status,
    knowledgeMode,
    fallbackUsed: false,
    retrieval,
    retrievalContext: retrieval?.context ?? null,
    citations: [],
    contradictions: [],
    summary: summary(),
  });
const fromRegistry = (
  base: any,
  fallbackUsed = false,
  fallbackReason?: string,
  retrieval: any = null,
): RagTemplateDraftGenerationResult => {
  const ok = base.status === "COMPLETED" || base.status === "PARTIAL";
  return freezeClone({
    status:
      base.status === "FEATURE_DISABLED"
        ? "FEATURE_DISABLED"
        : base.status === "PROVIDER_FAILED"
          ? "GENERATION_PROVIDER_FAILED"
          : base.status === "UNSUPPORTED_REQUEST"
            ? "UNSUPPORTED_REQUEST"
            : base.status === "VALIDATION_FAILED"
              ? "CANDIDATE_VALIDATION_FAILED"
              : base.status,
    knowledgeMode: "REGISTRY_ONLY",
    fallbackUsed,
    ...(fallbackReason ? { fallbackReason } : {}),
    retrieval,
    retrievalContext: null,
    ...(ok
      ? {
          candidate: base.candidate,
          validation: base.validation,
          validatedCandidate: base.validatedCandidate,
          generationLineage: base.generationLineage,
        }
      : {}),
    citations: [],
    contradictions: [],
    summary: summary(
      0,
      [],
      ok ? base.validatedCandidate.supportedBindings.length : 0,
      ok ? base.validatedCandidate.unresolvedConcepts.length : 0,
      0,
    ),
  });
};
