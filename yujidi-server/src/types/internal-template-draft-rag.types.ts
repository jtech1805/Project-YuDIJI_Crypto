import type {
  DraftSubjectCandidate,
  RequestedDraftConcept,
} from "./template-draft-candidate.types.js";
import type { TemplateDraftDualPathExecutionResult } from "./template-draft-dual-path-execution.types.js";

export type InternalTemplateDraftRequest = Readonly<{
  requestId: string;
  requestText?: string;
  requestedConcepts: readonly Readonly<{
    conceptId: RequestedDraftConcept["conceptId"];
    label: RequestedDraftConcept["text"];
  }>[];
  subject: DraftSubjectCandidate;
  runtimeBindingId: string;
  runtimeBindingVersion: number;
}>;

export type InternalTemplateDraftRagApplicationResult = Readonly<{
  executionId: string;
  shadowOnly: true;
  authoritativeResultUntouched: true;
  status: TemplateDraftDualPathExecutionResult["status"];
  reason?: string;
  authoritativeBaseline?: TemplateDraftDualPathExecutionResult["authoritativeBaseline"];
  ragShadow?: TemplateDraftDualPathExecutionResult["shadow"];
  comparison?: TemplateDraftDualPathExecutionResult["comparison"];
  runtime: Readonly<{
    bindingId: string;
    bindingVersion: number;
    indexPublicationId?: string;
    indexPublicationVersion?: number;
  }>;
  telemetry: TemplateDraftDualPathExecutionResult["telemetry"];
}>;

export type InternalTemplateDraftRagAssemblyResult =
  | Readonly<{
      assembled: true;
      execution: import("./template-draft-dual-path-execution.types.js").TemplateDraftDualPathExecutionRequest;
    }>
  | Readonly<{
      assembled: false;
      code:
        | "INVALID_REQUEST"
        | "INVALID_SUBJECT"
        | "DUPLICATE_CONCEPT"
        | "RUNTIME_BINDING_UNAVAILABLE"
        | "PUBLICATION_UNAVAILABLE"
        | "NO_ELIGIBLE_DOCUMENTS";
    }>;
