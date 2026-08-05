import type { EvidenceFactorCompatibilityService } from "./evidence-factor-compatibility.service.js";
import { EvidenceLifecycleResolverService } from "./evidence-lifecycle-resolver.service.js";
import { CompiledSubjectResolutionService } from "./compiled-subject-resolution.service.js";
import type { VersionedFactorDefinitionRegistry } from "../types/versioned-factor-definition.types.js";
import type { VersionedProviderBindingRegistry } from "../types/versioned-provider-binding.types.js";
import type { VersionedProviderResolutionPolicyRegistry } from "../types/versioned-provider-resolution-policy.types.js";
import type { ProviderResolutionRunnerRegistryPort } from "../types/provider-resolution-composition.types.js";
import type { CompiledFactorBinding, CompiledFixedSubject, CompiledRulebookDefinition } from "../types/compiled-rulebook.types.js";
import type { CompiledShadowObservation, CompiledShadowResolutionOutcome } from "../types/compiled-shadow-observation.types.js";
import type { EvidenceProviderResolutionAttestation } from "../types/evidence-provider-resolution-attestation.types.js";
import type { EvidenceReadRecord } from "../types/evidence-lifecycle.types.js";
import type { CompiledShadowAssemblyReasonCode, CompiledShadowAvailabilityStatus, CompiledShadowObservationAssemblyRequest, CompiledShadowObservationAssemblyResult, CompiledShadowObservationAssemblyTrace } from "../types/compiled-shadow-observation-assembly.types.js";

export type CompiledShadowObservationAssemblyDependencies = Readonly<{
  lifecycle?: Pick<EvidenceLifecycleResolverService, "resolveAll">;
  compatibility: Pick<EvidenceFactorCompatibilityService, "evaluate">;
  factorDefinitions: Pick<VersionedFactorDefinitionRegistry, "getExact">;
  providerBindings: Pick<VersionedProviderBindingRegistry, "getExact">;
  resolutionPolicies: Pick<VersionedProviderResolutionPolicyRegistry, "getExact">;
  providerRegistrations: Pick<ProviderResolutionRunnerRegistryPort, "get">;
  subjects?: CompiledSubjectResolutionService;
}>;

type Candidate = Readonly<{ observation: CompiledShadowObservation; trace: CompiledShadowObservationAssemblyTrace }>;
type CandidateEvaluation = Readonly<{ candidate: Candidate | null; reason: CompiledShadowAssemblyReasonCode | CompiledShadowAvailabilityStatus; trace: CompiledShadowObservationAssemblyTrace }>;

export class CompiledShadowObservationAssemblyService {
  private readonly lifecycle: Pick<EvidenceLifecycleResolverService, "resolveAll">;
  private readonly subjects: CompiledSubjectResolutionService;
  public constructor(private readonly dependencies: CompiledShadowObservationAssemblyDependencies) {
    this.lifecycle = dependencies.lifecycle ?? new EvidenceLifecycleResolverService();
    this.subjects = dependencies.subjects ?? new CompiledSubjectResolutionService();
  }

