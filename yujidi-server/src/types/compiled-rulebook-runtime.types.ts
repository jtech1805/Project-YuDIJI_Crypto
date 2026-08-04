import type { CompiledFactorBinding } from "./compiled-rulebook.types.js";
export const COMPILED_BINDING_INPUT_STATES = Object.freeze(["AVAILABLE", "MISSING", "INVALID"] as const);
export type CompiledBindingInputState = (typeof COMPILED_BINDING_INPUT_STATES)[number];
export const COMPILED_BINDING_DISPOSITIONS = Object.freeze(["INCLUDED", "PARTIAL", "OMITTED", "BLOCKING"] as const);
export type CompiledBindingDisposition = (typeof COMPILED_BINDING_DISPOSITIONS)[number];
export type CompiledBindingDispositionResult =
  | Readonly<{ derived: true; disposition: CompiledBindingDisposition }>
  | Readonly<{ derived: false; code: "INVALID_COMPILED_BINDING_OUTCOME" }>;
export type CompiledRulebookBindingOutcome = Readonly<{
  binding: CompiledFactorBinding;
  inputState: CompiledBindingInputState;
  normalizedScore: number | null;
}>;
export type CompiledRulebookPolicyConsistencyResult =
  | Readonly<{ consistent: true; lineage: CompiledFactorBinding["executionPolicies"] }>
  | Readonly<{ consistent: false; code: "INVALID_BINDING_COLLECTION" | "INCONSISTENT_AGGREGATION_POLICY_LINEAGE" | "INCONSISTENT_NORMALIZATION_POLICY_LINEAGE" | "INCONSISTENT_DECISION_BAND_POLICY_LINEAGE" }>;
export type CompiledRulebookAggregationResult =
  | Readonly<{ aggregated: true; status: "COMPLETED" | "PARTIAL"; numerator: number; includedWeight: number; aggregate: number; partial: boolean }>
  | Readonly<{ aggregated: false; status: "BLOCKED" | "INSUFFICIENT_INPUT" | "FAILED"; numerator: number | null; includedWeight: number; aggregate: null; code: "MANDATORY_BINDING_BLOCKED" | "INSUFFICIENT_INCLUDED_WEIGHT" | "INVALID_COMPILED_AGGREGATION_POLICY" | "INVALID_COMPILED_BINDING_OUTCOME" | "INVALID_BINDING_ORDER" | "INVALID_BINDING_WEIGHT" | "INVALID_BINDING_SCORE" | "INCONSISTENT_AGGREGATION_POLICY_LINEAGE" | "INCONSISTENT_NORMALIZATION_POLICY_LINEAGE" | "INCONSISTENT_DECISION_BAND_POLICY_LINEAGE" }>;
