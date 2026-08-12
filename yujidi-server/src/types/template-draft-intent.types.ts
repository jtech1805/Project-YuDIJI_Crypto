import type { DraftSubjectCandidate } from "./template-draft-candidate.types.js";
import type { InternalTemplateDraftRagApplicationResult } from "./internal-template-draft-rag.types.js";

export const TEMPLATE_DRAFT_INTENT_FAILURE_CODES = Object.freeze([
  "INVALID_REQUEST",
  "CALLER_ABORTED",
  "REQUEST_TIMEOUT",
  "NETWORK_FAILED",
  "PROVIDER_UNAVAILABLE",
  "RATE_LIMITED",
  "AUTHENTICATION_FAILED",
  "CONTENT_REJECTED",
  "SCHEMA_INVALID",
] as const);
export type TemplateDraftIntentFailureCode =
  (typeof TEMPLATE_DRAFT_INTENT_FAILURE_CODES)[number];

export type TemplateDraftIntentConcept = Readonly<{
  conceptId: string;
  label: string;
  registered: boolean;
}>;

export type TemplateDraftPartialIntent = Readonly<{
  subject?: DraftSubjectCandidate;
  requestedConcepts: readonly TemplateDraftIntentConcept[];
}>;

export type TemplateDraftIntentExtractionRequest = Readonly<{
  requestId: string;
  prompt: string;
}>;

export type TemplateDraftIntentExtractionResult =
  | Readonly<{
      status: "COMPLETED" | "UNSUPPORTED_REQUEST";
      subject: DraftSubjectCandidate;
      requestedConcepts: readonly TemplateDraftIntentConcept[];
      unresolvedConcepts: readonly TemplateDraftIntentConcept[];
    }>
  | Readonly<{
      status: "NEEDS_CLARIFICATION";
      clarificationQuestions: readonly string[];
      partialIntent?: TemplateDraftPartialIntent;
    }>
  | Readonly<{ status: "FAILED"; code: TemplateDraftIntentFailureCode }>;

export type TemplateDraftPromptRequest = Readonly<{ prompt: string }>;
export type TemplateDraftPromptApplicationResult =
  | Readonly<{
      status: "success";
      intent: Readonly<{
        subject: DraftSubjectCandidate;
        requestedConcepts: readonly TemplateDraftIntentConcept[];
      }>;
      draft: InternalTemplateDraftRagApplicationResult;
    }>
  | Readonly<{
      status: "needs_clarification";
      questions: readonly string[];
      partialIntent?: TemplateDraftPartialIntent;
    }>
  | Readonly<{
      status: "error";
      code: TemplateDraftIntentFailureCode;
    }>;

export type TemplateDraftIntentModelOutput = Readonly<{
  subject: Readonly<{
    type: string;
    key: string;
    displayName?: string | undefined;
  }> | null;
  concepts: readonly Readonly<{
    sourceText: string;
    candidateConceptId: string | null;
  }>[];
  clarificationQuestions: readonly string[];
}>;

export type TemplateDraftIntentModelPort = Readonly<{
  extract(
    request: Readonly<{
      correlationId: string;
      prompt: string;
      conceptVocabulary: readonly Readonly<{
        conceptId: string;
        labels: readonly string[];
      }>[];
      subjectVocabulary: readonly Readonly<{
        type: string;
        key: string;
        labels: readonly string[];
      }>[];
    }>,
    execution?: Readonly<{ signal: AbortSignal }>,
  ): Promise<
    | Readonly<{ completed: true; output: unknown }>
    | Readonly<{ completed: false; code: TemplateDraftIntentFailureCode }>
  >;
}>;
