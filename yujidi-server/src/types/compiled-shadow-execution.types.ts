import type { CompiledLegacyParityPolicy, CompiledLegacyParityResult, LegacyParityInput } from "./compiled-legacy-parity.types.js";
import type { CompiledRulebookExecutionBinding, ExactSystemTemplateIdentity } from "./compiled-rulebook-execution-binding.types.js";
import type { CompiledExecutionResult } from "./compiled-rulebook-execution.types.js";
import type { CompiledShadowObservationAssemblyResult } from "./compiled-shadow-observation-assembly.types.js";
import type { CompiledFixedSubject, CompiledRulebookCompilationLineage, CompiledRulebookIdentity } from "./compiled-rulebook.types.js";

export const COMPILED_SHADOW_EXECUTION_STAGES = Object.freeze([
  "REQUEST_VALIDATION", "EXECUTION_BINDING_LOOKUP", "RULEBOOK_LOOKUP", "EVIDENCE_READ",
  "ATTESTATION_READ", "OBSERVATION_ASSEMBLY", "COMPILED_EXECUTION",
  "PARITY_POLICY_VALIDATION", "PARITY_COMPARISON",
] as const);
export type CompiledShadowExecutionStage = (typeof COMPILED_SHADOW_EXECUTION_STAGES)[number];

export const COMPILED_SHADOW_SKIP_REASONS = Object.freeze([
  "TEMPLATE_NOT_ELIGIBLE", "NO_EXECUTION_BINDING", "EXACT_RULEBOOK_NOT_FOUND",
  "NO_RELEVANT_EVIDENCE", "NO_USABLE_OBSERVATIONS", "ASSEMBLY_NOT_EXECUTABLE",
] as const);
export type CompiledShadowSkipReason = (typeof COMPILED_SHADOW_SKIP_REASONS)[number];

export type CompiledShadowExecutionRequestIdentity = Readonly<{
  shadowExecutionId: string;
  authoritativeScoreCheckId?: string;
  requestedAt: Date;
}>;

export type CompiledShadowExecutionRequest = Readonly<{
  sourceTemplate: ExactSystemTemplateIdentity;
  asOf: Date;
  tradedInstrument: CompiledFixedSubject;
  underlyingAsset?: CompiledFixedSubject;
  legacyResult?: LegacyParityInput;
  parityPolicy?: CompiledLegacyParityPolicy;
  legacyNumericEligibility?: Readonly<{ eligible: boolean; reasonCode: string | null }>;
  shadowExecutionIdentity: CompiledShadowExecutionRequestIdentity;
}>;

export type CompiledShadowExecutionIdentity = Readonly<{
  shadowExecutionId: string | null;
  authoritativeScoreCheckId: string | null;
  sourceTemplate: ExactSystemTemplateIdentity | null;
  executionBinding: Readonly<Pick<CompiledRulebookExecutionBinding, "bindingId" | "bindingVersion">> | null;
  compiledRulebook: CompiledRulebookIdentity | null;
  compilerLineage: CompiledRulebookCompilationLineage | null;
  asOf: Date | null;
  requestedAt: Date | null;
}>;

export type CompiledShadowExactBindingProjection = Readonly<{
  bindingId: string;
  bindingVersion: number;
  sourceTemplate: ExactSystemTemplateIdentity;
  compiledRulebook: CompiledRulebookIdentity;
}>;

export type CompiledShadowExactRulebookProjection = Readonly<{
  identity: CompiledRulebookIdentity;
  sourceTemplate: Readonly<{ templateId: string; templateVersion: number }>;
  compilation: CompiledRulebookCompilationLineage;
}>;

export type CompiledShadowParityOutcome =
  | Readonly<{ status: "COMPLETED"; result: CompiledLegacyParityResult }>
  | Readonly<{ status: "UNAVAILABLE"; stage: "PARITY_POLICY_VALIDATION" | "PARITY_COMPARISON"; reasonCode: string }>
  | Readonly<{ status: "NOT_REQUESTED" }>;

type ReachedShadowState = Readonly<{
  executionBinding?: CompiledShadowExactBindingProjection;
  compiledRulebook?: CompiledShadowExactRulebookProjection;
  assembly?: CompiledShadowObservationAssemblyResult;
  compiledExecution?: CompiledExecutionResult;
}>;

export type CompiledShadowExecutionOutcome =
  | (Readonly<{ status: "COMPLETED"; identity: CompiledShadowExecutionIdentity; executionBinding: CompiledShadowExactBindingProjection; compiledRulebook: CompiledShadowExactRulebookProjection; assembly: CompiledShadowObservationAssemblyResult; compiledExecution: CompiledExecutionResult; parity: CompiledShadowParityOutcome }> & ReachedShadowState)
  | (Readonly<{ status: "SKIPPED"; identity: CompiledShadowExecutionIdentity; stage: CompiledShadowExecutionStage; reasonCode: CompiledShadowSkipReason }> & ReachedShadowState)
  | (Readonly<{ status: "FAILED"; identity: CompiledShadowExecutionIdentity; stage: CompiledShadowExecutionStage; reasonCode: string }> & ReachedShadowState);
