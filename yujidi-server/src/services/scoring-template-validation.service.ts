import { AppError } from "../errors/AppError.js";
import { factorRegistry } from "../registries/factor.registry.js";
import type { FactorRegistry } from "../types/factor-registry.types.js";
import {
  MISSING_DATA_POLICIES,
  type EditableScoringSectionDefinition,
  type ScoringPermissionThresholds,
} from "../types/scoring.types.js";
import { parseGenericFactorEvaluatorKey } from "./generic-factor-legacy-compatibility.service.js";
import { ScoringRuleEvaluatorRegistryService } from "./scoring-rule-evaluator-registry.service.js";

const unsafeStringPatterns = [
  "function",
  "=>",
  "eval(",
  "new Function",
  "constructor",
  "<script",
];

const sumWeights = (weights: number[]): number =>
  Number(weights.reduce((total, value) => total + value, 0).toFixed(4));

const assertWeightTotal = (value: number, label: string): void => {
  if (Math.abs(value - 100) > 0.0001) {
    throw new AppError(`${label} weights must total 100`, 400);
  }
};

const assertNoUnsafeConfig = (value: unknown, path = "config"): void => {
  if (value === null || value === undefined) return;
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (unsafeStringPatterns.some((pattern) => normalized.includes(pattern.toLowerCase()))) {
      throw new AppError(`Unsafe scoring template config at ${path}`, 400);
    }
    return;
  }
  if (typeof value === "number" || typeof value === "boolean") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoUnsafeConfig(item, `${path}[${index}]`));
    return;
  }
  if (typeof value === "object") {
    Object.entries(value as Record<string, unknown>).forEach(([key, item]) =>
      assertNoUnsafeConfig(item, `${path}.${key}`));
    return;
  }
  throw new AppError(`Unsupported scoring template config at ${path}`, 400);
};

export class ScoringTemplateValidationService {
  public constructor(
    private readonly evaluatorRegistry = new ScoringRuleEvaluatorRegistryService(),
    private readonly factors: Pick<FactorRegistry, "get"> = factorRegistry,
  ) {}

  public validateTemplate(input: {
    sections: EditableScoringSectionDefinition[];
    permissionThresholds: ScoringPermissionThresholds;
  }): void {
    this.validateSections(input.sections);
    this.validatePermissionThresholds(input.permissionThresholds);
  }

  private validateSections(sections: EditableScoringSectionDefinition[]): void {
    const enabledSections = sections.filter((section) => section.enabled);
    if (enabledSections.length === 0) {
      throw new AppError("At least one enabled scoring section is required", 400);
    }

    assertWeightTotal(
      sumWeights(enabledSections.map((section) => section.weight)),
      "Enabled section",
    );

    for (const section of enabledSections) {
      if (!MISSING_DATA_POLICIES.includes(section.missingDataPolicy)) {
        throw new AppError(`Invalid missingDataPolicy for section ${section.sectionKey}`, 400);
      }
      const enabledEvaluators = section.evaluators.filter((evaluator) => evaluator.enabled);
      if (enabledEvaluators.length === 0) {
        throw new AppError(`Section ${section.sectionKey} requires an enabled evaluator`, 400);
      }
      assertWeightTotal(
        sumWeights(enabledEvaluators.map((evaluator) => evaluator.weight)),
        `Enabled evaluator weights for ${section.sectionKey}`,
      );

      for (const evaluator of enabledEvaluators) {
        if (
          !this.evaluatorRegistry.has(evaluator.evaluatorKey)
          && !this.isValidGenericFactorEvaluator(evaluator)
        ) {
          throw new AppError(`Unknown scoring evaluator: ${evaluator.evaluatorKey}`, 400);
        }
        if (evaluator.missingDataPolicy && !MISSING_DATA_POLICIES.includes(evaluator.missingDataPolicy)) {
          throw new AppError(`Invalid missingDataPolicy for evaluator ${evaluator.evaluatorKey}`, 400);
        }
        assertNoUnsafeConfig(evaluator.config ?? {});
      }
    }
  }

  private isValidGenericFactorEvaluator(
    evaluator: EditableScoringSectionDefinition["evaluators"][number],
  ): boolean {
    const factorKey = parseGenericFactorEvaluatorKey(evaluator.evaluatorKey);
    if (!factorKey) return false;
    const definition = this.factors.get(factorKey);
    if (
      !definition
      || definition.status !== "ACTIVE"
      || definition.scoringEligibility !== "ELIGIBLE"
    ) return false;

    const config = evaluator.config;
    if (!config || config.factorVersion !== definition.version) return false;
    if (config.relationshipType !== "DIRECT" && config.relationshipType !== "INVERSE") return false;
    const subjectBinding = config.subjectBinding;
    if (!isRecord(subjectBinding)) return false;
    return typeof subjectBinding.type === "string"
      && definition.subjectTypes.includes(subjectBinding.type as never);
  }

  private validatePermissionThresholds(thresholds: ScoringPermissionThresholds): void {
    const values = [
      thresholds.rejectBelow,
      thresholds.waitBelow,
      thresholds.takeSmallRiskBelow,
      thresholds.takeTradeAtOrAbove,
    ];
    if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 100)) {
      throw new AppError("Permission thresholds must be between 0 and 100", 400);
    }
    if (
      !(thresholds.rejectBelow < thresholds.waitBelow
        && thresholds.waitBelow < thresholds.takeSmallRiskBelow
        && thresholds.takeSmallRiskBelow <= thresholds.takeTradeAtOrAbove)
    ) {
      throw new AppError("Permission thresholds must be ordered", 400);
    }
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
