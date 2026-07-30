import type { EvidenceProviderAdapter } from "../ports/evidence-provider-adapter.port.js";
import type { Clock } from "../ports/clock.port.js";
import type { EvidenceAdapterHealthSnapshot } from "../types/evidence-observability.types.js";
import type { EvidenceProviderRunResult } from "../types/evidence-provider-run.types.js";
import {
  EvidenceShadowExecutionError,
  type EvidenceShadowExecutionResult,
  type EvidenceShadowRunSummary,
} from "../types/evidence-shadow-execution.types.js";
import type { EvidenceObservabilityService } from "./evidence-observability.service.js";
import type { EvidenceProviderRunnerService } from "./evidence-provider-runner.service.js";

export type EvidenceShadowExecutionDependencies = {
  runner: Pick<EvidenceProviderRunnerService, "run">;
  observability: Pick<EvidenceObservabilityService, "recordRun">;
  clock: Clock;
};

export class EvidenceShadowExecutionService {
  public constructor(
    private readonly dependencies: EvidenceShadowExecutionDependencies,
  ) {}

  public async execute(params: {
    adapter: EvidenceProviderAdapter;
  }): Promise<EvidenceShadowExecutionResult> {
    const startedAt = readValidStart(this.dependencies.clock);
    const adapterId = safeAdapterId(params.adapter);

    let runResult: EvidenceProviderRunResult;
    try {
      runResult = await this.dependencies.runner.run({ adapter: params.adapter });
    } catch {
      const completion = readCompletion(this.dependencies.clock, startedAt);
      return executionFailure(
        startedAt,
        completion.completedAt,
        completion.durationMs,
        adapterId,
        completion.valid ? "RUNNER_EXECUTION_FAILED" : "INVALID_CLOCK",
      );
    }

    const completion = readCompletion(this.dependencies.clock, startedAt);
    if (!completion.valid) {
      return executionFailure(
        startedAt,
        completion.completedAt,
        completion.durationMs,
        adapterId,
        "INVALID_CLOCK",
      );
    }

    const run = summarizeRun(runResult);
    try {
      const health = this.dependencies.observability.recordRun({
        result: runResult,
        startedAt: new Date(startedAt.getTime()),
        completedAt: new Date(completion.completedAt.getTime()),
      });
      return {
        executionStatus: "RECORDED",
        startedAt: new Date(startedAt.getTime()),
        completedAt: new Date(completion.completedAt.getTime()),
        durationMs: completion.durationMs,
        run,
        health: cloneHealth(health),
      };
    } catch {
      return {
        executionStatus: "OBSERVABILITY_FAILED",
        startedAt: new Date(startedAt.getTime()),
        completedAt: new Date(completion.completedAt.getTime()),
        durationMs: completion.durationMs,
        run,
        failureCode: "OBSERVABILITY_RECORDING_FAILED",
      };
    }
  }
}

const readValidStart = (clock: Clock): Date => {
  const value = clock.now();
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new EvidenceShadowExecutionError();
  }
  return new Date(value.getTime());
};

type Completion = {
  completedAt: Date;
  durationMs: number;
  valid: boolean;
};

const readCompletion = (clock: Clock, startedAt: Date): Completion => {
  const value = clock.now();
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    return {
      completedAt: new Date(startedAt.getTime()),
      durationMs: 0,
      valid: false,
    };
  }
  const completedAt = new Date(value.getTime());
  const durationMs = completedAt.getTime() - startedAt.getTime();
  if (durationMs < 0) {
    return {
      completedAt: new Date(startedAt.getTime()),
      durationMs: 0,
      valid: false,
    };
  }
  return { completedAt, durationMs, valid: true };
};

const summarizeRun = (
  result: EvidenceProviderRunResult,
): EvidenceShadowRunSummary => ({
  adapterId: result.providerKey,
  status: result.status,
  candidateCount: result.candidateCount,
  createdCount: result.createdCount,
  duplicateCount: result.duplicateCount,
  rejectedCount: result.rejectedCount,
  failedCount: result.failedCount,
  failureCode: result.status === "FAILED" ? result.failureCode : null,
});

const safeAdapterId = (adapter: EvidenceProviderAdapter): string | null => {
  const adapterId = (adapter as unknown as { adapterId?: unknown }).adapterId;
  return typeof adapterId === "string" ? adapterId : null;
};

const executionFailure = (
  startedAt: Date,
  completedAt: Date,
  durationMs: number,
  adapterId: string | null,
  failureCode: "RUNNER_EXECUTION_FAILED" | "INVALID_CLOCK",
): EvidenceShadowExecutionResult => ({
  executionStatus: "EXECUTION_FAILED",
  startedAt: new Date(startedAt.getTime()),
  completedAt: new Date(completedAt.getTime()),
  durationMs,
  adapterId,
  failureCode,
});

const cloneHealth = (
  health: EvidenceAdapterHealthSnapshot,
): EvidenceAdapterHealthSnapshot => ({
  ...health,
  lastRunAt: health.lastRunAt
    ? new Date(health.lastRunAt.getTime())
    : null,
  lastSuccessAt: health.lastSuccessAt
    ? new Date(health.lastSuccessAt.getTime())
    : null,
});
