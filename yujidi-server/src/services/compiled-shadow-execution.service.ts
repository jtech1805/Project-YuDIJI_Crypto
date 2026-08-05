import type { CompiledRulebookExecutionBindingReadResult } from "../types/compiled-rulebook-execution-binding.types.js";
import type { CompiledRulebookReadResult } from "../types/compiled-rulebook-repository.types.js";
import type { EvidenceReadResult } from "../types/evidence-read.types.js";
import type { EvidenceReadRecord } from "../types/evidence-lifecycle.types.js";
import type { EvidenceProviderResolutionAttestationReadResult } from "../types/evidence-provider-resolution-attestation.types.js";
import type { CompiledShadowObservationAssemblyResult } from "../types/compiled-shadow-observation-assembly.types.js";
import type { CompiledExecutionResult } from "../types/compiled-rulebook-execution.types.js";
import type { CompiledLegacyParityComparisonResult, CompiledLegacyParityPolicyValidationResult } from "../types/compiled-legacy-parity.types.js";
import type { CompiledRulebookDefinition } from "../types/compiled-rulebook.types.js";
import type { CompiledShadowExecutionIdentity, CompiledShadowExecutionOutcome, CompiledShadowExecutionRequest, CompiledShadowExecutionStage, CompiledShadowExactBindingProjection, CompiledShadowExactRulebookProjection, CompiledShadowParityOutcome, CompiledShadowSkipReason } from "../types/compiled-shadow-execution.types.js";
import { CompiledSubjectResolutionService } from "./compiled-subject-resolution.service.js";

type Dependencies = Readonly<{
  executionBindingReader: { getExactForSourceTemplate(identity: unknown): Promise<CompiledRulebookExecutionBindingReadResult> };
  compiledRulebookReader: { getExact(rulebookId: unknown, rulebookVersion: unknown): Promise<CompiledRulebookReadResult> };
  evidenceReader: { read(query: { factorKey: string; subjectType: any; subjectKey: string; asOf: Date }): Promise<EvidenceReadResult> };
  attestationReader: { getExactByEvidenceId(evidenceId: unknown): Promise<EvidenceProviderResolutionAttestationReadResult> };
  observationAssembler: { assemble(request: unknown): CompiledShadowObservationAssemblyResult };
  compiledRulebookExecutor: { execute(rulebook: unknown, request: unknown): CompiledExecutionResult };
  parityPolicyValidator: { validate(policy: unknown): CompiledLegacyParityPolicyValidationResult };
  parityComparisonService: { compare(request: unknown): CompiledLegacyParityComparisonResult };
  subjectResolver?: Pick<CompiledSubjectResolutionService, "resolve">;
}>;

type Validated = Readonly<{ valid: true; request: CompiledShadowExecutionRequest }> | Readonly<{ valid: false; identity: CompiledShadowExecutionIdentity; code: string }>;

export class CompiledShadowExecutionService {
  private readonly subjects: Pick<CompiledSubjectResolutionService, "resolve">;

  public constructor(private readonly dependencies: Dependencies) {
    this.subjects = dependencies.subjectResolver ?? new CompiledSubjectResolutionService();
  }

