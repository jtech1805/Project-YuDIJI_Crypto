import { type FactorDefinition, type FactorFreshnessPolicy, type FactorKey } from "../../types/factor-registry.types.js";
import { MAX_COMPILED_EXECUTION_OBSERVATIONS } from "../../types/compiled-execution-request.types.js";
import type { CompiledInputFreshness } from "../../types/compiled-factor-input.types.js";
import type { CompiledFactorBinding } from "../../types/compiled-rulebook.types.js";
import type { VersionedFactorDefinitionRegistry } from "../../types/versioned-factor-definition.types.js";
import type { CompiledShadowInputAssemblyResult, ResolvedExecutionInput } from "../../types/resolved-execution-input.types.js";
import type { CompiledObservationAttestationValidationService } from "./compiled-observation-attestation-validation.service.js";
import { CompiledObservationSelectionService } from "./compiled-observation-selection.service.js";
import { CompiledSubjectResolutionService } from "./compiled-subject-resolution.service.js";

export type CompiledShadowInputAssemblyDependencies = Readonly<{
  factorDefinitions: Pick<VersionedFactorDefinitionRegistry, "getExact">;
  attestation: Pick<CompiledObservationAttestationValidationService, "validate">;
  subjects?: CompiledSubjectResolutionService;
  observations?: CompiledObservationSelectionService;
}>;

export class CompiledShadowInputAssemblyService {
  private readonly subjects: CompiledSubjectResolutionService;
  private readonly observations: CompiledObservationSelectionService;
  public constructor(private readonly dependencies: CompiledShadowInputAssemblyDependencies) {
    this.subjects = dependencies.subjects ?? new CompiledSubjectResolutionService();
    this.observations = dependencies.observations ?? new CompiledObservationSelectionService();
  }

  public assemble(request: unknown): CompiledShadowInputAssemblyResult {
    const envelope = validateEnvelope(request);
    if (!envelope.valid) return fail(envelope.code);
    const { execution, binding } = envelope;
    const subject = this.subjects.resolve(binding.subjectBinding, execution.subjectContext);
    if (!subject.resolved) return fail(subject.code);
    const selection = this.observations.select({ observations: execution.observations, binding, resolvedSubject: subject.subject });
    if (!selection.selected) return fail(selection.code);
    const attestation = this.dependencies.attestation.validate({ observation: selection.observation, binding, resolvedSubject: subject.subject });
    if (!attestation.valid) return Object.freeze({ resolved: false, code: "OBSERVATION_ATTESTATION_FAILED", attestationCode: attestation.code });
    const factor = this.dependencies.factorDefinitions.getExact(binding.factor.factorKey as FactorKey, binding.factor.factorVersion);
    if (!factor) return fail("FACTOR_DEFINITION_NOT_FOUND");
    if (!factor.compileEligible) return fail("FACTOR_DEFINITION_NOT_COMPILE_ELIGIBLE");
    if (!factor.definition.subjectTypes.includes(subject.subject.type)) return fail("FACTOR_SUBJECT_NOT_ALLOWED");
    if (!unitAllowed(factor.definition, attestation.observation.unit)) return fail("FACTOR_UNIT_NOT_ALLOWED");
    const freshness = projectFreshness(factor.definition.freshness, execution.asOf, attestation.observation.observedAt);
    if (!freshness.ok) return fail(freshness.code);
    const value: ResolvedExecutionInput = {
      rulebook: { ...execution.rulebook }, binding: cloneBinding(binding), resolvedSubject: { ...subject.subject },
      selectedObservation: structuredClone(attestation.observation), freshness: structuredClone(freshness.value),
      input: {
        factor: { ...binding.factor }, subject: { ...subject.subject },
        value: { type: "NUMBER", value: attestation.observation.value, unit: attestation.observation.unit },
        observedAt: new Date(attestation.observation.observedAt.getTime()), evaluatedAt: new Date(execution.asOf.getTime()),
        confidence: attestation.observation.confidence, freshness: structuredClone(freshness.value),
        providerAttestation: { ...attestation.observation.providerAttestation },
      },
      lineage: { factor: { ...binding.factor }, evaluator: { ...binding.evaluator }, provider: { ...binding.provider }, executionPolicies: { ...binding.executionPolicies } },
    };
    return Object.freeze({ resolved: true, value: deepFreeze(value) });
  }
}

