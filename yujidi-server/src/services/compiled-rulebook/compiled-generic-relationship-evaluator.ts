import type { CompiledDeterministicEvaluator } from "../../ports/compiled-deterministic-evaluator.port.js";
import type { CompiledEvaluatorExecutionRequest, CompiledEvaluatorExecutionResult } from "../../types/compiled-evaluator.types.js";
import { calculateGenericRelationship } from "../scoring/generic-relationship-calculation-core.js";

export class CompiledGenericRelationshipEvaluator implements CompiledDeterministicEvaluator {
  public readonly implementationKey = "GENERIC_RELATIONSHIP_FACTOR_EVALUATOR";
  public readonly evaluatorId = "GENERIC_RELATIONSHIP_FACTOR_EVALUATOR";
  public readonly evaluatorVersion = 1;

  public evaluate(request: CompiledEvaluatorExecutionRequest): CompiledEvaluatorExecutionResult {
    if (request.relationshipType !== "DIRECT" && request.relationshipType !== "INVERSE") return fail("UNSUPPORTED_RELATIONSHIP");
    const configuration = request.configuration.configuration;
    const calculation = calculateGenericRelationship({ configuration, factorKey: request.input.factor.factorKey,
      valueType: request.input.value.type, value: request.input.value.value, unit: request.input.value.unit });
    if (!calculation.calculated) return fail(calculation.code);
    return Object.freeze({ evaluated: true, result: Object.freeze({
      evaluator: Object.freeze({ evaluatorId: this.evaluatorId, evaluatorVersion: this.evaluatorVersion,
        configurationId: request.configuration.configurationId, configurationVersion: request.configuration.configurationVersion }),
      factor: Object.freeze({ ...request.input.factor }), subject: Object.freeze({ ...request.input.subject }), relationshipType: request.relationshipType,
      outcome: calculation.outcome, contribution: Object.freeze({ ...calculation.contribution }), reasonCode: calculation.reasonCode,
      diagnostics: Object.freeze({ ...calculation.diagnostics }), observedAt: new Date(request.input.observedAt.getTime()), evaluatedAt: new Date(request.input.evaluatedAt.getTime()),
    }) });
  }
}
const fail = (code: Extract<CompiledEvaluatorExecutionResult, { evaluated: false }>["code"]): CompiledEvaluatorExecutionResult => Object.freeze({ evaluated: false, code });