  public async execute(input: unknown): Promise<CompiledShadowExecutionOutcome> {
    const validated = validateRequest(input);
    if (!validated.valid) return validated.code === "TEMPLATE_NOT_ELIGIBLE"
      ? skipped(validated.identity, "REQUEST_VALIDATION", "TEMPLATE_NOT_ELIGIBLE")
      : frozen({ status: "FAILED", identity: validated.identity, stage: "REQUEST_VALIDATION", reasonCode: validated.code });
    const request = validated.request;
    let identity = identityFrom(request);

    let bindingRead: CompiledRulebookExecutionBindingReadResult;
    try { bindingRead = await this.dependencies.executionBindingReader.getExactForSourceTemplate(clone(request.sourceTemplate)); }
    catch { return failed(identity, "EXECUTION_BINDING_LOOKUP", "EXECUTION_BINDING_READ_FAILED"); }
    if (!bindingRead.found) return bindingRead.code === "NOT_FOUND"
      ? skipped(identity, "EXECUTION_BINDING_LOOKUP", "NO_EXECUTION_BINDING")
      : failed(identity, "EXECUTION_BINDING_LOOKUP", `EXECUTION_BINDING_${bindingRead.code}`);
    const bindingProjection = projectBinding(bindingRead.binding);
    identity = frozen({ ...identity, executionBinding: { bindingId: bindingRead.binding.bindingId, bindingVersion: bindingRead.binding.bindingVersion }, compiledRulebook: clone(bindingRead.binding.compiledRulebook) });

    let rulebookRead: CompiledRulebookReadResult;
    try { rulebookRead = await this.dependencies.compiledRulebookReader.getExact(bindingRead.binding.compiledRulebook.rulebookId, bindingRead.binding.compiledRulebook.rulebookVersion); }
    catch { return failed(identity, "RULEBOOK_LOOKUP", "RULEBOOK_READ_FAILED", { executionBinding: bindingProjection }); }
    if (!rulebookRead.found) return rulebookRead.code === "NOT_FOUND"
      ? skipped(identity, "RULEBOOK_LOOKUP", "EXACT_RULEBOOK_NOT_FOUND", { executionBinding: bindingProjection })
      : failed(identity, "RULEBOOK_LOOKUP", `RULEBOOK_${rulebookRead.code}`, { executionBinding: bindingProjection });
    const rulebookProjection = projectRulebook(rulebookRead.rulebook);
    identity = frozen({ ...identity, compilerLineage: clone(rulebookRead.rulebook.compilation) });
    if (!identityMatches(request, bindingRead.binding, rulebookRead.rulebook)) return failed(identity, "RULEBOOK_LOOKUP", "RULEBOOK_IDENTITY_MISMATCH", { executionBinding: bindingProjection, compiledRulebook: rulebookProjection });

    const evidence: EvidenceReadRecord[] = [];
    const seenQueries = new Set<string>();
    for (const factorBinding of [...rulebookRead.rulebook.factorBindings].sort((a, b) => a.order - b.order)) {
      const subject = this.subjects.resolve(factorBinding.subjectBinding, { tradedInstrument: request.tradedInstrument, underlyingAsset: request.underlyingAsset ?? null });
      if (!subject.resolved) return failed(identity, "EVIDENCE_READ", subject.code, { executionBinding: bindingProjection, compiledRulebook: rulebookProjection });
      const queryKey = `${factorBinding.factor.factorKey}\u0000${subject.subject.type}\u0000${subject.subject.key}`;
      if (seenQueries.has(queryKey)) continue;
      seenQueries.add(queryKey);
      let read: EvidenceReadResult;
      try { read = await this.dependencies.evidenceReader.read({ factorKey: factorBinding.factor.factorKey, subjectType: subject.subject.type, subjectKey: subject.subject.key, asOf: cloneDate(request.asOf) }); }
      catch { return failed(identity, "EVIDENCE_READ", "EVIDENCE_READ_FAILED", { executionBinding: bindingProjection, compiledRulebook: rulebookProjection }); }
      if (!read.complete) return failed(identity, "EVIDENCE_READ", "INCOMPLETE_EVIDENCE_HISTORY", { executionBinding: bindingProjection, compiledRulebook: rulebookProjection });
      evidence.push(...read.history);
    }
    const uniqueEvidence = deterministicEvidenceUnion(evidence);
    const attestations = [];
    for (const evidenceId of [...new Set(uniqueEvidence.map((item) => item.evidenceId))]) {
      let read: EvidenceProviderResolutionAttestationReadResult;
      try { read = await this.dependencies.attestationReader.getExactByEvidenceId(evidenceId); }
      catch { return failed(identity, "ATTESTATION_READ", "ATTESTATION_READ_FAILED", { executionBinding: bindingProjection, compiledRulebook: rulebookProjection }); }
      if (read.found) attestations.push(read.attestation);
      else if (read.code !== "NOT_FOUND") return failed(identity, "ATTESTATION_READ", `ATTESTATION_${read.code}`, { executionBinding: bindingProjection, compiledRulebook: rulebookProjection });
    }

    let assembly: CompiledShadowObservationAssemblyResult;
    try { assembly = this.dependencies.observationAssembler.assemble({ rulebook: rulebookRead.rulebook, executionBinding: bindingRead.binding, asOf: cloneDate(request.asOf), tradedInstrument: clone(request.tradedInstrument), ...(request.underlyingAsset ? { underlyingAsset: clone(request.underlyingAsset) } : {}), evidence: clone(uniqueEvidence), attestations: clone(attestations) }); }
    catch { return failed(identity, "OBSERVATION_ASSEMBLY", "OBSERVATION_ASSEMBLY_FAILED", { executionBinding: bindingProjection, compiledRulebook: rulebookProjection }); }
    const reached = { executionBinding: bindingProjection, compiledRulebook: rulebookProjection, assembly };
    if (assembly.status === "NO_USABLE_EVIDENCE") return skipped(identity, "OBSERVATION_ASSEMBLY", uniqueEvidence.length === 0 ? "NO_RELEVANT_EVIDENCE" : "NO_USABLE_OBSERVATIONS", reached);
    if (assembly.status === "INVALID_EVIDENCE_SET" || assembly.status === "FAILED") return failed(identity, "OBSERVATION_ASSEMBLY", assembly.status, reached);
    if ((assembly.status !== "COMPLETED" && assembly.status !== "PARTIAL") || assembly.observations.length === 0) return skipped(identity, "OBSERVATION_ASSEMBLY", "ASSEMBLY_NOT_EXECUTABLE", reached);

    let compiledExecution: CompiledExecutionResult;
    try { compiledExecution = this.dependencies.compiledRulebookExecutor.execute(rulebookRead.rulebook, { rulebook: clone(rulebookRead.rulebook.identity), asOf: cloneDate(request.asOf), subjectContext: { tradedInstrument: clone(request.tradedInstrument), underlyingAsset: request.underlyingAsset ? clone(request.underlyingAsset) : null }, observations: clone(assembly.observations) }); }
    catch { return failed(identity, "COMPILED_EXECUTION", "COMPILED_EXECUTION_FAILED", reached); }
    if (compiledExecution.status === "FAILED") return failed(identity, "COMPILED_EXECUTION", compiledExecution.failureCode ?? compiledExecution.stageFailureCode ?? "COMPILED_EXECUTION_FAILED", { ...reached, compiledExecution });
    const parity = this.compareParity(request, compiledExecution);
    return frozen({ status: "COMPLETED", identity, ...reached, compiledExecution, parity });
  }