type Envelope = { valid: true; execution: Record<string, any>; binding: CompiledFactorBinding } | { valid: false; code: any };
const validateEnvelope = (request: unknown): Envelope => {
  if (!record(request) || !record(request.execution) || !record(request.binding)) return { valid: false, code: "INVALID_EXECUTION_REQUEST" };
  const execution = request.execution;
  if (!record(execution.rulebook) || !identifier(execution.rulebook.rulebookId) || !positive(execution.rulebook.rulebookVersion)) return { valid: false, code: "INVALID_RULEBOOK_IDENTITY" };
  if (!(execution.asOf instanceof Date) || !Number.isFinite(execution.asOf.getTime())) return { valid: false, code: "INVALID_EXECUTION_AS_OF" };
  if (!record(execution.subjectContext) || !("tradedInstrument" in execution.subjectContext) || !("underlyingAsset" in execution.subjectContext)) return { valid: false, code: "INVALID_SUBJECT_CONTEXT" };
  if (!Array.isArray(execution.observations) || !dense(execution.observations)) return { valid: false, code: "INVALID_OBSERVATION_COLLECTION" };
  if (execution.observations.length === 0) return { valid: false, code: "EMPTY_OBSERVATION_COLLECTION" };
  if (execution.observations.length > MAX_COMPILED_EXECUTION_OBSERVATIONS) return { valid: false, code: "TOO_MANY_OBSERVATIONS" };
  return { valid: true, execution, binding: request.binding as CompiledFactorBinding };
};
const unitAllowed = (definition: FactorDefinition, unit: string): boolean => {
  if (!definition.valueTypes.includes("NUMBER")) return false;
  if (definition.unit.policy === "FORBIDDEN") return unit.length === 0;
  if (definition.unit.policy === "ALLOW_LIST") return definition.unit.allowedUnits.includes(unit);
  return definition.unit.policy === "OPTIONAL" || unit.length > 0;
};
const projectFreshness = (policy: FactorFreshnessPolicy, asOf: Date, observedAt: Date): { ok: true; value: CompiledInputFreshness } | { ok: false; code: "OBSERVATION_IN_FUTURE" | "STALE_OBSERVATION" | "INVALID_FRESHNESS_POLICY" } => {
  const ageMs = asOf.getTime() - observedAt.getTime();
  if (ageMs < 0) return { ok: false, code: "OBSERVATION_IN_FUTURE" };
  if (policy.kind === "MAX_AGE") {
    if (!Number.isInteger(policy.maxAgeMs) || policy.maxAgeMs <= 0) return { ok: false, code: "INVALID_FRESHNESS_POLICY" };
    return ageMs <= policy.maxAgeMs ? { ok: true, value: { status: "FRESH", ageMs, maxAgeMs: policy.maxAgeMs } } : { ok: false, code: "STALE_OBSERVATION" };
  }
  if (policy.kind === "VALIDITY_INTERVAL" || policy.kind === "NON_EXPIRING") return { ok: true, value: { status: "NOT_APPLICABLE", policy: policy.kind } };
  return { ok: false, code: "INVALID_FRESHNESS_POLICY" };
};
const cloneBinding = (binding: CompiledFactorBinding): CompiledFactorBinding => structuredClone(binding);
const deepFreeze = <T>(value: T): T => { if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value; for (const nested of Object.values(value)) deepFreeze(nested); return Object.freeze(value); };
const fail = (code: Extract<CompiledShadowInputAssemblyResult, { resolved: false }>["code"]): CompiledShadowInputAssemblyResult => Object.freeze({ resolved: false, code });
const record = (value: unknown): value is Record<string, any> => typeof value === "object" && value !== null && !Array.isArray(value);
const identifier = (value: unknown): value is string => typeof value === "string" && /^[A-Z0-9_]{1,120}$/.test(value);
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
const dense = (values: readonly unknown[]): boolean => { for (let index = 0; index < values.length; index += 1) if (!(index in values)) return false; return true; };
