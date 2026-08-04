import type { CompiledEvaluatorExecutionRequest, CompiledEvaluatorExecutionResult, CompiledEvaluatorIdentity } from "../types/compiled-evaluator.types.js";

export interface CompiledDeterministicEvaluator extends CompiledEvaluatorIdentity {
  evaluate(request: CompiledEvaluatorExecutionRequest): CompiledEvaluatorExecutionResult;
}