  private compareParity(request: CompiledShadowExecutionRequest, compiled: CompiledExecutionResult): CompiledShadowParityOutcome {
    if (!request.legacyResult || !request.parityPolicy || !request.legacyNumericEligibility) return frozen({ status: "NOT_REQUESTED" });
    let policy: CompiledLegacyParityPolicyValidationResult;
    try { policy = this.dependencies.parityPolicyValidator.validate(request.parityPolicy); }
    catch { return frozen({ status: "UNAVAILABLE", stage: "PARITY_POLICY_VALIDATION", reasonCode: "PARITY_POLICY_VALIDATION_FAILED" }); }
    if (!policy.valid) return frozen({ status: "UNAVAILABLE", stage: "PARITY_POLICY_VALIDATION", reasonCode: policy.code });
    let compared: CompiledLegacyParityComparisonResult;
    try { compared = this.dependencies.parityComparisonService.compare({ policy: policy.policy, legacy: request.legacyResult, compiled, legacyNumericEligibility: request.legacyNumericEligibility }); }
    catch { return frozen({ status: "UNAVAILABLE", stage: "PARITY_COMPARISON", reasonCode: "PARITY_COMPARISON_FAILED" }); }
    return compared.compared ? frozen({ status: "COMPLETED", result: compared.result }) : frozen({ status: "UNAVAILABLE", stage: "PARITY_COMPARISON", reasonCode: compared.code });
  }
}

const validateRequest = (input: unknown): Validated => {
  const fallback = emptyIdentity(input);
  if (!record(input)) return { valid: false, identity: fallback, code: "INVALID_SHADOW_EXECUTION_REQUEST" };
  if (!record(input.sourceTemplate) || !identifier(input.sourceTemplate.templateId) || !positive(input.sourceTemplate.templateVersion)) return { valid: false, identity: fallback, code: "INVALID_SOURCE_TEMPLATE_IDENTITY" };
  if (input.sourceTemplate.scope !== "SYSTEM") return input.sourceTemplate.scope === "USER" ? { valid: false, identity: fallback, code: "TEMPLATE_NOT_ELIGIBLE" } : { valid: false, identity: fallback, code: "INVALID_SOURCE_TEMPLATE_IDENTITY" };
  if (!validDate(input.asOf)) return { valid: false, identity: fallback, code: "INVALID_EXECUTION_AS_OF" };
  if (!subject(input.tradedInstrument, "INSTRUMENT")) return { valid: false, identity: fallback, code: "INVALID_TRADED_INSTRUMENT" };
  if (input.underlyingAsset !== undefined && !subject(input.underlyingAsset, "ASSET")) return { valid: false, identity: fallback, code: "INVALID_UNDERLYING_ASSET" };
  if (!record(input.shadowExecutionIdentity) || !semantic(input.shadowExecutionIdentity.shadowExecutionId) || !validDate(input.shadowExecutionIdentity.requestedAt) || (input.shadowExecutionIdentity.authoritativeScoreCheckId !== undefined && !semantic(input.shadowExecutionIdentity.authoritativeScoreCheckId))) return { valid: false, identity: fallback, code: "INVALID_SHADOW_EXECUTION_IDENTITY" };
  const parityPresence = [input.legacyResult !== undefined, input.parityPolicy !== undefined, input.legacyNumericEligibility !== undefined];
  if (!parityPresence.every((value) => value === parityPresence[0])) return { valid: false, identity: fallback, code: "INVALID_PARITY_INPUT_COMBINATION" };
  if (input.legacyNumericEligibility !== undefined && (!record(input.legacyNumericEligibility) || typeof input.legacyNumericEligibility.eligible !== "boolean" || !(input.legacyNumericEligibility.reasonCode === null || semantic(input.legacyNumericEligibility.reasonCode)))) return { valid: false, identity: fallback, code: "INVALID_LEGACY_NUMERIC_ELIGIBILITY" };
  return { valid: true, request: clone(input as CompiledShadowExecutionRequest) };
};

