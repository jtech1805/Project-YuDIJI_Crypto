import type { CompiledExecutionRequestFailureCode } from "./compiled-execution-request.types.js";
import type { CompiledFactorInput, CompiledInputFreshness } from "./compiled-factor-input.types.js";
import type { CompiledObservationSelectionFailureCode } from "./compiled-observation-selection.types.js";
import type { CompiledObservationAttestationFailureCode, CompiledShadowObservation } from "./compiled-shadow-observation.types.js";
import type { CompiledFactorBinding, CompiledFixedSubject, CompiledRulebookIdentity } from "./compiled-rulebook.types.js";

export type CompiledSubjectResolutionFailureCode =
  | "INVALID_COMPILED_SUBJECT_BINDING"
  | "MISSING_TRADED_INSTRUMENT"
  | "INVALID_TRADED_INSTRUMENT"
  | "MISSING_UNDERLYING_ASSET"
  | "INVALID_UNDERLYING_ASSET";

export type CompiledSubjectResolutionResult =
  | Readonly<{ resolved: true; subject: CompiledFixedSubject }>
  | Readonly<{ resolved: false; code: CompiledSubjectResolutionFailureCode }>;

export type CompiledShadowInputAssemblyFailureCode =
  | CompiledExecutionRequestFailureCode
  | CompiledSubjectResolutionFailureCode
  | CompiledObservationSelectionFailureCode
  | "OBSERVATION_ATTESTATION_FAILED"
  | "FACTOR_DEFINITION_NOT_FOUND"
  | "FACTOR_DEFINITION_NOT_COMPILE_ELIGIBLE"
  | "FACTOR_SUBJECT_NOT_ALLOWED"
  | "FACTOR_UNIT_NOT_ALLOWED"
  | "OBSERVATION_IN_FUTURE"
  | "STALE_OBSERVATION"
  | "INVALID_FRESHNESS_POLICY";

export type ResolvedExecutionInput = Readonly<{
  rulebook: CompiledRulebookIdentity;
  binding: CompiledFactorBinding;
  resolvedSubject: CompiledFixedSubject;
  selectedObservation: CompiledShadowObservation;
  freshness: CompiledInputFreshness;
  input: CompiledFactorInput;
  lineage: Readonly<{
    factor: CompiledFactorBinding["factor"];
    evaluator: CompiledFactorBinding["evaluator"];
    provider: CompiledFactorBinding["provider"];
    executionPolicies: CompiledFactorBinding["executionPolicies"];
  }>;
}>;

export type CompiledShadowInputAssemblyResult =
  | Readonly<{ resolved: true; value: ResolvedExecutionInput }>
  | Readonly<{
      resolved: false;
      code: CompiledShadowInputAssemblyFailureCode;
      attestationCode?: CompiledObservationAttestationFailureCode;
    }>;