  public assemble(input: unknown): CompiledShadowObservationAssemblyResult {
    if (!requestShape(input)) return result("FAILED", null, null, null, [], [], ["INVALID_REQUEST"], "REQUEST");
    const request = input as CompiledShadowObservationAssemblyRequest;
    if (!identityMatches(request.rulebook, request.executionBinding)) return result("FAILED", request.rulebook, request.executionBinding, request.asOf, [], [], ["IDENTITY_MISMATCH"], "IDENTITY");
    if (!validDate(request.asOf)) return result("FAILED", request.rulebook, request.executionBinding, null, [], [], ["INVALID_AS_OF"], "REQUEST");
    if (!Array.isArray(request.evidence) || !dense(request.evidence) || !Array.isArray(request.attestations) || !dense(request.attestations)) return result("INVALID_EVIDENCE_SET", request.rulebook, request.executionBinding, request.asOf, [], [], ["INVALID_COLLECTION"], "EVIDENCE");
    if (!request.evidence.every(validEvidenceStructure) || !request.attestations.every(validAttestationStructure)) return result("INVALID_EVIDENCE_SET", request.rulebook, request.executionBinding, request.asOf, [], [], ["INVALID_RECORD"], "EVIDENCE");

    const duplicateEvidenceIds = duplicates(request.evidence.map((item) => item.evidenceId));
    if (duplicateEvidenceIds.size > 0) return result("INVALID_EVIDENCE_SET", request.rulebook, request.executionBinding, request.asOf, [], [], ["DUPLICATE_EVIDENCE_ID"], "EVIDENCE");
    const attestationMap = groupAttestations(request.attestations);
    const availability = new Map<string, CompiledShadowAvailabilityStatus>();
    const historicallyAvailable = request.evidence.filter((record) => {
      const status = availabilityOf(record, attestationMap.get(record.evidenceId) ?? [], request.asOf);
      availability.set(record.evidenceId, status);
      return status === "ELIGIBLE";
    });

    let lifecycle;
    try { lifecycle = this.lifecycle.resolveAll({ evidence: historicallyAvailable, asOf: request.asOf }); }
    catch { return result("INVALID_EVIDENCE_SET", request.rulebook, request.executionBinding, request.asOf, [], [], ["LIFECYCLE_RESOLUTION_FAILED"], "EVIDENCE"); }
    const lifecycleById = new Map(lifecycle.resolutions.map((entry) => [entry.evidenceId, entry]));
    const observations: CompiledShadowObservation[] = [];
    const traces: CompiledShadowObservationAssemblyTrace[] = [];
    let ambiguous = false;

    for (const binding of [...request.rulebook.factorBindings].sort((a, b) => a.order - b.order)) {
      const subjectResult = this.subjects.resolve(binding.subjectBinding, { tradedInstrument: request.tradedInstrument, underlyingAsset: request.underlyingAsset ?? null });
      if (!subjectResult.resolved) { traces.push(emptyTrace(binding, request.asOf, null, "INVALID", "SUBJECT_MISMATCH")); continue; }
      const evaluations = [...request.evidence]
        .sort((a, b) => compareText(a.evidenceId, b.evidenceId))
        .filter((record) => record.recordType === "OBSERVATION")
        .map((record) => this.evaluateCandidate(request, binding, subjectResult.subject, record, attestationMap.get(record.evidenceId) ?? [], availability.get(record.evidenceId) ?? "INVALID_INGESTION_TIME", lifecycleById.get(record.evidenceId)?.state ?? null));
      const matches = evaluations.flatMap((entry) => entry.candidate ? [entry.candidate] : []);
      if (matches.length > 1) { ambiguous = true; traces.push(emptyTrace(binding, request.asOf, subjectResult.subject, "INVALID", "AMBIGUOUS_CANDIDATES")); continue; }
      if (matches.length === 1) { observations.push(matches[0]!.observation); traces.push(matches[0]!.trace); continue; }
      const closest = evaluations.find((entry) => entry.reason !== "FACTOR_MISMATCH" && entry.reason !== "SUBJECT_MISMATCH") ?? evaluations[0];
      traces.push(closest?.trace ?? emptyTrace(binding, request.asOf, subjectResult.subject, "OMITTED", "NO_CANDIDATE"));
    }
    const projected = observations.length;
    const invalid = traces.filter((trace) => trace.disposition === "INVALID").length;
    const status = ambiguous || invalid > 0 ? "INVALID_EVIDENCE_SET" : projected === 0 ? "NO_USABLE_EVIDENCE" : projected === request.rulebook.factorBindings.length ? "COMPLETED" : "PARTIAL";
    const diagnostics = [...new Set(traces.flatMap((trace) => trace.reasonCodes))].sort(compareText);
    return result(status, request.rulebook, request.executionBinding, request.asOf, observations, traces, diagnostics.length > 0 ? diagnostics : ["ASSEMBLY_COMPLETED"], null);
  }

