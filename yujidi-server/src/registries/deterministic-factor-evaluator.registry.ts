import type { DeterministicFactorEvaluator } from "../ports/deterministic-factor-evaluator.port.js";
import type { FactorEvaluatorContractService } from "../services/factor-evaluator-contract.service.js";
import {
  FactorEvaluatorRegistryError,
  type RegisteredFactorEvaluatorSummary,
} from "../types/factor-evaluator-registry.types.js";

export interface DeterministicFactorEvaluatorRegistry {
  getById(evaluatorId: string): DeterministicFactorEvaluator | null;
  list(): readonly RegisteredFactorEvaluatorSummary[];
  listByFactor(factorKey: string): readonly RegisteredFactorEvaluatorSummary[];
  getImplementationsByFactor(
    factorKey: string,
  ): readonly DeterministicFactorEvaluator[];
}

type Snapshot = {
  implementation: DeterministicFactorEvaluator;
  summary: RegisteredFactorEvaluatorSummary;
};

export class StaticDeterministicFactorEvaluatorRegistry
implements DeterministicFactorEvaluatorRegistry {
  private readonly snapshots: ReadonlyMap<string, Snapshot>;
  private readonly factorEvaluatorIds: ReadonlyMap<string, readonly string[]>;

  public constructor(params: {
    evaluators: readonly DeterministicFactorEvaluator[];
    contractService: Pick<FactorEvaluatorContractService, "validateEvaluator">;
  }) {
    if (!record(params)
      || !Array.isArray(params.evaluators)
      || !dense(params.evaluators)) {
      throw new FactorEvaluatorRegistryError({
        code: "INVALID_EVALUATOR_COLLECTION",
      });
    }

    const snapshots = new Map<string, Snapshot>();
    const factorEvaluatorIds = new Map<string, string[]>();
    for (const evaluator of params.evaluators as readonly unknown[]) {
      const validation = params.contractService.validateEvaluator(evaluator);
      if (!validation.valid) {
        throw new FactorEvaluatorRegistryError({
          code: "INVALID_EVALUATOR",
          evaluatorId: safeEvaluatorId(evaluator),
        });
      }
      const typedEvaluator = evaluator as DeterministicFactorEvaluator;
      if (snapshots.has(validation.evaluatorId)) {
        throw new FactorEvaluatorRegistryError({
          code: "DUPLICATE_EVALUATOR_ID",
          evaluatorId: validation.evaluatorId,
        });
      }
      const supportedFactorKeys = Object.freeze([
        ...typedEvaluator.supportedFactorKeys,
      ]);
      const summary: RegisteredFactorEvaluatorSummary = Object.freeze({
        evaluatorId: validation.evaluatorId,
        evaluatorVersion: typedEvaluator.evaluatorVersion,
        configurationVersion: typedEvaluator.configurationVersion,
        supportedFactorKeys,
      });
      snapshots.set(validation.evaluatorId, {
        implementation: typedEvaluator,
        summary,
      });
      for (const factorKey of supportedFactorKeys) {
        const ids = factorEvaluatorIds.get(factorKey) ?? [];
        ids.push(validation.evaluatorId);
        factorEvaluatorIds.set(factorKey, ids);
      }
    }
    for (const ids of factorEvaluatorIds.values()) {
      ids.sort(compare);
      Object.freeze(ids);
    }
    this.snapshots = snapshots;
    this.factorEvaluatorIds = factorEvaluatorIds;
  }

  public getById(evaluatorId: string): DeterministicFactorEvaluator | null {
    if (typeof evaluatorId !== "string") return null;
    return this.snapshots.get(evaluatorId)?.implementation ?? null;
  }

  public list(): readonly RegisteredFactorEvaluatorSummary[] {
    return freezeSummaries(
      [...this.snapshots.values()]
        .sort((left, right) =>
          compare(left.summary.evaluatorId, right.summary.evaluatorId))
        .map(({ summary }) => summary),
    );
  }

  public listByFactor(
    factorKey: string,
  ): readonly RegisteredFactorEvaluatorSummary[] {
    if (typeof factorKey !== "string") return Object.freeze([]);
    const ids = this.factorEvaluatorIds.get(factorKey) ?? [];
    return freezeSummaries(ids.map((id) => this.snapshots.get(id)!.summary));
  }

  public getImplementationsByFactor(
    factorKey: string,
  ): readonly DeterministicFactorEvaluator[] {
    if (typeof factorKey !== "string") return Object.freeze([]);
    const ids = this.factorEvaluatorIds.get(factorKey) ?? [];
    return Object.freeze(ids.map((id) => this.snapshots.get(id)!.implementation));
  }
}

const freezeSummaries = (
  summaries: readonly RegisteredFactorEvaluatorSummary[],
): readonly RegisteredFactorEvaluatorSummary[] => Object.freeze(
  summaries.map((summary) => Object.freeze({
    evaluatorId: summary.evaluatorId,
    evaluatorVersion: summary.evaluatorVersion,
    configurationVersion: summary.configurationVersion,
    supportedFactorKeys: Object.freeze([...summary.supportedFactorKeys]),
  })),
);
const safeEvaluatorId = (value: unknown): string | null => {
  if (!record(value) || typeof value.evaluatorId !== "string") return null;
  return /^[A-Z0-9_]{1,120}$/.test(value.evaluatorId)
    ? value.evaluatorId
    : null;
};
const dense = (values: readonly unknown[]): boolean => {
  for (let index = 0; index < values.length; index += 1) {
    if (!(index in values)) return false;
  }
  return true;
};
const compare = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
const record = (value: unknown): value is Record<string, any> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
