import type { CompiledBindingDisposition, CompiledBindingInputState } from "./compiled-rulebook-runtime.types.js";
import type { CompiledEvaluatorExecutionResult, CompiledRawEvaluatorResult } from "./compiled-evaluator.types.js";
import type { CompiledInputFreshness } from "./compiled-factor-input.types.js";
import type { CompiledObservationAttestationFailureCode, CompiledShadowObservation } from "./compiled-shadow-observation.types.js";
import type { CompiledFactorBinding, CompiledFixedSubject, CompiledRulebookIdentity } from "./compiled-rulebook.types.js";
import type { CompiledShadowInputAssemblyFailureCode, CompiledShadowInputAssemblyResult, ResolvedExecutionInput } from "./resolved-execution-input.types.js";

export const COMPILED_BINDING_EXECUTION_FAILURE_CODES = Object.freeze([
  "INVALID_RESOLVED_EXECUTION_INPUT", "RESOLVED_RULEBOOK_LINEAGE_MISMATCH", "RESOLVED_BINDING_LINEAGE_MISMATCH",
  "RESOLVED_FACTOR_INPUT_MISMATCH", "RESOLVED_PROVIDER_ATTESTATION_MISMATCH", "EVALUATOR_DECLARATION_NOT_FOUND",
  "EVALUATOR_DECLARATION_NOT_COMPILE_ELIGIBLE", "EVALUATOR_FACTOR_NOT_SUPPORTED", "EVALUATOR_RELATIONSHIP_NOT_SUPPORTED",
  "EVALUATOR_CONFIGURATION_NOT_FOUND", "EVALUATOR_CONFIGURATION_NOT_COMPILE_ELIGIBLE", "EVALUATOR_CONFIGURATION_LINEAGE_MISMATCH",
  "EVALUATOR_CONFIGURATION_FACTOR_NOT_SUPPORTED", "EVALUATOR_CONFIGURATION_RELATIONSHIP_NOT_SUPPORTED",
  "EVALUATOR_CONFIGURATION_RELATIONSHIP_MISMATCH", "EVALUATOR_IMPLEMENTATION_NOT_FOUND", "EVALUATOR_IMPLEMENTATION_IDENTITY_MISMATCH",
  "EVALUATOR_EXECUTION_FAILED", "INVALID_EVALUATOR_RESULT", "INVALID_CONTRIBUTION_BOUNDS", "INVALID_BINDING_SCORE", "INVALID_BINDING_DISPOSITION",
] as const);
export type CompiledBindingExecutionFailureCode = (typeof COMPILED_BINDING_EXECUTION_FAILURE_CODES)[number];

export type CompiledBindingExecutionResult = Readonly<{
  rulebook: CompiledRulebookIdentity;
  bindingId: string;
  bindingOrder: number;
  binding: CompiledFactorBinding;
  lineage: Readonly<{ factor: CompiledFactorBinding["factor"]; evaluator: CompiledFactorBinding["evaluator"]; provider: CompiledFactorBinding["provider"]; executionPolicies: CompiledFactorBinding["executionPolicies"] }>;
  resolvedSubject: CompiledFixedSubject | null;
  providerAttestation: CompiledShadowObservation["providerAttestation"] | null;
  relationshipType: CompiledFactorBinding["relationshipType"];
  requirementLevel: CompiledFactorBinding["requirementLevel"];
  optionalBehavior: CompiledFactorBinding["optionalBehavior"];
  weight: number;
  inputState: CompiledBindingInputState;
  disposition: CompiledBindingDisposition;
  executionStatus: "EXECUTED" | "NOT_EXECUTED";
  confidence: number | null;
  freshness: CompiledInputFreshness | null;
  observedAt: Date | null;
  evaluatedAt: Date | null;
  rawEvaluatorResult: CompiledRawEvaluatorResult | null;
  bindingScore: number | null;
  preparationFailureCode: CompiledShadowInputAssemblyFailureCode | null;
  attestationFailureCode: CompiledObservationAttestationFailureCode | null;
  executionFailureCode: CompiledBindingExecutionFailureCode | null;
}>;

export type CompiledBindingExecutionServiceResult =
  | Readonly<{ produced: true; result: CompiledBindingExecutionResult }>
  | Readonly<{ produced: false; code: "INVALID_RESOLVED_EXECUTION_INPUT" }>;
export type CompiledBindingExecutionPreparationRequest = Readonly<{ rulebook: CompiledRulebookIdentity; binding: CompiledFactorBinding; preparation: CompiledShadowInputAssemblyResult }>;
export type CompiledBindingExecutionRequest = ResolvedExecutionInput;
export type CompiledRawEvaluatorValidationResult = Readonly<{ valid: true; result: CompiledRawEvaluatorResult }> | Readonly<{ valid: false; code: "INVALID_EVALUATOR_RESULT" | "INVALID_CONTRIBUTION_BOUNDS" }>;
export type CompiledEvaluatorInvocationResult = CompiledEvaluatorExecutionResult;

