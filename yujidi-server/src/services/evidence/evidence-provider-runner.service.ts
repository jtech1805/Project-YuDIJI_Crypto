import type { EvidenceProviderAdapter } from "../../ports/evidence-provider-adapter.port.js";
import {
  evidenceIngestionService,
  type EvidenceIngestionService,
} from "./evidence-ingestion.service.js";
import type { EvidenceIngestionResult } from "../../types/evidence-ingestion.types.js";
import {
  MAX_EVIDENCE_PROVIDER_BATCH_SIZE,
  type EvidenceProviderCandidateRunResult,
  type EvidenceProviderRunFailedResult,
  type EvidenceProviderRunFailureCode,
  type EvidenceProviderRunResult,
} from "../../types/evidence-provider-run.types.js";

export type EvidenceProviderRunnerDependencies = {
  ingestionService: Pick<EvidenceIngestionService, "ingest">;
};

export class EvidenceProviderRunnerService {
  private readonly ingestionService: Pick<EvidenceIngestionService, "ingest">;

  public constructor(
    dependencies: Partial<EvidenceProviderRunnerDependencies> = {},
  ) {
    this.ingestionService = dependencies.ingestionService ?? evidenceIngestionService;
  }

  public async run(params: {
    adapter: EvidenceProviderAdapter;
  }): Promise<EvidenceProviderRunResult> {
    const adapterId = params.adapter.adapterId;
    if (!isValidAdapterId(adapterId)) {
      return failedRun(null, "INVALID_PROVIDER_KEY");
    }

    let adapterResult: unknown;
    try {
      adapterResult = await params.adapter.readCandidates();
    } catch {
      return failedRun(adapterId, "ADAPTER_EXECUTION_FAILED");
    }

    if (!Array.isArray(adapterResult)) {
      return failedRun(adapterId, "INVALID_ADAPTER_RESULT");
    }
    if (adapterResult.length > MAX_EVIDENCE_PROVIDER_BATCH_SIZE) {
      return failedRun(adapterId, "BATCH_SIZE_EXCEEDED");
    }

    const results: EvidenceProviderCandidateRunResult[] = [];
    for (let index = 0; index < adapterResult.length; index += 1) {
      let result: EvidenceIngestionResult;
      try {
        result = await this.ingestionService.ingest(adapterResult[index]);
      } catch {
        result = { status: "FAILED", code: "PERSISTENCE_FAILED" };
      }
      results.push({ index, result });
    }

    const createdCount = countStatus(results, "CREATED");
    const duplicateCount = countStatus(results, "DUPLICATE");
    const rejectedCount = countStatus(results, "REJECTED");
    const failedCount = countStatus(results, "FAILED");
    return {
      providerKey: adapterId,
      status: rejectedCount > 0 || failedCount > 0 ? "PARTIAL" : "COMPLETED",
      candidateCount: results.length,
      createdCount,
      duplicateCount,
      rejectedCount,
      failedCount,
      results,
    };
  }
}

const isValidAdapterId = (adapterId: unknown): adapterId is string =>
  typeof adapterId === "string"
  && adapterId.length > 0
  && adapterId.length <= 120
  && adapterId.trim() === adapterId;

const failedRun = (
  providerKey: string | null,
  failureCode: EvidenceProviderRunFailureCode,
): EvidenceProviderRunFailedResult => ({
  providerKey,
  status: "FAILED",
  failureCode,
  candidateCount: 0,
  createdCount: 0,
  duplicateCount: 0,
  rejectedCount: 0,
  failedCount: 0,
  results: [],
});

const countStatus = (
  results: readonly EvidenceProviderCandidateRunResult[],
  status: EvidenceIngestionResult["status"],
): number =>
  results.reduce(
    (count, candidateResult) =>
      count + (candidateResult.result.status === status ? 1 : 0),
    0,
  );

export const evidenceProviderRunnerService =
  new EvidenceProviderRunnerService();
