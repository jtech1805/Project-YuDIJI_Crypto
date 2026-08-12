import type { DeterministicFactorEvaluator } from "../ports/deterministic-factor-evaluator.port.js";
import type { FactorEvaluatorContractService } from "../services/scoring/factor-evaluator-contract.service.js";
import { StaticDeterministicFactorEvaluatorRegistry } from "./deterministic-factor-evaluator.registry.js";

export const DEFAULT_DETERMINISTIC_FACTOR_EVALUATORS:
readonly DeterministicFactorEvaluator[] = Object.freeze([]);

export const createDefaultDeterministicFactorEvaluatorRegistry = (
  contractService: Pick<FactorEvaluatorContractService, "validateEvaluator">,
): StaticDeterministicFactorEvaluatorRegistry =>
  new StaticDeterministicFactorEvaluatorRegistry({
    evaluators: DEFAULT_DETERMINISTIC_FACTOR_EVALUATORS,
    contractService,
  });
