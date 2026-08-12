import type { DraftSubjectCandidate } from "./template-draft-candidate.types.js";

export type CopilotTemplateDraftRequest = Readonly<{ prompt: string }>;

export type CopilotConceptPreview = Readonly<{
  conceptId: string;
  label: string;
}>;

export type CopilotBindingPreview = Readonly<{
  bindingReviewId: string;
  label: string;
  relationship: "DIRECT" | "INVERSE";
}>;

export type CopilotDraftReviewHandle = Readonly<{
  reviewId: string;
  reviewVersion: 1;
  expiresAt: Date;
}>;

export type CopilotTemplateDraftPreview = Readonly<{
  preview: true;
  authority: "NON_AUTHORITATIVE_PREVIEW";
  subject: DraftSubjectCandidate;
  title?: string;
  description?: string;
  supportedConcepts: readonly CopilotConceptPreview[];
  bindings: readonly CopilotBindingPreview[];
  unresolvedConcepts: readonly CopilotConceptPreview[];
  requiresUserWeights: boolean;
}>;

export type CopilotTemplateDraftResult =
  | Readonly<{
      status: "success";
      review: CopilotDraftReviewHandle;
      draft: CopilotTemplateDraftPreview;
    }>
  | Readonly<{
      status: "unsupported";
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

export type CopilotDraftAcceptanceRequest = Readonly<{
  reviewVersion: number;
  template: Readonly<{
    baseTemplateKey: import("./scoring.types.js").ScoringTemplateKey;
    templateName: string;
    description?: string;
    marketType: import("./market-data.types.js").MarketType;
    tradeStyle: string;
    instrumentType: import("./market-data.types.js").InstrumentType;
  }>;
  acceptedBindings: readonly Readonly<{ bindingReviewId: string; weight: number }>[];
}>;

export type CopilotDraftAcceptanceResult =
  | Readonly<{
      status: "created";
      template: Readonly<{
        id: string;
        templateKey: string;
        version: number;
        scope: "USER";
        status: "DRAFT";
      }>;
    }>
  | Readonly<{
      status: "rejected";
      code:
        | "REVIEW_NOT_FOUND"
        | "REVIEW_EXPIRED"
        | "REVIEW_ALREADY_ACCEPTED"
        | "REVIEW_OWNER_MISMATCH"
        | "UNRESOLVED_CONCEPTS_PRESENT"
        | "INVALID_BINDING_SELECTION"
        | "INVALID_WEIGHT"
        | "STALE_GENERATION"
        | "ACCEPTANCE_REJECTED"
        | "PERSISTENCE_FAILED";
      template?: Readonly<{ id: string; templateKey: string; version: number }>;
    }>;
