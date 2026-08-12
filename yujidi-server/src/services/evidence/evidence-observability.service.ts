import type { Clock } from "../../ports/clock.port.js";
import {
  EVIDENCE_PROVIDER_RUN_FAILURE_CODES,
  type EvidenceProviderRunFailureCode,
  type EvidenceProviderRunResult,
  type EvidenceProviderRunStatus,
} from "../../types/evidence-provider-run.types.js";
import {
  EvidenceObservabilityError,
  MAX_TRACKED_EVIDENCE_ADAPTERS,
  type EvidenceAdapterHealthSnapshot,
  type EvidencePipelineHealthSnapshot,
  type EvidenceProviderRunSummary,
} from "../../types/evidence-observability.types.js";

export type EvidenceObservabilityDependencies = {
  clock: Clock;
};

const systemClock: Clock = {
  now: () => new Date(),
};

export class EvidenceObservabilityService {
  private readonly clock: Clock;
  private readonly adapters = new Map<string, EvidenceAdapterHealthSnapshot>();

  public constructor(
    dependencies: Partial<EvidenceObservabilityDependencies> = {},
  ) {
    this.clock = dependencies.clock ?? systemClock;
  }

  public recordRun(params: {
    result: EvidenceProviderRunResult;
    startedAt: Date;
    completedAt: Date;
  }): EvidenceAdapterHealthSnapshot {
    const summary = validateAndSummarize(params);
    const existing = this.adapters.get(summary.adapterId);
    if (!existing && this.adapters.size >= MAX_TRACKED_EVIDENCE_ADAPTERS) {
      throw new EvidenceObservabilityError("ADAPTER_LIMIT_EXCEEDED");
    }

    const snapshot = updateSnapshot(existing, summary);
    this.adapters.set(summary.adapterId, snapshot);
    return cloneSnapshot(snapshot);
  }

  public getAdapterHealth(
    adapterId: string,
  ): EvidenceAdapterHealthSnapshot | null {
    validateAdapterId(adapterId);
    const snapshot = this.adapters.get(adapterId);
    return snapshot ? cloneSnapshot(snapshot) : null;
  }

  public getPipelineHealth(): EvidencePipelineHealthSnapshot {
    const generatedAt = this.clock.now();
    if (!(generatedAt instanceof Date) || !Number.isFinite(generatedAt.getTime())) {
      throw new EvidenceObservabilityError("INVALID_TIME_RANGE");
    }
    return {
      generatedAt: new Date(generatedAt.getTime()),
      adapters: [...this.adapters.values()]
        .sort((left, right) =>
          left.adapterId < right.adapterId
            ? -1
            : left.adapterId > right.adapterId ? 1 : 0)
        .map(cloneSnapshot),
    };
  }
}

const validateAndSummarize = (params: {
  result: EvidenceProviderRunResult;
  startedAt: Date;
  completedAt: Date;
}): EvidenceProviderRunSummary => {
  validateDate(params.startedAt);
  validateDate(params.completedAt);
  const durationMs = params.completedAt.getTime() - params.startedAt.getTime();
  if (durationMs < 0) {
    throw new EvidenceObservabilityError("INVALID_TIME_RANGE");
  }

  const result = params.result as unknown as Record<string, unknown>;
  validateAdapterId(result.providerKey);
  if (
    result.status !== "COMPLETED"
    && result.status !== "PARTIAL"
    && result.status !== "FAILED"
  ) {
    throw new EvidenceObservabilityError("INVALID_RUN_RESULT");
  }

  const counts = [
    result.candidateCount,
    result.createdCount,
    result.duplicateCount,
    result.rejectedCount,
    result.failedCount,
  ];
  if (!counts.every(isNonNegativeInteger) || !Array.isArray(result.results)) {
    throw new EvidenceObservabilityError("INVALID_RUN_RESULT");
  }

  const candidateCount = result.candidateCount as number;
  const createdCount = result.createdCount as number;
  const duplicateCount = result.duplicateCount as number;
  const rejectedCount = result.rejectedCount as number;
  const failedCount = result.failedCount as number;
  const status = result.status as EvidenceProviderRunStatus;
  const failureCode = result.failureCode as EvidenceProviderRunFailureCode;
  const candidateTotal =
    createdCount + duplicateCount + rejectedCount + failedCount;

  if (status === "FAILED") {
    if (
      candidateCount !== 0
      || candidateTotal !== 0
      || result.results.length !== 0
      || !EVIDENCE_PROVIDER_RUN_FAILURE_CODES.includes(
        result.failureCode as never,
      )
    ) {
      throw new EvidenceObservabilityError("INVALID_RUN_RESULT");
    }
  } else if (
    candidateCount !== candidateTotal
    || result.results.length !== candidateCount
    || (status === "COMPLETED" && (rejectedCount > 0 || failedCount > 0))
    || (status === "PARTIAL" && rejectedCount === 0 && failedCount === 0)
    || result.failureCode !== undefined
  ) {
    throw new EvidenceObservabilityError("INVALID_RUN_RESULT");
  }

  return {
    adapterId: result.providerKey as string,
    status,
    candidateCount,
    createdCount,
    duplicateCount,
    rejectedCount,
    failedCount,
    ...(status === "FAILED"
      ? { failureCode }
      : {}),
    startedAt: new Date(params.startedAt.getTime()),
    completedAt: new Date(params.completedAt.getTime()),
    durationMs,
  };
};

