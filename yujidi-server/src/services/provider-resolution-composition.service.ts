import { EVIDENCE_INGESTION_STATUSES } from "../types/evidence-ingestion.types.js";
import { EVIDENCE_PROVIDER_RUN_FAILURE_CODES } from "../types/evidence-provider-run.types.js";
import { PROVIDER_TYPES } from "../types/provider-definition.types.js";
import { PROVIDER_RESOLUTION_WARNING_CODES } from "../types/provider-resolution-policy.types.js";
import { PROVIDER_RESOLUTION_COMPOSITION_STAGES, type ProviderResolutionCompositionFailureCode, type ProviderResolutionCompositionRequest, type ProviderResolutionCompositionResult, type ProviderResolutionCompositionStageReport, type SafeEvidenceAttestationOutcome, type SafeEvidenceAttestationProjection, type SafeEvidenceIngestionProjection } from "../types/provider-resolution-composition.types.js";

const ID = /^[A-Z0-9_]{1,120}$/;

export class ProviderResolutionCompositionService {
  public async compose(request: ProviderResolutionCompositionRequest): Promise<ProviderResolutionCompositionResult> {
    if (!requestBoundary(request)) return failure("INVALID_REQUEST", request, stages("RESOLUTION_INPUT", "INVALID_REQUEST"));
    if (!resolutionBoundary(request.resolution)) return failure("INVALID_RESOLUTION_BOUNDARY", request, stages("RESOLUTION_INPUT", "INVALID_RESOLUTION_BOUNDARY"));
    if (!bindingBoundary(request.providerBinding)) return failure("INVALID_PROVIDER_BINDING", request, stages("RESOLUTION_INPUT", "INVALID_PROVIDER_BINDING"));
    if (!validDate(request.resolvedAt)) return failure("INVALID_RESOLVED_AT", request, stages("RESOLUTION_INPUT", "INVALID_RESOLVED_AT"));
    if (!attestationBoundary(request)) return failure("INVALID_ATTESTATION_BOUNDARY", request, stages("RESOLUTION_INPUT", "INVALID_ATTESTATION_BOUNDARY"));
    const resolution = (request.resolution as Extract<ProviderResolutionCompositionRequest["resolution"], { executed: true }>).result;
    if (!bindingMatches(request.providerBinding, resolution)) return failure("PROVIDER_BINDING_MISMATCH", request, stages("RESOLUTION_INPUT", "PROVIDER_BINDING_MISMATCH"));
    if (!registryBoundary(request.runnerRegistry)) return failure("INVALID_RUNNER_REGISTRY_BOUNDARY", request, stages("RUNNER_LOOKUP", "INVALID_RUNNER_REGISTRY_BOUNDARY"));
    if (!inputBoundary(request.executionInput)) return failure("INVALID_EXECUTION_INPUT", request, stages("RESOLUTION_INPUT", "INVALID_EXECUTION_INPUT"));
    const lineage = lineageOf(request);
    if (!resolution.resolved) return deepFreeze({ composed: true as const, status: "FAILED" as const, resolved: false as const, ...lineage, selectedProviderKey: null, resolutionStatus: resolution.resolutionStatus, runnerId: null, providerExecutionStatus: "SKIPPED" as const, candidateCount: 0 as const, evidenceOutcome: null, attestationOutcome: null, stages: skippedRuntimeStages() });

    const registration = request.runnerRegistry.get(resolution.selectedProviderKey);
    if (registration === null) return failure("RUNNER_NOT_REGISTERED", request, stages("RUNNER_LOOKUP", "RUNNER_NOT_REGISTERED"));
    if (!registrationBoundary(registration)) return failure("INVALID_RUNNER_REGISTRY_BOUNDARY", request, stages("RUNNER_LOOKUP", "INVALID_RUNNER_REGISTRY_BOUNDARY"));
    if (registration.providerKey !== resolution.selectedProviderKey) return failure("SELECTED_PROVIDER_MISMATCH", request, stages("RUNNER_LOOKUP", "SELECTED_PROVIDER_MISMATCH"));
    if (registration.runnerId !== request.executionInput.adapter.adapterId) return failure("RUNNER_IDENTITY_MISMATCH", request, stages("RUNNER_LOOKUP", "RUNNER_IDENTITY_MISMATCH"));

    let runResult: any;
    try { runResult = await registration.runner.run(request.executionInput); }
    catch { return failure("RUNNER_EXECUTION_THROWN", request, stages("PROVIDER_EXECUTION", "RUNNER_EXECUTION_THROWN")); }
    try {
      if (!record(runResult) || runResult.status === "FAILED") return failure(failedRunBoundary(runResult) ? "RUNNER_EXECUTION_FAILED" : "RUNNER_RESULT_INVALID", request, stages("PROVIDER_EXECUTION", failedRunBoundary(runResult) ? "RUNNER_EXECUTION_FAILED" : "RUNNER_RESULT_INVALID"));
      if (!completedRunBoundary(runResult) || runResult.providerKey !== registration.runnerId) return failure("RUNNER_RESULT_INVALID", request, stages("PROVIDER_EXECUTION", "RUNNER_RESULT_INVALID"));
    } catch { return failure("RUNNER_RESULT_INVALID", request, stages("PROVIDER_EXECUTION", "RUNNER_RESULT_INVALID")); }

    let evidenceOutcome: SafeEvidenceIngestionProjection;
    try { evidenceOutcome = projectEvidence(runResult); }
    catch { return failure("EVIDENCE_INGESTION_THROWN", request, stages("EVIDENCE_INGESTION", "EVIDENCE_INGESTION_THROWN")); }
    if (evidenceOutcome.evidenceIds.length === 0 && runResult.failedCount > 0) return failure("EVIDENCE_INGESTION_FAILED", request, stages("EVIDENCE_INGESTION", "EVIDENCE_INGESTION_FAILED"));

    const attestationOutcome = await emitAttestations(request, registration.evidenceProvenanceProvider, evidenceOutcome);
    const status = evidenceOutcome.evidenceIds.length === 0 ? "FAILED" as const : attestationOutcome.failedCount > 0 || runResult.rejectedCount > 0 || runResult.failedCount > 0 ? "PARTIAL" as const : "COMPLETED" as const;
    return deepFreeze({ composed: true as const, status, resolved: true as const, ...lineage, selectedProviderKey: resolution.selectedProviderKey, selectedProviderType: resolution.selectedProviderType, resolutionStatus: resolution.resolutionStatus, runnerId: registration.runnerId, evidenceProvenanceProvider: registration.evidenceProvenanceProvider, providerExecutionStatus: runResult.status, candidateCount: runResult.candidateCount, evidenceOutcome, attestationOutcome, stages: stages() });
  }
}

