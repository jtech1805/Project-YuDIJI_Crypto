import type { DraftSubjectCandidate } from "./template-draft-candidate.types.js";

export type CopilotTemplateDraftRequest = Readonly<{ prompt: string }>;

export type CopilotConceptPreview = Readonly<{
  conceptId: string;
  label: string;
}>;

export type CopilotTemplateDraftPreview = Readonly<{
  preview: true;
  authority: "NON_AUTHORITATIVE_PREVIEW";
  subject: DraftSubjectCandidate;
  title?: string;
  description?: string;
  supportedConcepts: readonly CopilotConceptPreview[];
  unresolvedConcepts: readonly CopilotConceptPreview[];
  requiresUserWeights: boolean;
}>;

export type CopilotTemplateDraftResult =
  | Readonly<{
      status: "success" | "unsupported";
      draft: CopilotTemplateDraftPreview;
    }>
  | Readonly<{
      status: "needs_clarification";
      questions: readonly string[];
    }>
  | Readonly<{
      status: "unavailable";
      code:
        | "COPILOT_UNAVAILABLE"
        | "INVALID_REQUEST"
        | "REQUEST_TIMEOUT"
        | "CALLER_CANCELLED";
    }>;
