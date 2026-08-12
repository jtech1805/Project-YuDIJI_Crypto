import type { DeterministicFactorEvaluator } from "../../ports/deterministic-factor-evaluator.port.js";
import {
  FACTOR_EVALUATION_OUTCOMES,
  FACTOR_EVALUATOR_FAILURE_CODES,
  type FactorEvaluationDiagnostics,
  type FactorEvaluationResult,
  type FactorEvaluatorExecutionResult,
  type FactorEvaluatorResultValidationResult,
  type FactorEvaluatorValidationResult,
} from "../../types/factor-evaluator.types.js";
import type { AssembledFactorInput } from "../../types/factor-input-assembly.types.js";
import { FACTOR_KEYS } from "../../types/factor-registry.types.js";

const MAX_EVALUATOR_ID_LENGTH = 120;
const MAX_REASON_CODE_LENGTH = 160;
const MAX_DIAGNOSTIC_ENTRIES = 20;
const MAX_DIAGNOSTIC_KEY_LENGTH = 64;
const MAX_DIAGNOSTIC_STRING_LENGTH = 500;

export const supportsFactorInput = (
  evaluator: Pick<DeterministicFactorEvaluator, "supportedFactorKeys">,
  input: Pick<AssembledFactorInput, "factorKey">,
): boolean => Array.isArray(evaluator.supportedFactorKeys)
  && evaluator.supportedFactorKeys.includes(input.factorKey);

export class FactorEvaluatorContractService {
  public validateEvaluator(evaluator: unknown): FactorEvaluatorValidationResult {
    if (!record(evaluator)
      || !identifier(evaluator.evaluatorId, MAX_EVALUATOR_ID_LENGTH)) {
      return invalidEvaluator("INVALID_EVALUATOR_ID");
    }
    if (!positiveInteger(evaluator.evaluatorVersion)) {
      return invalidEvaluator("INVALID_EVALUATOR_VERSION");
    }
    if (!positiveInteger(evaluator.configurationVersion)) {
      return invalidEvaluator("INVALID_CONFIGURATION_VERSION");
    }
    if (!Array.isArray(evaluator.supportedFactorKeys)) {
      return invalidEvaluator("INVALID_SUPPORTED_FACTOR");
    }
    if (evaluator.supportedFactorKeys.length === 0) {
      return invalidEvaluator("EMPTY_SUPPORTED_FACTORS");
    }
    if (new Set(evaluator.supportedFactorKeys).size !== evaluator.supportedFactorKeys.length) {
      return invalidEvaluator("DUPLICATE_SUPPORTED_FACTOR");
    }
    if (!evaluator.supportedFactorKeys.every((key) => FACTOR_KEYS.includes(key as never))) {
      return invalidEvaluator("INVALID_SUPPORTED_FACTOR");
    }
    if (typeof evaluator.evaluate !== "function") {
      return invalidEvaluator("INVALID_EVALUATE_FUNCTION");
    }
    return { valid: true, evaluatorId: evaluator.evaluatorId };
  }

  public validateResult(params: {
    evaluator: DeterministicFactorEvaluator;
    input: AssembledFactorInput;
    execution: FactorEvaluatorExecutionResult;
  }): FactorEvaluatorResultValidationResult {
    const evaluatorValidation = this.validateEvaluator(params.evaluator);
    if (!evaluatorValidation.valid) {
      return { valid: false, code: "INVALID_CONFIGURATION" };
    }
    const inputCode = validateInput(params.input);
    if (inputCode) return { valid: false, code: inputCode };
    if (!supportsFactorInput(params.evaluator, params.input)) {
      return { valid: false, code: "UNSUPPORTED_FACTOR" };
    }
    if (!record(params.execution) || typeof params.execution.evaluated !== "boolean") {
      return { valid: false, code: "INVALID_RESULT" };
    }
    if (!params.execution.evaluated) {
      return validateFailedExecution(params.evaluator, params.input, params.execution);
    }
    if (!exactKeys(params.execution, ["evaluated", "result"])
      || !validEvaluationResult(params.evaluator, params.input, params.execution.result)) {
      return { valid: false, code: "INVALID_RESULT" };
    }
    return {
      valid: true,
      result: cloneResult(params.execution.result),
    };
  }
}

