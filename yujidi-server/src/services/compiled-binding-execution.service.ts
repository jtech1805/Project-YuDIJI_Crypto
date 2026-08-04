import type { CompiledEvaluatorImplementationRegistry } from "../registries/compiled-evaluator-implementation.registry.js";
import type { EvaluatorConfigurationRegistry } from "../types/evaluator-configuration-registry.types.js";
import type { VersionedEvaluatorDeclarationRegistry } from "../types/versioned-evaluator-declaration.types.js";
import type { CompiledBindingExecutionFailureCode, CompiledBindingExecutionPreparationRequest, CompiledBindingExecutionResult, CompiledBindingExecutionServiceResult } from "../types/compiled-binding-execution.types.js";
import type { CompiledBindingDisposition, CompiledBindingInputState } from "../types/compiled-rulebook-runtime.types.js";
import type { CompiledFactorBinding, CompiledRulebookIdentity } from "../types/compiled-rulebook.types.js";
import type { CompiledShadowInputAssemblyFailureCode, ResolvedExecutionInput } from "../types/resolved-execution-input.types.js";
import { CompiledBindingDispositionService } from "./compiled-binding-disposition.service.js";
import { CompiledBindingScoreProjectionService } from "./compiled-binding-score-projection.service.js";
import { CompiledEvaluatorRuntimeValidationService } from "./compiled-evaluator-runtime-validation.service.js";

export type CompiledBindingExecutionDependencies = Readonly<{
  evaluatorDeclarations: Pick<VersionedEvaluatorDeclarationRegistry, "getExact">;
  evaluatorConfigurations: Pick<EvaluatorConfigurationRegistry, "getExact">;
  evaluatorImplementations: Pick<CompiledEvaluatorImplementationRegistry, "getExact">;
  dispositions?: CompiledBindingDispositionService;
  scores?: CompiledBindingScoreProjectionService;
  results?: CompiledEvaluatorRuntimeValidationService;
}>;

export class CompiledBindingExecutionService {
  private readonly dispositions; private readonly scores; private readonly results;
  public constructor(private readonly dependencies: CompiledBindingExecutionDependencies) {
    this.dispositions = dependencies.dispositions ?? new CompiledBindingDispositionService();
    this.scores = dependencies.scores ?? new CompiledBindingScoreProjectionService();
    this.results = dependencies.results ?? new CompiledEvaluatorRuntimeValidationService();
  }

  public execute(resolved: ResolvedExecutionInput): CompiledBindingExecutionServiceResult {
    const boundary = validateResolved(resolved);
    if (boundary) return boundary === "INVALID_RESOLVED_EXECUTION_INPUT" ? Object.freeze({ produced: false, code: boundary }) : this.executionFailure(resolved, boundary);
    const binding = resolved.binding;
    const declaration = this.dependencies.evaluatorDeclarations.getExact(binding.evaluator.evaluatorId, binding.evaluator.evaluatorVersion);
    if (!declaration) return this.executionFailure(resolved, "EVALUATOR_DECLARATION_NOT_FOUND");
    if (!declaration.compileEligible) return this.executionFailure(resolved, "EVALUATOR_DECLARATION_NOT_COMPILE_ELIGIBLE");
    if (!declaration.supportedFactorKeys.includes(binding.factor.factorKey)) return this.executionFailure(resolved, "EVALUATOR_FACTOR_NOT_SUPPORTED");
    if ((binding.relationshipType !== "DIRECT" && binding.relationshipType !== "INVERSE") || !declaration.supportedRelationshipTypes.includes(binding.relationshipType)) return this.executionFailure(resolved, "EVALUATOR_RELATIONSHIP_NOT_SUPPORTED");
    const configuration = this.dependencies.evaluatorConfigurations.getExact(binding.evaluator.configurationId, binding.evaluator.configurationVersion);
    if (!configuration) return this.executionFailure(resolved, "EVALUATOR_CONFIGURATION_NOT_FOUND");
    if (!configuration.compileEligible) return this.executionFailure(resolved, "EVALUATOR_CONFIGURATION_NOT_COMPILE_ELIGIBLE");
    if (configuration.evaluatorId !== binding.evaluator.evaluatorId || configuration.evaluatorVersion !== binding.evaluator.evaluatorVersion) return this.executionFailure(resolved, "EVALUATOR_CONFIGURATION_LINEAGE_MISMATCH");
    if (!configuration.supportedFactorKeys.includes(binding.factor.factorKey)) return this.executionFailure(resolved, "EVALUATOR_CONFIGURATION_FACTOR_NOT_SUPPORTED");
    if (!configuration.supportedRelationshipTypes.includes(binding.relationshipType)) return this.executionFailure(resolved, "EVALUATOR_CONFIGURATION_RELATIONSHIP_NOT_SUPPORTED");
    if (configuration.configuration.relationshipType !== binding.relationshipType) return this.executionFailure(resolved, "EVALUATOR_CONFIGURATION_RELATIONSHIP_MISMATCH");
    const implementation = this.dependencies.evaluatorImplementations.getExact(declaration.implementationKey, binding.evaluator.evaluatorVersion);
    if (!implementation) return this.executionFailure(resolved, "EVALUATOR_IMPLEMENTATION_NOT_FOUND");
    if (implementation.implementationKey !== declaration.implementationKey || implementation.evaluatorId !== binding.evaluator.evaluatorId || implementation.evaluatorVersion !== binding.evaluator.evaluatorVersion) return this.executionFailure(resolved, "EVALUATOR_IMPLEMENTATION_IDENTITY_MISMATCH");
    let execution;
    try { execution = implementation.evaluate({ input: resolved.input, configuration, relationshipType: binding.relationshipType }); }
    catch { return this.executionFailure(resolved, "EVALUATOR_EXECUTION_FAILED"); }
    if (!execution.evaluated) return this.executionFailure(resolved, "EVALUATOR_EXECUTION_FAILED");
    const validation = this.results.validateResult(resolved, implementation, execution.result);
    if (!validation.valid) return this.executionFailure(resolved, validation.code);
    const score = this.scores.project(validation.result);
    if (!score.projected) return this.executionFailure(resolved, score.code);
    const disposition = this.dispositions.derive(binding, "AVAILABLE");
    if (!disposition.derived || disposition.disposition !== "INCLUDED") return this.executionFailure(resolved, "INVALID_BINDING_DISPOSITION");
    return Object.freeze({ produced: true, result: createResult(resolved.rulebook, binding, {
      resolved, inputState: "AVAILABLE", disposition: "INCLUDED", executionStatus: "EXECUTED",
      rawEvaluatorResult: validation.result, bindingScore: score.score, preparationFailureCode: null, attestationFailureCode: null, executionFailureCode: null,
    }) });
  }

