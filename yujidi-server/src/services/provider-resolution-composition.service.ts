import { EVIDENCE_INGESTION_STATUSES } from "../types/evidence-ingestion.types.js";
import { EVIDENCE_PROVIDER_RUN_FAILURE_CODES } from "../types/evidence-provider-run.types.js";
import { PROVIDER_TYPES } from "../types/provider-definition.types.js";
import { PROVIDER_RESOLUTION_WARNING_CODES } from "../types/provider-resolution-policy.types.js";
import { PROVIDER_RESOLUTION_COMPOSITION_STAGES, type ProviderResolutionCompositionFailureCode, type ProviderResolutionCompositionRequest, type ProviderResolutionCompositionResult, type ProviderResolutionCompositionStageReport, type SafeEvidenceIngestionProjection } from "../types/provider-resolution-composition.types.js";

const ID = /^[A-Z0-9_]{1,120}$/;
export class ProviderResolutionCompositionService {
  public async compose(request: ProviderResolutionCompositionRequest): Promise<ProviderResolutionCompositionResult> {
    if (!record(request) || !("resolution" in request) || !("runnerRegistry" in request) || !("executionInput" in request)) return failure("INVALID_REQUEST", request, stages("RESOLUTION_INPUT", "FAILED", "INVALID_REQUEST"));
    if (!resolutionBoundary(request.resolution)) return failure("INVALID_RESOLUTION_BOUNDARY", request, stages("RESOLUTION_INPUT", "FAILED", "INVALID_RESOLUTION_BOUNDARY"));
    const resolution = request.resolution.result;
    if (!registryBoundary(request.runnerRegistry)) return failure("INVALID_RUNNER_REGISTRY_BOUNDARY", request, stages("RUNNER_LOOKUP", "FAILED", "INVALID_RUNNER_REGISTRY_BOUNDARY"));
    if (!inputBoundary(request.executionInput)) return failure("INVALID_EXECUTION_INPUT", request, stages("RESOLUTION_INPUT", "FAILED", "INVALID_EXECUTION_INPUT"));
    if (!resolution.resolved) return freeze({ composed: true as const, resolved: false as const, factorKey: resolution.factorKey, requestedProviderKey: resolution.requestedProviderKey, selectedProviderKey: null, resolutionStatus: resolution.resolutionStatus, confidenceAdjustment: resolution.confidenceAdjustment, warningCodes: Object.freeze([...resolution.warningCodes]), runnerId: null, providerExecutionStatus: "SKIPPED" as const, candidateCount: 0 as const, evidenceOutcome: null, stages: skippedRuntimeStages() });
    const registration = request.runnerRegistry.get(resolution.selectedProviderKey);
    if (registration === null) return failure("RUNNER_NOT_REGISTERED", request, stages("RUNNER_LOOKUP", "FAILED", "RUNNER_NOT_REGISTERED"));
    if (!registrationBoundary(registration)) return failure("INVALID_RUNNER_REGISTRY_BOUNDARY", request, stages("RUNNER_LOOKUP", "FAILED", "INVALID_RUNNER_REGISTRY_BOUNDARY"));
    if (registration.providerKey !== resolution.selectedProviderKey) return failure("SELECTED_PROVIDER_MISMATCH", request, stages("RUNNER_LOOKUP", "FAILED", "SELECTED_PROVIDER_MISMATCH"));
    if (registration.runnerId !== request.executionInput.adapter.adapterId) return failure("RUNNER_IDENTITY_MISMATCH", request, stages("RUNNER_LOOKUP", "FAILED", "RUNNER_IDENTITY_MISMATCH"));
    let runResult: unknown;
    try { runResult = await registration.runner.run(request.executionInput); }
    catch { return failure("RUNNER_EXECUTION_THROWN", request, stages("PROVIDER_EXECUTION", "FAILED", "RUNNER_EXECUTION_THROWN")); }
    try {
      if (!record(runResult) || runResult.status === "FAILED") {
        if (failedRunBoundary(runResult)) return failure("RUNNER_EXECUTION_FAILED", request, stages("PROVIDER_EXECUTION", "FAILED", "RUNNER_EXECUTION_FAILED"));
        return failure("RUNNER_RESULT_INVALID", request, stages("PROVIDER_EXECUTION", "FAILED", "RUNNER_RESULT_INVALID"));
      }
      if (!completedRunBoundary(runResult) || runResult.providerKey !== registration.runnerId) return failure("RUNNER_RESULT_INVALID", request, stages("PROVIDER_EXECUTION", "FAILED", "RUNNER_RESULT_INVALID"));
    } catch {
      return failure("RUNNER_RESULT_INVALID", request, stages("PROVIDER_EXECUTION", "FAILED", "RUNNER_RESULT_INVALID"));
    }
    let evidenceOutcome: SafeEvidenceIngestionProjection;
    try { evidenceOutcome = project(runResult); }
    catch { return failure("EVIDENCE_INGESTION_THROWN", request, stages("EVIDENCE_INGESTION", "FAILED", "EVIDENCE_INGESTION_THROWN")); }
    if (runResult.failedCount > 0) return failure("EVIDENCE_INGESTION_FAILED", request, stages("EVIDENCE_INGESTION", "FAILED", "EVIDENCE_INGESTION_FAILED"));
    return freeze({ composed: true, resolved: true, factorKey: resolution.factorKey, requestedProviderKey: resolution.requestedProviderKey, selectedProviderKey: resolution.selectedProviderKey, selectedProviderType: resolution.selectedProviderType, resolutionStatus: resolution.resolutionStatus, confidenceAdjustment: resolution.confidenceAdjustment, warningCodes: Object.freeze([...resolution.warningCodes]), runnerId: registration.runnerId, providerExecutionStatus: runResult.status, candidateCount: runResult.candidateCount, evidenceOutcome, stages: stages() });
  }
}

