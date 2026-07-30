import type {
  FactorEvaluatorExecutionResult,
} from "../types/factor-evaluator.types.js";
import type { AssembledFactorInput } from "../types/factor-input-assembly.types.js";
import type { FactorKey } from "../types/factor-registry.types.js";

export interface DeterministicFactorEvaluator {
  readonly evaluatorId: string;
  readonly evaluatorVersion: number;
  readonly configurationVersion: number;
  readonly supportedFactorKeys: readonly FactorKey[];

  evaluate(input: AssembledFactorInput): FactorEvaluatorExecutionResult;
}
