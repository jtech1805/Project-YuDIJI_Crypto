import type { TemplateDraftPromptApplicationResult } from "../../types/template-draft-intent.types.js";
import type {
  CopilotBindingPreview,
  CopilotDraftReviewHandle,
  CopilotConceptPreview,
  CopilotTemplateDraftResult,
} from "../../types/copilot-template-draft.types.js";
import type { TemplateDraftGenerationResult } from "../../types/template-draft-generation.types.js";
import { freezeClone } from "../knowledge/knowledge-document-admission.service.js";

type ValidatedCandidate = Readonly<{
  interpretedRequest?: Readonly<{
    title?: string;
    description?: string;
  }>;
  supportedBindings?: readonly Readonly<{
    requestedConceptIds: readonly string[];
    weightStatus?: string;
  }>[];
  unresolvedConcepts?: readonly Readonly<{ conceptId: string }>[];
}>;

export class CopilotTemplateDraftResponseService {
  public project(
    result: TemplateDraftPromptApplicationResult,
    persistable?: Readonly<{
      generation: TemplateDraftGenerationResult;
      review: CopilotDraftReviewHandle;
      bindings: readonly CopilotBindingPreview[];
    }>,
  ): CopilotTemplateDraftResult {
    if (result.status === "needs_clarification")
      return freezeClone({
        status: "needs_clarification" as const,
        questions: result.questions,
      });
    if (result.status === "error")
      return Object.freeze({
        status: "unavailable",
        code: mapFailure(result.code),
      });

    const candidate = persistable && (persistable.generation.status === "COMPLETED" || persistable.generation.status === "PARTIAL")
      ? persistable.generation.validatedCandidate
      : selectCandidate(result);
    if (
      !candidate &&
      result.intent.requestedConcepts.every((concept) => !concept.registered)
    )
      return freezeClone({
        status: "unsupported" as const,
        draft: {
          preview: true as const,
          authority: "NON_AUTHORITATIVE_PREVIEW" as const,
          subject: result.intent.subject,
          supportedConcepts: [],
          bindings: [],
          unresolvedConcepts: result.intent.requestedConcepts.map(
            ({ conceptId, label }) => ({ conceptId, label }),
          ),
          requiresUserWeights: false,
        },
      });
    if (!candidate)
      return Object.freeze({
        status: "unavailable",
        code: "COPILOT_UNAVAILABLE",
      });
    const supportedIds = new Set(
      (candidate.supportedBindings ?? []).flatMap(
        (binding) => binding.requestedConceptIds,
      ),
    );
    const unresolvedIds = new Set([
      ...(candidate.unresolvedConcepts ?? []).map((concept) => concept.conceptId),
      ...result.intent.requestedConcepts
        .filter((concept) => !concept.registered)
        .map((concept) => concept.conceptId),
    ]);
    const concept = (conceptId: string): CopilotConceptPreview | null => {
      const requested = result.intent.requestedConcepts.find(
        (item) => item.conceptId === conceptId,
      );
      return requested
        ? { conceptId: requested.conceptId, label: requested.label }
        : null;
    };
    const supportedConcepts = [...supportedIds]
      .map(concept)
      .filter((value): value is CopilotConceptPreview => value !== null);
    const unresolvedConcepts = [...unresolvedIds]
      .filter((conceptId) => !supportedIds.has(conceptId))
      .map(concept)
      .filter((value): value is CopilotConceptPreview => value !== null);
    if (supportedConcepts.length > 0 && !persistable)
      return Object.freeze({ status: "unavailable", code: "COPILOT_UNAVAILABLE" });
    const interpreted = candidate.interpretedRequest;
    if (supportedConcepts.length === 0)
      return freezeClone({
        status: "unsupported" as const,
        draft: {
          preview: true as const,
          authority: "NON_AUTHORITATIVE_PREVIEW" as const,
          subject: result.intent.subject,
          ...(interpreted?.title ? { title: interpreted.title } : {}),
          ...(interpreted?.description ? { description: interpreted.description } : {}),
          supportedConcepts,
          bindings: [],
          unresolvedConcepts,
          requiresUserWeights: false,
        },
      });
    return freezeClone({
      status: "success" as const,
      review: persistable!.review,
      draft: {
        preview: true as const,
        authority: "NON_AUTHORITATIVE_PREVIEW" as const,
        subject: result.intent.subject,
        ...(interpreted?.title ? { title: interpreted.title } : {}),
        ...(interpreted?.description
          ? { description: interpreted.description }
          : {}),
        supportedConcepts,
        bindings: persistable!.bindings,
        unresolvedConcepts,
        requiresUserWeights: (candidate.supportedBindings ?? []).some(
          (binding) => binding.weightStatus === "REQUIRES_USER_INPUT",
        ),
      },
    });
  }
}

const selectCandidate = (
  result: Extract<TemplateDraftPromptApplicationResult, { status: "success" }>,
): ValidatedCandidate | null => {
  const baseline = result.draft.authoritativeBaseline;
  return (result.draft.ragShadow?.ragResult?.validatedCandidate as
    | ValidatedCandidate
    | undefined) ??
    (baseline?.status === "COMPLETED" || baseline?.status === "PARTIAL"
      ? baseline.validatedCandidate
      : undefined) ??
    null;
};

const mapFailure = (
  code: Extract<TemplateDraftPromptApplicationResult, { status: "error" }>["code"],
): Extract<CopilotTemplateDraftResult, { status: "unavailable" }>["code"] => {
  if (code === "INVALID_REQUEST") return "INVALID_REQUEST";
  if (code === "REQUEST_TIMEOUT") return "REQUEST_TIMEOUT";
  if (code === "CALLER_ABORTED") return "CALLER_CANCELLED";
  return "COPILOT_UNAVAILABLE";
};