const project = (run: any): SafeEvidenceIngestionProjection => {
  const results = Object.freeze(run.results.map((entry: any) => Object.freeze({ index: entry.index, status: entry.result.status, evidenceId: entry.result.status === "CREATED" || entry.result.status === "DUPLICATE" ? entry.result.evidenceId : null })));
  return freeze({ createdCount: run.createdCount, duplicateCount: run.duplicateCount, rejectedCount: run.rejectedCount, failedCount: run.failedCount, evidenceIds: Object.freeze(results.flatMap((item: { evidenceId: string | null }) => item.evidenceId === null ? [] : [item.evidenceId])), results });
};
const completedRunBoundary = (r: any) => record(r) && (r.status === "COMPLETED" || r.status === "PARTIAL") && ID.test(r.providerKey) && counts(r) && Array.isArray(r.results) && r.results.length === r.candidateCount && r.results.every(candidateResultBoundary) && r.createdCount + r.duplicateCount + r.rejectedCount + r.failedCount === r.candidateCount && (r.status === "COMPLETED" ? r.rejectedCount === 0 && r.failedCount === 0 : r.rejectedCount > 0 || r.failedCount > 0);
const candidateResultBoundary = (x: any, index: number) => record(x) && x.index === index && record(x.result) && EVIDENCE_INGESTION_STATUSES.includes(x.result.status) && ((x.result.status === "CREATED" || x.result.status === "DUPLICATE") ? typeof x.result.evidenceId === "string" && x.result.evidenceId.length > 0 : true);
const failedRunBoundary = (r: any) => record(r) && r.status === "FAILED" && (r.providerKey === null || (typeof r.providerKey === "string" && ID.test(r.providerKey))) && EVIDENCE_PROVIDER_RUN_FAILURE_CODES.includes(r.failureCode) && counts(r) && r.candidateCount === 0 && Array.isArray(r.results) && r.results.length === 0;
const counts = (r: any) => [r.candidateCount, r.createdCount, r.duplicateCount, r.rejectedCount, r.failedCount].every((n) => Number.isInteger(n) && n >= 0);
const resolutionBoundary = (value: any): value is Extract<ProviderResolutionCompositionRequest["resolution"], { executed: true }> => record(value) && value.executed === true && record(value.result) && value.result.factorKey === "MARKET.PRICE" && ID.test(value.result.requestedProviderKey) && typeof value.result.resolved === "boolean" && typeof value.result.confidenceAdjustment === "number" && Number.isFinite(value.result.confidenceAdjustment) && Array.isArray(value.result.warningCodes) && value.result.warningCodes.every((x: any) => PROVIDER_RESOLUTION_WARNING_CODES.includes(x)) && (value.result.resolved === false ? value.result.selectedProviderKey === null && (value.result.resolutionStatus === "MANUAL_REQUIRED" || value.result.resolutionStatus === "UNRESOLVED") : ID.test(value.result.selectedProviderKey) && PROVIDER_TYPES.includes(value.result.selectedProviderType) && ["RESOLVED", "DEGRADED_PRIMARY_USED", "FALLBACK_USED", "PROXY_USED"].includes(value.result.resolutionStatus));
const registryBoundary = (r: any) => record(r) && typeof r.get === "function";
const registrationBoundary = (r: any) => record(r) && ID.test(r.providerKey) && ID.test(r.runnerId) && record(r.runner) && typeof r.runner.run === "function";
const inputBoundary = (i: any) => record(i) && record(i.adapter) && ID.test(i.adapter.adapterId) && typeof i.adapter.readCandidates === "function";
const stages = (failed?: string, state?: "FAILED", code?: string): readonly ProviderResolutionCompositionStageReport[] => Object.freeze(PROVIDER_RESOLUTION_COMPOSITION_STAGES.map((stage) => Object.freeze({ stage, state: failed === undefined ? "COMPLETED" : stage === failed ? state! : before(stage, failed) ? "COMPLETED" : "SKIPPED", code: stage === failed ? code! : null })));
const skippedRuntimeStages = (): readonly ProviderResolutionCompositionStageReport[] => Object.freeze(PROVIDER_RESOLUTION_COMPOSITION_STAGES.map((stage) => Object.freeze({ stage, state: stage === "RESOLUTION_INPUT" ? "COMPLETED" as const : "SKIPPED" as const, code: null })));
const before = (stage: string, target: string) => PROVIDER_RESOLUTION_COMPOSITION_STAGES.indexOf(stage as never) < PROVIDER_RESOLUTION_COMPOSITION_STAGES.indexOf(target as never);
const failure = (code: ProviderResolutionCompositionFailureCode, request: unknown, stageReports: readonly ProviderResolutionCompositionStageReport[]): ProviderResolutionCompositionResult => { const result = record(request) && record(request.resolution) && request.resolution.executed === true && record(request.resolution.result) ? request.resolution.result : null; return freeze({ composed: false, code, factorKey: result && typeof result.factorKey === "string" ? result.factorKey : null, selectedProviderKey: result && typeof result.selectedProviderKey === "string" ? result.selectedProviderKey : null, resolutionStatus: result && typeof result.resolutionStatus === "string" ? result.resolutionStatus : null, stages: stageReports }) as ProviderResolutionCompositionResult; };
const freeze = <T extends object>(value: T): Readonly<T> => Object.freeze(value);
const record = (value: unknown): value is Record<string, any> => typeof value === "object" && value !== null && !Array.isArray(value);