const validateInput = (
  input: unknown,
): "INVALID_INPUT" | "UNSUPPORTED_VALUE_TYPE" | null => {
  if (!record(input)
    || !trimmed(input.factorKey)
    || !positiveInteger(input.factorDefinitionVersion)
    || !record(input.subject)
    || !trimmed(input.subject.type)
    || !trimmed(input.subject.key)
    || !trimmed(input.evidenceId)
    || !record(input.value)) return "INVALID_INPUT";
  if (input.value.type !== "NUMBER") return "UNSUPPORTED_VALUE_TYPE";
  if (!finite(input.value.value)
    || !trimmed(input.value.unit)
    || !record(input.source)
    || !trimmed(input.source.sourceType)
    || !trimmed(input.source.provider)
    || !trimmed(input.source.sourceId)
    || !validDate(input.observedAt)
    || !validDate(input.evaluatedAt)) return "INVALID_INPUT";
  return null;
};

const validateFailedExecution = (
  evaluator: DeterministicFactorEvaluator,
  input: AssembledFactorInput,
  execution: Record<string, any>,
): FactorEvaluatorResultValidationResult => {
  if (!exactKeys(execution, ["evaluated", "evaluatorId", "factorKey", "code"])
    || !FACTOR_EVALUATOR_FAILURE_CODES.includes(execution.code)
    || (execution.evaluatorId !== null && execution.evaluatorId !== evaluator.evaluatorId)
    || (execution.factorKey !== null && execution.factorKey !== input.factorKey)) {
    return { valid: false, code: "INVALID_RESULT" };
  }
  return {
    valid: true,
    execution: Object.freeze({
      evaluated: false,
      evaluatorId: execution.evaluatorId,
      factorKey: execution.factorKey,
      code: execution.code,
    }),
  };
};

const validEvaluationResult = (
  evaluator: DeterministicFactorEvaluator,
  input: AssembledFactorInput,
  value: unknown,
): value is FactorEvaluationResult => {
  if (!record(value)
    || !exactKeys(value, [
      "evaluator", "factorKey", "subject", "outcome", "contribution",
      "reasonCode", "evidence", "diagnostics",
    ])
    || !record(value.evaluator)
    || !exactKeys(value.evaluator, [
      "evaluatorId", "evaluatorVersion", "configurationVersion",
    ])
    || value.evaluator.evaluatorId !== evaluator.evaluatorId
    || value.evaluator.evaluatorVersion !== evaluator.evaluatorVersion
    || value.evaluator.configurationVersion !== evaluator.configurationVersion
    || value.factorKey !== input.factorKey
    || !sameSubject(value.subject, input.subject)
    || !FACTOR_EVALUATION_OUTCOMES.includes(value.outcome)
    || !validContribution(value.outcome, value.contribution)
    || !identifier(value.reasonCode, MAX_REASON_CODE_LENGTH)
    || !validEvidenceReference(value.evidence, input)
    || !validDiagnostics(value.diagnostics)) return false;
  return true;
};

const validContribution = (
  outcome: unknown,
  contribution: unknown,
): boolean => {
  if (!record(contribution)
    || !exactKeys(contribution, ["points", "minimumPoints", "maximumPoints"])
    || !finite(contribution.points)
    || !finite(contribution.minimumPoints)
    || !finite(contribution.maximumPoints)
    || contribution.minimumPoints > contribution.maximumPoints
    || contribution.points < contribution.minimumPoints
    || contribution.points > contribution.maximumPoints) return false;
  switch (outcome) {
    case "PASS": return contribution.points > 0;
    case "FAIL": return contribution.points < 0;
    case "NEUTRAL":
    case "UNAVAILABLE": return contribution.points === 0;
    default: return false;
  }
};