  private evaluateCandidate(request: CompiledShadowObservationAssemblyRequest, binding: CompiledFactorBinding, subject: CompiledFixedSubject, evidence: EvidenceReadRecord, attestations: readonly EvidenceProviderResolutionAttestation[], availabilityStatus: CompiledShadowAvailabilityStatus, lifecycleStatus: any): CandidateEvaluation {
    const base = traceBase(binding, subject, request.asOf, evidence, attestations[0] ?? null, availabilityStatus, lifecycleStatus);
    const reject = (reason: CompiledShadowAssemblyReasonCode | CompiledShadowAvailabilityStatus, invalid = false): CandidateEvaluation => ({ candidate: null, reason, trace: deepFreeze({ ...base, compatibilityStatus: reason === "FACTOR_MISMATCH" || reason === "SUBJECT_MISMATCH" ? null : "INCOMPATIBLE", disposition: invalid ? "INVALID" : "OMITTED", reasonCodes: [reason] }) });
    if (availabilityStatus !== "ELIGIBLE") return reject(availabilityStatus);
    if (lifecycleStatus !== "ACTIVE") return reject("LIFECYCLE_EXCLUDED");
    if (evidence.factorKey !== binding.factor.factorKey) return reject("FACTOR_MISMATCH");
    if (evidence.subject.type !== subject.type || evidence.subject.key !== subject.key) return reject("SUBJECT_MISMATCH");
    if (evidence.recordType !== "OBSERVATION" || evidence.value.type !== "NUMBER" || !Number.isFinite(evidence.value.numberValue)) return reject("VALUE_TYPE_MISMATCH");
    if (attestations.length === 0) return reject("PROVIDER_ATTESTATION_MISSING");
    if (attestations.length > 1) return reject("PROVIDER_ATTESTATION_AMBIGUOUS", true);
    const attestation = attestations[0]!;
    if (attestation.evidenceId !== evidence.evidenceId) return reject("EVIDENCE_ID_MISMATCH", true);
    if (attestation.providerBinding.providerBindingId !== binding.provider.providerBindingId || attestation.providerBinding.providerBindingVersion !== binding.provider.providerBindingVersion) return reject("PROVIDER_BINDING_MISMATCH");
    if (attestation.resolutionPolicy.policyId !== binding.provider.resolutionPolicyId || attestation.resolutionPolicy.policyVersion !== binding.provider.resolutionPolicyVersion) return reject("RESOLUTION_POLICY_MISMATCH");
    const providerBinding = this.dependencies.providerBindings.getExact(binding.provider.providerBindingId, binding.provider.providerBindingVersion);
    if (!providerBinding) return reject("PROVIDER_BINDING_NOT_FOUND");
    const resolutionPolicy = this.dependencies.resolutionPolicies.getExact(binding.provider.resolutionPolicyId, binding.provider.resolutionPolicyVersion);
    if (!resolutionPolicy) return reject("RESOLUTION_POLICY_NOT_FOUND");
    if (!providerBinding.compileEligible || !resolutionPolicy.compileEligible) return reject("PROVIDER_AUTHORITY_INELIGIBLE");
    if (!providerBinding.orderedProviderKeys.includes(attestation.selectedProviderKey)) return reject("SELECTED_PROVIDER_NOT_IN_BINDING");
    const registration = this.dependencies.providerRegistrations.get(attestation.selectedProviderKey);
    if (!registration) return reject("PROVIDER_REGISTRATION_MISSING");
    if (registration.evidenceProvenanceProvider !== evidence.provenance.provider) return reject("PROVIDER_PROVENANCE_MISMATCH");
    const exactFactor = this.dependencies.factorDefinitions.getExact(binding.factor.factorKey, binding.factor.factorVersion);
    if (!exactFactor || !exactFactor.compileEligible) return reject("FACTOR_VERSION_MISMATCH");
    const compatibility = this.dependencies.compatibility.evaluate({ evidence, asOf: request.asOf });
    if (!compatibility.compatible) return reject(compatibility.code === "STALE_EVIDENCE" || compatibility.code === "OBSERVED_IN_FUTURE" ? "FRESHNESS_REJECTED" : compatibility.code.startsWith("UNIT_") ? "UNIT_MISMATCH" : compatibility.code === "VALUE_TYPE_NOT_ALLOWED" ? "VALUE_TYPE_MISMATCH" : "FACTOR_VERSION_MISMATCH");
    if (compatibility.factorDefinitionVersion !== binding.factor.factorVersion) return reject("FACTOR_VERSION_MISMATCH");
    const unit = evidence.value.unit;
    if (typeof unit !== "string" || unit.length === 0) return reject("UNIT_MISMATCH");
    const outcome = projectStatus(attestation.resolutionStatus);
    const observation: CompiledShadowObservation = { factor: { ...binding.factor }, subject: { ...subject }, value: evidence.value.numberValue, unit, observedAt: new Date(evidence.observedAt.getTime()), confidence: evidence.confidence ?? null, providerAttestation: { providerBindingId: binding.provider.providerBindingId, providerBindingVersion: binding.provider.providerBindingVersion, resolutionPolicyId: binding.provider.resolutionPolicyId, resolutionPolicyVersion: binding.provider.resolutionPolicyVersion, selectedProviderKey: attestation.selectedProviderKey, resolutionOutcome: outcome } };
    const trace = deepFreeze({ ...traceBase(binding, subject, request.asOf, evidence, attestation, availabilityStatus, lifecycleStatus), compatibilityStatus: "COMPATIBLE" as const, freshness: structuredClone(compatibility.freshness), compiledResolutionOutcome: outcome, disposition: "PROJECTED" as const, reasonCodes: [] });
    return { candidate: { observation: deepFreeze(observation), trace }, reason: "NO_CANDIDATE", trace };
  }
}

