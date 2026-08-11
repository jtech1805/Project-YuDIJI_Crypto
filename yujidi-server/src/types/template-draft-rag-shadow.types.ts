import type {
  RagTemplateDraftGenerationRequest,
  RagTemplateDraftGenerationResult,
} from "./template-draft-rag.types.js";
export type RagRuntimeFeatures = Readonly<{
  aiTemplateGenerationEnabled: boolean;
  knowledgeRetrievalEnabled: boolean;
  ragTemplateDraftingEnabled: boolean;
  killSwitch: boolean;
}>;
export type TemplateDraftRagShadowRequest = Readonly<{
  bindingId: string;
  bindingVersion: number;
  caller: Readonly<{
    userId: string;
    tenantId?: string;
    isInternal: boolean;
    rolloutCohort?: string;
  }>;
  request: RagTemplateDraftGenerationRequest;
  authoritativeResult: unknown;
  features: RagRuntimeFeatures;
  requestedAt: Date;
}>;
export const TEMPLATE_DRAFT_RAG_SHADOW_COMPARISON_OUTCOMES = [
  "MATCH",
  "DIFFERENT_BUT_SAFE",
  "RAG_SAFETY_REGRESSION",
  "NOT_COMPARABLE",
] as const;
export type TemplateDraftRagShadowComparisonOutcome =
  (typeof TEMPLATE_DRAFT_RAG_SHADOW_COMPARISON_OUTCOMES)[number];
export type TemplateDraftRagShadowComparison = Readonly<{
  outcome: TemplateDraftRagShadowComparisonOutcome;
  supportedConceptAgreement: number;
  unresolvedConceptRetention: number;
  inventedFactorCount: number;
  silentSubstitutionCount: number;
  registryOverruleCount: number;
  aiWeightAcceptanceCount: number;
  citationCoverage: number;
  citationValidity: number;
  promptInjectionAcceptanceCount: number;
}>;
export type TemplateDraftRagRuntimeTrace = Readonly<{
  bindingId?: string;
  bindingVersion?: number;
  indexPublicationId?: string;
  indexPublicationVersion?: number;
  rolloutMode?: string;
  featureControls: RagRuntimeFeatures;
  budgetDecision: "NOT_REACHED" | "ALLOWED" | "DENIED";
  concurrencyDecision: "NOT_REACHED" | "ACQUIRED" | "DENIED";
  circuitStates: Readonly<Record<string, string>>;
  totalLatencyMs: number;
  contextPassageCount: number;
  citationCount: number;
  validCitationCount: number;
  provider?: string | null;
  model?: string | null;
  registryOnlyOutcome?: string;
  ragOutcome?: string;
  comparisonOutcome?: TemplateDraftRagShadowComparisonOutcome;
  failureCode?: string;
}>;
export type TemplateDraftRagShadowResult = Readonly<{
  status: "COMPLETED" | "SKIPPED" | "FAILED";
  reason?: string;
  authoritativeResultUntouched: true;
  ragResult?: RagTemplateDraftGenerationResult;
  comparison?: TemplateDraftRagShadowComparison;
  trace: TemplateDraftRagRuntimeTrace;
}>;