const identityMatches = (request: CompiledShadowExecutionRequest, binding: any, rulebook: CompiledRulebookDefinition) => binding.sourceTemplate.templateId === request.sourceTemplate.templateId && binding.sourceTemplate.templateVersion === request.sourceTemplate.templateVersion && binding.sourceTemplate.scope === request.sourceTemplate.scope && binding.compiledRulebook.rulebookId === rulebook.identity.rulebookId && binding.compiledRulebook.rulebookVersion === rulebook.identity.rulebookVersion && rulebook.source.templateId === request.sourceTemplate.templateId && rulebook.source.templateVersion === request.sourceTemplate.templateVersion;
const projectBinding = (value: any): CompiledShadowExactBindingProjection => frozen({ bindingId: value.bindingId, bindingVersion: value.bindingVersion, sourceTemplate: clone(value.sourceTemplate), compiledRulebook: clone(value.compiledRulebook) });
const projectRulebook = (value: CompiledRulebookDefinition): CompiledShadowExactRulebookProjection => frozen({ identity: clone(value.identity), sourceTemplate: clone(value.source), compilation: clone(value.compilation) });
const identityFrom = (request: CompiledShadowExecutionRequest): CompiledShadowExecutionIdentity => frozen({ shadowExecutionId: request.shadowExecutionIdentity.shadowExecutionId, authoritativeScoreCheckId: request.shadowExecutionIdentity.authoritativeScoreCheckId ?? null, sourceTemplate: clone(request.sourceTemplate), executionBinding: null, compiledRulebook: null, compilerLineage: null, asOf: cloneDate(request.asOf), requestedAt: cloneDate(request.shadowExecutionIdentity.requestedAt) });
const emptyIdentity = (input: unknown): CompiledShadowExecutionIdentity => { const value = record(input) ? input : {}; const shadow = record(value.shadowExecutionIdentity) ? value.shadowExecutionIdentity : {}; return frozen({ shadowExecutionId: semantic(shadow.shadowExecutionId) ? shadow.shadowExecutionId : null, authoritativeScoreCheckId: semantic(shadow.authoritativeScoreCheckId) ? shadow.authoritativeScoreCheckId : null, sourceTemplate: null, executionBinding: null, compiledRulebook: null, compilerLineage: null, asOf: validDate(value.asOf) ? cloneDate(value.asOf) : null, requestedAt: validDate(shadow.requestedAt) ? cloneDate(shadow.requestedAt) : null }); };
const deterministicEvidenceUnion = (records: readonly EvidenceReadRecord[]): EvidenceReadRecord[] => { const output: EvidenceReadRecord[] = []; const seen = new Map<string, string>(); for (const record of records) { const signature = stable(record); const previous = seen.get(record.evidenceId); if (previous === signature) continue; seen.set(record.evidenceId, signature); output.push(record); } return output; };
const stable = (value: unknown): string => JSON.stringify(value, (_key, item) => item instanceof Date ? item.toISOString() : item);
const failed = (identity: CompiledShadowExecutionIdentity, stage: CompiledShadowExecutionStage, reasonCode: string, reached = {}): CompiledShadowExecutionOutcome => frozen({ status: "FAILED", identity, stage, reasonCode, ...reached });
const skipped = (identity: CompiledShadowExecutionIdentity, stage: CompiledShadowExecutionStage, reasonCode: CompiledShadowSkipReason, reached = {}): CompiledShadowExecutionOutcome => frozen({ status: "SKIPPED", identity, stage, reasonCode, ...reached });
const record = (value: unknown): value is Record<string, any> => typeof value === "object" && value !== null && !Array.isArray(value);
const identifier = (value: unknown): value is string => typeof value === "string" && /^[A-Z0-9_]{1,120}$/.test(value);
const semantic = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 160 && value.trim() === value;
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
const validDate = (value: unknown): value is Date => value instanceof Date && Number.isFinite(value.getTime());
const subject = (value: unknown, type: "INSTRUMENT" | "ASSET") => record(value) && value.type === type && semantic(value.key) && /^[A-Z0-9._:-]+$/.test(value.key);
const cloneDate = (value: Date): Date => new Date(value.getTime());
const clone = <T>(value: T): T => structuredClone(value);
const frozen = <T>(value: T): T => deepFreeze(clone(value));
const deepFreeze = <T>(value: T): T => { if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value; for (const child of Object.values(value)) deepFreeze(child); return Object.freeze(value); };