function validateAdapterId(adapterId: unknown): asserts adapterId is string {
  if (
    typeof adapterId !== "string"
    || adapterId.length === 0
    || adapterId.length > 120
    || adapterId.trim() !== adapterId
  ) {
    throw new EvidenceObservabilityError("INVALID_ADAPTER_ID");
  }
}

function validateDate(value: unknown): asserts value is Date {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new EvidenceObservabilityError("INVALID_TIME_RANGE");
  }
}

const isNonNegativeInteger = (value: unknown): boolean =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

const updateSnapshot = (
  existing: EvidenceAdapterHealthSnapshot | undefined,
  summary: EvidenceProviderRunSummary,
): EvidenceAdapterHealthSnapshot => {
  const consecutiveFailedRuns =
    summary.status === "FAILED"
      ? (existing?.consecutiveFailedRuns ?? 0) + 1
      : 0;
  const health =
    summary.status === "COMPLETED"
      ? "HEALTHY"
      : summary.status === "PARTIAL" || consecutiveFailedRuns === 1
        ? "DEGRADED"
        : "UNHEALTHY";

  return {
    adapterId: summary.adapterId,
    health,
    totalRuns: (existing?.totalRuns ?? 0) + 1,
    completedRuns:
      (existing?.completedRuns ?? 0) + (summary.status === "COMPLETED" ? 1 : 0),
    partialRuns:
      (existing?.partialRuns ?? 0) + (summary.status === "PARTIAL" ? 1 : 0),
    failedRuns:
      (existing?.failedRuns ?? 0) + (summary.status === "FAILED" ? 1 : 0),
    totalCandidates: (existing?.totalCandidates ?? 0) + summary.candidateCount,
    createdCandidates: (existing?.createdCandidates ?? 0) + summary.createdCount,
    duplicateCandidates:
      (existing?.duplicateCandidates ?? 0) + summary.duplicateCount,
    rejectedCandidates:
      (existing?.rejectedCandidates ?? 0) + summary.rejectedCount,
    failedCandidates: (existing?.failedCandidates ?? 0) + summary.failedCount,
    consecutiveFailedRuns,
    lastRunAt: new Date(summary.completedAt.getTime()),
    lastSuccessAt:
      summary.status === "COMPLETED"
        ? new Date(summary.completedAt.getTime())
        : cloneDate(existing?.lastSuccessAt ?? null),
    lastStatus: summary.status,
    lastFailureCode: summary.failureCode ?? null,
    lastDurationMs: summary.durationMs,
  };
};

const cloneDate = (value: Date | null): Date | null =>
  value ? new Date(value.getTime()) : null;

const cloneSnapshot = (
  snapshot: EvidenceAdapterHealthSnapshot,
): EvidenceAdapterHealthSnapshot => ({
  ...snapshot,
  lastRunAt: cloneDate(snapshot.lastRunAt),
  lastSuccessAt: cloneDate(snapshot.lastSuccessAt),
});
