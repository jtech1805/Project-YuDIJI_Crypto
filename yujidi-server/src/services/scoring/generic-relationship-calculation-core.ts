import type { GenericRelationshipEvaluatorConfiguration, GenericRelationshipConfigurationValidationResult } from "../../types/generic-relationship-evaluator.types.js";
import { classifyGenericFactorRelationship } from "../../types/generic-factor-relationship.types.js";

export type GenericRelationshipCalculationResult =
  | Readonly<{ calculated: true; outcome: "PASS" | "FAIL" | "NEUTRAL"; contribution: Readonly<{ points: number; minimumPoints: number; maximumPoints: number }>; reasonCode: string; diagnostics: Readonly<{ relationshipType: "DIRECT" | "INVERSE"; inputValue: number; inputUnit: string }> }>
  | Readonly<{ calculated: false; code: "INVALID_CONFIGURATION" | "UNSUPPORTED_FACTOR" | "UNSUPPORTED_VALUE_TYPE" | "INVALID_INPUT" }>;

export const calculateGenericRelationship = (request: Readonly<{
  configuration: GenericRelationshipEvaluatorConfiguration;
  factorKey: unknown;
  valueType: unknown;
  value: unknown;
  unit: unknown;
}>): GenericRelationshipCalculationResult => {
  const validation = validateGenericRelationshipConfiguration(request.configuration, request.factorKey);
  if (!validation.valid) return failure("INVALID_CONFIGURATION");
  if (request.factorKey !== "CRYPTO.ETF_NET_FLOW") return failure("UNSUPPORTED_FACTOR");
  if (request.valueType !== "NUMBER") return failure("UNSUPPORTED_VALUE_TYPE");
  if (request.unit !== request.configuration.expectedUnit || typeof request.value !== "number" || !Number.isFinite(request.value)) return failure("INVALID_INPUT");
  const band = classifyBand(request.value, request.configuration.thresholds);
  const directPoints = request.configuration.contributions[band];
  const points = directPoints === 0 ? 0 : request.configuration.relationshipType === "INVERSE" ? -directPoints : directPoints;
  const direction = points > 0 ? "POSITIVE" : points < 0 ? "NEGATIVE" : "NEUTRAL";
  const strength = band === "strongNegative" || band === "strongPositive" ? "STRONG_" : "";
  const relationship = request.configuration.relationshipType as "DIRECT" | "INVERSE";
  return Object.freeze({
    calculated: true,
    outcome: points > 0 ? "PASS" : points < 0 ? "FAIL" : "NEUTRAL",
    contribution: Object.freeze({ points, minimumPoints: request.configuration.minimumPoints, maximumPoints: request.configuration.maximumPoints }),
    reasonCode: `${strength}${direction}_${relationship}_RELATIONSHIP`,
    diagnostics: Object.freeze({ relationshipType: relationship, inputValue: request.value, inputUnit: request.unit }),
  });
};

export const validateGenericRelationshipConfiguration = (
  configuration: GenericRelationshipEvaluatorConfiguration,
  factorKey: unknown,
): GenericRelationshipConfigurationValidationResult => {
  const classification = classifyGenericFactorRelationship(configuration?.relationshipType);
  if (!classification || classification.supportState !== "SINGLE_FACTOR_EXECUTABLE") return { valid: false, code: configuration?.relationshipType === "CONDITIONAL" ? "CONDITION_BINDING_REQUIRED" : "UNSUPPORTED_RELATIONSHIP" };
  if (factorKey !== "CRYPTO.ETF_NET_FLOW") return { valid: false, code: "UNSUPPORTED_FACTOR" };
  if (configuration.expectedUnit !== "USD") return { valid: false, code: "INVALID_UNIT" };
  const t = configuration.thresholds;
  if (!t || ![t.strongNegativeMax, t.negativeMax, t.positiveMin, t.strongPositiveMin].every(Number.isFinite)) return { valid: false, code: "NON_FINITE_THRESHOLD" };
  if (!(t.strongNegativeMax < t.negativeMax && t.negativeMax < t.positiveMin && t.positiveMin < t.strongPositiveMin)) return { valid: false, code: "UNORDERED_THRESHOLDS" };
  const c = configuration.contributions;
  if (!c || ![c.strongNegative, c.negative, c.neutral, c.positive, c.strongPositive].every(Number.isFinite)) return { valid: false, code: "NON_FINITE_CONTRIBUTION" };
  if (!Number.isFinite(configuration.minimumPoints) || !Number.isFinite(configuration.maximumPoints) || configuration.minimumPoints > configuration.maximumPoints
    || c.neutral !== 0 || Math.min(...Object.values(c)) < configuration.minimumPoints || Math.max(...Object.values(c)) > configuration.maximumPoints) return { valid: false, code: "INVALID_CONTRIBUTION_BOUNDS" };
  return { valid: true };
};

const classifyBand = (value: number, thresholds: GenericRelationshipEvaluatorConfiguration["thresholds"]): keyof GenericRelationshipEvaluatorConfiguration["contributions"] => {
  if (value <= thresholds.strongNegativeMax) return "strongNegative";
  if (value <= thresholds.negativeMax) return "negative";
  if (value >= thresholds.strongPositiveMin) return "strongPositive";
  if (value >= thresholds.positiveMin) return "positive";
  return "neutral";
};
const failure = (code: Extract<GenericRelationshipCalculationResult, { calculated: false }>["code"]): GenericRelationshipCalculationResult => Object.freeze({ calculated: false, code });
