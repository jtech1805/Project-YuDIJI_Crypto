import type { CompiledShadowObservation } from "./compiled-shadow-observation.types.js";

export type CompiledObservationSelectionFailureCode =
  | "INVALID_OBSERVATION_COLLECTION"
  | "INVALID_SHADOW_OBSERVATION"
  | "OBSERVATION_NOT_FOUND"
  | "DUPLICATE_OBSERVATION"
  | "AMBIGUOUS_OBSERVATION";

export type CompiledObservationSelectionResult =
  | Readonly<{ selected: true; observation: CompiledShadowObservation }>
  | Readonly<{ selected: false; code: CompiledObservationSelectionFailureCode }>;