  public fromPreparation(request: CompiledBindingExecutionPreparationRequest): CompiledBindingExecutionServiceResult {
    if (request.preparation.resolved) {
      if (!sameBinding(request.binding, request.preparation.value.binding) || !sameRulebook(request.rulebook, request.preparation.value.rulebook)) return this.executionFailure(request.preparation.value, "RESOLVED_BINDING_LINEAGE_MISMATCH");
      return this.execute(request.preparation.value);
    }
    const inputState = preparationState(request.preparation.code);
    const derived = this.dispositions.derive(request.binding, inputState);
    if (!derived.derived) return Object.freeze({ produced: false, code: "INVALID_RESOLVED_EXECUTION_INPUT" });
    return Object.freeze({ produced: true, result: createResult(request.rulebook, request.binding, {
      resolved: null, inputState, disposition: derived.disposition, executionStatus: "NOT_EXECUTED", rawEvaluatorResult: null, bindingScore: null,
      preparationFailureCode: request.preparation.code, attestationFailureCode: request.preparation.attestationCode ?? null, executionFailureCode: null,
    }) });
  }

  private executionFailure(resolved: ResolvedExecutionInput, code: CompiledBindingExecutionFailureCode): CompiledBindingExecutionServiceResult {
    const derived = this.dispositions.derive(resolved.binding, "INVALID");
    if (!derived.derived) return Object.freeze({ produced: false, code: "INVALID_RESOLVED_EXECUTION_INPUT" });
    return Object.freeze({ produced: true, result: createResult(resolved.rulebook, resolved.binding, {
      resolved, inputState: "INVALID", disposition: derived.disposition, executionStatus: "NOT_EXECUTED", rawEvaluatorResult: null,
      bindingScore: null, preparationFailureCode: null, attestationFailureCode: null, executionFailureCode: code,
    }) });
  }
}

type ResultParts = { resolved: ResolvedExecutionInput | null; inputState: CompiledBindingInputState; disposition: CompiledBindingDisposition; executionStatus: "EXECUTED" | "NOT_EXECUTED";
  rawEvaluatorResult: any; bindingScore: number | null; preparationFailureCode: CompiledShadowInputAssemblyFailureCode | null; attestationFailureCode: any; executionFailureCode: CompiledBindingExecutionFailureCode | null };