const validEvidenceReference = (
  evidence: unknown,
  input: AssembledFactorInput,
): boolean => record(evidence)
  && exactKeys(evidence, [
    "evidenceId", "factorDefinitionVersion", "source", "observedAt", "evaluatedAt",
  ])
  && evidence.evidenceId === input.evidenceId
  && evidence.factorDefinitionVersion === input.factorDefinitionVersion
  && record(evidence.source)
  && exactKeys(evidence.source, ["sourceType", "provider", "sourceId"])
  && evidence.source.sourceType === input.source.sourceType
  && evidence.source.provider === input.source.provider
  && evidence.source.sourceId === input.source.sourceId
  && validDate(evidence.observedAt)
  && validDate(evidence.evaluatedAt)
  && evidence.observedAt.getTime() === input.observedAt.getTime()
  && evidence.evaluatedAt.getTime() === input.evaluatedAt.getTime();

const validDiagnostics = (diagnostics: unknown): diagnostics is FactorEvaluationDiagnostics => {
  if (!record(diagnostics)) return false;
  const entries = Object.entries(diagnostics);
  if (entries.length > MAX_DIAGNOSTIC_ENTRIES) return false;
  return entries.every(([key, value]) =>
    trimmed(key)
    && key.length <= MAX_DIAGNOSTIC_KEY_LENGTH
    && !sensitiveDiagnosticKey(key)
    && (value === null
      || typeof value === "boolean"
      || (typeof value === "number" && Number.isFinite(value))
      || (typeof value === "string" && value.length <= MAX_DIAGNOSTIC_STRING_LENGTH)));
};

const sensitiveDiagnosticKey = (key: string): boolean =>
  /(?:^|_)(?:payload|credential|credentials|password|secret|token|stack|exception)(?:_|$)/i
    .test(key);

const cloneResult = (result: FactorEvaluationResult): FactorEvaluationResult =>
  Object.freeze({
    evaluator: Object.freeze({ ...result.evaluator }),
    factorKey: result.factorKey,
    subject: Object.freeze({ ...result.subject }),
    outcome: result.outcome,
    contribution: Object.freeze({ ...result.contribution }),
    reasonCode: result.reasonCode,
    evidence: Object.freeze({
      evidenceId: result.evidence.evidenceId,
      factorDefinitionVersion: result.evidence.factorDefinitionVersion,
      source: Object.freeze({ ...result.evidence.source }),
      observedAt: structuredClone(result.evidence.observedAt),
      evaluatedAt: structuredClone(result.evidence.evaluatedAt),
    }),
    diagnostics: Object.freeze({ ...result.diagnostics }),
  });

const invalidEvaluator = (
  code: Exclude<FactorEvaluatorValidationResult, { valid: true }>["code"],
): FactorEvaluatorValidationResult => ({ valid: false, code });
const sameSubject = (value: unknown, expected: { type: string; key: string }): boolean =>
  record(value)
  && exactKeys(value, ["type", "key"])
  && value.type === expected.type
  && value.key === expected.key;
const exactKeys = (value: Record<string, any>, expected: readonly string[]): boolean => {
  const keys = Object.keys(value).sort();
  return keys.length === expected.length
    && [...expected].sort().every((key, index) => keys[index] === key);
};
const identifier = (value: unknown, maximumLength: number): value is string =>
  typeof value === "string"
  && value.length > 0
  && value.length <= maximumLength
  && value.trim() === value
  && /^[A-Z0-9_]+$/.test(value);
const trimmed = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.trim() === value;
const positiveInteger = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) > 0;
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const validDate = (value: unknown): value is Date =>
  value instanceof Date && Number.isFinite(value.getTime());
const record = (value: unknown): value is Record<string, any> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
