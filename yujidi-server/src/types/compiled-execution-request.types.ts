import type { CompiledRulebookIdentity, CompiledFixedSubject } from "./compiled-rulebook.types.js";
import type { CompiledShadowObservation } from "./compiled-shadow-observation.types.js";

export const MAX_COMPILED_EXECUTION_OBSERVATIONS = 100;

export type CompiledExecutionSubjectContext = Readonly<{
  tradedInstrument: CompiledFixedSubject | null;
  underlyingAsset: CompiledFixedSubject | null;
}>;

export type CompiledExecutionRequest = Readonly<{
  rulebook: CompiledRulebookIdentity;
  asOf: Date;
  subjectContext: CompiledExecutionSubjectContext;
  observations: readonly CompiledShadowObservation[];
}>;

export type CompiledExecutionRequestFailureCode =
  | "INVALID_EXECUTION_REQUEST"
  | "INVALID_RULEBOOK_IDENTITY"
  | "INVALID_EXECUTION_AS_OF"
  | "INVALID_SUBJECT_CONTEXT"
  | "INVALID_OBSERVATION_COLLECTION"
  | "EMPTY_OBSERVATION_COLLECTION"
  | "TOO_MANY_OBSERVATIONS";