const createResult = (rulebook: CompiledRulebookIdentity, binding: CompiledFactorBinding, parts: ResultParts): CompiledBindingExecutionResult => deepFreeze({
  rulebook: { ...rulebook }, bindingId: binding.bindingId, bindingOrder: binding.order, binding: structuredClone(binding),
  lineage: { factor: { ...binding.factor }, evaluator: { ...binding.evaluator }, provider: { ...binding.provider }, executionPolicies: { ...binding.executionPolicies } },
  resolvedSubject: parts.resolved ? { ...parts.resolved.resolvedSubject } : null,
  providerAttestation: parts.resolved ? { ...parts.resolved.input.providerAttestation } : null,
  relationshipType: binding.relationshipType, requirementLevel: binding.requirementLevel, optionalBehavior: binding.optionalBehavior, weight: binding.weight,
  inputState: parts.inputState, disposition: parts.disposition, executionStatus: parts.executionStatus,
  confidence: parts.resolved?.input.confidence ?? null, freshness: parts.resolved ? structuredClone(parts.resolved.input.freshness) : null,
  observedAt: parts.resolved ? new Date(parts.resolved.input.observedAt.getTime()) : null,
  evaluatedAt: parts.resolved ? new Date(parts.resolved.input.evaluatedAt.getTime()) : null,
  rawEvaluatorResult: parts.rawEvaluatorResult ? structuredClone(parts.rawEvaluatorResult) : null, bindingScore: parts.bindingScore,
  preparationFailureCode: parts.preparationFailureCode, attestationFailureCode: parts.attestationFailureCode, executionFailureCode: parts.executionFailureCode,
});
const validateResolved = (value: unknown): CompiledBindingExecutionFailureCode | null => {
  if (!record(value) || !record(value.rulebook) || !record(value.binding) || !record(value.input) || !record(value.lineage)
    || !record(value.resolvedSubject) || !record(value.selectedObservation)) return "INVALID_RESOLVED_EXECUTION_INPUT";
  if (!identifier(value.rulebook.rulebookId) || !positive(value.rulebook.rulebookVersion)) return "RESOLVED_RULEBOOK_LINEAGE_MISMATCH";
  const binding = value.binding;
  if (value.lineage.factor.factorKey !== binding.factor?.factorKey || value.lineage.factor.factorVersion !== binding.factor?.factorVersion
    || value.lineage.evaluator.evaluatorId !== binding.evaluator?.evaluatorId || value.lineage.evaluator.evaluatorVersion !== binding.evaluator?.evaluatorVersion
    || value.lineage.evaluator.configurationId !== binding.evaluator?.configurationId || value.lineage.evaluator.configurationVersion !== binding.evaluator?.configurationVersion
    || JSON.stringify(value.lineage.provider) !== JSON.stringify(binding.provider) || JSON.stringify(value.lineage.executionPolicies) !== JSON.stringify(binding.executionPolicies)) return "RESOLVED_BINDING_LINEAGE_MISMATCH";
  if (value.input.factor.factorKey !== binding.factor.factorKey || value.input.factor.factorVersion !== binding.factor.factorVersion
    || value.input.subject.type !== value.resolvedSubject.type || value.input.subject.key !== value.resolvedSubject.key
    || value.selectedObservation.factor.factorKey !== value.input.factor.factorKey || value.selectedObservation.factor.factorVersion !== value.input.factor.factorVersion
    || value.selectedObservation.subject.type !== value.input.subject.type || value.selectedObservation.subject.key !== value.input.subject.key
    || value.selectedObservation.observedAt.getTime() !== value.input.observedAt.getTime()) return "RESOLVED_FACTOR_INPUT_MISMATCH";
  if (JSON.stringify(value.input.providerAttestation) !== JSON.stringify(value.selectedObservation.providerAttestation)
    || value.input.providerAttestation.providerBindingId !== binding.provider.providerBindingId
    || value.input.providerAttestation.providerBindingVersion !== binding.provider.providerBindingVersion
    || value.input.providerAttestation.resolutionPolicyId !== binding.provider.resolutionPolicyId
    || value.input.providerAttestation.resolutionPolicyVersion !== binding.provider.resolutionPolicyVersion) return "RESOLVED_PROVIDER_ATTESTATION_MISMATCH";
  return null;
};
const preparationState = (code: CompiledShadowInputAssemblyFailureCode): CompiledBindingInputState => ["MISSING_TRADED_INSTRUMENT", "MISSING_UNDERLYING_ASSET", "OBSERVATION_NOT_FOUND", "STALE_OBSERVATION"].includes(code) ? "MISSING" : "INVALID";
const sameRulebook = (a: CompiledRulebookIdentity, b: CompiledRulebookIdentity) => a.rulebookId === b.rulebookId && a.rulebookVersion === b.rulebookVersion;
const sameBinding = (a: CompiledFactorBinding, b: CompiledFactorBinding) => JSON.stringify(a) === JSON.stringify(b);
const deepFreeze = <T>(value: T): T => { if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value; for (const nested of Object.values(value)) deepFreeze(nested); return Object.freeze(value); };
const record = (value: unknown): value is Record<string, any> => typeof value === "object" && value !== null && !Array.isArray(value);
const identifier = (value: unknown): value is string => typeof value === "string" && /^[A-Z0-9_]{1,120}$/.test(value);
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;

