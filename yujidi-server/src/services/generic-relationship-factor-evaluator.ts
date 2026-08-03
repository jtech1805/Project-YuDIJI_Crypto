import type { DeterministicFactorEvaluator } from "../ports/deterministic-factor-evaluator.port.js";
import type { FactorEvaluatorExecutionResult } from "../types/factor-evaluator.types.js";
import type { AssembledFactorInput } from "../types/factor-input-assembly.types.js";
import type {
  GenericRelationshipConfigurationValidationResult,
  GenericConditionalBindingValidationResult,
  GenericRelationshipEvaluatorConfiguration,
} from "../types/generic-relationship-evaluator.types.js";
import {
  classifyGenericFactorRelationship,
  type GenericFactorRelationshipType,
} from "../types/generic-factor-relationship.types.js";

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
    const validation = validateGenericRelationshipConfiguration(
      this.configuration,
      input.factorKey,
    );
    if (!validation.valid) return failure(input, "INVALID_CONFIGURATION");
    if (input.factorKey !== "CRYPTO.ETF_NET_FLOW") {
      return failure(input, "UNSUPPORTED_FACTOR");
    }
    if (input.value.type !== "NUMBER") {
      return failure(input, "UNSUPPORTED_VALUE_TYPE");
    }
    if (input.value.unit !== this.configuration.expectedUnit
      || !Number.isFinite(input.value.value)) {
      return failure(input, "INVALID_INPUT");
    }

    const band = classifyBand(input.value.value, this.configuration.thresholds);
    const directPoints = this.configuration.contributions[band];
    const points = directPoints === 0
      ? 0
      : this.configuration.relationshipType === "INVERSE"
        ? -directPoints
        : directPoints;
    const direction = points > 0 ? "POSITIVE" : points < 0 ? "NEGATIVE" : "NEUTRAL";
    const strength = band === "strongNegative" || band === "strongPositive"
      ? "STRONG_"
      : "";
    const relationship = this.configuration.relationshipType;

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
        outcome: points > 0 ? "PASS" : points < 0 ? "FAIL" : "NEUTRAL",
        contribution: Object.freeze({
          points,
          minimumPoints: this.configuration.minimumPoints,
          maximumPoints: this.configuration.maximumPoints,
        }),
        reasonCode: `${strength}${direction}_${relationship}_RELATIONSHIP`,
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
        diagnostics: Object.freeze({
          relationshipType: relationship,
          inputValue: input.value.value,
          inputUnit: input.value.unit,
        }),
      }),
    });
  }
}

export const validateGenericRelationshipConfiguration = (
  configuration: GenericRelationshipEvaluatorConfiguration,
  factorKey: unknown,
): GenericRelationshipConfigurationValidationResult => {
  const classification = classifyGenericFactorRelationship(configuration?.relationshipType);
  if (!classification || classification.supportState !== "SINGLE_FACTOR_EXECUTABLE") {
    return { valid: false, code: configuration?.relationshipType === "CONDITIONAL"
      ? "CONDITION_BINDING_REQUIRED" : "UNSUPPORTED_RELATIONSHIP" };
  }
  if (factorKey !== "CRYPTO.ETF_NET_FLOW") {
    return { valid: false, code: "UNSUPPORTED_FACTOR" };
  }
  if (configuration.expectedUnit !== "USD") return { valid: false, code: "INVALID_UNIT" };
  const t = configuration.thresholds;
  if (!t || ![t.strongNegativeMax, t.negativeMax, t.positiveMin, t.strongPositiveMin]
    .every(Number.isFinite)) return { valid: false, code: "NON_FINITE_THRESHOLD" };
  if (!(t.strongNegativeMax < t.negativeMax
    && t.negativeMax < t.positiveMin
    && t.positiveMin < t.strongPositiveMin)) {
    return { valid: false, code: "UNORDERED_THRESHOLDS" };
  }
  const c = configuration.contributions;
  if (!c || ![c.strongNegative, c.negative, c.neutral, c.positive, c.strongPositive]
    .every(Number.isFinite)) return { valid: false, code: "NON_FINITE_CONTRIBUTION" };
  if (!Number.isFinite(configuration.minimumPoints)
    || !Number.isFinite(configuration.maximumPoints)
    || configuration.minimumPoints > configuration.maximumPoints
    || c.neutral !== 0
    || Math.min(...Object.values(c)) < configuration.minimumPoints
    || Math.max(...Object.values(c)) > configuration.maximumPoints) {
    return { valid: false, code: "INVALID_CONTRIBUTION_BOUNDS" };
  }
  return { valid: true };
};

export const validateGenericConditionalBinding = (
  condition: unknown,
): GenericConditionalBindingValidationResult => typeof condition === "boolean"
  ? Object.freeze({ valid: true, condition, executionStatus: "DEFERRED", reasonCode: "CONDITIONAL_EXECUTION_DEFERRED" })
  : Object.freeze({ valid: false, condition: null, executionStatus: "DEFERRED", reasonCode: "CONDITION_BINDING_REQUIRED" });

const classifyBand = (
  value: number,
  thresholds: GenericRelationshipEvaluatorConfiguration["thresholds"],
): keyof GenericRelationshipEvaluatorConfiguration["contributions"] => {
  if (value <= thresholds.strongNegativeMax) return "strongNegative";
  if (value <= thresholds.negativeMax) return "negative";
  if (value >= thresholds.strongPositiveMin) return "strongPositive";
  if (value >= thresholds.positiveMin) return "positive";
  return "neutral";
};

const failure = (
  input: AssembledFactorInput,
  code: Extract<FactorEvaluatorExecutionResult, { evaluated: false }>["code"],
): FactorEvaluatorExecutionResult => Object.freeze({
  evaluated: false,
  evaluatorId: GENERIC_RELATIONSHIP_FACTOR_EVALUATOR_ID,
  factorKey: typeof input?.factorKey === "string" ? input.factorKey : null,
  code,
});