const emitAttestations = async (request: ProviderResolutionCompositionRequest, expectedProvider: string, evidence: SafeEvidenceIngestionProjection): Promise<SafeEvidenceAttestationProjection> => {
  const outcomes: SafeEvidenceAttestationOutcome[] = [];
  for (const result of evidence.results) {
    if (result.evidenceId === null) { outcomes.push(Object.freeze({ index: result.index, evidenceId: null, attestationId: null, status: "SKIPPED", code: "INGESTION_NOT_PERSISTED" })); continue; }
    let identity: { attestationId: string; attestationVersion: number };
    try { identity = request.attestationIdentityFactory.create(Object.freeze({ evidenceId: result.evidenceId, candidateIndex: result.index })); }
    catch { outcomes.push(failedAttestation(result.index, result.evidenceId, null, "IDENTITY_CREATION_FAILED")); continue; }
    if (!record(identity) || !ID.test(identity.attestationId) || !positive(identity.attestationVersion)) { outcomes.push(failedAttestation(result.index, result.evidenceId, null, "IDENTITY_CREATION_FAILED")); continue; }
    let canonical: any;
    try { canonical = await request.evidenceRepository.findByEvidenceId(result.evidenceId); }
    catch { outcomes.push(failedAttestation(result.index, result.evidenceId, identity.attestationId, "EVIDENCE_LOOKUP_FAILED")); continue; }
    if (!record(canonical)) { outcomes.push(failedAttestation(result.index, result.evidenceId, identity.attestationId, "EVIDENCE_NOT_FOUND")); continue; }
    if (canonical.evidenceId !== result.evidenceId || !record(canonical.provenance) || canonical.provenance.provider !== expectedProvider) { outcomes.push(failedAttestation(result.index, result.evidenceId, identity.attestationId, "PROVENANCE_MISMATCH")); continue; }
    const resolution = (request.resolution as Extract<ProviderResolutionCompositionRequest["resolution"], { executed: true }>).result;
    if (!resolution.resolved) throw new Error("unreachable resolution state");
    let inserted;
    try { inserted = await request.attestationService.insert({ ...identity, evidenceId: result.evidenceId, providerBinding: { providerBindingId: request.providerBinding.providerBindingId, providerBindingVersion: request.providerBinding.providerBindingVersion }, resolutionPolicy: { policyId: resolution.policyId, policyVersion: resolution.policyVersion }, selectedProviderKey: resolution.selectedProviderKey, selectedProviderType: resolution.selectedProviderType, resolutionStatus: resolution.resolutionStatus, confidenceAdjustment: resolution.confidenceAdjustment, warningCodes: [...resolution.warningCodes], resolvedAt: new Date(request.resolvedAt.getTime()) }); }
    catch { outcomes.push(failedAttestation(result.index, result.evidenceId, identity.attestationId, "ATTESTATION_INSERT_FAILED")); continue; }
    if (inserted?.code === "INSERTED" || inserted?.code === "ALREADY_EXISTS") outcomes.push(Object.freeze({ index: result.index, evidenceId: result.evidenceId, attestationId: inserted.attestation.attestationId, status: inserted.code, code: inserted.code }));
    else outcomes.push(failedAttestation(result.index, result.evidenceId, identity.attestationId, inserted?.code === "CONFLICT" ? "ATTESTATION_CONFLICT" : inserted?.code === "EVIDENCE_NOT_FOUND" ? "EVIDENCE_NOT_FOUND" : "ATTESTATION_INSERT_FAILED"));
  }
  return deepFreeze({ attemptedCount: outcomes.filter((x) => x.status !== "SKIPPED").length, insertedCount: outcomes.filter((x) => x.status === "INSERTED").length, alreadyExistsCount: outcomes.filter((x) => x.status === "ALREADY_EXISTS").length, failedCount: outcomes.filter((x) => x.status === "FAILED").length, results: outcomes });
};

