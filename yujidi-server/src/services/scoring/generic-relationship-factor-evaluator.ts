import type { DeterministicFactorEvaluator } from "../../ports/deterministic-factor-evaluator.port.js";
import type { FactorEvaluatorExecutionResult } from "../../types/factor-evaluator.types.js";
import type { AssembledFactorInput } from "../../types/factor-input-assembly.types.js";
import type {
  GenericConditionalBindingValidationResult,
  GenericRelationshipEvaluatorConfiguration,
} from "../../types/generic-relationship-evaluator.types.js";
import {
  calculateGenericRelationship,
  validateGenericRelationshipConfiguration,
} from "./generic-relationship-calculation-core.js";
import type {
  GenericFactorRelationshipType,
} from "../../types/generic-factor-relationship.types.js";

export { validateGenericRelationshipConfiguration } from "./generic-relationship-calculation-core.js";

export const GENERIC_RELATIONSHIP_FACTOR_EVALUATOR_ID =
  "GENERIC_RELATIONSHIP_FACTOR_EVALUATOR";

export class GenericRelationshipFactorEvaluator
implements DeterministicFactorEvaluator {
  public readonly evaluatorId = GENERIC_RELATIONSHIP_FACTOR_EVALUATOR_ID;
  public readonly evaluatorVersion = 1;
  public readonly configurationVersion = 1;
  public readonly supportedFactorKeys = Object.freeze([
    "CRYPTO.ETF_NET_FLOW",
  ] as const);
  public readonly supportedRelationshipTypes = Object.freeze([
    "DIRECT", "INVERSE",
  ] as const);

  public constructor(
    private readonly configuration: GenericRelationshipEvaluatorConfiguration,
  ) {}

  public evaluate(input: AssembledFactorInput): FactorEvaluatorExecutionResult {
    const calculation = calculateGenericRelationship({ configuration: this.configuration, factorKey: input.factorKey,
      valueType: input.value.type, value: input.value.value, unit: input.value.unit });
    if (!calculation.calculated) return failure(input, calculation.code);
    const { outcome, contribution, reasonCode, diagnostics } = calculation;

    return Object.freeze({
      evaluated: true,
      result: Object.freeze({
        evaluator: Object.freeze({
          evaluatorId: this.evaluatorId,
          evaluatorVersion: this.evaluatorVersion,
          configurationVersion: this.configurationVersion,
        }),
        factorKey: input.factorKey,
        subject: Object.freeze({ ...input.subject }),
        outcome,
        contribution,
        reasonCode,
        evidence: Object.freeze({
          evidenceId: input.evidenceId,
          factorDefinitionVersion: input.factorDefinitionVersion,
          source: Object.freeze({
            sourceType: input.source.sourceType,
            provider: input.source.provider,
            sourceId: input.source.sourceId,
          }),
          observedAt: new Date(input.observedAt.getTime()),
          evaluatedAt: new Date(input.evaluatedAt.getTime()),
        }),
        diagnostics,
      }),
    });
  }
}

export const validateGenericConditionalBinding = (
  condition: unknown,
): GenericConditionalBindingValidationResult => typeof condition === "boolean"
  ? Object.freeze({ valid: true, condition, executionStatus: "DEFERRED", reasonCode: "CONDITIONAL_EXECUTION_DEFERRED" })
  : Object.freeze({ valid: false, condition: null, executionStatus: "DEFERRED", reasonCode: "CONDITION_BINDING_REQUIRED" });

const failure = (
  input: AssembledFactorInput,
  code: Extract<FactorEvaluatorExecutionResult, { evaluated: false }>["code"],
): FactorEvaluatorExecutionResult => Object.freeze({
  evaluated: false,
  evaluatorId: GENERIC_RELATIONSHIP_FACTOR_EVALUATOR_ID,
  factorKey: typeof input?.factorKey === "string" ? input.factorKey : null,
  code,
});