const availabilityOf = (evidence: EvidenceReadRecord, attestations: readonly EvidenceProviderResolutionAttestation[], asOf: Date): CompiledShadowAvailabilityStatus => {
  const published = evidence.provenance.sourcePublishedAt;
  if (published === undefined) return "PUBLICATION_TIME_MISSING";
  if (!validDate(published)) return "INVALID_PUBLICATION_TIME";
  if (!validDate(evidence.createdAt)) return evidence.createdAt === undefined ? "INGESTION_TIME_MISSING" : "INVALID_INGESTION_TIME";
  if (published.getTime() > asOf.getTime()) return "NOT_YET_PUBLISHED";
  if (evidence.createdAt.getTime() > asOf.getTime()) return "NOT_YET_INGESTED";
  if (attestations.length === 0) return "ELIGIBLE";
  if (!validDate(attestations[0]!.createdAt)) return attestations[0]!.createdAt === undefined ? "ATTESTATION_CREATED_TIME_MISSING" : "INVALID_ATTESTATION_CREATED_TIME";
  if (attestations[0]!.createdAt.getTime() > asOf.getTime()) return "ATTESTATION_NOT_YET_PERSISTED";
  return "ELIGIBLE";
};
const projectStatus = (status: EvidenceProviderResolutionAttestation["resolutionStatus"]): CompiledShadowResolutionOutcome => status === "FALLBACK_USED" ? "FALLBACK" : status === "PROXY_USED" ? "PROXY" : "RESOLVED";
const traceBase = (binding: CompiledFactorBinding, subject: CompiledFixedSubject, asOf: Date, evidence: EvidenceReadRecord, attestation: EvidenceProviderResolutionAttestation | null, availabilityStatus: CompiledShadowAvailabilityStatus, lifecycleStatus: any) => ({ bindingIndex: binding.order, bindingId: binding.bindingId, factor: { ...binding.factor }, expectedSubject: { ...subject }, evidenceId: evidence.evidenceId, observedAt: cloneDate(evidence.observedAt), sourcePublishedAt: cloneDate(evidence.provenance.sourcePublishedAt), evidenceCreatedAt: cloneDate(evidence.createdAt), attestationId: attestation?.attestationId ?? null, attestationResolvedAt: cloneDate(attestation?.resolvedAt), attestationCreatedAt: cloneDate(attestation?.createdAt), asOf: new Date(asOf.getTime()), availabilityStatus, lifecycleStatus, compatibilityStatus: null, freshness: null, selectedProviderKey: attestation?.selectedProviderKey ?? null, evidenceProvenanceProvider: evidence.provenance.provider, providerBinding: attestation ? { ...attestation.providerBinding } : null, resolutionPolicy: attestation ? { ...attestation.resolutionPolicy } : null, detailedResolutionStatus: attestation?.resolutionStatus ?? null, compiledResolutionOutcome: null, confidenceAdjustment: attestation?.confidenceAdjustment ?? null, warningCodes: attestation ? [...attestation.warningCodes] : [], disposition: "OMITTED" as const, reasonCodes: [] as readonly any[] });
const emptyTrace = (binding: CompiledFactorBinding, asOf: Date, subject: CompiledFixedSubject | null, disposition: "OMITTED" | "INVALID", reason: CompiledShadowAssemblyReasonCode): CompiledShadowObservationAssemblyTrace => deepFreeze({ bindingIndex: binding.order, bindingId: binding.bindingId, factor: { ...binding.factor }, expectedSubject: subject ? { ...subject } : null, evidenceId: null, observedAt: null, sourcePublishedAt: null, evidenceCreatedAt: null, attestationId: null, attestationResolvedAt: null, attestationCreatedAt: null, asOf: new Date(asOf.getTime()), availabilityStatus: null, lifecycleStatus: null, compatibilityStatus: null, freshness: null, selectedProviderKey: null, evidenceProvenanceProvider: null, providerBinding: null, resolutionPolicy: null, detailedResolutionStatus: null, compiledResolutionOutcome: null, confidenceAdjustment: null, warningCodes: [], disposition, reasonCodes: [reason] });
const result = (status: CompiledShadowObservationAssemblyResult["status"], rulebook: CompiledRulebookDefinition | null, executionBinding: any, asOf: Date | null, observations: readonly CompiledShadowObservation[], traces: readonly CompiledShadowObservationAssemblyTrace[], diagnostics: readonly string[], failureStage: CompiledShadowObservationAssemblyResult["failureStage"]): CompiledShadowObservationAssemblyResult => deepFreeze({ status, rulebook: rulebook ? { ...rulebook.identity } : null, executionBinding: executionBinding ? { bindingId: executionBinding.bindingId, bindingVersion: executionBinding.bindingVersion } : null, asOf: cloneDate(asOf), observations: structuredClone(observations), traces: structuredClone(traces), counts: { bindingCount: rulebook?.factorBindings.length ?? 0, projectedCount: observations.length, omittedCount: traces.filter((trace) => trace.disposition === "OMITTED").length, invalidCount: traces.filter((trace) => trace.disposition === "INVALID").length }, diagnostics: [...diagnostics], failureStage });
const requestShape = (value: unknown): value is CompiledShadowObservationAssemblyRequest => record(value) && record(value.rulebook) && record(value.executionBinding) && Object.hasOwn(value, "asOf") && Object.hasOwn(value, "tradedInstrument") && Object.hasOwn(value, "evidence") && Object.hasOwn(value, "attestations");
const identityMatches = (r: any, b: any) => record(r.identity) && record(r.source) && record(b.compiledRulebook) && record(b.sourceTemplate) && b.compiledRulebook.rulebookId === r.identity.rulebookId && b.compiledRulebook.rulebookVersion === r.identity.rulebookVersion && b.sourceTemplate.scope === "SYSTEM" && b.sourceTemplate.templateId === r.source.templateId && b.sourceTemplate.templateVersion === r.source.templateVersion && Array.isArray(r.factorBindings);
const validEvidenceStructure = (e: any) => record(e) && semantic(e.evidenceId) && (e.recordType === "OBSERVATION" || e.recordType === "REVOCATION") && semantic(e.factorKey) && record(e.subject) && semantic(e.subject.type) && semantic(e.subject.key) && record(e.provenance) && semantic(e.provenance.provider) && validDate(e.observedAt);
const validAttestationStructure = (a: any) => record(a) && semantic(a.attestationId) && positive(a.attestationVersion) && semantic(a.evidenceId) && record(a.providerBinding) && record(a.resolutionPolicy) && semantic(a.selectedProviderKey) && ["RESOLVED", "DEGRADED_PRIMARY_USED", "FALLBACK_USED", "PROXY_USED"].includes(a.resolutionStatus) && typeof a.confidenceAdjustment === "number" && Number.isFinite(a.confidenceAdjustment) && Array.isArray(a.warningCodes) && dense(a.warningCodes) && validDate(a.resolvedAt);
const groupAttestations = (values: readonly EvidenceProviderResolutionAttestation[]) => { const map = new Map<string, EvidenceProviderResolutionAttestation[]>(); for (const value of values) map.set(value.evidenceId, [...(map.get(value.evidenceId) ?? []), value]); return map; };
const duplicates = (values: readonly string[]) => { const seen = new Set<string>(); const duplicate = new Set<string>(); for (const value of values) seen.has(value) ? duplicate.add(value) : seen.add(value); return duplicate; };
const cloneDate = (value: unknown): Date | null => validDate(value) ? new Date(value.getTime()) : null;
const compareText = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const validDate = (value: unknown): value is Date => value instanceof Date && Number.isFinite(value.getTime());
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
const semantic = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.trim() === value;
const dense = (values: readonly unknown[]) => { for (let index = 0; index < values.length; index += 1) if (!(index in values)) return false; return true; };
const record = (value: unknown): value is Record<string, any> => typeof value === "object" && value !== null && !Array.isArray(value);
const deepFreeze = <T>(value: T): T => { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); for (const nested of Object.values(value)) deepFreeze(nested); } return value; };
