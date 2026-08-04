import type { CompiledFactorInput } from "./compiled-factor-input.types.js";
import type { CompiledFixedSubject } from "./compiled-rulebook.types.js";
import type { EvaluatorConfigurationDefinition } from "./evaluator-configuration-registry.types.js";

export type CompiledEvaluatorIdentity = Readonly<{ implementationKey: string; evaluatorId: string; evaluatorVersion: number }>;
export type CompiledRawEvaluatorResult = Readonly<{
  evaluator: Readonly<{ evaluatorId: string; evaluatorVersion: number; configurationId: string; configurationVersion: number }>;
  factor: CompiledFactorInput["factor"];
  subject: CompiledFixedSubject;
  relationshipType: "DIRECT" | "INVERSE";
  outcome: "PASS" | "FAIL" | "NEUTRAL";
  contribution: Readonly<{ points: number; minimumPoints: number; maximumPoints: number }>;
  reasonCode: string;
  diagnostics: Readonly<Record<string, string | number | boolean | null>>;
  observedAt: Date;
  evaluatedAt: Date;
}>;
export type CompiledEvaluatorFailureCode = "INVALID_CONFIGURATION" | "UNSUPPORTED_FACTOR" | "UNSUPPORTED_VALUE_TYPE" | "INVALID_INPUT" | "UNSUPPORTED_RELATIONSHIP";
export type CompiledEvaluatorExecutionResult =
  | Readonly<{ evaluated: true; result: CompiledRawEvaluatorResult }>
  | Readonly<{ evaluated: false; code: CompiledEvaluatorFailureCode }>;
export type CompiledEvaluatorExecutionRequest = Readonly<{ input: CompiledFactorInput; configuration: EvaluatorConfigurationDefinition; relationshipType: "DIRECT" | "INVERSE" }>;

export const COMPILED_EVALUATOR_IMPLEMENTATION_REGISTRY_FAILURE_CODES = Object.freeze([
  "INVALID_IMPLEMENTATION_COLLECTION", "INVALID_IMPLEMENTATION", "DUPLICATE_IMPLEMENTATION",
] as const);
export type CompiledEvaluatorImplementationRegistryFailureCode = (typeof COMPILED_EVALUATOR_IMPLEMENTATION_REGISTRY_FAILURE_CODES)[number];
export class CompiledEvaluatorImplementationRegistryError extends Error {
  public constructor(public readonly code: CompiledEvaluatorImplementationRegistryFailureCode) {
    super(`Compiled evaluator implementation registry failed: ${code}`); this.name = "CompiledEvaluatorImplementationRegistryError";
  }
}

