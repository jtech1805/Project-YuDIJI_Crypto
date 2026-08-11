import type { TemplateDraftPromptApplicationResult } from "../types/template-draft-intent.types.js";
import type {
  CopilotConceptPreview,
  CopilotTemplateDraftResult,
} from "../types/copilot-template-draft.types.js";
import { freezeClone } from "./knowledge-document-admission.service.js";

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

    const candidate = selectCandidate(result);
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
    const interpreted = candidate.interpretedRequest;
    return freezeClone({
      status: supportedConcepts.length === 0 ? "unsupported" : "success",
      draft: {
        preview: true as const,
        authority: "NON_AUTHORITATIVE_PREVIEW" as const,
        subject: result.intent.subject,
        ...(interpreted?.title ? { title: interpreted.title } : {}),
        ...(interpreted?.description
          ? { description: interpreted.description }
          : {}),
        supportedConcepts,
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
): ValidatedCandidate | null =>
  (result.draft.ragShadow?.ragResult?.validatedCandidate as
    | ValidatedCandidate
    | undefined) ??
  (result.draft.authoritativeBaseline?.validatedCandidate as
    | ValidatedCandidate
    | undefined) ??
  null;

const mapFailure = (
  code: Extract<TemplateDraftPromptApplicationResult, { status: "error" }>["code"],
): Extract<CopilotTemplateDraftResult, { status: "unavailable" }>["code"] => {
  if (code === "INVALID_REQUEST") return "INVALID_REQUEST";
  if (code === "REQUEST_TIMEOUT") return "REQUEST_TIMEOUT";
  if (code === "CALLER_ABORTED") return "CALLER_CANCELLED";
  return "COPILOT_UNAVAILABLE";
};