type FailedAttestationCode = Exclude<SafeEvidenceAttestationOutcome["code"], "INSERTED" | "ALREADY_EXISTS" | "INGESTION_NOT_PERSISTED">;
const failedAttestation = (index: number, evidenceId: string, attestationId: string | null, code: FailedAttestationCode): SafeEvidenceAttestationOutcome => Object.freeze({ index, evidenceId, attestationId, status: "FAILED", code });
const projectEvidence = (run: any): SafeEvidenceIngestionProjection => { const results: readonly { index: number; status: any; evidenceId: string | null }[] = Object.freeze(run.results.map((entry: any) => Object.freeze({ index: entry.index, status: entry.result.status, evidenceId: entry.result.status === "CREATED" || entry.result.status === "DUPLICATE" ? entry.result.evidenceId : null }))); return deepFreeze({ createdCount: run.createdCount, duplicateCount: run.duplicateCount, rejectedCount: run.rejectedCount, failedCount: run.failedCount, evidenceIds: results.flatMap((item) => item.evidenceId === null ? [] : [item.evidenceId]), results }); };
const lineageOf = (request: ProviderResolutionCompositionRequest) => { const r = (request.resolution as Extract<ProviderResolutionCompositionRequest["resolution"], { executed: true }>).result; return { factorKey: r.factorKey, requestedProviderKey: r.requestedProviderKey, providerBinding: Object.freeze({ providerBindingId: request.providerBinding.providerBindingId, providerBindingVersion: request.providerBinding.providerBindingVersion }), resolutionPolicy: Object.freeze({ policyId: r.policyId, policyVersion: r.policyVersion }), confidenceAdjustment: r.confidenceAdjustment, warningCodes: Object.freeze([...r.warningCodes]), resolvedAt: Object.freeze(new Date(request.resolvedAt.getTime())) as Date }; };
const requestBoundary = (r: any): r is ProviderResolutionCompositionRequest => record(r) && ["resolution", "providerBinding", "resolvedAt", "runnerRegistry", "executionInput", "evidenceRepository", "attestationService", "attestationIdentityFactory"].every((key) => Object.hasOwn(r, key));
const attestationBoundary = (r: any) => record(r.evidenceRepository) && typeof r.evidenceRepository.findByEvidenceId === "function" && record(r.attestationService) && typeof r.attestationService.insert === "function" && record(r.attestationIdentityFactory) && typeof r.attestationIdentityFactory.create === "function";
const bindingBoundary = (b: any) => record(b) && ID.test(b.providerBindingId) && positive(b.providerBindingVersion) && typeof b.factorKey === "string" && b.factorKey.length > 0 && positive(b.factorVersion) && Array.isArray(b.orderedProviderKeys) && dense(b.orderedProviderKeys) && b.orderedProviderKeys.length > 0 && b.orderedProviderKeys.every((x: any) => ID.test(x)) && new Set(b.orderedProviderKeys).size === b.orderedProviderKeys.length && typeof b.compileEligible === "boolean";
const bindingMatches = (b: any, r: any) => b.factorKey === r.factorKey && Array.isArray(r.attempts) && dense(r.attempts) && r.attempts.length === b.orderedProviderKeys.length && r.requestedProviderKey === b.orderedProviderKeys[0] && r.attempts.every((a: any, index: number) => record(a) && a.order === index && a.providerKey === b.orderedProviderKeys[index]) && (!r.resolved || (r.selectedProviderOrder >= 0 && b.orderedProviderKeys[r.selectedProviderOrder] === r.selectedProviderKey && r.attempts[r.selectedProviderOrder]?.outcome === "SELECTED"));
const completedRunBoundary = (r: any) => record(r) && (r.status === "COMPLETED" || r.status === "PARTIAL") && ID.test(r.providerKey) && counts(r) && Array.isArray(r.results) && dense(r.results) && r.results.length === r.candidateCount && r.results.every(candidateResultBoundary) && r.createdCount + r.duplicateCount + r.rejectedCount + r.failedCount === r.candidateCount && (r.status === "COMPLETED" ? r.rejectedCount === 0 && r.failedCount === 0 : r.rejectedCount > 0 || r.failedCount > 0);
const candidateResultBoundary = (x: any, index: number) => record(x) && x.index === index && record(x.result) && EVIDENCE_INGESTION_STATUSES.includes(x.result.status) && ((x.result.status === "CREATED" || x.result.status === "DUPLICATE") ? typeof x.result.evidenceId === "string" && x.result.evidenceId.length > 0 : true);
const failedRunBoundary = (r: any) => record(r) && r.status === "FAILED" && (r.providerKey === null || (typeof r.providerKey === "string" && ID.test(r.providerKey))) && EVIDENCE_PROVIDER_RUN_FAILURE_CODES.includes(r.failureCode) && counts(r) && r.candidateCount === 0 && Array.isArray(r.results) && r.results.length === 0;
const counts = (r: any) => [r.candidateCount, r.createdCount, r.duplicateCount, r.rejectedCount, r.failedCount].every((n) => Number.isInteger(n) && n >= 0);
const resolutionBoundary = (value: any): value is Extract<ProviderResolutionCompositionRequest["resolution"], { executed: true }> => record(value) && value.executed === true && record(value.result) && typeof value.result.factorKey === "string" && value.result.factorKey.length > 0 && ID.test(value.result.policyId) && positive(value.result.policyVersion) && ID.test(value.result.requestedProviderKey) && typeof value.result.resolved === "boolean" && typeof value.result.confidenceAdjustment === "number" && Number.isFinite(value.result.confidenceAdjustment) && Array.isArray(value.result.warningCodes) && dense(value.result.warningCodes) && value.result.warningCodes.every((x: any) => PROVIDER_RESOLUTION_WARNING_CODES.includes(x)) && Array.isArray(value.result.attempts) && dense(value.result.attempts) && (value.result.resolved === false ? value.result.selectedProviderKey === null && (value.result.resolutionStatus === "MANUAL_REQUIRED" || value.result.resolutionStatus === "UNRESOLVED") : ID.test(value.result.selectedProviderKey) && PROVIDER_TYPES.includes(value.result.selectedProviderType) && Number.isInteger(value.result.selectedProviderOrder) && ["RESOLVED", "DEGRADED_PRIMARY_USED", "FALLBACK_USED", "PROXY_USED"].includes(value.result.resolutionStatus));
const registryBoundary = (r: any) => record(r) && typeof r.get === "function";
const registrationBoundary = (r: any) => record(r) && ID.test(r.providerKey) && ID.test(r.runnerId) && typeof r.evidenceProvenanceProvider === "string" && r.evidenceProvenanceProvider.length > 0 && r.evidenceProvenanceProvider.trim() === r.evidenceProvenanceProvider && record(r.runner) && typeof r.runner.run === "function";
const inputBoundary = (i: any) => record(i) && record(i.adapter) && ID.test(i.adapter.adapterId) && typeof i.adapter.readCandidates === "function";
const stages = (failed?: string, code?: string): readonly ProviderResolutionCompositionStageReport[] => Object.freeze(PROVIDER_RESOLUTION_COMPOSITION_STAGES.map((stage) => Object.freeze({ stage, state: failed === undefined ? "COMPLETED" : stage === failed ? "FAILED" : before(stage, failed) ? "COMPLETED" : "SKIPPED", code: stage === failed ? code! : null })));
const skippedRuntimeStages = (): readonly ProviderResolutionCompositionStageReport[] => Object.freeze(PROVIDER_RESOLUTION_COMPOSITION_STAGES.map((stage) => Object.freeze({ stage, state: stage === "RESOLUTION_INPUT" ? "COMPLETED" as const : "SKIPPED" as const, code: null })));
const before = (stage: string, target: string) => PROVIDER_RESOLUTION_COMPOSITION_STAGES.indexOf(stage as never) < PROVIDER_RESOLUTION_COMPOSITION_STAGES.indexOf(target as never);
const failure = (code: ProviderResolutionCompositionFailureCode, request: unknown, reports: readonly ProviderResolutionCompositionStageReport[]): ProviderResolutionCompositionResult => { const result = record(request) && record(request.resolution) && request.resolution.executed === true && record(request.resolution.result) ? request.resolution.result : null; return deepFreeze({ composed: false as const, status: "FAILED" as const, code, factorKey: result && typeof result.factorKey === "string" ? result.factorKey : null, selectedProviderKey: result && typeof result.selectedProviderKey === "string" ? result.selectedProviderKey : null, resolutionStatus: result && typeof result.resolutionStatus === "string" ? result.resolutionStatus : null, stages: reports }) as ProviderResolutionCompositionResult; };
const deepFreeze = <T>(value: T): T => { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value)) deepFreeze(child); } return value; };
const validDate = (value: unknown): value is Date => value instanceof Date && Number.isFinite(value.getTime());
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
const dense = (values: readonly unknown[]) => { for (let index = 0; index < values.length; index += 1) if (!(index in values)) return false; return true; };
const record = (value: unknown): value is Record<string, any> => typeof value === "object" && value !== null && !Array.isArray(value);
